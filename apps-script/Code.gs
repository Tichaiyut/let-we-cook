/**
 * Let We Cook · Google Apps Script API
 *
 * Bound to the "Let We Cook - Task Database" Google Sheet (Extensions → Apps Script).
 * Setup and deployment steps are in README.md of the let-we-cook repository.
 *
 * Nothing secret lives in this file: the team password, every chef's PIN
 * (salted hashes) and the key that signs sessions are stored in Script Properties.
 */

const API_VERSION = "2.2";
const TIMEZONE = "Asia/Bangkok";
const SHEETS = {
  PEOPLE: "People",
  EPICS: "Epics",
  STORIES: "Stories",
  ITEMS: "Work Items",
  ASSIGNEES: "Task Assignees",
  PLANS: "Daily Plans",
  ACTIVITY: "Activity Log",
};
const STATUSES = ["Backlog", "To Do", "In Progress", "Done"];
const MAX_ASSIGNEES = 4;
const MAX_PLAN_ENTRIES = 50;
const DELETE_COLUMNS = ["Deleted", "DeletedAt", "DeletedBy"];
const TEAM = "team";

const SESSION_SECONDS = 2 * 60 * 60;
const MAX_FAILURES = 5;
const LOCK_SECONDS = 2 * 60 * 60;
const GLOBAL_MAX_FAILURES = 20;
const GLOBAL_WINDOW_SECONDS = 10 * 60;
const GLOBAL_PAUSE_SECONDS = 15 * 60;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_ROUNDS = 500;
const WEAK_PINS = ["1234", "2345", "3456", "4567", "5678", "6789", "0123", "9876", "8765", "7654", "6543", "5432", "4321", "3210", "1212", "2580"];

// ---------------------------------------------------------------------------
// Sheet menu: setup for the sheet owner
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🍳 Let We Cook")
    .addItem("1) ตั้งค่าเริ่มต้น", "setupLetWeCook")
    .addItem("2) ตั้ง / เปลี่ยนรหัสผ่านทีม", "setTeamPassword")
    .addItem("3) รีเซ็ต PIN ของเชฟ", "resetChefPin")
    .addSeparator()
    .addItem("ตรวจสถานะระบบ", "showSetupStatus")
    .addToUi();
}

function setupLetWeCook() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const missing = Object.values(SHEETS).filter(name => !spreadsheet.getSheetByName(name));
  if (missing.length) throw new Error("ไม่พบแท็บ: " + missing.join(", "));
  const props = PropertiesService.getScriptProperties();
  props.setProperty("SPREADSHEET_ID", spreadsheet.getId());
  if (!props.getProperty("TOKEN_SECRET")) props.setProperty("TOKEN_SECRET", randomSecret_());
  props.deleteProperty("API_SHARED_SECRET");
  ensureColumns_(spreadsheet.getSheetByName(SHEETS.ITEMS), DELETE_COLUMNS);
  return notify_("ตั้งค่าเรียบร้อย ✅\n\nขั้นต่อไป: เมนู 🍳 Let We Cook → 2) ตั้ง / เปลี่ยนรหัสผ่านทีม");
}

function setTeamPassword() {
  const ui = SpreadsheetApp.getUi();
  const first = ui.prompt(
    "ตั้งรหัสผ่านทีม",
    "อย่างน้อย " + PASSWORD_MIN_LENGTH + " ตัวอักษร · ใช้เข้าเว็บแบบสำรอง และใช้ตอนเชฟตั้ง PIN ครั้งแรก",
    ui.ButtonSet.OK_CANCEL
  );
  if (first.getSelectedButton() !== ui.Button.OK) return;
  const password = first.getResponseText();
  if (password.length < PASSWORD_MIN_LENGTH) {
    ui.alert("รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย " + PASSWORD_MIN_LENGTH + " ตัวอักษร");
    return;
  }
  const second = ui.prompt("ยืนยันรหัสผ่านทีม", "พิมพ์รหัสผ่านเดิมอีกครั้ง", ui.ButtonSet.OK_CANCEL);
  if (second.getSelectedButton() !== ui.Button.OK) return;
  if (second.getResponseText() !== password) {
    ui.alert("รหัสผ่านสองช่องไม่ตรงกัน ลองใหม่อีกครั้ง");
    return;
  }
  storePassword_(password);
  ui.alert("บันทึกรหัสผ่านทีมแล้ว ✅\nใครที่ล็อกอินค้างอยู่จะต้องเข้าสู่ระบบใหม่");
}

