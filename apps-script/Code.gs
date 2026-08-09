/*
 * Let We Cook Google Apps Script API
 *
 * Attach this Apps Script to the NEW Google Sheet, set the two values below,
 * then Deploy > New deployment > Web app and copy the /exec URL into PHP.
 */

const CONFIG = {
  spreadsheetId: '1ODlK7BtOrpNGKioG8fb2eYH6hG1c_E4N99qQ9pjFjxo',
  apiSecret: 'PASTE_THE_SAME_SHARED_API_SECRET_HERE',
  tasksSheet: 'Tasks',
  dailyPlanSheet: 'Daily Plan',
};

const TASK_HEADERS = [
  'ID', 'Title', 'Description', 'EpicCode', 'Epic', 'EpicColor',
  'StoryID', 'StoryCode', 'Story', 'IssueType', 'Status', 'Assignees',
  'Reporter', 'CreatedDate', 'DueDate',
];
const PLAN_HEADERS = ['PlanDate', 'PersonID', 'TaskID', 'Note', 'SavedAt'];

function doGet(event) {
  if (!isAuthorized_(event && event.parameter && event.parameter.secret)) return json_({ ok: false, error: 'Unauthorized' });
  return json_(readDashboard_());
}

function doPost(event) {
  let request = {};
  try { request = JSON.parse((event.postData && event.postData.contents) || '{}'); } catch (_) {}
  if (!isAuthorized_(request.secret)) return json_({ ok: false, error: 'Unauthorized' });

  try {
    switch (request.action) {
      case 'createTask': return json_(createTask_(request.actor || '', request.payload || {}));
      case 'updateStatus': return json_(updateStatus_(request.actor || '', request.payload || {}));
      case 'saveDailyPlan': return json_(saveDailyPlan_(request.actor || '', request.payload || {}));
      default: return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (error) {
    return json_({ ok: false, error: error.message || 'Unexpected Apps Script error' });
  }
}

function isAuthorized_(secret) {
  return secret && String(secret) === String(CONFIG.apiSecret);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function spreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.spreadsheetId);
}

function sheetWithHeaders_(name, headers) {
  const spreadsheet = spreadsheet_();
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function readRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    const output = {};
    headers.forEach((header, index) => output[header] = row[index]);
    return output;
  });
}

function dateValue_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}

function asAssignees_(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  try {
    const parsed = JSON.parse(String(value || '[]'));
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
  } catch (_) {}
  return String(value || '').split(/\s*[,;|]\s*/).filter(Boolean);
}

function asTask_(row) {
  return {
    id: String(row.ID || ''),
    title: String(row.Title || ''),
    description: String(row.Description || ''),
    epicCode: String(row.EpicCode || ''),
    epic: String(row.Epic || 'General'),
    epicColor: String(row.EpicColor || ''),
    storyId: String(row.StoryID || ''),
    storyCode: String(row.StoryCode || ''),
    story: String(row.Story || ''),
    issueType: String(row.IssueType || 'Task'),
    status: String(row.Status || 'To Do'),
    assignees: asAssignees_(row.Assignees),
    reporter: String(row.Reporter || ''),
    createdDate: dateValue_(row.CreatedDate),
    dueDate: dateValue_(row.DueDate),
  };
}

function readDashboard_() {
  const rows = readRows_(sheetWithHeaders_(CONFIG.tasksSheet, TASK_HEADERS));
  const tasks = rows.map(asTask_);
  const people = ['chonlasit', 'sorawee', 'tichaiyut', 'arparat'].map(id => ({ id, name: id[0].toUpperCase() + id.slice(1), active: true }));
  const epics = [];
  const stories = [];
  const seenEpics = {};
  const seenStories = {};
  tasks.forEach(task => {
    if (task.epicCode && !seenEpics[task.epicCode]) {
      seenEpics[task.epicCode] = true;
      epics.push({ code: task.epicCode, name: task.epic, color: task.epicColor || '#4d77d8' });
    }
    if (task.storyId && !seenStories[task.storyId]) {
      seenStories[task.storyId] = true;
      stories.push({ id: task.storyId, epicCode: task.epicCode, code: task.storyCode, name: task.story });
    }
  });
  return { ok: true, tasks, people, epics, stories };
}

function createTask_(actor, payload) {
  const sheet = sheetWithHeaders_(CONFIG.tasksSheet, TASK_HEADERS);
  const epics = readDashboard_().epics;
  const currentEpic = epics.find(item => item.code === payload.epicCode);
  const epic = payload.newEpic || currentEpic;
  if (!epic || !epic.code || !epic.name) throw new Error('Epic is required');

  const stories = readDashboard_().stories;
  const selectedStory = stories.find(item => item.id === payload.storyId);
  const story = payload.newStory || selectedStory;
  if (!story || !story.code || !story.name) throw new Error('Story is required');

  const issueType = String(payload.issueType || 'Task') === 'Bug' ? 'Bug' : 'Task';
  const prefix = [epic.code, story.code, issueType === 'Bug' ? 'B' : 'T'].join('-');
  const ids = readRows_(sheet).map(row => String(row.ID || ''));
  const next = ids.reduce((highest, id) => {
    const match = id.match(new RegExp('^' + prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '(\\d+)$'));
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
  const id = prefix + String(next).padStart(3, '0');
  const createdDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const task = {
    id,
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    epicCode: String(epic.code).trim(),
    epic: String(epic.name).trim(),
    epicColor: String(epic.color || '#4d77d8'),
    storyId: String(payload.storyId || (epic.code + '-' + story.code)),
    storyCode: String(story.code).trim(),
    story: String(story.name).trim(),
    issueType,
    status: String(payload.status || 'To Do'),
    assignees: asAssignees_(payload.assignees),
    reporter: String(actor || payload.assignees && payload.assignees[0] || ''),
    createdDate,
    dueDate: String(payload.dueDate || ''),
  };
  if (!task.title || !task.dueDate) throw new Error('Title and due date are required');
  sheet.appendRow([task.id, task.title, task.description, task.epicCode, task.epic, task.epicColor, task.storyId, task.storyCode, task.story, task.issueType, task.status, JSON.stringify(task.assignees), task.reporter, task.createdDate, task.dueDate]);
  return { ok: true, task };
}

function updateStatus_(_actor, payload) {
  const id = String(payload.id || '');
  const status = String(payload.status || '');
  if (!id || !['To Do', 'In Progress', 'Done', 'Backlog'].includes(status)) throw new Error('Invalid task or status');
  const sheet = sheetWithHeaders_(CONFIG.tasksSheet, TASK_HEADERS);
  const rows = readRows_(sheet);
  const rowIndex = rows.findIndex(row => String(row.ID) === id);
  if (rowIndex < 0) throw new Error('Task not found');
  sheet.getRange(rowIndex + 2, TASK_HEADERS.indexOf('Status') + 1).setValue(status);
  return { ok: true };
}

function saveDailyPlan_(_actor, payload) {
  const planDate = String(payload.planDate || '');
  const personId = String(payload.personId || '');
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  if (!planDate || !personId) throw new Error('Plan date and person are required');
  const sheet = sheetWithHeaders_(CONFIG.dailyPlanSheet, PLAN_HEADERS);
  const rows = readRows_(sheet);
  for (let index = rows.length - 1; index >= 0; index--) {
    if (dateValue_(rows[index].PlanDate) === planDate && String(rows[index].PersonID) === personId) sheet.deleteRow(index + 2);
  }
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  entries.forEach(entry => sheet.appendRow([planDate, personId, String(entry.taskId || ''), String(entry.note || ''), now]));
  return { ok: true };
}
