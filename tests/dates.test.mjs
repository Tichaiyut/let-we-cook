import assert from "node:assert/strict";
import test from "node:test";
import { countdownLabel, daysUntil, parseDate, priorityFor, sortByDueDateOldestFirst } from "../src/lib/dates.js";
import { normalizeStatus, normalizeTask } from "../src/lib/kitchen.js";

const at = (text) => new Date(text);

test("parses ISO, ISO-with-time and Buddhist-era dates", () => {
  assert.equal(parseDate("2026-08-20").getDate(), 20);
  assert.equal(parseDate("2026-08-20T00:00:00+07:00").getDate(), 20);
  assert.equal(parseDate("20/08/2569").getFullYear(), 2026);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate("not a date"), null);
});

test("days until due ignores the time of day", () => {
  assert.equal(daysUntil("2026-09-30", at("2026-09-30T08:00:00")), 0);
  assert.equal(daysUntil("2026-09-30", at("2026-09-30T23:30:00")), 0);
  assert.equal(daysUntil("2026-10-01", at("2026-09-30T08:00:00")), 1);
  assert.equal(daysUntil("2026-09-28", at("2026-09-30T08:00:00")), -2);
  assert.equal(daysUntil("", at("2026-09-30T08:00:00")), Number.POSITIVE_INFINITY);
});

test("priority follows the due-date rule", () => {
  const now = at("2026-09-30T10:00:00");
  assert.equal(priorityFor("2026-09-25", "To Do", now), "Urgent");
  assert.equal(priorityFor("2026-10-07", "To Do", now), "Urgent");
  assert.equal(priorityFor("2026-10-08", "To Do", now), "High");
  assert.equal(priorityFor("2026-10-14", "To Do", now), "High");
  assert.equal(priorityFor("2026-10-15", "To Do", now), "Medium");
  assert.equal(priorityFor("2026-10-30", "To Do", now), "Medium");
  assert.equal(priorityFor("2026-10-31", "To Do", now), "Low");
  assert.equal(priorityFor("", "In Progress", now), "Low");
  assert.equal(priorityFor("2026-09-01", "Done", now), "Done");
});

test("countdown labels", () => {
  const now = at("2026-09-30T10:00:00");
  assert.equal(countdownLabel("2026-09-30", "To Do", now), "Due today");
  assert.equal(countdownLabel("2026-10-01", "To Do", now), "1 day");
  assert.equal(countdownLabel("2026-09-27", "To Do", now), "3d overdue");
  assert.equal(countdownLabel("2026-09-27", "Done", now), "Served");
});

test("sorts oldest due date first and undated last", () => {
  const items = [{ id: "C", dueDate: "" }, { id: "B", dueDate: "2026-10-02" }, { id: "A", dueDate: "2026-10-01" }];
  assert.deepEqual(items.sort(sortByDueDateOldestFirst).map((item) => item.id), ["A", "B", "C"]);
});

test("normalizes statuses and API tasks", () => {
  assert.equal(normalizeStatus("Review"), "In Progress");
  assert.equal(normalizeStatus("todo"), "To Do");
  assert.equal(normalizeStatus(""), "Backlog");
  const task = normalizeTask({ id: "IFM-PER-B0001", epic: "iFarm", epicColor: "#2f72e8", issueType: "bug", status: "Done", assignees: ["sorawee", ""] });
  assert.equal(task.issueType, "Bug");
  assert.equal(task.priority, "Done");
  assert.equal(task.color, "#2f72e8");
  assert.deepEqual(task.assignees, ["sorawee"]);
});