function resetChefPin() {
  const ui = SpreadsheetApp.getUi();
  const ids = rows_(SHEETS.PEOPLE).map(row => String(row.PersonID)).filter(Boolean);
  const answer = ui.prompt("รีเซ็ต PIN ของเชฟ", "พิมพ์ PersonID ของคนที่ลืม PIN: " + ids.join(", "), ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  const personId = answer.getResponseText().trim().toLowerCase();
  if (ids.indexOf(personId) === -1) {
    ui.alert("ไม่พบ PersonID: " + personId);
    return;
  }
  clearPin_(personId);
  ui.alert("รีเซ็ต PIN ของ " + personId + " แล้ว ✅\nให้เจ้าตัวเข้าเว็บ เลือกชื่อ แล้วตั้ง PIN ใหม่ด้วยรหัสทีม");
}

function showSetupStatus() {
  const props = PropertiesService.getScriptProperties();
  const chefs = rows_(SHEETS.PEOPLE).filter(row => isTrue_(row.Active))
    .map(row => "   " + row.PersonID + ": " + (props.getProperty(pinKey_(row.PersonID, "HASH")) ? "✅ ตั้ง PIN แล้ว" : "⏳ ยังไม่ได้ตั้ง PIN"));
  return notify_([
    "Spreadsheet: " + (props.getProperty("SPREADSHEET_ID") ? "✅" : "❌ ยังไม่ได้รัน 1) ตั้งค่าเริ่มต้น"),
    "รหัสผ่านทีม: " + (props.getProperty("PASSWORD_HASH") ? "✅" : "❌ ยังไม่ได้ตั้ง"),
    "Session key: " + (props.getProperty("TOKEN_SECRET") ? "✅" : "❌"),
    "PIN ของเชฟ:",
  ].concat(chefs, ["API version: " + API_VERSION]).join("\n"));
}

function storePassword_(password) {
  const salt = randomSecret_();
  PropertiesService.getScriptProperties().setProperties({
    PASSWORD_SALT: salt,
    PASSWORD_HASH: hashPassword_(password, salt),
    TOKEN_SECRET: randomSecret_(), // a new signing key signs everyone out
  });
}

function notify_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    Logger.log(message);
  }
  return message;
}

// ---------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------

function doGet() {
  return json_({ ok: true, service: "Let We Cook API", version: API_VERSION });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (error) {
    return json_({ ok: false, error: "Invalid request" });
  }
  try {
    return json_(route_(body));
  } catch (error) {
    return json_({ ok: false, error: error.message || "Unexpected error" });
  }
}

function route_(body) {
  const action = String(body.action || "");
  if (action === "roster") return { ok: true, chefs: roster_() };
  if (action === "login") return teamLogin_(body.password, body.clientId);
  if (action === "chefLogin") return chefLogin_(body.personId, body.pin);
  if (action === "setupPin") return setupPin_(body.personId, body.teamPassword, body.pin, body.clientId);

  const session = verifyToken_(body.token);
  if (!session) return { ok: false, code: "AUTH", error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  const payload = body.payload || {};
  const actor = session.who; // who did it always comes from the signed session
  if (action === "session") return { ok: true, authenticated: true, me: me_(actor) };
  if (action === "changePin") return changePin_(session, body.currentPin, body.newPin);
  if (action === "bootstrap") return Object.assign({ ok: true, me: me_(actor) }, buildBootstrap_());
  if (action === "getDailyPlan") return { ok: true, entries: getDailyPlan_(payload) };
  if (action === "saveDailyPlan") return { ok: true, saved: saveDailyPlan_(payload, actor) };
  if (action === "createTask") return Object.assign({ ok: true }, createTask_(payload, actor));
  if (action === "updateStatus") return { ok: true, task: updateStatus_(payload, actor) };
  if (action === "updateTask") return Object.assign({ ok: true }, updateTask_(payload, actor));
  if (action === "deleteTask") return { ok: true, task: deleteTask_(payload, actor) };
  if (action === "restoreTask") return { ok: true, task: restoreTask_(payload, actor) };
  return { ok: false, error: "Unknown action" };
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Identities: every chef logs in with their own 4-digit PIN; the team
// password is a backup entrance that acts as "team".
//
// Apps Script cannot see the visitor's IP, so brute force is limited by:
// - per chef: 5 wrong PINs from anywhere → that chef is locked for 2 hours
// - per browser (random clientId): 5 wrong team passwords → locked for 2 hours
// - whole site: 20 wrong attempts within 10 minutes → all logins paused 15 minutes
// ---------------------------------------------------------------------------

function pinKey_(personId, part) {
  return "PIN_" + part + "_" + String(personId).toLowerCase();
}

function activeChef_(personId) {
  const id = String(personId || "").trim().toLowerCase();
  const row = rows_(SHEETS.PEOPLE).find(item => String(item.PersonID).toLowerCase() === id && isTrue_(item.Active));
  if (!row) throw new Error("ไม่พบเชฟคนนี้ในทีม");
  return { id: id, name: String(row.DisplayName || row.PersonID) };
}

function me_(who) {
  if (who === TEAM) return { kind: "team", id: TEAM, name: "Team" };
  const row = rows_(SHEETS.PEOPLE).find(item => String(item.PersonID).toLowerCase() === who) || {};
  return { kind: "chef", id: who, name: String(row.DisplayName || who) };
}

function roster_() {
  const props = PropertiesService.getScriptProperties();
  return rows_(SHEETS.PEOPLE).filter(row => isTrue_(row.Active)).map(row => ({
    id: String(row.PersonID).toLowerCase(),
    name: String(row.DisplayName || row.PersonID),
    characterName: String(row.CharacterName || ""),
    hasPin: Boolean(props.getProperty(pinKey_(row.PersonID, "HASH"))),
  }));
}

function validPin_(pin) {
  const value = String(pin || "");
  if (!/^\d{4}$/.test(value)) throw new Error("PIN ต้องเป็นตัวเลข 4 หลัก");
  if (/^(\d)\1{3}$/.test(value) || WEAK_PINS.indexOf(value) !== -1) throw new Error("PIN นี้เดาง่ายเกินไป ลองตัวเลขอื่น");
  return value;
}

function storePin_(personId, pin) {
  const salt = randomSecret_();
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    [pinKey_(personId, "SALT")]: salt,
    [pinKey_(personId, "HASH")]: hashPassword_(pin, salt),
    [pinKey_(personId, "VER")]: String(Number(props.getProperty(pinKey_(personId, "VER")) || 0) + 1),
  });
}

