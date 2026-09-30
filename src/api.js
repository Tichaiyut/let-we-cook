import { API_URL } from "./config.js";
import { createSampleKitchen } from "./sampleKitchen.js";

const SESSION_KEY = "lwc:session";
const CLIENT_KEY = "lwc:client-id";

// live         → talks to the Google Apps Script in config.js
// sample       → `npm run dev` without VITE_USE_LIVE_API=true: in-browser demo data
// unconfigured → a production build whose API_URL has not been filled in yet
const useLive = Boolean(API_URL) && !(import.meta.env.DEV && import.meta.env.VITE_USE_LIVE_API !== "true");
export const MODE = useLive ? "live" : import.meta.env.DEV ? "sample" : "unconfigured";

export class ApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ApiError";
    this.code = details.code || "";
    this.retryAfter = Number(details.retryAfter || 0);
    this.remaining = details.remaining;
  }

  get isAuth() {
    return this.code === "AUTH";
  }
}

function readJson(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the session simply lasts for this tab.
  }
}

function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing stored, nothing to remove.
  }
}

function clientId() {
  let id = readJson(CLIENT_KEY);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    writeJson(CLIENT_KEY, id);
  }
  return id;
}

function readSession() {
  const session = readJson(SESSION_KEY);
  return session?.token && session.expiresAt > Date.now() ? session : null;
}

// Apps Script only answers CORS for "simple" requests, so everything is a
// text/plain POST (no preflight) and the token travels in the body.
async function call(action, body = {}) {
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...body, action, token: readSession()?.token || "" }),
      redirect: "follow",
    });
  } catch {
    throw new ApiError("เชื่อมต่อครัวไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new ApiError(`ครัวตอบกลับผิดปกติ (HTTP ${response.status})`);
  if (result.ok === false) {
    if (result.code === "AUTH") removeKey(SESSION_KEY);
    throw new ApiError(result.error || "ทำรายการไม่สำเร็จ", result);
  }
  return result;
}

const liveKitchen = {
  async login(password) {
    const result = await call("login", { password, clientId: clientId() });
    writeJson(SESSION_KEY, { token: result.token, expiresAt: result.expiresAt });
    return result;
  },
  bootstrap: () => call("bootstrap"),
  getDailyPlan: (planDate, personId) => call("getDailyPlan", { payload: { planDate, personId } }),
  saveDailyPlan: (planDate, personId, entries, actor) => call("saveDailyPlan", { actor, payload: { planDate, personId, entries } }),
  createTask: (payload, actor) => call("createTask", { actor, payload }),
  updateStatus: (id, status, actor) => call("updateStatus", { actor, payload: { id, status } }),
};

export const api = {
  mode: MODE,
  hasSession: () => MODE === "sample" || Boolean(readSession()),
  logout: () => removeKey(SESSION_KEY),
  ...(MODE === "sample" ? createSampleKitchen(ApiError) : liveKitchen),
};
