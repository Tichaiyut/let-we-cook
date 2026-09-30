import { CalendarBlank, CaretDown, ChefHat, FloppyDisk, HandGrabbing, LockKey, X } from "@phosphor-icons/react";
import { formatDate } from "../lib/dates.js";
import { ChefAvatar } from "./common.jsx";

// Chalkboard "today's menu". Entries are copies: planning never moves a
// ticket off the Kanban, it only lists what a chef intends to cook today.
export function TodayPlan({
  crew, currentUser, onUserChange, planDate, onDateChange,
  entries, loading, saving, dirty, onDropTask, onRemove, onNote, onSave,
}) {
  const canPlan = currentUser !== "All";
  return (
    <section
      className={`today-board ${canPlan ? "" : "is-locked"}`}
      onDragOver={(event) => {
        if (canPlan) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (canPlan) onDropTask(event.dataTransfer.getData("text/task-id"));
      }}
    >
      <header>
        <ChefHat size={24} weight="duotone" />
        <div>
          <strong>What are you going to cook today?</strong>
          <small>เมนูของฉันวันนี้</small>
        </div>
      </header>

      <div className="plan-controls">
        <label>
          <span>Chef</span>
          <div>
            {canPlan ? <ChefAvatar id={currentUser} size={22} /> : <ChefHat size={18} />}
            <select value={currentUser} onChange={(event) => onUserChange(event.target.value)}>
              <option value="All">Choose chef…</option>
              {crew.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            <CaretDown size={12} weight="bold" />
          </div>
        </label>
        <label>
          <span>Date</span>
          <div>
            <CalendarBlank size={16} />
            <input type="date" value={planDate} onChange={(event) => onDateChange(event.target.value)} />
          </div>
        </label>
      </div>

      <div className="drop-zone">
        {canPlan ? <HandGrabbing size={26} weight="duotone" /> : <LockKey size={24} weight="duotone" />}
        <strong>{canPlan ? "Drag tickets here" : "Choose a chef to start planning"}</strong>
        <span>{canPlan ? "or tap “+ Today” on any ticket — it stays on the board" : "the board shows every ticket until a chef is chosen"}</span>
      </div>

      <div className="plan-list">
        {loading ? (
          <div className="plan-empty">กำลังหยิบเมนูของวันนี้…</div>
        ) : entries.length === 0 ? (
          <div className="plan-empty">{canPlan ? "ยังไม่มีเมนูของวันนี้" : "เลือกเชฟก่อน แล้วค่อยวางแผน"}</div>
        ) : entries.map(({ taskId, task, note }) => (
          <article className="plan-note" key={taskId} style={{ "--menu": task?.color || "#8a7a6a" }}>
            <div className="plan-note__top">
              <b>{taskId}</b>
              {task && <span><CalendarBlank size={11} /> {formatDate(task.dueDate, false)}</span>}
              {task && <span className={`mini-priority ${task.priority.toLowerCase()}`}>{task.priority}</span>}
              <button type="button" onClick={() => onRemove(taskId)} aria-label={`Remove ${taskId}`}><X size={11} weight="bold" /></button>
            </div>
            <strong>{task ? task.title : "งานนี้ไม่อยู่บนบอร์ดแล้ว"}</strong>
            <textarea
              rows={1}
              value={note}
              ref={(element) => {
                if (element) {
                  element.style.height = "auto";
                  element.style.height = `${element.scrollHeight}px`;
                }
              }}
              onChange={(event) => onNote(taskId, event.target.value)}
              placeholder="Chef's note (optional)…"
            />
          </article>
        ))}
      </div>

      <footer>
        <span className={`plan-state ${dirty ? "is-dirty" : ""}`}>
          {!canPlan ? "" : dirty ? "● ยังไม่ได้บันทึก" : entries.length ? "✓ บันทึกแล้ว" : ""}
        </span>
        <button className="save-plan" type="button" disabled={!canPlan || saving || loading} onClick={onSave}>
          <FloppyDisk size={16} weight="bold" /> {saving ? "Saving…" : "Save today's menu"}
        </button>
      </footer>
    </section>
  );
}
