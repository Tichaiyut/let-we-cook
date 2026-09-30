// Runs apps-script/Code.gs in a Node sandbox with small fakes of the Google
// services it uses, so the API contract, auth and lockout rules are tested
// without deploying.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const CODE = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
const PASSWORD = "kitchen-open-2026";

// Dates written into fake sheets must come from the sandbox realm, otherwise
// `instanceof Date` inside Code.gs would not recognise them.
let SheetDate = Date;

const toBuffer = (value) => (typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value.map((byte) => byte & 0xff)));
const toBytes = (buffer) => [...buffer].map((byte) => (byte > 127 ? byte - 256 : byte));

class FakeSheet {
  constructor(headers, rows = []) {
    this.data = [headers, ...rows];
  }
  getDataRange() {
    return { getValues: () => this.data.map((row) => [...row]) };
  }
  getLastColumn() {
    return this.data[0].length;
  }
  getMaxColumns() {
    return 26;
  }
  insertColumnsAfter() {}
  getRange(row, column, rows = 1, columns = 1) {
    return {
      getValues: () => this.data.slice(row - 1, row - 1 + rows).map((values) => values.slice(column - 1, column - 1 + columns)),
      setValue: (value) => { this.data[row - 1][column - 1] = value; },
      setValues: (values) => values.forEach((cells, r) => cells.forEach((value, c) => { this.data[row - 1 + r][column - 1 + c] = value; })),
    };
  }
  // Like Google Sheets, ISO date strings become real dates (Bangkok midnight).
  appendRow(values) {
    this.data.push(values.map((value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new SheetDate(`${value}T00:00:00+07:00`) : value)));
  }
  deleteRow(row) {
    this.data.splice(row - 1, 1);
  }
}

function bangkok(date) {
  const shifted = new Date(date.getTime() + 7 * 3600000).toISOString();
  return { day: shifted.slice(0, 10), time: shifted.slice(11, 19) };
}

