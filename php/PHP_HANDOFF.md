# Let We Cook PHP handoff

Upload the complete contents of `php-release/` to the same directory on the PHP server:

- `tech_feed_todo.php`
- `index.html`
- `assets/`
- `avatars/`
- `apps-script/Code.gs`
- this handoff file

Do not upload only the PHP file: `assets/` contains the app and `avatars/` contains the four profile photos. The `apps-script/` folder is copied into the Apps Script editor; it does not need to be uploaded to cpfrun.

## Google Apps Script setup

The Google Apps Script must be connected to the new Let We Cook Google Sheet and deployed as a Web App. Paste its `/exec` URL and the shared API secret into the configuration at the beginning of `tech_feed_todo.php`.

The Script must return JSON and support the following requests. Every request includes `secret`; reject requests with a mismatched value.

### Read dashboard data

`GET /exec?secret=...`

Return:

```json
{
  "ok": true,
  "tasks": [],
  "people": [],
  "epics": [],
  "stories": []
}
```

Task fields used by the app:

```text
id / TaskID, title / Title, description / Description,
epic / Epic / Project, epicCode / EpicCode,
story / Story, storyId / StoryID, storyCode / StoryCode,
issueType / IssueType, status / Status, assignees / Assignees,
reporter / Reporter, createdDate / CreatedDate, dueDate / DueDate
```

`assignees` must be an array, for example `["chonlasit", "sorawee"]`.

### Create work item

`POST /exec`

```json
{
  "action": "createTask",
  "actor": "chonlasit",
  "payload": {
    "epicCode": "IFL",
    "newEpic": null,
    "storyId": "IFL-PER",
    "newStory": null,
    "title": "Create monthly KPI query",
    "description": "",
    "issueType": "Task",
    "assignees": ["chonlasit", "sorawee"],
    "status": "To Do",
    "dueDate": "2026-08-20"
  },
  "secret": "..."
}
```

Return `{ "ok": true, "task": { ...created task... } }`.

### Update status

`POST /exec`

```json
{
  "action": "updateStatus",
  "actor": "team",
  "payload": { "id": "IFL-PER-T001", "status": "Done" },
  "secret": "..."
}
```

Return `{ "ok": true }`.

### Save Today Plan

`POST /exec`

```json
{
  "action": "saveDailyPlan",
  "actor": "sorawee",
  "payload": {
    "planDate": "2026-08-09",
    "personId": "sorawee",
    "entries": [{ "taskId": "IFL-PER-T001", "note": "Finish chart layout" }]
  },
  "secret": "..."
}
```

Store these records in a separate `Daily Plan` sheet. Return `{ "ok": true }`.

## Security

The PHP file already enforces the shared password, a 2-hour session, and a 2-hour lock after 5 wrong attempts. Before upload, replace `CHANGE_THIS_TO_A_LONG_RANDOM_DEPLOYMENT_SECRET` with a long random value. The server needs PHP with cURL enabled and permission to write to its temporary directory.