function clearPin_(personId) {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(pinKey_(personId, "SALT"));
  props.deleteProperty(pinKey_(personId, "HASH"));
  props.setProperty(pinKey_(personId, "VER"), String(Number(props.getProperty(pinKey_(personId, "VER")) || 0) + 1));
  CacheService.getScriptCache().remove("login:chef:" + String(personId).toLowerCase());
}

function pinMatches_(personId, pin) {
  const props = PropertiesService.getScriptProperties();
  const hash = props.getProperty(pinKey_(personId, "HASH"));
  const salt = props.getProperty(pinKey_(personId, "SALT"));
  return Boolean(hash && salt) && safeEqual_(hashPassword_(String(pin || ""), salt), hash);
}

function teamPasswordMatches_(password) {
  const props = PropertiesService.getScriptProperties();
  const hash = props.getProperty("PASSWORD_HASH");
  const salt = props.getProperty("PASSWORD_SALT");
  return safeEqual_(hashPassword_(String(password || ""), salt), hash);
}

function teamPasswordReady_() {
  const props = PropertiesService.getScriptProperties();
  return Boolean(props.getProperty("PASSWORD_HASH") && props.getProperty("PASSWORD_SALT") && props.getProperty("TOKEN_SECRET"));
}

function notConfigured_() {
  return { ok: false, code: "NOT_CONFIGURED", error: "ยังไม่ได้ตั้งรหัสผ่านทีม เจ้าของชีทต้องตั้งจากเมนู 🍳 Let We Cook ก่อน" };
}

// Runs one login attempt against a lock key. `check` returns true when the
// secret is right; `onSuccess` builds the response.
function guardedAttempt_(lockKey, lockMessage, check, onSuccess) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();
    const now = nowSeconds_();
    const pausedUntil = Number(cache.get("login:pause") || 0);
    if (pausedUntil > now) {
      return lockedResponse_("PAUSED", pausedUntil - now, "มีการใส่รหัสผิดหลายครั้ง ระบบพักการเข้าสู่ระบบชั่วคราว");
    }
    const state = readCacheJson_(cache, lockKey) || { failures: 0, lockedUntil: 0 };
    if (state.lockedUntil > now) return lockedResponse_("LOCKED", state.lockedUntil - now, lockMessage);

    if (check()) {
      cache.remove(lockKey);
      return onSuccess();
    }

    state.failures += 1;
    if (state.failures >= MAX_FAILURES) state.lockedUntil = now + LOCK_SECONDS;
    cache.put(lockKey, JSON.stringify(state), LOCK_SECONDS);

    const previous = readCacheJson_(cache, "login:global");
    const windowState = previous && now - previous.startedAt < GLOBAL_WINDOW_SECONDS ? previous : { failures: 0, startedAt: now };
    windowState.failures += 1;
    if (windowState.failures >= GLOBAL_MAX_FAILURES) {
      cache.put("login:pause", String(now + GLOBAL_PAUSE_SECONDS), GLOBAL_PAUSE_SECONDS);
      cache.remove("login:global");
    } else {
      cache.put("login:global", JSON.stringify(windowState), GLOBAL_WINDOW_SECONDS);
    }

    if (state.lockedUntil > now) return lockedResponse_("LOCKED", LOCK_SECONDS, lockMessage);
    const remaining = MAX_FAILURES - state.failures;
    return { ok: false, code: "WRONG_PASSWORD", remaining: remaining, error: "รหัสไม่ถูกต้อง เหลือโอกาสอีก " + remaining + " ครั้ง" };
  } finally {
    lock.releaseLock();
  }
}

function clientKey_(rawClientId) {
  return "login:client:" + String(rawClientId || "unknown").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
}

function sessionResponse_(who) {
  return Object.assign({ ok: true, me: me_(who) }, issueToken_(who));
}

function teamLogin_(password, clientId) {
  if (!teamPasswordReady_()) return notConfigured_();
  return guardedAttempt_(
    clientKey_(clientId),
    "ใส่รหัสทีมผิดครบ " + MAX_FAILURES + " ครั้ง เบราว์เซอร์นี้ถูกล็อก 2 ชั่วโมง",
    () => teamPasswordMatches_(password),
    () => sessionResponse_(TEAM)
  );
}

function chefLogin_(personId, pin) {
  if (!teamPasswordReady_()) return notConfigured_();
  const chef = activeChef_(personId);
  if (!PropertiesService.getScriptProperties().getProperty(pinKey_(chef.id, "HASH"))) {
    return { ok: false, code: "PIN_NOT_SET", error: chef.name + " ยังไม่ได้ตั้ง PIN" };
  }
  return guardedAttempt_(
    "login:chef:" + chef.id,
    "PIN ของ " + chef.name + " ผิดครบ " + MAX_FAILURES + " ครั้ง ชื่อนี้ถูกล็อก 2 ชั่วโมง (เข้าด้วยรหัสทีมได้)",
    () => pinMatches_(chef.id, pin),
    () => sessionResponse_(chef.id)
  );
}

