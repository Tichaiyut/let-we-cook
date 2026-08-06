const SESSION_COOKIE = "lwc_session";
const SESSION_SECONDS = 60 * 60 * 12;

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
    if (!env.SITE_PASSWORD || !env.SESSION_SECRET) return json({ error: "Site password is not configured" }, 503);
    const body = await request.json().catch(() => ({}));
    if (String(body.password || "") !== String(env.SITE_PASSWORD)) return json({ error: "รหัสผ่านไม่ถูกต้อง" }, 401);
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
