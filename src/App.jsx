import { useEffect, useMemo, useState } from "react";
import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  ChefHat,
  ClipboardText,
  Clock,
  GridFour,
  Info,
  LockKey,
  Plus,
  Prohibit,
  SquaresFour,
  Tray,
  User,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

const apiUrl = (name) => window.__LWC_PHP_API?.[name] || `/api/${name}`;
const DATA_URL = apiUrl("data");
const IS_LOCAL_PREVIEW = import.meta.env.DEV;
const ACTIVE_TEAM = ["chonlasit", "sorawee", "tichaiyut", "arparat"];
const ACTIVE_TEAM_LABELS = {
  chonlasit: "Chonlasit",
  sorawee: "Sorawee",
  tichaiyut: "Tichaiyut",
  arparat: "Arparat",
};
const ASSET_BASE = window.__LWC_ASSET_BASE || "";
const AVATAR_IMAGES = {
  arparat: `${ASSET_BASE}/avatars/arparat.png`,
  tichaiyut: `${ASSET_BASE}/avatars/tichaiyut.png`,
  chonlasit: `${ASSET_BASE}/avatars/chonlasit.png`,
  sorawee: `${ASSET_BASE}/avatars/sorawee.png`,
};
const KITCHEN_TYPE = { Task: "Food Piece", Bug: "Kitchen Issue" };
const KITCHEN_STATUS = { "To Do": "Ready to Prep", "In Progress": "Cooking", Done: "Served" };
const NORMAL_TYPE = { Task: "Task", Bug: "Bug" };
const CHARACTERS = [
  { id: "arparat", name: "Arparat", title: "Saint - Chan", role: "Data Provider", specialty: "Data supply & quality" },
  { id: "chonlasit", name: "Chonlasit", title: "Bon - Kun", role: "AI Engineer", specialty: "AI models & automation" },
  { id: "sorawee", name: "Sorawee", title: "Ing - Kun", role: "Web Developer", specialty: "Web apps & experience" },
  { id: "tichaiyut", name: "Tichaiyut", title: "Topu - Kun", role: "Data Scientist", specialty: "Insights & analytics" },
];
const BOARD_STATUSES = ["To Do", "In Progress", "Done"];
const NOW = new Date();

const FALLBACK_TASKS = [
  { TaskID: "AIR-221", Title: "เพิ่มสิทธิภาพเพิ่มอัตราคละสะสมเพิ่มขึ้นจากเดิม", Project: "AIR-STATION", Status: "To Do", Assignee: "sorawee", StartDate: "2026-07-14", DueDate: "2026-07-24" },
  { TaskID: "IF-314", Title: "ปรับปรุงหน้าจอ Dashboard NH3", Project: "ifarm ไก่ไข่", Status: "To Do", Assignee: "tichaiyut", StartDate: "2026-07-17", DueDate: "2026-07-29" },
  { TaskID: "SA-187", Title: "แก้ไขบริการคำนวณยอดชำระ", Project: "SuperAPP", Status: "To Do", Assignee: "sorawee", StartDate: "2026-07-16", DueDate: "2026-07-31" },
  { TaskID: "AI-102", Title: "เทรนโมเดลการจัดกลุ่มลูกค้า", Project: "AI", Status: "In Progress", Assignee: "chonlasit", StartDate: "2026-07-06", DueDate: "2026-08-11" },
  { TaskID: "PB-88", Title: "สร้าง Dashboard ยอดขายรายวัน", Project: "Power BI", Status: "In Progress", Assignee: "tichaiyut", StartDate: "2026-07-07", DueDate: "2026-08-18" },
  { TaskID: "SA-175", Title: "ออกแบบหน้าจอโปรโมชั่นใหม่", Project: "SuperAPP", Status: "Done", Assignee: "arparat", StartDate: "2026-07-01", DueDate: "2026-07-10" },
];

const PROJECT_COLORS = {
  AI: "#9138d7",
  "AIR-STATION": "#15a4a0",
  "ifarm ไก่ไข่": "#2f72e8",
  "ifarm ไก่เนื้อ": "#4c87f2",
  SuperAPP: "#f37818",
  "Power BI": "#e6ae00",
  Document: "#7a8798",
  "Web Internal": "#d34b7f",
  HMI: "#3d9d67",
  ifarm: "#5d75d8",
  CPFFeedSolution: "#c76c37",
  "AIR-STATION ": "#15a4a0",
};

