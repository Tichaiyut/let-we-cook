const DAY_MS = 86400000;

// Accepts "yyyy-mm-dd…" (what the Sheet API returns) and legacy "dd/mm/yyyy"
// (including Buddhist-era years). Dates are pinned to local noon so day math
// is never thrown off by the time of day.
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const parsed = new Date(`${text.slice(0, 10)}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += year >= 60 ? 2500 : 2000;
  if (year > 2400) year -= 543;
  const parsed = new Date(year, Number(match[2]) - 1, Number(match[1]), 12);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isoDate(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIso(now = new Date()) {
  return isoDate(now);
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}

export function formatDate(value, includeYear = true) {
  const date = parseDate(value);
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}

export function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

// Whole days from today until the date; negative when overdue.
export function daysUntil(value, now = new Date()) {
  const due = parseDate(value);
  if (!due) return Number.POSITIVE_INFINITY;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((due.getTime() - today.getTime()) / DAY_MS);
}

// Priority is always derived from the due date, never stored:
// Urgent 0–7 days (and overdue), High 8–14, Medium 15–30, Low > 30 or no due date.
export function priorityFor(dueDate, status, now = new Date()) {
  if (status === "Done") return "Done";
  const days = daysUntil(dueDate, now);
  if (!Number.isFinite(days)) return "Low";
  if (days <= 7) return "Urgent";
  if (days <= 14) return "High";
  if (days <= 30) return "Medium";
  return "Low";
}

export function countdownLabel(dueDate, status, now = new Date()) {
  if (status === "Done") return "Served";
  const days = daysUntil(dueDate, now);
  if (!Number.isFinite(days)) return "No due date";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return days === 1 ? "1 day" : `${days} days`;
}

// Oldest due date first; undated work goes last.
export function sortByDueDateOldestFirst(a, b) {
  const aDue = parseDate(a.dueDate);
  const bDue = parseDate(b.dueDate);
  if (!aDue && !bDue) return String(a.id).localeCompare(String(b.id));
  if (!aDue) return 1;
  if (!bDue) return -1;
  return aDue - bDue || String(a.id).localeCompare(String(b.id));
}
