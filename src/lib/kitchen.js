import { priorityFor } from "./dates.js";

// The data model stays Epic → Story → Task/Bug; the UI always speaks kitchen.
export const TERMS = {
  epic: "Menu",
  story: "Course",
  Task: "Food Piece",
  Bug: "Kitchen Issue",
};

export const BOARD_STATUSES = ["To Do", "In Progress", "Done"];
export const ALL_STATUSES = ["Backlog", ...BOARD_STATUSES];

export const STATIONS = {
  "To Do": { name: "Ready to Prep", thai: "รอเตรียม", tone: "prep" },
  "In Progress": { name: "Cooking", thai: "กำลังปรุง", tone: "cooking" },
  Done: { name: "Served", thai: "เสิร์ฟแล้ว", tone: "served" },
  Backlog: { name: "Pantry", thai: "เก็บในคลัง", tone: "pantry" },
};

export const PRIORITIES = ["Urgent", "High", "Medium", "Low"];

const FALLBACK_COLORS = ["#d8572a", "#2f72e8", "#1f8a70", "#9138d7", "#e0a100", "#c2417a", "#5d8390"];

export function hashColor(value) {
  let hash = 0;
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function menuColor(task) {
  return /^#[0-9a-f]{6}$/i.test(task?.epicColor || "") ? task.epicColor : hashColor(task?.epicCode || task?.epic || "General");
}

export function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (["done", "complete", "completed"].includes(status)) return "Done";
  if (["in progress", "review", "in review"].includes(status)) return "In Progress";
  if (["to do", "todo"].includes(status)) return "To Do";
  return "Backlog";
}

export function normalizeTask(task, now = new Date()) {
  const status = normalizeStatus(task.status);
  const assignees = (Array.isArray(task.assignees) ? task.assignees : [task.assignee]).filter(Boolean).map(String);
  const epic = String(task.epic || task.epicCode || "General").trim();
  const normalized = {
    id: String(task.id || ""),
    title: String(task.title || "Untitled task"),
    description: String(task.description || ""),
    epic,
    epicCode: String(task.epicCode || ""),
    epicColor: String(task.epicColor || ""),
    story: task.story ? String(task.story) : "",
    storyId: String(task.storyId || ""),
    issueType: String(task.issueType || "").toLowerCase() === "bug" ? "Bug" : "Task",
    status,
    assignees,
    reporter: String(task.reporter || ""),
    createdDate: String(task.createdDate || ""),
    dueDate: String(task.dueDate || ""),
    priority: priorityFor(task.dueDate, status, now),
    deleted: Boolean(task.deleted),
    deletedAt: String(task.deletedAt || ""),
    deletedBy: String(task.deletedBy || ""),
  };
  normalized.color = menuColor(normalized);
  return normalized;
}