// First visit: a chef proves they are on the team with the team password,
// then chooses their own PIN and is signed in straight away.
function setupPin_(personId, teamPassword, pin, clientId) {
  if (!teamPasswordReady_()) return notConfigured_();
  const chef = activeChef_(personId);
  if (PropertiesService.getScriptProperties().getProperty(pinKey_(chef.id, "HASH"))) {
    return { ok: false, code: "PIN_ALREADY_SET", error: chef.name + " ตั้ง PIN ไว้แล้ว ถ้าลืม PIN ให้เจ้าของชีทรีเซ็ตจากเมนู 🍳" };
  }
  const newPin = validPin_(pin);
  return guardedAttempt_(
    clientKey_(clientId),
    "ใส่รหัสทีมผิดครบ " + MAX_FAILURES + " ครั้ง เบราว์เซอร์นี้ถูกล็อก 2 ชั่วโมง",
    () => teamPasswordMatches_(teamPassword),
    () => {
      storePin_(chef.id, newPin);
      log_(chef.id, "", "PIN set", "", chef.id, "first visit");
      return sessionResponse_(chef.id);
    }
  );
}

function changePin_(session, currentPin, newPin) {
  if (session.who === TEAM) throw new Error("เข้าด้วยรหัสทีมอยู่ เปลี่ยน PIN ไม่ได้");
  const pin = validPin_(newPin);
  return guardedAttempt_(
    "login:chef:" + session.who,
    "PIN ผิดครบ " + MAX_FAILURES + " ครั้ง ชื่อนี้ถูกล็อก 2 ชั่วโมง",
    () => pinMatches_(session.who, currentPin),
    () => {
      storePin_(session.who, pin); // bumps the version: other devices are signed out
      log_(session.who, "", "PIN changed", "", session.who, "");
      return sessionResponse_(session.who);
    }
  );
}

function lockedResponse_(code, retryAfter, message) {
  return { ok: false, code: code, locked: true, retryAfter: retryAfter, error: message };
}

function readCacheJson_(cache, key) {
  try {
    return JSON.parse(cache.get(key) || "null");
  } catch (error) {
    return null;
  }
}

// Token: expires.who.pinVersion.nonce.signature — a chef's tokens stop
// working as soon as their PIN is changed or reset.
function issueToken_(who) {
  const expiresAt = nowSeconds_() + SESSION_SECONDS;
  const version = who === TEAM ? "0" : String(PropertiesService.getScriptProperties().getProperty(pinKey_(who, "VER")) || "0");
  const payload = [expiresAt, who, version, Utilities.getUuid().replace(/-/g, "").slice(0, 16)].join(".");
  return { token: payload + "." + sign_(payload, tokenSecret_()), expiresAt: expiresAt * 1000 };
}

function verifyToken_(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 5 || !/^\d+$/.test(parts[0])) return null;
  if (Number(parts[0]) <= nowSeconds_()) return null;
  const secret = tokenSecret_();
  if (!secret || !safeEqual_(sign_(parts.slice(0, 4).join("."), secret), parts[4])) return null;
  const who = parts[1];
  if (who !== TEAM) {
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty(pinKey_(who, "HASH"))) return null;
    if (String(props.getProperty(pinKey_(who, "VER")) || "0") !== parts[2]) return null;
  }
  return { who: who };
}

function tokenSecret_() {
  return PropertiesService.getScriptProperties().getProperty("TOKEN_SECRET") || "";
}

function sign_(value, secret) {
  return base64url_(Utilities.computeHmacSha256Signature(value, secret));
}

function hashPassword_(password, salt) {
  const key = Utilities.newBlob(salt).getBytes();
  let digest = Utilities.computeHmacSha256Signature(Utilities.newBlob(password).getBytes(), key);
  for (let round = 1; round < PASSWORD_ROUNDS; round += 1) {
    digest = Utilities.computeHmacSha256Signature(digest, key);
  }
  return base64url_(digest);
}

function base64url_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

function randomSecret_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
}

function safeEqual_(a, b) {
  const left = String(a);
  const right = String(b);
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

function nowSeconds_() {
  return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

function getDb_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("ยังไม่ได้ตั้งค่า: เปิดชีทแล้วรันเมนู 🍳 Let We Cook → 1) ตั้งค่าเริ่มต้น");
  return SpreadsheetApp.openById(id);
}

function sheet_(sheetName) {
  const sheet = getDb_().getSheetByName(sheetName);
  if (!sheet) throw new Error("Missing sheet: " + sheetName);
  return sheet;
}

function rows_(sheetName) {
  const values = sheet_(sheetName).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1)
    .filter(row => row.some(value => value !== ""))
    .map(row => {
      const record = {};
      headers.forEach((header, index) => { record[header] = value_(row[index]); });
      return record;
    });
}

function value_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
  return value;
}

// Text that starts with = + - @ would be run as a formula by Google Sheets.
function safeCell_(value) {
  return typeof value === "string" && /^[=+\-@]/.test(value) ? "'" + value : value;
}

