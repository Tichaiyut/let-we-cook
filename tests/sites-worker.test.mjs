import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";

function passwordHash(value) {
  return createHash("sha256").update(value).digest("base64url");
}

function createLoginDb() {
  const rows = new Map();
  return {
    prepare(sql) {
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        async first() {
          if (!sql.includes("FROM login_attempts")) return null;
          return rows.get(args[0]) || null;
        },
        async run() {
          if (sql.startsWith("INSERT INTO login_attempts")) {
            rows.set(args[0], { failure_count: args[1], window_started_at: args[2], locked_until: args[3], updated_at: args[4] });
          } else if (sql.startsWith("DELETE FROM login_attempts")) {
            rows.delete(args[0]);
          }
          return { success: true };
        },
      };
      return statement;
    },
  };
}

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("does not turn missing API or write requests into the app shell", async () => {
  let calls = 0;
  const env = { ASSETS: { fetch: async () => { calls += 1; return new Response("missing", { status: 404 }); } } };
  const apiResponse = await worker.fetch(new Request("https://example.test/api/missing"), env);
  assert.equal(apiResponse.status, 404);
  assert.equal(calls, 0);

  const writeResponse = await worker.fetch(new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }), env);
  assert.equal(writeResponse.status, 404);
  assert.equal(calls, 1);
});

test("protects data APIs with the shared-password session", async () => {
  const env = {
    SITE_PASSWORD_HASH: passwordHash("team-pass"),
    SESSION_SECRET: "session-secret-for-tests",
    DB: createLoginDb(),
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
  };
  const unauthenticated = await worker.fetch(new Request("https://example.test/api/data"), env);
  assert.equal(unauthenticated.status, 401);

  const login = await worker.fetch(new Request("https://example.test/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "team-pass" }),
  }), env);
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /^lwc_session=/);
  assert.match(login.headers.get("set-cookie"), /Max-Age=7200/);
});

test("locks a client for two hours after five wrong passwords", async () => {
  const env = {
    SITE_PASSWORD_HASH: passwordHash("team-pass"),
    SESSION_SECRET: "session-secret-for-tests",
    DB: createLoginDb(),
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
  };
  const makeLogin = (password) => new Request("https://example.test/api/login", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10", "user-agent": "test-browser" },
    body: JSON.stringify({ password }),
  });

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await worker.fetch(makeLogin("wrong"), env);
    assert.equal(response.status, 401);
  }
  const fifth = await worker.fetch(makeLogin("wrong"), env);
  assert.equal(fifth.status, 429);
  assert.equal(fifth.headers.get("retry-after"), "7200");

  const correctWhileLocked = await worker.fetch(makeLogin("team-pass"), env);
  assert.equal(correctWhileLocked.status, 429);
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});
