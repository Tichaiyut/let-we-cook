const SESSION_COOKIE = "lwc_session";
const SESSION_SECONDS = 60 * 60 * 2;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_SECONDS = 60 * 60 * 2;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function bytesToBase64Url(bytes) {
  let value = "";
  bytes.forEach(byte => { value += String.fromCharCode(byte); });
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function loginClientKey(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown-ip";
  const agent = (request.headers.get("user-agent") || "unknown-agent").slice(0, 180);
  return sign(`${ip}|${agent}`, env.SESSION_SECRET);
}

async function readLoginAttempt(env, clientKey) {
  return env.DB.prepare(
    "SELECT failure_count, window_started_at, locked_until FROM login_attempts WHERE client_key = ?",
  ).bind(clientKey).first();
}

async function recordLoginFailure(env, clientKey, now) {
  const current = await readLoginAttempt(env, clientKey);
  const windowExpired = !current || now - Number(current.window_started_at) >= LOGIN_LOCK_SECONDS;
  const failureCount = windowExpired ? 1 : Number(current.failure_count) + 1;
  const windowStartedAt = windowExpired ? now : Number(current.window_started_at);
  const lockedUntil = failureCount >= MAX_LOGIN_FAILURES ? now + LOGIN_LOCK_SECONDS : 0;
  await env.DB.prepare(
    `INSERT INTO login_attempts (client_key, failure_count, window_started_at, locked_until, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(client_key) DO UPDATE SET
       failure_count = excluded.failure_count,
       window_started_at = excluded.window_started_at,
       locked_until = excluded.locked_until,
       updated_at = excluded.updated_at`,
  ).bind(clientKey, failureCount, windowStartedAt, lockedUntil, now).run();
  return { failureCount, lockedUntil };
}

async function clearLoginFailures(env, clientKey) {
  await env.DB.prepare("DELETE FROM login_attempts WHERE client_key = ?").bind(clientKey).run();
}

async function makeSession(secret) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const value = String(expires);
  return `${value}.${await sign(value, secret)}`;
}

async function hasSession(request, env) {
  if (!env.SESSION_SECRET) return false;
  const token = getCookie(request, SESSION_COOKIE);
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  return signature === await sign(expires, env.SESSION_SECRET);
}

async function handleApi(request, env, url) {
  if (url.pathname === "/api/session" && request.method === "GET") {
    return json({ authenticated: await hasSession(request, env) });
  }

  if (url.pathname === "/api/login" && request.method === "POST") {
    if (!env.SITE_PASSWORD_HASH || !env.SESSION_SECRET || !env.DB) return json({ error: "Site security is not configured" }, 503);
    const now = Math.floor(Date.now() / 1000);
    const clientKey = await loginClientKey(request, env);
    const attempt = await readLoginAttempt(env, clientKey);
    if (attempt && Number(attempt.locked_until) > now) {
      const retryAfter = Number(attempt.locked_until) - now;
      return json({ error: "กรอกรหัสผิดครบ 5 ครั้ง กรุณารอ 2 ชั่วโมง", locked: true, retryAfter }, 429, { "retry-after": String(retryAfter) });
    }
    const body = await request.json().catch(() => ({}));
    if (await sha256(String(body.password || "")) !== String(env.SITE_PASSWORD_HASH)) {
      const failure = await recordLoginFailure(env, clientKey, now);
      const remaining = Math.max(0, MAX_LOGIN_FAILURES - failure.failureCount);
      if (failure.lockedUntil > now) {
        return json({ error: "กรอกรหัสผิดครบ 5 ครั้ง ระบบล็อกไว้ 2 ชั่วโมง", locked: true, retryAfter: LOGIN_LOCK_SECONDS }, 429, { "retry-after": String(LOGIN_LOCK_SECONDS) });
      }
      return json({ error: `รหัสผ่านไม่ถูกต้อง เหลือลองได้อีก ${remaining} ครั้ง`, remaining }, 401);
    }
    await clearLoginFailures(env, clientKey);
    const token = await makeSession(env.SESSION_SECRET);
    return json({ authenticated: true }, 200, {
      "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`,
    });
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    return json({ authenticated: false }, 200, {
      "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    });
  }

  if (!["/api/data", "/api/action"].includes(url.pathname)) return json({ error: "Not found" }, 404);
  if (!(await hasSession(request, env))) return json({ error: "Authentication required" }, 401);
  if (!env.SHEET_API_URL || !env.SHEET_API_SECRET) return json({ error: "Google Sheet API is not configured" }, 503);

  try {
    let response;
    if (url.pathname === "/api/data" && request.method === "GET") {
      const endpoint = new URL(env.SHEET_API_URL);
      endpoint.searchParams.set("secret", env.SHEET_API_SECRET);
      response = await fetch(endpoint.toString(), { redirect: "follow" });
    } else if (url.pathname === "/api/action" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      response = await fetch(env.SHEET_API_URL, {
        method: "POST",
        redirect: "follow",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, secret: env.SHEET_API_SECRET }),
      });
    } else {
      return json({ error: "Method not allowed" }, 405);
    }

    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { ok: false, error: "Invalid response from Google Sheet API" }; }
    return json(payload, response.ok && payload.ok !== false ? 200 : 502);
  } catch (error) {
    return json({ error: "Unable to connect to Google Sheet", detail: error.message }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