function hashColor(value) {
  const palette = ["#4d77d8", "#ba4f78", "#2c9470", "#9a64c8", "#bf7b2f", "#5d8390"];
  let hash = 0;
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function projectColor(project) {
  return PROJECT_COLORS[String(project || "").trim()] || hashColor(project || "General");
}

function displayPersonName(name) {
  const value = String(name || "");
  return ACTIVE_TEAM_LABELS[value.toLowerCase()] || value;
}

function assigneeMatches(taskAssignee, selectedAssignee) {
  if (selectedAssignee === "All") return true;
  const values = Array.isArray(taskAssignee) ? taskAssignee : [taskAssignee];
  return values.some((value) => String(value || "").toLowerCase() === String(selectedAssignee || "").toLowerCase());
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (["done", "complete", "completed"].includes(status)) return "Done";
  if (["in progress", "review", "in review"].includes(status)) return "In Progress";
  if (["to do", "todo"].includes(status)) return "To Do";
  return "Backlog";
}

function normalizeIssueType(value) {
  return String(value || "").trim().toLowerCase() === "bug" ? "Bug" : "Task";
}

function parseDate(value) {
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

function isoDate(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value, includeYear = true) {
  const date = parseDate(value);
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}

function daysUntil(value) {
  const due = parseDate(value);
  if (!due) return Number.POSITIVE_INFINITY;
  return Math.ceil((due.getTime() - NOW.getTime()) / 86400000);
}

function sortByDueDateOldestFirst(a, b) {
  const aDue = parseDate(a.dueDate);
  const bDue = parseDate(b.dueDate);

  if (!aDue && !bDue) return a.id.localeCompare(b.id);
  if (!aDue) return 1;
  if (!bDue) return -1;
  return aDue - bDue || a.id.localeCompare(b.id);
}

function priorityFor(value, status) {
  if (status === "Done") return "Done";
  const days = daysUntil(value);
  if (!Number.isFinite(days)) return "Low";
  if (days <= 7) return "Urgent";
  if (days <= 14) return "High";
  if (days <= 30) return "Medium";
  return "Low";
}

function normalizeTask(task, index) {
  const status = normalizeStatus(task.status ?? task.Status);
  const dueDate = task.dueDate ?? task.DueDate ?? "";
  const epic = String(task.epic ?? task.Epic ?? task.Project ?? "General").trim();
  const assignees = Array.isArray(task.assignees)
    ? task.assignees.filter(Boolean)
    : [task.assignee ?? task.Assignee].filter(Boolean);
  return {
    id: task.id ?? task.WorkItemID ?? task.TaskID ?? `TF-${index + 1}`,
    title: task.title ?? task.Title ?? "Untitled task",
    description: task.description ?? task.Description ?? "",
    project: epic,
    epic,
    epicCode: task.epicCode ?? task.EpicCode ?? "",
    epicColor: task.epicColor ?? "",
    story: task.story ?? task.Story ?? null,
    storyId: task.storyId ?? task.StoryID ?? "",
    issueType: normalizeIssueType(task.issueType ?? task.IssueType),
    parentId: task.parentId ?? task.ParentID ?? null,
    status,
    assignees,
    assignee: assignees[0] || "Unassigned",
    reporter: task.reporter ?? task.Reporter ?? "",
    createdDate: task.createdDate ?? task.StartDate ?? "",
    dueDate,
    priority: task.priority ?? priorityFor(dueDate, status),
  };
}

function normalizeStoredTask(task, index) {
  const epic = String(task.epic || task.project || "General").trim();
  const status = normalizeStatus(task.status);
  const dueDate = task.dueDate || "";
  return {
    ...task,
    id: task.id || `LOCAL-${index + 1}`,
    title: task.title || "Untitled task",
    description: task.description || "",
    project: epic,
    epic,
    story: task.story || null,
    issueType: normalizeIssueType(task.issueType),
    parentId: task.parentId || null,
    status,
    dueDate,
    priority: priorityFor(dueDate, status),
  };
}

function Avatar({ name, size = 30 }) {
  const image = AVATAR_IMAGES[String(name || "").toLowerCase()];
  return (
    <span className={`avatar-placeholder ${image ? "has-image" : ""}`} style={{ width: size, height: size }} title={displayPersonName(name)}>
      {image ? <img src={image} alt={displayPersonName(name)} /> : <User size={Math.round(size * 0.6)} />}
    </span>
  );
}

function AssigneeStack({ names = [], size = 22 }) {
  const values = (Array.isArray(names) ? names : [names]).filter(Boolean);
  return (
    <span className="assignee-stack" title={values.map(displayPersonName).join(", ")}>
      {values.slice(0, 4).map((name, index) => <Avatar key={`${name}-${index}`} name={name} size={size} />)}
      {values.length > 4 && <b>+{values.length - 4}</b>}
    </span>
  );
}

function Filter({ label, value, options, onChange, icon }) {
  return (
    <label className="filter-control">
      <span className="sr-only">{label}</span>
      {icon}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="All">{label}: All</option>
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option
              key={item.value}
              value={item.value}
              className={item.muted ? "former-member-option" : ""}
            >
              {item.label}
            </option>
          );
        })}
      </select>
      <CaretDown size={14} />
    </label>
  );
}

function PriorityPill({ task }) {
  const priority = task.priority;
  const days = daysUntil(task.dueDate);
  const countdown = task.status === "Done"
    ? "Done"
    : !Number.isFinite(days)
      ? "No due date"
      : days < 0
        ? `${Math.abs(days)}d overdue`
        : days === 0
          ? "Today"
          : `${days} days`;
  return (
    <span className="priority-wrap">
      <span className={`priority-pill priority-${priority.toLowerCase()}`}>{priority}</span>
      <b className={days < 0 ? "is-overdue" : ""}>{countdown}</b>
    </span>
  );
}

function TaskCard({ task, onDragStart, onAdd, canPlan, isKitchen, onOpen }) {
  return (
    <article
      className="task-card"
      style={{ "--project": projectColor(task.project) }}
      draggable={canPlan}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task);
        }
      }}
      onDragStart={(event) => {
        if (!canPlan) {
          event.preventDefault();
          return;
        }
        onDragStart(event, task.id);
      }}
    >
      <div className="task-key-row">
        <span className="task-key">{task.id}</span>
        <span className={`issue-type issue-${task.issueType.toLowerCase()}`}>{(isKitchen ? KITCHEN_TYPE : NORMAL_TYPE)[task.issueType]}</span>
      </div>
      <h3>{task.title}</h3>
      <div className="task-hierarchy" title={`${task.epic} › ${task.story || "Unassigned story"}`}>
        <b>{task.epic}</b><span>›</span><em>{task.story || "No course yet"}</em>
      </div>
      <div className="assignee-line"><AssigneeStack names={task.assignees || [task.assignee]} size={19} /><span>{(task.assignees || [task.assignee]).map(displayPersonName).join(", ")}</span></div>
      <div className="date-line">
        <span><CalendarBlank size={13} /> Created {formatDate(task.createdDate)}</span>
        <span>Due {formatDate(task.dueDate)}</span>
      </div>
      <div className="card-foot">
        <button
          type="button"
          disabled={!canPlan}
          onClick={(event) => {
            event.stopPropagation();
            if (canPlan) onAdd(task);
          }}
          aria-label={canPlan ? `Add ${task.title} to today's plan` : "Select a team member before adding tasks"}
        >
          <Plus size={13} /> Today
        </button>
        <PriorityPill task={task} />
      </div>
    </article>
  );
}

