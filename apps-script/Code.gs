/**
 * Let We Cook · Google Apps Script API
 *
 * Bound to the "Let We Cook - Task Database" Google Sheet (Extensions → Apps Script).
 * Setup and deployment steps are in README.md of the let-we-cook repository.
 *
 * Nothing secret lives in this file: the team password (salted hash) and the
 * key that signs login sessions are stored in Script Properties.
 */

const API_VERSION = "2.0";
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

const SESSION_SECONDS = 2 * 60 * 60;
const CLIENT_MAX_FAILURES = 5;
const CLIENT_LOCK_SECONDS = 2 * 60 * 60;
const GLOBAL_MAX_FAILURES = 20;
const GLOBAL_WINDOW_SECONDS = 10 * 60;
const GLOBAL_PAUSE_SECONDS = 15 * 60;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_ROUNDS = 500;

// ---------------------------------------------------------------------------
// Sheet menu: one-time setup for the sheet owner
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🍳 Let We Cook")
    .addItem("1) ตั้งค่าเริ่มต้น", "setupLetWeCook")
    .addItem("2) ตั้ง / เปลี่ยนรหัสผ่านทีม", "setTeamPassword")
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
  return notify_("ตั้งค่าเรียบร้อย ✅\n\nขั้นต่อไป: เมนู 🍳 Let We Cook → 2) ตั้ง / เปลี่ยนรหัสผ่านทีม");
}