function append_(sheetName, record) {
  const sheet = sheet_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(header => (record[header] === undefined ? "" : safeCell_(record[header]))));
}

function cleanText_(value, maxLength) {
  return String(value === undefined || value === null ? "" : value).trim().slice(0, maxLength || 5000);
}

function cleanCode_(value, label) {
  const code = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 3) throw new Error(label + " code must be exactly 3 letters or numbers");
  return code;
}

function isTrue_(value) {
  return value === true || String(value).toUpperCase() === "TRUE";
}

function isoToday_() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
}

function computePriority_(dueDate, status) {
  if (status === "Done") return "Done";
  const due = String(dueDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return "Low";
  const today = isoToday_();
  const days = Math.round((Date.parse(due + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
  if (days <= 7) return "Urgent";
  if (days <= 14) return "High";
  if (days <= 30) return "Medium";
  return "Low";
}

function withLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function log_(actor, workItemId, action, fromValue, toValue, detail) {
  append_(SHEETS.ACTIVITY, {
    EventID: Utilities.getUuid(),
    Timestamp: new Date(),
    Actor: actor,
    WorkItemID: workItemId,
    Action: action,
    FromValue: fromValue,
    ToValue: toValue,
    Detail: detail,
  });
}

// ---------------------------------------------------------------------------
// Work item rows
// ---------------------------------------------------------------------------

// Adds any missing header columns at the end of the sheet (e.g. the trash
// columns on sheets created before soft delete existed).
function ensureColumns_(sheet, names) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const missing = names.filter(name => headers.indexOf(name) === -1);
  if (missing.length) {
    const room = sheet.getMaxColumns() - lastColumn;
    if (room < missing.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), missing.length - room);
    sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
  }
  return headers.concat(missing);
}

function findItem_(sheet, id) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idColumn = headers.indexOf("WorkItemID");
  const index = values.findIndex((row, rowIndex) => rowIndex > 0 && String(row[idColumn]) === id);
  if (index < 1) throw new Error("Work item not found");
  const record = {};
  headers.forEach((header, column) => { record[header] = value_(values[index][column]); });
  return { rowNumber: index + 1, headers: headers, record: record };
}

function setCells_(sheet, found, changes) {
  Object.keys(changes).forEach(name => {
    const column = found.headers.indexOf(name);
    if (column !== -1) sheet.getRange(found.rowNumber, column + 1).setValue(safeCell_(changes[name]));
  });
}

// Next free number for an ID prefix such as "IFM-PDA-T". IDs that ever
// existed (including moved or hard-deleted items, via the Activity Log) are
// never handed out again.
function nextItemNumber_(prefix) {
  const pattern = new RegExp("^" + prefix + "(\\d{4})$");
  const used = rows_(SHEETS.ITEMS).map(row => row.WorkItemID)
    .concat(...rows_(SHEETS.ACTIVITY).map(row => [row.WorkItemID, row.FromValue, row.ToValue]));
  return used.reduce((max, value) => {
    const match = String(value || "").match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
}

function activeAssignees_(values) {
  const active = rows_(SHEETS.PEOPLE).filter(row => isTrue_(row.Active)).map(row => String(row.PersonID));
  const assignees = [];
  (Array.isArray(values) ? values : []).forEach(value => {
    const personId = cleanText_(value, 80);
    if (active.indexOf(personId) !== -1 && assignees.indexOf(personId) === -1) assignees.push(personId);
  });
  if (!assignees.length) throw new Error("Choose at least one chef");
  if (assignees.length > MAX_ASSIGNEES) throw new Error("A work item can have at most " + MAX_ASSIGNEES + " chefs");
  return assignees;
}

function assigneesOf_(workItemId) {
  return rows_(SHEETS.ASSIGNEES)
    .filter(row => String(row.WorkItemID) === workItemId)
    .sort((a, b) => Number(a.AssigneeOrder || 99) - Number(b.AssigneeOrder || 99))
    .map(row => String(row.PersonID));
}

function replaceAssignees_(oldId, newId, assignees, actor) {
  const sheet = sheet_(SHEETS.ASSIGNEES);
  const values = sheet.getDataRange().getValues();
  const idColumn = values[0].map(String).indexOf("WorkItemID");
  for (let row = values.length - 1; row >= 1; row -= 1) {
    if (String(values[row][idColumn]) === oldId) sheet.deleteRow(row + 1);
  }
  const now = new Date();
  assignees.forEach((personId, index) => append_(SHEETS.ASSIGNEES, {
    WorkItemID: newId, PersonID: personId, AssigneeOrder: index + 1, AddedAt: now, AddedBy: actor,
  }));
}

function renamePlanReferences_(oldId, newId) {
  const sheet = sheet_(SHEETS.PLANS);
  const values = sheet.getDataRange().getValues();
  const idColumn = values[0].map(String).indexOf("WorkItemID");
  values.forEach((row, index) => {
    if (index > 0 && String(row[idColumn]) === oldId) sheet.getRange(index + 1, idColumn + 1).setValue(newId);
  });
}

function validDueDate_(value) {
  const dueDate = cleanText_(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Due date is required");
  return dueDate;
}

function validTitle_(value) {
  const title = cleanText_(value, 240);
  if (!title) throw new Error("Title is required");
  return title;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function buildBootstrap_() {
  const people = rows_(SHEETS.PEOPLE).map(row => ({
    id: String(row.PersonID || ""),
    name: String(row.DisplayName || row.PersonID || ""),
    active: isTrue_(row.Active),
    characterName: String(row.CharacterName || ""),
    role: String(row.Role || ""),
  })).filter(person => person.id);
  const epics = rows_(SHEETS.EPICS).map(row => ({
    code: String(row.EpicCode || ""),
    name: String(row.EpicName || row.EpicCode || ""),
    color: String(row.ProjectColor || ""),
    status: String(row.Status || "Active"),
  })).filter(epic => epic.code);
  const stories = rows_(SHEETS.STORIES).map(row => ({
    id: String(row.StoryID || ""),
    epicCode: String(row.EpicCode || ""),
    code: String(row.StoryCode || ""),
    name: String(row.StoryName || ""),
    status: String(row.Status || "Active"),
  })).filter(story => story.id);

  const assignments = {};
  rows_(SHEETS.ASSIGNEES).forEach(row => {
    const key = String(row.WorkItemID || "");
    if (!assignments[key]) assignments[key] = [];
    assignments[key].push({ personId: String(row.PersonID || ""), order: Number(row.AssigneeOrder || 99) });
  });
  Object.keys(assignments).forEach(key => assignments[key].sort((a, b) => a.order - b.order));

  const epicByCode = {};
  epics.forEach(epic => { epicByCode[epic.code] = epic; });
  const storyById = {};
  stories.forEach(story => { storyById[story.id] = story; });

  const items = rows_(SHEETS.ITEMS).map(row => {
    const id = String(row.WorkItemID || "");
    const epic = epicByCode[String(row.EpicCode || "")] || {};
    const story = storyById[String(row.StoryID || "")] || {};
    const status = String(row.Status || "To Do");
    return {
      id: id,
      itemCode: String(row.ItemCode || ""),
      epicCode: String(row.EpicCode || ""),
      epic: epic.name || String(row.EpicCode || "General"),
      epicColor: epic.color || "",
      storyId: String(row.StoryID || ""),
      story: story.name || "",
      issueType: String(row.IssueType || "Task"),
      title: String(row.Title || "Untitled task"),
      description: String(row.Description || ""),
      status: status,
      priority: computePriority_(row.DueDate, status),
      createdDate: String(row.CreatedDate || ""),
      dueDate: String(row.DueDate || ""),
      reporter: String(row.Reporter || ""),
      assignees: (assignments[id] || []).map(item => item.personId),
      progress: Number(row.Progress || 0),
      blocker: isTrue_(row.Blocker),
      tags: String(row.Tags || ""),
      deleted: isTrue_(row.Deleted),
      deletedAt: String(row.DeletedAt || ""),
      deletedBy: String(row.DeletedBy || ""),
    };
  }).filter(task => task.id);

  return {
    people: people,
    epics: epics,
    stories: stories,
    tasks: items.filter(task => !task.deleted),
    trash: items.filter(task => task.deleted),
    generatedAt: new Date().toISOString(),
  };
}

function findTask_(id) {
  const data = buildBootstrap_();
  return data.tasks.concat(data.trash).find(task => task.id === id);
}

function createTask_(payload, actor) {
  return withLock_(() => {
    const now = new Date();
    const epics = rows_(SHEETS.EPICS);
    const stories = rows_(SHEETS.STORIES);
    const title = validTitle_(payload.title);
    const dueDate = validDueDate_(payload.dueDate);
    const assignees = activeAssignees_(payload.assignees);

    let epicCode;
    if (payload.newEpic) {
      epicCode = cleanCode_(payload.newEpic.code, "Menu");
      const epicName = cleanText_(payload.newEpic.name, 120);
      if (!epicName) throw new Error("Menu name is required");
      if (epics.some(row => String(row.EpicCode).toUpperCase() === epicCode)) throw new Error("Menu code " + epicCode + " already exists");
      if (!payload.newStory) throw new Error("A new menu needs a new course");
      const color = /^#[0-9a-f]{6}$/i.test(String(payload.newEpic.color || "")) ? String(payload.newEpic.color) : "#d8572a";
      append_(SHEETS.EPICS, {
        EpicCode: epicCode, EpicName: epicName, ProjectColor: color, Status: "Active",
        CreatedAt: now, CreatedBy: actor, UpdatedAt: now, UpdatedBy: actor,
      });
      log_(actor, "", "Menu created", "", epicCode, epicName);
    } else {
      epicCode = cleanText_(payload.epicCode, 3).toUpperCase();
      if (!epics.some(row => String(row.EpicCode).toUpperCase() === epicCode)) throw new Error("Choose a valid menu");
    }

    let storyId;
    let storyCode;
    if (payload.newStory) {
      storyCode = cleanCode_(payload.newStory.code, "Course");
      const storyName = cleanText_(payload.newStory.name, 160);
      if (!storyName) throw new Error("Course name is required");
      storyId = epicCode + "-" + storyCode;
      if (stories.some(row => String(row.StoryID).toUpperCase() === storyId)) throw new Error("Course " + storyId + " already exists");
      append_(SHEETS.STORIES, {
        StoryID: storyId, EpicCode: epicCode, StoryCode: storyCode, StoryName: storyName, Status: "Active",
        CreatedAt: now, CreatedBy: actor, UpdatedAt: now, UpdatedBy: actor,
      });
      log_(actor, "", "Course created", "", storyId, storyName);
    } else {
      storyId = cleanText_(payload.storyId, 20).toUpperCase();
      const story = stories.find(row => String(row.StoryID).toUpperCase() === storyId && String(row.EpicCode).toUpperCase() === epicCode);
      if (!story) throw new Error("Choose a valid course");
      storyCode = cleanCode_(story.StoryCode, "Course");
    }

    const issueType = String(payload.issueType).toLowerCase() === "bug" ? "Bug" : "Task";
    const typeCode = issueType === "Bug" ? "B" : "T";
    const prefix = epicCode + "-" + storyCode + "-" + typeCode;
    const itemCode = typeCode + String(nextItemNumber_(prefix)).padStart(4, "0");
    const workItemId = epicCode + "-" + storyCode + "-" + itemCode;
    const status = STATUSES.indexOf(payload.status) !== -1 ? payload.status : "To Do";

    append_(SHEETS.ITEMS, {
      WorkItemID: workItemId,
      EpicCode: epicCode,
      StoryID: storyId,
      ItemCode: itemCode,
      IssueType: issueType,
      Title: title,
      Description: cleanText_(payload.description, 5000),
      Status: status,
      Priority: computePriority_(dueDate, status),
      CreatedDate: isoToday_(),
      DueDate: dueDate,
      Reporter: actor,
      AssigneeSummary: assignees.join(", "),
      Progress: status === "Done" ? 100 : 0,
      Blocker: false,
      Tags: cleanText_(payload.tags, 500),
      UpdatedAt: now,
      UpdatedBy: actor,
    });
    assignees.forEach((personId, index) => append_(SHEETS.ASSIGNEES, {
      WorkItemID: workItemId, PersonID: personId, AssigneeOrder: index + 1, AddedAt: now, AddedBy: actor,
    }));
    log_(actor, workItemId, "Created", "", status, title);

    const data = buildBootstrap_();
    return { task: data.tasks.find(task => task.id === workItemId), epics: data.epics, stories: data.stories };
  });
}

function updateStatus_(payload, actor) {
  const id = cleanText_(payload.id, 40);
  const status = String(payload.status || "");
  if (STATUSES.indexOf(status) === -1) throw new Error("Invalid status");
  return withLock_(() => {
    const sheet = sheet_(SHEETS.ITEMS);
    const found = findItem_(sheet, id);
    if (isTrue_(found.record.Deleted)) throw new Error("งานนี้อยู่ในถังขยะ กู้คืนก่อนเปลี่ยนสถานะ");
    const oldStatus = String(found.record.Status || "");
    const changes = { Status: status, Priority: computePriority_(found.record.DueDate, status), UpdatedAt: new Date(), UpdatedBy: actor };
    if (status === "Done") changes.Progress = 100;
    setCells_(sheet, found, changes);
    log_(actor, id, "Status changed", oldStatus, status, "");
    return findTask_(id);
  });
}

// Edits every field of a ticket. Moving it to another course or switching
// Task ↔ Bug gives it a new ID (the old one is kept in the Activity Log and
// is never reused); assignees and today's-menu entries follow the new ID.
function updateTask_(payload, actor) {
  const id = cleanText_(payload.id, 40);
  return withLock_(() => {
    const sheet = sheet_(SHEETS.ITEMS);
    const found = findItem_(sheet, id);
    const row = found.record;
    if (isTrue_(row.Deleted)) throw new Error("งานนี้อยู่ในถังขยะ กู้คืนก่อนแก้ไข");

    const title = validTitle_(payload.title);
    const description = cleanText_(payload.description, 5000);
    const dueDate = validDueDate_(payload.dueDate);
    const assignees = activeAssignees_(payload.assignees);
    const status = STATUSES.indexOf(payload.status) !== -1 ? payload.status : String(row.Status || "To Do");
    const issueType = String(payload.issueType).toLowerCase() === "bug" ? "Bug" : "Task";
    const storyId = cleanText_(payload.storyId, 20).toUpperCase();
    const story = rows_(SHEETS.STORIES).find(item => String(item.StoryID).toUpperCase() === storyId);
    if (!story) throw new Error("Choose a valid course");
    const epicCode = String(story.EpicCode).toUpperCase();
    const storyCode = cleanCode_(story.StoryCode, "Course");
    const typeCode = issueType === "Bug" ? "B" : "T";
    const prefix = epicCode + "-" + storyCode + "-" + typeCode;

    let newId = id;
    let itemCode = String(row.ItemCode || "");
    if (!new RegExp("^" + prefix + "\\d{4}$").test(id)) {
      itemCode = typeCode + String(nextItemNumber_(prefix)).padStart(4, "0");
      newId = epicCode + "-" + storyCode + "-" + itemCode;
    }

    const oldAssignees = assigneesOf_(id);
    const changed = [];
    if (title !== String(row.Title || "")) changed.push("title");
    if (description !== String(row.Description || "")) changed.push("description");
    if (dueDate !== String(row.DueDate || "").slice(0, 10)) changed.push("due date");
    if (status !== String(row.Status || "")) changed.push("status");
    if (issueType !== String(row.IssueType || "Task")) changed.push("type");
    if (storyId !== String(row.StoryID || "")) changed.push("course");
    if (assignees.join(",") !== oldAssignees.join(",")) changed.push("chefs");

    const now = new Date();
    const changes = {
      WorkItemID: newId,
      EpicCode: epicCode,
      StoryID: storyId,
      ItemCode: itemCode,
      IssueType: issueType,
      Title: title,
      Description: description,
      Status: status,
      Priority: computePriority_(dueDate, status),
      DueDate: dueDate,
      AssigneeSummary: assignees.join(", "),
      UpdatedAt: now,
      UpdatedBy: actor,
    };
    if (status === "Done") changes.Progress = 100;
    setCells_(sheet, found, changes);
    if (newId !== id || changed.indexOf("chefs") !== -1) replaceAssignees_(id, newId, assignees, actor);
    if (newId !== id) {
      renamePlanReferences_(id, newId);
      log_(actor, newId, "Moved", id, newId, "");
    }
    log_(actor, newId, "Edited", "", "", changed.join(", ") || "no changes");
    return { task: findTask_(newId), previousId: newId !== id ? id : "" };
  });
}

// Soft delete: the row stays in the sheet with Deleted = TRUE so it can be restored.
function deleteTask_(payload, actor) {
  const id = cleanText_(payload.id, 40);
  const reason = cleanText_(payload.reason, 300);
  return withLock_(() => {
    const sheet = sheet_(SHEETS.ITEMS);
    ensureColumns_(sheet, DELETE_COLUMNS);
    const found = findItem_(sheet, id);
    if (isTrue_(found.record.Deleted)) throw new Error("งานนี้อยู่ในถังขยะแล้ว");
    const now = new Date();
    setCells_(sheet, found, { Deleted: true, DeletedAt: now, DeletedBy: actor, UpdatedAt: now, UpdatedBy: actor });
    log_(actor, id, "Deleted", String(found.record.Status || ""), "Trash", reason);
    return findTask_(id);
  });
}

function restoreTask_(payload, actor) {
  const id = cleanText_(payload.id, 40);
  return withLock_(() => {
    const sheet = sheet_(SHEETS.ITEMS);
    ensureColumns_(sheet, DELETE_COLUMNS);
    const found = findItem_(sheet, id);
    if (!isTrue_(found.record.Deleted)) throw new Error("งานนี้ไม่ได้อยู่ในถังขยะ");
    const now = new Date();
    setCells_(sheet, found, { Deleted: false, DeletedAt: "", DeletedBy: "", UpdatedAt: now, UpdatedBy: actor });
    log_(actor, id, "Restored", "Trash", String(found.record.Status || ""), "");
    return findTask_(id);
  });
}

function planKey_(payload) {
  const planDate = cleanText_(payload.planDate, 10);
  const personId = cleanText_(payload.personId, 80);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate) || !personId) throw new Error("Plan date and chef are required");
  return { planDate: planDate, personId: personId };
}

function getDailyPlan_(payload) {
  const key = planKey_(payload);
  return rows_(SHEETS.PLANS)
    .filter(row => String(row.PlanDate).slice(0, 10) === key.planDate && String(row.PersonID) === key.personId)
    .sort((a, b) => String(a.PlanID).localeCompare(String(b.PlanID)))
    .map(row => ({ taskId: String(row.WorkItemID || ""), note: String(row.Note || "") }));
}

function saveDailyPlan_(payload, actor) {
  const key = planKey_(payload);
  const people = rows_(SHEETS.PEOPLE).map(row => String(row.PersonID));
  if (people.indexOf(key.personId) === -1) throw new Error("Unknown chef");
  if (actor === TEAM) throw new Error("เข้าด้วยรหัสทีมอยู่ ดูเมนูวันนี้ได้อย่างเดียว เข้าด้วย PIN ของตัวเองเพื่อแก้ไข");
  if (actor !== key.personId) throw new Error("แก้ได้เฉพาะเมนูวันนี้ของตัวเอง");
  const entries = (Array.isArray(payload.entries) ? payload.entries : []).slice(0, MAX_PLAN_ENTRIES);
  return withLock_(() => {
    const sheet = sheet_(SHEETS.PLANS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const dateIndex = headers.indexOf("PlanDate");
    const personIndex = headers.indexOf("PersonID");
    for (let row = values.length - 1; row >= 1; row -= 1) {
      const rowDate = String(value_(values[row][dateIndex])).slice(0, 10);
      if (rowDate === key.planDate && String(values[row][personIndex]) === key.personId) sheet.deleteRow(row + 1);
    }
    const now = new Date();
    entries.forEach((entry, index) => append_(SHEETS.PLANS, {
      PlanID: key.planDate.replace(/-/g, "") + "-" + key.personId + "-" + String(index + 1).padStart(2, "0"),
      PlanDate: key.planDate,
      PersonID: key.personId,
      WorkItemID: cleanText_(entry.taskId, 40),
      Note: cleanText_(entry.note, 3000),
      SavedAt: now,
      SavedBy: actor,
    }));
    log_(actor, "", "Daily plan saved", "", key.personId + " · " + key.planDate, entries.length + " items");
    return entries.length;
  });
}