function TaskDetailModal({ task, isKitchen, onClose, onSave }) {
  const [status, setStatus] = useState(task.status);
  const typeLabel = (isKitchen ? KITCHEN_TYPE : NORMAL_TYPE)[task.issueType];
  const hierarchy = isKitchen ? { epic: "Menu", story: "Course" } : { epic: "Epic", story: "Story" };

  useEffect(() => setStatus(task.status), [task]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="task-detail" style={{ "--project": projectColor(task.project) }} aria-label="Task details">
        <header className="task-detail__header">
          <div><span className="task-key">{task.id}</span><span className={`issue-type issue-${task.issueType.toLowerCase()}`}>{typeLabel}</span></div>
          <button type="button" onClick={onClose} aria-label="Close task details"><X size={19} /></button>
        </header>
        <div className="task-detail__title"><h2>{task.title}</h2><p>{task.description || "No additional description for this work item."}</p></div>
        <div className="detail-hierarchy">
          <div><small>{hierarchy.epic}</small><b>{task.epic}</b></div>
          <span>›</span>
          <div><small>{hierarchy.story}</small><b>{task.story || (isKitchen ? "No course yet" : "Unassigned story")}</b></div>
        </div>
        <div className="detail-grid">
          <div><small>Assignees</small><span><AssigneeStack names={task.assignees || [task.assignee]} size={24} />{(task.assignees || [task.assignee]).map(displayPersonName).join(", ")}</span></div>
          <label><small>Status</small><select value={status} onChange={(event) => setStatus(event.target.value)}>{BOARD_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <div><small>Created</small><b>{formatDate(task.createdDate)}</b></div>
          <div><small>Due date</small><b>{formatDate(task.dueDate)}</b></div>
          <div><small>Priority</small><PriorityPill task={{ ...task, status }} /></div>
        </div>
        <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={() => onSave(task.id, status)}>Save status</button></footer>
      </section>
    </div>
  );
}

function Timeline({ tasks, isKitchen, quarter, onQuarterChange }) {
  const datedTasks = tasks.filter((task) => parseDate(task.dueDate));
  const currentMonthStart = new Date(NOW.getFullYear(), NOW.getMonth(), 1);
  const monthCount = 3;
  const normalizedStart = new Date(quarter.year, quarter.index * 3, 1);
  const end = new Date(quarter.year, quarter.index * 3 + 3, 0);
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(normalizedStart.getFullYear(), normalizedStart.getMonth() + index, 1);
    return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(date).replace(" ", " ’");
  });
  const span = end.getTime() - normalizedStart.getTime();
  const marks = datedTasks.filter((task) => {
    const due = parseDate(task.dueDate);
    return due >= normalizedStart && due <= end;
  }).sort((a, b) => {
    const aDue = parseDate(a.dueDate);
    const bDue = parseDate(b.dueDate);
    const aIsPast = aDue < currentMonthStart;
    const bIsPast = bDue < currentMonthStart;

    if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
    return aDue - bDue;
  });
  const yearLabel = months.length ? `${normalizedStart.getFullYear()}–${end.getFullYear()}` : NOW.getFullYear();

  return (
    <section className="timeline-card">
      <header>
        <CalendarBlank size={17} />
        <strong>{isKitchen ? "Kitchen Timeline" : "Task Timeline"}</strong>
        <div className="quarter-nav">
          <button type="button" onClick={() => onQuarterChange(-1)} aria-label="Previous quarter"><CaretLeft size={15} /></button>
          <b>{`Q${quarter.index + 1} ${quarter.year}`}</b>
          <button type="button" onClick={() => onQuarterChange(1)} aria-label="Next quarter"><CaretRight size={15} /></button>
        </div>
        <small>Scroll horizontally to view the full range</small>
      </header>
      <div className="timeline-scroll">
        <div className="timeline-gantt" style={{ "--month-count": monthCount }}>
          <div className="timeline-gantt__header">
            <strong>{isKitchen ? "Food Piece" : "Task"}</strong>
            <div className="month-labels">{months.map((month) => <span key={month}>{month}</span>)}</div>
          </div>
          <div className="timeline-rows">
            {marks.map((task) => {
              const due = parseDate(task.dueDate);
              const rawCreated = parseDate(task.createdDate);
              const created = rawCreated && rawCreated <= due
                ? rawCreated
                : new Date(due.getTime() - 4 * 86400000);
              const clampedDue = Math.max(0, Math.min(1, (due.getTime() - normalizedStart.getTime()) / span));
              const clampedStart = Math.max(0, Math.min(clampedDue, (created.getTime() - normalizedStart.getTime()) / span));
              const width = Math.max(1.5, (clampedDue - clampedStart) * 100);
              return (
                <div
                  className={`timeline-row ${due < currentMonthStart ? "is-past" : "is-current-future"}`}
                  key={task.id}
                >
                  <div className="timeline-task-label">
                    <i style={{ background: projectColor(task.project) }} />
                    <span>
                      <b>{task.id}</b>
                      <strong title={task.title}>{task.title}</strong>
                    </span>
                    <small>{formatDate(created, false)} – {formatDate(due, false)}</small>
                  </div>
                  <div className="timeline-track">
                    {months.map((month) => <i key={month} />)}
                    <span
                      title={`${task.id} · ${formatDate(created)} – ${formatDate(due)}`}
                      className="timeline-bar"
                      style={{
                        left: `${clampedStart * 100}%`,
                        width: `${Math.min(width, 100 - clampedStart * 100)}%`,
                        background: projectColor(task.project),
                      }}
                    >
                      {width > 9 ? task.project : ""}
                    </span>
                  </div>
                </div>
              );
            })}
            {marks.length === 0 && <div className="timeline-empty">No dated tasks match the current filters.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function TodayPlan({ tasks, currentUser, setCurrentUser, planDate, setPlanDate, entries, addTask, updateNote, removeTask, savePlan, isKitchen }) {
  const canPlan = currentUser !== "All";
  return (
    <section className="today-panel" onDragOver={(event) => {
      if (canPlan) event.preventDefault();
    }} onDrop={(event) => {
      event.preventDefault();
      if (!canPlan) return;
      const id = event.dataTransfer.getData("text/task-id");
      const task = tasks.find((item) => item.id === id);
      if (task) addTask(task);
    }}>
      <header><ChefHat size={18} weight="bold" /><strong>{isKitchen ? "What are you going to cook today?" : "Today's Plan"}</strong></header>
      <div className="plan-controls">
        <label><span>You</span><div><Avatar name={currentUser} size={24} /><select value={currentUser} onChange={(event) => setCurrentUser(event.target.value)}><option value="All">All</option>{ACTIVE_TEAM.map((name) => <option key={name} value={name}>{displayPersonName(name)}</option>)}</select><CaretDown size={12} /></div></label>
        <label><span>Plan for</span><div><CalendarBlank size={14} /><input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} /></div></label>
      </div>
      <div className={`drop-zone ${canPlan ? "" : "is-disabled"}`}>
        {canPlan ? <Tray size={25} /> : <LockKey size={24} />}
        <strong>{canPlan ? "Drag & drop tasks here" : "Select a team member first"}</strong>
        <span>{canPlan ? "or click “Today” on a task" : "Kanban shows all tasks until a member is selected."}</span>
        <small>{canPlan ? "Source tasks stay on the Kanban board." : "Planning is disabled while You is set to All."}</small>
      </div>
      <div className="plan-list">
        {entries.length === 0 ? (
          <div className="plan-empty">ยังไม่มีงานในแผนวันนี้</div>
        ) : entries.map(({ task, note }) => (
          <article className="plan-item" key={task.id} style={{ "--project": projectColor(task.project) }}>
            <div className="plan-item__top">
              <span className="fake-check" />
              <b>{task.id}</b>
              <span><CalendarBlank size={12} />{formatDate(task.dueDate, false)}</span>
              <span className={`mini-priority ${task.priority.toLowerCase()}`}>{task.priority}</span>
              <button type="button" onClick={() => removeTask(task.id)} aria-label={`Remove ${task.title}`}><X size={12} /></button>
            </div>
            <strong>{task.title}</strong>
            <textarea
              rows={1}
              value={note}
              onChange={(event) => {
                updateNote(task.id, event.target.value);
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
              }}
              placeholder="Add a quick note (optional)..."
            />
          </article>
        ))}
      </div>
      <button className="save-plan" type="button" disabled={!canPlan} onClick={savePlan}><CalendarBlank size={16} /> Save Daily Plan</button>
    </section>
  );
}

function HierarchyGuide() {
  return (
    <section className="hierarchy-guide" aria-label="Work item hierarchy">
      <small>Work hierarchy</small>
      <div>
        <span><b>Epic</b><em>Menu</em></span><i>›</i>
        <span><b>Story</b><em>Course</em></span><i>›</i>
        <span><b>Task</b><em>Food Piece</em></span><i>+</i>
        <span className="bug"><b>Bug</b><em>Kitchen Issue</em></span>
      </div>
      <p>Epic groups the work, Story is a feature, and Task or Bug is the item to complete.</p>
    </section>
  );
}

function CharacterRoster({ tasks }) {
  return (
    <section className="character-page">
      <header><span>TechFeed Party</span><h1>Choose your kitchen crew</h1><p>Each character card reflects the current work on the board.</p></header>
      <div className="character-grid">
        {CHARACTERS.map((character) => {
          const memberTasks = tasks.filter((task) => assigneeMatches(task.assignees || task.assignee, character.id));
          const done = memberTasks.filter((task) => task.status === "Done").length;
          const completeness = memberTasks.length ? Math.round((done / memberTasks.length) * 100) : 0;
          const projects = [...new Set(memberTasks.map((task) => task.project))].slice(0, 4);
          return (
            <article className="character-card" key={character.id}>
              <div className="character-card__portrait"><img src={AVATAR_IMAGES[character.id]} alt={character.name} /></div>
              <div className="character-card__identity"><small>{character.role}</small><h2>{character.title}</h2><b>{character.name}</b><p>{character.specialty}</p></div>
              <div className="character-stats"><span><b>{memberTasks.length}</b> Food Pieces</span><span><b>{completeness}%</b> Completeness</span></div>
              <div className="character-projects"><small>Current menus</small><div>{projects.length ? projects.map((project) => <span key={project}>{project}</span>) : <em>No active menu</em>}</div></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CreateModal({ epics, stories, people, onClose, onCreate, isKitchen }) {
  const [epicChoice, setEpicChoice] = useState(epics[0]?.code || "__new__");
  const [newEpicCode, setNewEpicCode] = useState("");
  const [newEpicName, setNewEpicName] = useState("");
  const [newEpicColor, setNewEpicColor] = useState("#4d77d8");
  const [issueType, setIssueType] = useState("Task");
  const [storyChoice, setStoryChoice] = useState("__new__");
  const [newStoryCode, setNewStoryCode] = useState("");
  const [newStoryName, setNewStoryName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState([ACTIVE_TEAM[0]]);
  const [status, setStatus] = useState("To Do");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const priority = priorityFor(dueDate, status);
  const selectedEpic = epics.find((epic) => epic.code === epicChoice);
  const storyOptions = stories.filter((story) => story.epicCode === epicChoice);
  const activePeople = people.filter((person) => person.active !== false);

  useEffect(() => {
    setStoryChoice(storyOptions[0]?.id || "__new__");
    setNewStoryCode("");
    setNewStoryName("");
  }, [epicChoice]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <div className="modal-frame" style={{ "--project": selectedEpic?.color || newEpicColor }}>
        <form className="create-modal" onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSaving(true);
          try {
            await onCreate({
              epicCode: epicChoice === "__new__" ? "" : epicChoice,
              newEpic: epicChoice === "__new__" ? { code: newEpicCode, name: newEpicName, color: newEpicColor } : null,
              storyId: storyChoice === "__new__" ? "" : storyChoice,
              newStory: storyChoice === "__new__" ? { code: newStoryCode, name: newStoryName } : null,
              title: title.trim(),
              description: description.trim(),
              issueType,
              assignees: [...new Set(assignees.filter(Boolean))],
              status,
              dueDate,
            });
          } catch (submitError) {
            setError(submitError.message || "บันทึกงานไม่สำเร็จ");
            setSaving(false);
          }
        }}>
          <header><div><span>{isKitchen ? "Add Food Piece" : "Create task"}</span><small>ข้อมูลจะถูกบันทึกลง Google Sheet ใหม่ของ Let We Cook</small></div><button type="button" onClick={onClose}><X size={18} /></button></header>
          <HierarchyGuide />
          <div className="modal-section-title"><b>{isKitchen ? "Kitchen hierarchy" : "Hierarchy"}</b><small>Choose where this work belongs</small></div>
          <div className="modal-grid">
            <label><span>{isKitchen ? "Piece type" : "Issue type"}</span><select value={issueType} onChange={(event) => setIssueType(event.target.value)}><option>Task</option><option>Bug</option></select></label>
            <label><span>{isKitchen ? "Menu" : "Epic"}</span><select value={epicChoice} onChange={(event) => setEpicChoice(event.target.value)}>{epics.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}<option value="__new__">{isKitchen ? "+ Create new menu" : "+ Create new epic"}</option></select></label>
            {epicChoice === "__new__" && <>
              <label><span>Epic code (3 letters)</span><input required maxLength={3} value={newEpicCode} onChange={(event) => setNewEpicCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="IFL" /></label>
              <label><span>{isKitchen ? "New menu name" : "New epic name"}</span><input required value={newEpicName} onChange={(event) => setNewEpicName(event.target.value)} placeholder="e.g. iFarm Layer" /></label>
              <label><span>Project color</span><input className="color-input" type="color" value={newEpicColor} onChange={(event) => setNewEpicColor(event.target.value)} /></label>
            </>}
            <label className="story-field"><span>{isKitchen ? "Course" : "Story"}</span><select value={storyChoice} onChange={(event) => setStoryChoice(event.target.value)}>{storyOptions.map((story) => <option key={story.id} value={story.id}>{story.code} · {story.name}</option>)}<option value="__new__">{isKitchen ? "+ Create new course" : "+ Create new story"}</option></select></label>
            {storyChoice === "__new__" && <>
              <label><span>Story code (3 letters)</span><input required maxLength={3} value={newStoryCode} onChange={(event) => setNewStoryCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="PER" /></label>
              <label className="story-field"><span>{isKitchen ? "New course name" : "New story name"}</span><input required value={newStoryName} onChange={(event) => setNewStoryName(event.target.value)} placeholder="e.g. Performance Dashboard" /></label>
            </>}
          </div>
          <div className="modal-section-title"><b>{isKitchen ? "Food piece details" : "Work details"}</b><small>Daily execution information</small></div>
          <label className="full-field"><span>Title</span><input required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to be done?" /></label>
          <label className="full-field"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add context, expected result, or acceptance notes…" /></label>
          <div className="modal-grid">
            {assignees.map((assignee, index) => <label key={index}><span>Assignee {index + 1}</span><select value={assignee} onChange={(event) => setAssignees((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}><option value="">Select person</option>{activePeople.map((person) => <option key={person.id} value={person.id} disabled={assignees.includes(person.id) && assignee !== person.id}>{person.name}</option>)}</select></label>)}
            {assignees.length < 4 && <button className="add-person-button" type="button" onClick={() => setAssignees((current) => [...current, ""])}><Plus size={14} /> Add person {assignees.length + 1}</button>}
            <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{[...BOARD_STATUSES, "Backlog"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Due date</span><input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <label><span>Created date</span><input type="date" value={isoDate(NOW)} readOnly /></label>
            <label><span>Auto priority</span><output className={`priority-preview ${priority.toLowerCase()}`}>{priority}</output></label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : `${isKitchen ? "Add" : "Create"} ${(isKitchen ? KITCHEN_TYPE : NORMAL_TYPE)[issueType]}`}</button></footer>
        </form>
      </div>
    </div>
  );
}

function BacklogTable({ tasks, isKitchen }) {
  return (
    <section className="backlog-table-wrap">
      <header><div><strong>Backlog</strong><span>{tasks.length} tasks waiting to be planned</span></div></header>
      <div className="backlog-scroll">
        <table>
          <thead><tr><th>{isKitchen ? "Food piece" : "Work item"}</th><th>Type</th><th>{isKitchen ? "Menu" : "Epic"}</th><th>{isKitchen ? "Course" : "Story"}</th><th>{isKitchen ? "Chef" : "Assignee"}</th><th>Created</th><th>Due date</th><th>Priority</th></tr></thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td><span className="row-project" style={{ background: projectColor(task.project) }} /><b>{task.id}</b><span>{task.title}</span></td>
                <td><span className={`issue-type issue-${task.issueType.toLowerCase()}`}>{(isKitchen ? KITCHEN_TYPE : NORMAL_TYPE)[task.issueType]}</span></td>
                <td>{task.epic}</td>
                <td>{task.story || "No course yet"}</td>
                <td><AssigneeStack names={task.assignees || [task.assignee]} size={22} />{(task.assignees || [task.assignee]).map(displayPersonName).join(", ")}</td>
                <td>{formatDate(task.createdDate)}</td>
                <td>{formatDate(task.dueDate)}</td>
                <td><span className={`priority-pill priority-${task.priority.toLowerCase()}`}>{task.priority}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TaskDashboard({ onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [people, setPeople] = useState(ACTIVE_TEAM.map((id) => ({ id, name: displayPersonName(id), active: true })));
  const [epicCatalog, setEpicCatalog] = useState([]);
  const [storyCatalog, setStoryCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataState, setDataState] = useState("connecting");
  const [projectFilter, setProjectFilter] = useState("All");
  const [storyFilter, setStoryFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("Board");
  const [currentUser, setCurrentUser] = useState("All");
  const [planDate, setPlanDate] = useState(isoDate(NOW));
  const [planEntries, setPlanEntries] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("let-him-cook-theme") || "kitchen");
  const [kitchenPage, setKitchenPage] = useState("home");
  const [quarter, setQuarter] = useState({ year: NOW.getFullYear(), index: Math.floor(NOW.getMonth() / 3) });
  const isKitchen = theme === "kitchen";

  function chooseTheme(nextTheme) {
    setTheme(nextTheme);
    localStorage.setItem("let-him-cook-theme", nextTheme);
  }
  function moveQuarter(delta) {
    setQuarter((current) => {
      const value = current.year * 4 + current.index + delta;
      return { year: Math.floor(value / 4), index: ((value % 4) + 4) % 4 };
    });
  }

  useEffect(() => {
    let active = true;
    fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load tasks");
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        const source = Array.isArray(payload.tasks) ? payload.tasks : [];
        setTasks(source.map(normalizeTask));
        if (Array.isArray(payload.people) && payload.people.length) setPeople(payload.people);
        if (Array.isArray(payload.epics)) setEpicCatalog(payload.epics);
        if (Array.isArray(payload.stories)) setStoryCatalog(payload.stories);
        setDataState("live");
      })
      .catch(() => {
        if (!active) return;
        setTasks(IS_LOCAL_PREVIEW ? FALLBACK_TASKS.map(normalizeTask) : []);
        setDataState(IS_LOCAL_PREVIEW ? "preview" : "error");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (currentUser === "All") {
      setPlanEntries([]);
      return;
    }
    if (!IS_LOCAL_PREVIEW) {
      setPlanEntries([]);
      return;
    }
    const saved = localStorage.getItem(`daily-plan:${planDate}:${currentUser}`);
    if (!saved) {
      setPlanEntries([]);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      setPlanEntries(parsed.map((entry) => {
        const task = tasks.find((item) => item.id === entry.taskId);
        return task ? { task, note: entry.note || "" } : null;
      }).filter(Boolean));
    } catch {
      setPlanEntries([]);
    }
  }, [planDate, currentUser, tasks]);

  const projects = useMemo(() => [...new Set([...epicCatalog.map((epic) => epic.name), ...tasks.map((task) => task.project)])].sort(), [tasks, epicCatalog]);
  const stories = useMemo(() => {
    const unique = new Map();
    storyCatalog.forEach((story) => {
      const epic = epicCatalog.find((item) => item.code === story.epicCode);
      unique.set(story.id, { ...story, epic: epic?.name || story.epicCode });
    });
    tasks.forEach((task) => {
      if (!task.story) return;
      const id = task.storyId || `${task.epicCode || task.epic}:${task.story}`;
      if (!unique.has(id)) unique.set(id, { id, epic: task.epic, epicCode: task.epicCode, code: id.split("-").at(-1), name: task.story });
    });
    return [...unique.values()].sort((a, b) => String(a.epic).localeCompare(String(b.epic)) || a.name.localeCompare(b.name));
  }, [tasks, storyCatalog, epicCatalog]);
  const storyOptions = useMemo(() => {
    const visibleStories = projectFilter === "All"
      ? stories
      : stories.filter((story) => story.epic === projectFilter);
    const storyNames = [...new Set(visibleStories.map((story) => story.name))];
    return [
      { value: "__unassigned__", label: "No course yet", muted: true },
      ...storyNames.map((name) => ({ value: name, label: name })),
    ];
  }, [stories, projectFilter]);
  const assignees = useMemo(() => {
    const allAssignees = [...new Set(tasks.flatMap((task) => task.assignees || [task.assignee]).filter(Boolean))];
    const devTeam = allAssignees.find((name) => name.toLowerCase() === "dev team") || "Dev Team";
    const activeOptions = ACTIVE_TEAM.map((name) => ({
      value: name,
      label: displayPersonName(name),
    }));
    const formerOptions = allAssignees
      .filter((name) => name.toLowerCase() !== "dev team" && !ACTIVE_TEAM.includes(name.toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name, muted: true }));
    return [{ value: devTeam, label: "Dev Team" }, ...activeOptions, ...formerOptions];
  }, [tasks]);
  const filtered = useMemo(() => tasks.filter((task) => {
    if (projectFilter !== "All" && task.project !== projectFilter) return false;
    if (storyFilter === "__unassigned__" && task.story) return false;
    if (storyFilter !== "All" && storyFilter !== "__unassigned__" && task.story !== storyFilter) return false;
    if (!assigneeMatches(task.assignees || task.assignee, assigneeFilter)) return false;
    if (statusFilter !== "All" && task.status !== statusFilter) return false;
    if (priorityFilter !== "All" && task.priority !== priorityFilter) return false;
    return true;
  }), [tasks, projectFilter, storyFilter, assigneeFilter, statusFilter, priorityFilter]);

  const board = useMemo(() => Object.fromEntries(BOARD_STATUSES.map((status) => [
    status,
    filtered.filter((task) => task.status === status).sort(sortByDueDateOldestFirst),
  ])), [filtered]);
  const backlog = useMemo(() => filtered.filter((task) => task.status === "Backlog").sort(sortByDueDateOldestFirst), [filtered]);
  const completed = tasks.length ? Math.round((tasks.filter((task) => task.status === "Done").length / tasks.length) * 100) : 0;
  const overdue = tasks.filter((task) => task.status !== "Done" && daysUntil(task.dueDate) < 0).length;
  const blockers = tasks.filter((task) => task.status !== "Done" && task.priority === "Urgent").length;

  function addToPlan(task) {
    if (currentUser === "All") {
      setToast("Select a team member before planning");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    setPlanEntries((entries) => entries.some((entry) => entry.task.id === task.id) ? entries : [...entries, { task, note: "" }]);
  }
  async function savePlan() {
    if (currentUser === "All") {
      setToast("Select a team member before saving");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    const entries = planEntries.map(({ task, note }) => ({ taskId: task.id, note }));
    if (IS_LOCAL_PREVIEW) {
      localStorage.setItem(`daily-plan:${planDate}:${currentUser}`, JSON.stringify(entries));
    } else {
      const response = await fetch(apiUrl("action"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "saveDailyPlan", actor: currentUser, payload: { planDate, personId: currentUser, entries } }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "บันทึกแผนวันนี้ไม่สำเร็จ");
    }
    setToast(IS_LOCAL_PREVIEW ? "Saved in local preview" : "Daily plan saved to Google Sheet");
    window.setTimeout(() => setToast(""), 2800);
  }
  async function createTask(payload) {
    let task;
    if (IS_LOCAL_PREVIEW) {
      const epic = payload.newEpic || epicCatalog.find((item) => item.code === payload.epicCode) || { code: payload.epicCode, name: payload.epicCode, color: "#4d77d8" };
      const story = payload.newStory || stories.find((item) => item.id === payload.storyId) || { code: "GEN", name: "General" };
      task = normalizeTask({
        ...payload,
        id: `${epic.code}-${story.code}-${payload.issueType === "Bug" ? "B" : "T"}${Date.now().toString().slice(-4)}`,
        epicCode: epic.code,
        epic: epic.name,
        epicColor: epic.color,
        storyId: `${epic.code}-${story.code}`,
        story: story.name,
        createdDate: isoDate(NOW),
        reporter: currentUser === "All" ? payload.assignees[0] : currentUser,
      });
      if (payload.newEpic) setEpicCatalog((current) => [...current, payload.newEpic]);
      if (payload.newStory) setStoryCatalog((current) => [...current, { id: `${epic.code}-${story.code}`, epicCode: epic.code, ...payload.newStory }]);
    } else {
      const response = await fetch(apiUrl("action"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createTask", actor: currentUser === "All" ? payload.assignees[0] : currentUser, payload }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "สร้างงานไม่สำเร็จ");
      task = normalizeTask(result.task);
    }
    setTasks((current) => [task, ...current]);
    setShowCreate(false);
    setToast(IS_LOCAL_PREVIEW ? `Preview created: ${task.id}` : `Created and saved: ${task.id}`);
    window.setTimeout(() => setToast(""), 2800);
  }
  async function saveTaskStatus(id, status) {
    if (!IS_LOCAL_PREVIEW) {
      const response = await fetch(apiUrl("action"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "updateStatus", actor: currentUser === "All" ? "team" : currentUser, payload: { id, status } }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "เปลี่ยนสถานะไม่สำเร็จ");
    }
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status, priority: priorityFor(task.dueDate, status) } : task));
    setSelectedTask(null);
    setToast(IS_LOCAL_PREVIEW ? `Preview status: ${status}` : `Saved status: ${status}`);
    window.setTimeout(() => setToast(""), 2200);
  }

  return (
    <main className={`app-shell ${isKitchen ? "kitchen-mode" : "normal-mode"}`}>
      <header className="topbar">
        <div className="brand"><ChefHat size={32} weight="fill" /><strong>{isKitchen ? "Let We Cook" : "TechFeed"}</strong><i /> <span>{isKitchen ? "TechFeed Kitchen · Task Tracker" : "Team Task Tracker"}</span></div>
        {isKitchen && <nav className="kitchen-nav" aria-label="Kitchen pages"><button className={kitchenPage === "home" ? "active" : ""} type="button" onClick={() => setKitchenPage("home")}>⌂ Home</button><button className={kitchenPage === "characters" ? "active" : ""} type="button" onClick={() => setKitchenPage("characters")}>★ Character</button></nav>}
        <div className="theme-switch" aria-label="Choose visual theme">
          <button type="button" className={!isKitchen ? "active" : ""} onClick={() => chooseTheme("normal")}>Normal</button>
          <button type="button" className={isKitchen ? "active" : ""} onClick={() => chooseTheme("kitchen")}>👨‍🍳 Kitchen</button>
        </div>
        <div className="current-date"><CalendarBlank size={17} weight="bold" />{new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(NOW)}</div>
        {!IS_LOCAL_PREVIEW && <button className="logout-button" type="button" onClick={onLogout}>Log out</button>}
        <button className="create-button" type="button" onClick={() => setShowCreate(true)}><Plus size={17} />{isKitchen ? "Add Food Piece" : "Create task"}</button>
      </header>

      <div className={`content ${isKitchen && kitchenPage === "characters" ? "is-character-page" : ""}`}>
        {isKitchen && kitchenPage === "characters" && <CharacterRoster tasks={tasks} />}
        <section className="filters">
          <Filter label={isKitchen ? "Menu" : "Epic"} value={projectFilter} options={projects} onChange={(value) => { setProjectFilter(value); setStoryFilter("All"); }} />
          <Filter label={isKitchen ? "Course" : "Story"} value={storyFilter} options={storyOptions} onChange={setStoryFilter} />
          <Filter
            label="Assignee"
            value={assigneeFilter}
            options={assignees}
            onChange={(value) => {
              setAssigneeFilter(value);
              setCurrentUser(value === "All" || ACTIVE_TEAM.includes(value.toLowerCase()) ? value : "All");
            }}
          />
          <Filter label="Status" value={statusFilter} options={["Backlog", ...BOARD_STATUSES]} onChange={setStatusFilter} />
          <Filter label="Priority" value={priorityFilter} options={["Low", "Medium", "High", "Urgent"]} onChange={setPriorityFilter} />
          <span className={`live-badge ${dataState}`}><i />{dataState === "live" ? "Live · Let We Cook Google Sheet" : dataState === "preview" ? "Local preview · Sample data" : dataState === "error" ? "Google Sheet connection pending" : "Connecting…"}</span>
        </section>

        <section className="summary-strip">
          <div className="kpi-card kpi-total"><ClipboardText size={24} /><span><small>Total work</small><strong>{tasks.length}</strong><em>Quest list</em></span></div>
          <div className="kpi-card kpi-complete"><Clock size={25} /><span><small>Completed</small><strong>{completed}%</strong><i className="progress"><b style={{ width: `${completed}%` }} /></i></span></div>
          <div className="kpi-card kpi-overdue"><WarningCircle size={25} /><span><small>Overdue</small><strong className="danger">{overdue}</strong><em>Needs action</em></span></div>
          <div className="kpi-card kpi-blocker"><Prohibit size={25} /><span><small>Blockers</small><strong className="danger">{blockers}</strong><em>Kitchen alert</em></span></div>
          <div className="kpi-card kpi-visible"><GridFour size={24} /><span><small>Visible tasks</small><strong>{filtered.length}</strong><em>On the board</em></span></div>
        </section>

        <Timeline tasks={filtered} isKitchen={isKitchen} quarter={quarter} onQuarterChange={moveQuarter} />

        <nav className="tabs" aria-label="Task views">
          {[isKitchen ? "Kitchen Board" : "Board", "Backlog"].map((tab) => {
            const tabValue = tab === "Kitchen Board" ? "Board" : tab;
            return <button key={tab} className={activeTab === tabValue ? "active" : ""} type="button" onClick={() => setActiveTab(tabValue)}>{tab}</button>;
          })}
        </nav>

        {loading ? (
          <div className="loading"><span /><strong>Preparing your workspace…</strong></div>
        ) : activeTab === "Board" ? (
          <div className="work-area">
            <TodayPlan
              tasks={filtered}
              currentUser={currentUser}
              setCurrentUser={(value) => {
                setCurrentUser(value);
                setAssigneeFilter(value);
              }}
              planDate={planDate}
              setPlanDate={setPlanDate}
              entries={planEntries}
              addTask={addToPlan}
              updateNote={(id, note) => setPlanEntries((entries) => entries.map((entry) => entry.task.id === id ? { ...entry, note } : entry))}
              removeTask={(id) => setPlanEntries((entries) => entries.filter((entry) => entry.task.id !== id))}
              savePlan={savePlan}
              isKitchen={isKitchen}
            />
            <section className="kanban">
              {BOARD_STATUSES.map((status) => (
                <section className={`kanban-column status-${status.toLowerCase().replace(" ", "-")}`} key={status}>
                  <header><strong>{status.toUpperCase()} <small>· {KITCHEN_STATUS[status]}</small></strong><span>{board[status].length}</span></header>
                  <div className="column-body">
                    {board[status].map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        canPlan={currentUser !== "All"}
                        onDragStart={(event, id) => {
                          event.dataTransfer.setData("text/task-id", id);
                          event.dataTransfer.effectAllowed = "copy";
                        }}
                        onAdd={addToPlan}
                        isKitchen={isKitchen}
                        onOpen={setSelectedTask}
                      />
                    ))}
                    {board[status].length === 0 && <div className="empty-column"><CheckCircle size={24} />No tasks here.<br />The kitchen is all clear.</div>}
                  </div>
                  <button className="column-add" type="button" onClick={() => setShowCreate(true)}><Plus size={14} />{isKitchen ? "Add Food Piece" : "Add task"}</button>
                </section>
              ))}
            </section>
          </div>
        ) : <BacklogTable tasks={backlog} isKitchen={isKitchen} />}

        <footer className="page-note"><Info size={15} />ลากงานจาก Kanban มาวางในแผนของวันนี้ งานต้นทางจะยังอยู่ใน Kanban เพื่อการติดตามสถานะที่แท้จริง</footer>
      </div>
      {showCreate && <CreateModal epics={epicCatalog} stories={stories} people={people} onClose={() => setShowCreate(false)} onCreate={createTask} isKitchen={isKitchen} />}
      {selectedTask && <TaskDetailModal task={tasks.find((task) => task.id === selectedTask.id) || selectedTask} isKitchen={isKitchen} onClose={() => setSelectedTask(null)} onSave={saveTaskStatus} />}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function LoginScreen({ onAuthenticated }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, setClockTick] = useState(0);
  const lockedSeconds = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  const isLocked = lockedSeconds > 0;

  useEffect(() => {
    if (!isLocked) return undefined;
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isLocked]);

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-emblem"><ChefHat size={42} weight="fill" /></div>
        <small>TECHFEED TEAM WORKSPACE</small>
        <h1>Let We Cook</h1>
        <p>ระบบติดตามงาน โปรเจกต์ และความคืบหน้าของทีม</p>
        <form onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError("");
          try {
            const response = await fetch(apiUrl("login"), {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ password }),
            });
            const result = await response.json();
            if (!response.ok || !result.authenticated) {
              if (result.locked && result.retryAfter) setLockedUntil(Date.now() + Number(result.retryAfter) * 1000);
              throw new Error(result.error || "รหัสผ่านไม่ถูกต้อง");
            }
            onAuthenticated();
          } catch (loginError) {
            setError(loginError.message || "เข้าสู่ระบบไม่สำเร็จ");
          } finally {
            setSubmitting(false);
          }
        }}>
          <label><span>Team password</span><div><LockKey size={18} /><input autoFocus required disabled={isLocked} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" /></div></label>
          {error && <p className="login-error">{error}</p>}
          {isLocked && <p className="login-lock-time">ลองใหม่ได้ใน {Math.floor(lockedSeconds / 3600)}:{String(Math.floor((lockedSeconds % 3600) / 60)).padStart(2, "0")}:{String(lockedSeconds % 60).padStart(2, "0")}</p>}
          <button type="submit" disabled={submitting || isLocked}>{isLocked ? "Temporarily locked" : submitting ? "Opening kitchen…" : "Enter workspace"}</button>
        </form>
        <em>สำหรับสมาชิก TechFeed Team เท่านั้น</em>
      </section>
    </main>
  );
}

export function App() {
  const [checking, setChecking] = useState(!IS_LOCAL_PREVIEW);
  const [authenticated, setAuthenticated] = useState(IS_LOCAL_PREVIEW);

  useEffect(() => {
    if (IS_LOCAL_PREVIEW) return;
    fetch(apiUrl("session"))
      .then((response) => response.json())
      .then((result) => setAuthenticated(Boolean(result.authenticated)))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <main className="login-screen"><div className="login-loading">Preparing your workspace…</div></main>;
  if (!authenticated) return <LoginScreen onAuthenticated={() => setAuthenticated(true)} />;
  return <TaskDashboard onLogout={async () => {
    await fetch(apiUrl("logout"), { method: "POST" }).catch(() => {});
    setAuthenticated(false);
  }} />;
}