function setTeamPassword() {
  const ui = SpreadsheetApp.getUi();
  const first = ui.prompt(
    "ตั้งรหัสผ่านทีม",
    "อย่างน้อย " + PASSWORD_MIN_LENGTH + " ตัวอักษร และห้ามซ้ำกับรหัสของระบบเก่า",
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

function showSetupStatus() {
  const props = PropertiesService.getScriptProperties();
  return notify_([
    "Spreadsheet: " + (props.getProperty("SPREADSHEET_ID") ? "✅" : "❌ ยังไม่ได้รัน 1) ตั้งค่าเริ่มต้น"),
    "รหัสผ่านทีม: " + (props.getProperty("PASSWORD_HASH") ? "✅" : "❌ ยังไม่ได้ตั้ง"),
    "Session key: " + (props.getProperty("TOKEN_SECRET") ? "✅" : "❌"),
    "API version: " + API_VERSION,
  ].join("\n"));
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
  if (action === "login") return login_(body.password, body.clientId);
  if (!verifyToken_(body.token)) {
    return { ok: false, code: "AUTH", error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  }
  const payload = body.payload || {};
  const actor = cleanText_(body.actor || "team", 80);
  if (action === "session") return { ok: true, authenticated: true };
  if (action === "bootstrap") return Object.assign({ ok: true }, buildBootstrap_());
  if (action === "getDailyPlan") return { ok: true, entries: getDailyPlan_(payload) };
  if (action === "saveDailyPlan") return { ok: true, saved: saveDailyPlan_(payload, actor) };
  if (action === "createTask") return Object.assign({ ok: true }, createTask_(payload, actor));
  if (action === "updateStatus") return { ok: true, task: updateStatus_(payload, actor) };
  return { ok: false, error: "Unknown action" };
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Login, sessions and brute-force protection
//
// Apps Script cannot see the visitor's IP, so protection has two layers:
// - per browser (random clientId): 5 wrong passwords → locked for 2 hours
// - whole site: 20 wrong passwords within 10 minutes → logins paused 15 minutes
// ---------------------------------------------------------------------------

function login_(password, rawClientId) {
  const props = PropertiesService.getScriptProperties();
  const hash = props.getProperty("PASSWORD_HASH");
  const salt = props.getProperty("PASSWORD_SALT");
  if (!hash || !salt || !props.getProperty("TOKEN_SECRET")) {
    return { ok: false, code: "NOT_CONFIGURED", error: "ยังไม่ได้ตั้งรหัสผ่านทีม เจ้าของชีทต้องตั้งจากเมนู 🍳 Let We Cook ก่อน" };
  }
  const clientKey = "login:client:" + String(rawClientId || "unknown").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();
    const now = nowSeconds_();
    const pausedUntil = Number(cache.get("login:pause") || 0);
    if (pausedUntil > now) {
      return lockedResponse_("PAUSED", pausedUntil - now, "มีการใส่รหัสผิดหลายครั้ง ระบบพักการเข้าสู่ระบบชั่วคราว");
    }
    const client = readCacheJson_(cache, clientKey) || { failures: 0, lockedUntil: 0 };
    if (client.lockedUntil > now) {
      return lockedResponse_("LOCKED", client.lockedUntil - now, "ใส่รหัสผิดครบ " + CLIENT_MAX_FAILURES + " ครั้ง เบราว์เซอร์นี้ถูกล็อก 2 ชั่วโมง");
    }

    if (safeEqual_(hashPassword_(String(password || ""), salt), hash)) {
      cache.remove(clientKey);
      const expiresAt = now + SESSION_SECONDS;
      return { ok: true, token: issueToken_(expiresAt), expiresAt: expiresAt * 1000 };
    }

    client.failures += 1;
    if (client.failures >= CLIENT_MAX_FAILURES) client.lockedUntil = now + CLIENT_LOCK_SECONDS;
    cache.put(clientKey, JSON.stringify(client), CLIENT_LOCK_SECONDS);

    const previous = readCacheJson_(cache, "login:global");
    const windowState = previous && now - previous.startedAt < GLOBAL_WINDOW_SECONDS ? previous : { failures: 0, startedAt: now };
    windowState.failures += 1;
    if (windowState.failures >= GLOBAL_MAX_FAILURES) {
      cache.put("login:pause", String(now + GLOBAL_PAUSE_SECONDS), GLOBAL_PAUSE_SECONDS);
      cache.remove("login:global");
    } else {
      cache.put("login:global", JSON.stringify(windowState), GLOBAL_WINDOW_SECONDS);
    }

    if (client.lockedUntil > now) {
      return lockedResponse_("LOCKED", CLIENT_LOCK_SECONDS, "ใส่รหัสผิดครบ " + CLIENT_MAX_FAILURES + " ครั้ง เบราว์เซอร์นี้ถูกล็อก 2 ชั่วโมง");
    }
    const remaining = CLIENT_MAX_FAILURES - client.failures;
    return { ok: false, code: "WRONG_PASSWORD", remaining: remaining, error: "รหัสผ่านไม่ถูกต้อง เหลือโอกาสอีก " + remaining + " ครั้ง" };
  } finally {
    lock.releaseLock();
  }
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

function issueToken_(expiresAt) {
  const payload = expiresAt + "." + Utilities.getUuid().replace(/-/g, "").slice(0, 16);
  return payload + "." + sign_(payload, tokenSecret_());
}

function verifyToken_(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
  if (Number(parts[0]) <= nowSeconds_()) return false;
  const secret = tokenSecret_();
  if (!secret) return false;
  return safeEqual_(sign_(parts[0] + "." + parts[1], secret), parts[2]);
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

  const tasks = rows_(SHEETS.ITEMS).map(row => {
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
    };
  }).filter(task => task.id);

  return { people: people, epics: epics, stories: stories, tasks: tasks, generatedAt: new Date().toISOString() };
}

function createTask_(payload, actor) {
  return withLock_(() => {
    const now = new Date();
    const epics = rows_(SHEETS.EPICS);
    const stories = rows_(SHEETS.STORIES);
    const activePeople = rows_(SHEETS.PEOPLE).filter(row => isTrue_(row.Active)).map(row => String(row.PersonID));

    const title = cleanText_(payload.title, 240);
    const dueDate = cleanText_(payload.dueDate, 10);
    if (!title) throw new Error("Title is required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Due date is required");
    const assignees = [];
    (Array.isArray(payload.assignees) ? payload.assignees : []).forEach(value => {
      const personId = cleanText_(value, 80);
      if (activePeople.indexOf(personId) !== -1 && assignees.indexOf(personId) === -1) assignees.push(personId);
    });
    if (!assignees.length) throw new Error("Choose at least one chef");
    if (assignees.length > MAX_ASSIGNEES) throw new Error("A work item can have at most " + MAX_ASSIGNEES + " chefs");

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
    const pattern = new RegExp("^" + prefix + "(\\d{4})$");
    const nextNumber = rows_(SHEETS.ITEMS).reduce((max, row) => {
      const match = String(row.WorkItemID || "").match(pattern);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    const itemCode = typeCode + String(nextNumber).padStart(4, "0");
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
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const column = name => headers.indexOf(name);
    const rowIndex = values.findIndex((row, index) => index > 0 && String(row[column("WorkItemID")]) === id);
    if (rowIndex < 1) throw new Error("Work item not found");
    const row = values[rowIndex];
    const oldStatus = String(row[column("Status")] || "");
    const set = (name, value) => {
      if (column(name) !== -1) sheet.getRange(rowIndex + 1, column(name) + 1).setValue(safeCell_(value));
    };
    set("Status", status);
    set("Priority", computePriority_(value_(row[column("DueDate")]), status));
    if (status === "Done") set("Progress", 100);
    set("UpdatedAt", new Date());
    set("UpdatedBy", actor);
    log_(actor, id, "Status changed", oldStatus, status, "");
    return buildBootstrap_().tasks.find(task => task.id === id);
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