function createKitchen() {
  const sheets = {
    People: new FakeSheet(["PersonID", "DisplayName", "Active", "CharacterName", "Role", "AvatarFile", "CreatedAt", "UpdatedAt"], [
      ["arparat", "Arparat", true, "Saint - Chan", "Data Provider", "", "", ""],
      ["tichaiyut", "Tichaiyut", true, "Topu - Kun", "Data Scientist", "", "", ""],
      ["chonlasit", "Chonlasit", true, "Bon - Kun", "AI Engineer", "", "", ""],
      ["sorawee", "Sorawee", true, "Ing - Kun", "Web Developer", "", "", ""],
      ["bank", "Bank", false, "", "", "", "", ""],
    ]),
    Epics: new FakeSheet(["EpicCode", "EpicName", "ProjectColor", "Status", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
    Stories: new FakeSheet(["StoryID", "EpicCode", "StoryCode", "StoryName", "Status", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
    "Work Items": new FakeSheet(["WorkItemID", "EpicCode", "StoryID", "ItemCode", "IssueType", "Title", "Description", "Status", "Priority", "CreatedDate", "DueDate", "Reporter", "AssigneeSummary", "Progress", "Blocker", "Tags", "UpdatedAt", "UpdatedBy"]),
    "Task Assignees": new FakeSheet(["WorkItemID", "PersonID", "AssigneeOrder", "AddedAt", "AddedBy"]),
    "Daily Plans": new FakeSheet(["PlanID", "PlanDate", "PersonID", "WorkItemID", "Note", "SavedAt", "SavedBy"]),
    "Activity Log": new FakeSheet(["EventID", "Timestamp", "Actor", "WorkItemID", "Action", "FromValue", "ToValue", "Detail"]),
  };
  const spreadsheet = { getId: () => "sheet-id", getSheetByName: (name) => sheets[name] || null };
  const properties = new Map();
  const cache = new Map();
  const context = vm.createContext({
    Logger: { log() {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: () => spreadsheet,
      getUi: () => { throw new Error("No UI in web app context"); },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => (properties.has(key) ? properties.get(key) : null),
        setProperty: (key, value) => properties.set(key, String(value)),
        setProperties: (values) => Object.entries(values).forEach(([key, value]) => properties.set(key, String(value))),
        deleteProperty: (key) => properties.delete(key),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => (cache.has(key) ? cache.get(key) : null),
        put: (key, value) => cache.set(key, String(value)),
        remove: (key) => cache.delete(key),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    Utilities: {
      getUuid: () => randomUUID(),
      newBlob: (text) => ({ getBytes: () => toBytes(Buffer.from(text, "utf8")) }),
      computeHmacSha256Signature: (value, key) => toBytes(createHmac("sha256", toBuffer(key)).update(toBuffer(value)).digest()),
      base64EncodeWebSafe: (bytes) => toBuffer(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"),
      formatDate: (date, _zone, pattern) => {
        const { day, time } = bangkok(date);
        return pattern === "yyyy-MM-dd" ? day : `${day}T${time}+07:00`;
      },
    },
  });
  SheetDate = vm.runInContext("Date", context);
  vm.runInContext(CODE, context);
  context.setupLetWeCook();
  context.storePassword_(PASSWORD);

  const call = (body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  const login = (password = PASSWORD, clientId = "browser-a") => call({ action: "login", password, clientId });
  // Sets a chef's first PIN (with the team password) and returns their session token.
  const chef = (personId, pin = PINS[personId]) => {
    const result = call({ action: "setupPin", personId, teamPassword: PASSWORD, pin, clientId: `setup-${personId}` });
    assert.equal(result.ok, true, result.error);
    return result.token;
  };
  return { context, sheets, properties, cache, call, login, chef };
}

const PINS = { arparat: "4829", tichaiyut: "7361", chonlasit: "5093", sorawee: "2718" };

const inTenDays = () => new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);

function newOrder(overrides = {}) {
  return {
    epicCode: "",
    newEpic: { code: "IFM", name: "iFarm", color: "#2f72e8" },
    storyId: "",
    newStory: { code: "PER", name: "Performance Dashboard" },
    title: "Weekly performance chart",
    description: "",
    issueType: "Task",
    assignees: ["tichaiyut", "sorawee"],
    status: "To Do",
    dueDate: inTenDays(),
    ...overrides,
  };
}

test("health check exposes no data", () => {
  const { context } = createKitchen();
  const health = JSON.parse(context.doGet().text);
  assert.equal(health.ok, true);
  assert.equal(health.tasks, undefined);
});

test("every data action needs a valid session token", () => {
  const { call, login, properties } = createKitchen();
  assert.equal(call({ action: "bootstrap" }).code, "AUTH");
  assert.equal(call({ action: "bootstrap", token: "123.abc.def" }).code, "AUTH");

  const session = login();
  assert.equal(session.ok, true);
  assert.ok(session.expiresAt > Date.now() + 7000 * 1000, "session lasts about 2 hours");
  const data = call({ action: "bootstrap", token: session.token });
  assert.equal(data.ok, true);
  assert.equal(data.people.length, 5);

  assert.deepEqual(data.me, { kind: "team", id: "team", name: "Team" });

  const [expires, who, version, nonce, signature0] = session.token.split(".");
  assert.equal(call({ action: "bootstrap", token: `${expires}.${who}.${version}.${nonce}.forged` }).code, "AUTH");
  assert.equal(call({ action: "bootstrap", token: `${Number(expires) + 999}.${who}.${version}.${nonce}.${signature0}` }).code, "AUTH");
  assert.equal(call({ action: "bootstrap", token: `${expires}.sorawee.${version}.${nonce}.${signature0}` }).code, "AUTH", "cannot swap identity");

  const expiredPayload = `1000.team.0.${nonce}`;
  const signature = createHmac("sha256", properties.get("TOKEN_SECRET")).update(expiredPayload).digest("base64url");
  assert.equal(call({ action: "bootstrap", token: `${expiredPayload}.${signature}` }).code, "AUTH");
});

test("changing the team password signs everyone out", () => {
  const { call, login, context } = createKitchen();
  const { token } = login();
  context.storePassword_("a-brand-new-password");
  assert.equal(call({ action: "bootstrap", token }).code, "AUTH");
  assert.equal(login().code, "WRONG_PASSWORD");
  assert.equal(login("a-brand-new-password").ok, true);
});

test("five wrong passwords lock that browser for two hours", () => {
  const { login } = createKitchen();
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const result = login("wrong", "browser-a");
    assert.equal(result.code, "WRONG_PASSWORD");
    assert.equal(result.remaining, 5 - attempt);
  }
  const fifth = login("wrong", "browser-a");
  assert.equal(fifth.code, "LOCKED");
  assert.equal(fifth.retryAfter, 7200);
  assert.equal(login(PASSWORD, "browser-a").code, "LOCKED", "even the right password waits out the lock");
  assert.equal(login(PASSWORD, "browser-b").ok, true, "other browsers are unaffected");
});

test("a successful login clears earlier failures", () => {
  const { login } = createKitchen();
  login("wrong");
  login("wrong");
  assert.equal(login().ok, true);
  assert.equal(login("wrong").remaining, 4);
});

test("twenty wrong passwords across browsers pause every login", () => {
  const { login } = createKitchen();
  for (let attempt = 0; attempt < 20; attempt += 1) login("wrong", `attacker-${attempt}`);
  const paused = login(PASSWORD, "teammate");
  assert.equal(paused.code, "PAUSED");
  assert.equal(paused.retryAfter, 900);
});

test("creates menus, courses and numbered tickets", () => {
  const { call, login, sheets } = createKitchen();
  const { token } = login();
  const first = call({ action: "createTask", token, actor: "tichaiyut", payload: newOrder() });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.task.id, "IFM-PER-T0001");
  assert.deepEqual(first.task.assignees, ["tichaiyut", "sorawee"]);
  assert.equal(first.task.epic, "iFarm");
  assert.equal(first.task.story, "Performance Dashboard");
  assert.equal(first.task.priority, "High");
  assert.equal(first.task.dueDate.slice(0, 10), inTenDays());
  assert.equal(first.epics.length, 1);
  assert.equal(first.stories.length, 1);

  const existing = { newEpic: null, newStory: null, epicCode: "IFM", storyId: "IFM-PER" };
  assert.equal(call({ action: "createTask", token, payload: newOrder({ ...existing, title: "Second" }) }).task.id, "IFM-PER-T0002");
  assert.equal(call({ action: "createTask", token, payload: newOrder({ ...existing, issueType: "Bug", title: "Broken chart" }) }).task.id, "IFM-PER-B0001");
  assert.equal(sheets["Task Assignees"].data.length, 1 + 2 + 2 + 2);
  assert.ok(sheets["Activity Log"].data.length > 3);
});

test("rejects invalid tickets", () => {
  const { call, login } = createKitchen();
  const { token } = login();
  const error = (payload) => call({ action: "createTask", token, payload }).error;
  assert.match(error(newOrder({ assignees: ["bank"] })), /at least one chef/);
  assert.match(error(newOrder({ title: "  " })), /Title/);
  assert.match(error(newOrder({ dueDate: "" })), /Due date/);
  assert.match(error(newOrder({ newEpic: null, epicCode: "XYZ" })), /valid menu/);
  assert.match(error(newOrder({ newEpic: { code: "AB", name: "Too short" } })), /3 letters/);
  call({ action: "createTask", token, payload: newOrder() });
  assert.match(error(newOrder()), /already exists/);
  assert.match(error(newOrder({ newEpic: null, epicCode: "IFM", newStory: null, storyId: "IFM-NOP" })), /valid course/);
});

test("text that looks like a formula is stored as plain text", () => {
  const { call, login, sheets } = createKitchen();
  const { token } = login();
  call({ action: "createTask", token, payload: newOrder({ title: '=HYPERLINK("http://evil","x")' }) });
  const title = sheets["Work Items"].data[1][5];
  assert.equal(title, `'=HYPERLINK("http://evil","x")`);
});

test("updates the station of a ticket", () => {
  const { call, login, sheets } = createKitchen();
  const { token } = login();
  call({ action: "createTask", token, payload: newOrder() });
  const result = call({ action: "updateStatus", token, actor: "sorawee", payload: { id: "IFM-PER-T0001", status: "Done" } });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.task.status, "Done");
  assert.equal(result.task.priority, "Done");
  assert.equal(sheets["Work Items"].data[1][13], 100);
  assert.match(call({ action: "updateStatus", token, payload: { id: "IFM-PER-T0001", status: "Review" } }).error, /Invalid status/);
  assert.match(call({ action: "updateStatus", token, payload: { id: "NOPE", status: "Done" } }).error, /not found/);
});

test("saves and reloads today's menu per chef and date", () => {
  const { call, chef } = createKitchen();
  const tokens = { sorawee: chef("sorawee"), chonlasit: chef("chonlasit") };
  const save = (entries, personId = "sorawee", planDate = "2026-09-30", token = tokens[personId]) =>
    call({ action: "saveDailyPlan", token, payload: { planDate, personId, entries } });
  const load = (personId = "sorawee", planDate = "2026-09-30") =>
    call({ action: "getDailyPlan", token: tokens.chonlasit, payload: { planDate, personId } }).entries;

  assert.deepEqual(load(), []);
  assert.equal(save([{ taskId: "IFM-PER-T0001", note: "finish chart" }, { taskId: "IFM-PER-B0001", note: "" }]).saved, 2);
  assert.deepEqual(load(), [{ taskId: "IFM-PER-T0001", note: "finish chart" }, { taskId: "IFM-PER-B0001", note: "" }], "other chefs can read it");
  save([{ taskId: "IFM-PER-T0002", note: "replaced" }]);
  assert.deepEqual(load(), [{ taskId: "IFM-PER-T0002", note: "replaced" }]);
  save([{ taskId: "X", note: "other chef" }], "chonlasit");
  save([{ taskId: "Y", note: "tomorrow" }], "sorawee", "2026-10-01");
  assert.deepEqual(load(), [{ taskId: "IFM-PER-T0002", note: "replaced" }]);
  assert.match(save([], "stranger", "2026-09-30", tokens.sorawee).error, /Unknown chef/);
});

test("only the chef can change their own menu; the team login is read-only", () => {
  const { call, login, chef } = createKitchen();
  const sorawee = chef("sorawee");
  const team = login().token;
  const payload = { planDate: "2026-09-30", personId: "chonlasit", entries: [{ taskId: "A", note: "" }] };
  assert.match(call({ action: "saveDailyPlan", token: sorawee, payload }).error, /เฉพาะเมนูวันนี้ของตัวเอง/);
  assert.match(call({ action: "saveDailyPlan", token: team, payload }).error, /รหัสทีม/);
  assert.equal(call({ action: "getDailyPlan", token: team, payload }).ok, true);
});

function seedTicket(call, token, overrides = {}) {
  return call({ action: "createTask", token, actor: "sorawee", payload: newOrder(overrides) }).task;
}

test("setup adds the trash columns to older sheets", () => {
  const { sheets } = createKitchen();
  const headers = sheets["Work Items"].data[0];
  assert.deepEqual(headers.slice(-3), ["Deleted", "DeletedAt", "DeletedBy"]);
});

test("deleting moves a ticket to the trash and restoring brings it back", () => {
  const { call, chef, sheets } = createKitchen();
  const token = chef("arparat");
  const ticket = seedTicket(call, token);
  const deleted = call({ action: "deleteTask", token, actor: "someone-else", payload: { id: ticket.id, reason: "duplicate" } });
  assert.equal(deleted.ok, true, deleted.error);
  assert.equal(deleted.task.deleted, true);
  assert.equal(deleted.task.deletedBy, "arparat");

  let data = call({ action: "bootstrap", token });
  assert.equal(data.tasks.length, 0);
  assert.deepEqual(data.trash.map((task) => task.id), [ticket.id]);
  assert.equal(sheets["Work Items"].data.length, 2, "the row stays in the sheet");
  const log = sheets["Activity Log"].data.at(-1);
  assert.deepEqual([log[4], log[7]], ["Deleted", "duplicate"]);

  assert.match(call({ action: "deleteTask", token, payload: { id: ticket.id } }).error, /ถังขยะแล้ว/);
  assert.match(call({ action: "updateStatus", token, payload: { id: ticket.id, status: "Done" } }).error, /ถังขยะ/);

  const restored = call({ action: "restoreTask", token, actor: "arparat", payload: { id: ticket.id } });
  assert.equal(restored.task.deleted, false);
  assert.deepEqual(restored.task.assignees, ["tichaiyut", "sorawee"], "assignees survive the trip");
  data = call({ action: "bootstrap", token });
  assert.deepEqual([data.tasks.length, data.trash.length], [1, 0]);
});

test("deleted IDs are never handed out again", () => {
  const { call, login, sheets } = createKitchen();
  const { token } = login();
  seedTicket(call, token);
  const second = seedTicket(call, token, { newEpic: null, newStory: null, epicCode: "IFM", storyId: "IFM-PER" });
  call({ action: "deleteTask", token, payload: { id: second.id } });
  // even if the owner removes the row by hand, the Activity Log remembers the ID
  sheets["Work Items"].data.splice(2, 1);
  const third = seedTicket(call, token, { newEpic: null, newStory: null, epicCode: "IFM", storyId: "IFM-PER" });
  assert.equal(third.id, "IFM-PER-T0003");
});

test("edits every field of a ticket and keeps its ID within the same course", () => {
  const { call, login, sheets } = createKitchen();
  const { token } = login();
  const ticket = seedTicket(call, token);
  const result = call({
    action: "updateTask", token, actor: "tichaiyut",
    payload: { id: ticket.id, storyId: "IFM-PER", issueType: "Task", title: "Renamed", description: "More detail", dueDate: "2027-01-31", assignees: ["chonlasit"], status: "In Progress" },
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.previousId, "");
  assert.equal(result.task.id, ticket.id);
  assert.equal(result.task.title, "Renamed");
  assert.equal(result.task.description, "More detail");
  assert.equal(result.task.dueDate.slice(0, 10), "2027-01-31");
  assert.equal(result.task.status, "In Progress");
  assert.deepEqual(result.task.assignees, ["chonlasit"]);
  assert.equal(sheets["Task Assignees"].data.length, 2);
  assert.match(sheets["Activity Log"].data.at(-1)[7], /title, description, due date, status, chefs/);
});

test("moving to another course or type gives a new ID and carries references along", () => {
  const { call, chef, sheets } = createKitchen();
  const token = chef("sorawee");
  const ticket = seedTicket(call, token);
  call({ action: "createTask", token, payload: newOrder({ newEpic: null, epicCode: "IFM", newStory: { code: "DEN", name: "Daily Entry" }, title: "Other" }) });
  call({ action: "saveDailyPlan", token, payload: { planDate: "2026-09-30", personId: "sorawee", entries: [{ taskId: ticket.id, note: "keep me" }] } });

  const moved = call({
    action: "updateTask", token,
    payload: { id: ticket.id, storyId: "IFM-DEN", issueType: "Bug", title: ticket.title, description: "", dueDate: inTenDays(), assignees: ["sorawee"], status: "To Do" },
  });
  assert.equal(moved.ok, true, moved.error);
  assert.equal(moved.previousId, "IFM-PER-T0001");
  assert.equal(moved.task.id, "IFM-DEN-B0001");
  assert.equal(moved.task.story, "Daily Entry");
  assert.deepEqual(moved.task.assignees, ["sorawee"]);
  assert.ok(sheets["Task Assignees"].data.every((row, index) => index === 0 || row[0] !== "IFM-PER-T0001"));
  const plan = call({ action: "getDailyPlan", token, payload: { planDate: "2026-09-30", personId: "sorawee" } });
  assert.deepEqual(plan.entries, [{ taskId: "IFM-DEN-B0001", note: "keep me" }]);

  const next = seedTicket(call, token, { newEpic: null, newStory: null, epicCode: "IFM", storyId: "IFM-PER" });
  assert.equal(next.id, "IFM-PER-T0002", "the moved-away ID is not reused");
});

test("rejects invalid edits", () => {
  const { call, login } = createKitchen();
  const { token } = login();
  const ticket = seedTicket(call, token);
  const edit = (changes) => call({
    action: "updateTask", token,
    payload: { id: ticket.id, storyId: "IFM-PER", issueType: "Task", title: "ok", dueDate: inTenDays(), assignees: ["sorawee"], status: "To Do", ...changes },
  }).error;
  assert.match(edit({ title: "" }), /Title/);
  assert.match(edit({ storyId: "NOPE" }), /valid course/);
  assert.match(edit({ assignees: [] }), /chef/);
  assert.match(edit({ id: "IFM-PER-T9999" }), /not found/);
  call({ action: "deleteTask", token, payload: { id: ticket.id } });
  assert.match(edit({}), /ถังขยะ/);
});

test("the roster shows who still needs to set a PIN", () => {
  const { call, chef } = createKitchen();
  chef("sorawee");
  const roster = call({ action: "roster" });
  assert.equal(roster.ok, true);
  assert.deepEqual(roster.chefs.map((person) => [person.id, person.hasPin]), [
    ["arparat", false], ["tichaiyut", false], ["chonlasit", false], ["sorawee", true],
  ], "inactive people are not listed");
  assert.equal(JSON.stringify(roster).includes("HASH"), false);
});

test("setting a first PIN needs the team password and a non-obvious PIN", () => {
  const { call } = createKitchen();
  const setup = (overrides) => call({ action: "setupPin", personId: "tichaiyut", teamPassword: PASSWORD, pin: "7361", clientId: "c1", ...overrides });
  assert.match(setup({ pin: "123" }).error, /4 หลัก/);
  assert.match(setup({ pin: "1234" }).error, /เดาง่าย/);
  assert.match(setup({ pin: "0000" }).error, /เดาง่าย/);
  assert.match(setup({ personId: "bank" }).error, /ไม่พบเชฟ/, "inactive people cannot sign up");
  const wrong = setup({ teamPassword: "guess" });
  assert.equal(wrong.code, "WRONG_PASSWORD");
  const ok = setup({});
  assert.equal(ok.ok, true, ok.error);
  assert.deepEqual(ok.me, { kind: "chef", id: "tichaiyut", name: "Tichaiyut" });
  assert.equal(setup({ pin: "5555" }).code, "PIN_ALREADY_SET");
});

test("chefs sign in with their PIN and act under their own name", () => {
  const { call, chef, sheets } = createKitchen();
  chef("chonlasit");
  assert.equal(call({ action: "chefLogin", personId: "arparat", pin: "4829" }).code, "PIN_NOT_SET");
  const wrong = call({ action: "chefLogin", personId: "chonlasit", pin: "1111" });
  assert.equal(wrong.code, "WRONG_PASSWORD");
  assert.equal(wrong.remaining, 4);
  const session = call({ action: "chefLogin", personId: "Chonlasit", pin: PINS.chonlasit });
  assert.equal(session.ok, true, session.error);
  assert.equal(session.me.id, "chonlasit");
  const created = call({ action: "createTask", token: session.token, actor: "sorawee", payload: newOrder() });
  assert.equal(created.task.reporter, "chonlasit", "the actor comes from the session, not the request");
  assert.equal(sheets["Activity Log"].data.at(-1)[2], "chonlasit");
});

test("five wrong PINs lock that chef everywhere, but not the others", () => {
  const { call, chef, login } = createKitchen();
  chef("sorawee");
  chef("arparat");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    assert.equal(call({ action: "chefLogin", personId: "sorawee", pin: "9999", clientId: `device-${attempt}` }).code, "WRONG_PASSWORD");
  }
  const locked = call({ action: "chefLogin", personId: "sorawee", pin: "9999", clientId: "device-9" });
  assert.equal(locked.code, "LOCKED");
  assert.equal(call({ action: "chefLogin", personId: "sorawee", pin: PINS.sorawee }).code, "LOCKED", "switching browsers does not help");
  assert.equal(call({ action: "chefLogin", personId: "arparat", pin: PINS.arparat }).ok, true);
  assert.equal(login().ok, true, "the team password still works as a backup");
});

test("changing a PIN signs out that chef's other sessions only", () => {
  const { call, chef } = createKitchen();
  const oldToken = chef("sorawee");
  const other = chef("arparat");
  assert.equal(call({ action: "changePin", token: oldToken, currentPin: "0001", newPin: "8642" }).code, "WRONG_PASSWORD");
  assert.match(call({ action: "changePin", token: oldToken, currentPin: PINS.sorawee, newPin: "4444" }).error, /เดาง่าย/);
  const changed = call({ action: "changePin", token: oldToken, currentPin: PINS.sorawee, newPin: "8642" });
  assert.equal(changed.ok, true, changed.error);
  assert.equal(call({ action: "bootstrap", token: oldToken }).code, "AUTH");
  assert.equal(call({ action: "bootstrap", token: changed.token }).ok, true);
  assert.equal(call({ action: "bootstrap", token: other }).ok, true);
  assert.equal(call({ action: "chefLogin", personId: "sorawee", pin: "8642" }).ok, true);
});

test("the owner can reset a forgotten PIN", () => {
  const { call, chef, context } = createKitchen();
  const token = chef("sorawee");
  context.clearPin_("sorawee");
  assert.equal(call({ action: "bootstrap", token }).code, "AUTH");
  assert.equal(call({ action: "chefLogin", personId: "sorawee", pin: PINS.sorawee }).code, "PIN_NOT_SET");
  assert.equal(chef("sorawee", "3579").length > 0, true);
  assert.equal(call({ action: "changePin", token: call({ action: "login", password: PASSWORD, clientId: "x" }).token, currentPin: "3579", newPin: "8642" }).error.includes("รหัสทีม"), true);
});
