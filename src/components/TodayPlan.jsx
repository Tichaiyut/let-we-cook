import { CalendarBlank, CaretDown, ChefHat, Eye, FloppyDisk, HandGrabbing, LockKey, X } from "@phosphor-icons/react";
import { formatDate } from "../lib/dates.js";
import { ChefAvatar } from "./common.jsx";

// Chalkboard "today's menu". Entries are copies: planning never moves a
// ticket off the Kanban. Everyone can look at anyone's menu, but only the
// signed-in chef can change their own.
export function TodayPlan({
  crew, me, editable, currentUser, onUserChange, planDate, onDateChange,
  entries, loading, saving, dirty, onDropTask, onRemove, onNote, onSave,
}) {
  const viewing = currentUser !== "All";
  const owner = crew.find((person) => person.id === currentUser);
  const isMine = me.kind === "chef" && currentUser === me.id;

  let zone;
  if (editable) {
    zone = { icon: <HandGrabbing size={26} weight="duotone" />, title: "Drag tickets here", text: "or tap “+ Today” on any ticket — it stays on the board" };
  } else if (!viewing) {
    zone = { icon: <LockKey size={24} weight="duotone" />, title: "Choose a chef to see their menu", text: "the board shows every ticket until a chef is chosen" };
  } else if (me.kind === "team") {
    zone = { icon: <Eye size={24} weight="duotone" />, title: `${owner?.name || currentUser}'s menu · read only`, text: "เข้าด้วยรหัสทีมอยู่ ดูได้อย่างเดียว" };
  } else {
    zone = { icon: <Eye size={24} weight="duotone" />, title: `${owner?.name || currentUser}'s menu · read only`, text: "แก้ได้เฉพาะเมนูวันนี้ของตัวเอง" };
  }

  return (
    <section
      className={`today-board ${editable ? "" : "is-locked"}`}
      onDragOver={(event) => {
        if (editable) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (editable) onDropTask(event.dataTransfer.getData("text/task-id"));
      }}
    >
      <header>
        <ChefHat size={24} weight="duotone" />
        <div>
          <strong>{isMine || !viewing ? "What are you going to cook today?" : `What is ${owner?.name || currentUser} cooking today?`}</strong>
          <small>{isMine || !viewing ? "เมนูของฉันวันนี้" : "ดูเมนูของเพื่อน"}</small>
        </div>
      </header>

      <div className="plan-controls">
        <label>
          <span>Chef</span>
          <div>
            {viewing ? <ChefAvatar id={currentUser} size={22} /> : <ChefHat size={18} />}
            <select value={currentUser} onChange={(event) => onUserChange(event.target.value)}>
              <option value="All">— เลือกเชฟ —</option>
              {crew.map((person) => (
                <option key={person.id} value={person.id}>{person.name}{me.kind === "chef" && person.id === me.id ? " (ฉัน)" : ""}</option>
              ))}
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
        {zone.icon}
        <strong>{zone.title}</strong>
        <span>{zone.text}</span>
      </div>

      <div className="plan-list">
        {loading ? (
          <div className="plan-empty">กำลังหยิบเมนูของวันนี้…</div>
        ) : entries.length === 0 ? (
          <div className="plan-empty">{viewing ? "ยังไม่มีเมนูของวันนี้" : "เลือกเชฟเพื่อดูเมนู"}</div>
        ) : entries.map(({ taskId, task, note, binned }) => (
          <article className="plan-note" key={taskId} style={{ "--menu": task?.color || "#8a7a6a" }}>
            <div className="plan-note__top">
              <b>{taskId}</b>
              {task && <span><CalendarBlank size={11} /> {formatDate(task.dueDate, false)}</span>}
              {task && <span className={`mini-priority ${task.priority.toLowerCase()}`}>{task.priority}</span>}
              {editable && <button type="button" onClick={() => onRemove(taskId)} aria-label={`Remove ${taskId}`}><X size={11} weight="bold" /></button>}
            </div>
            <strong>{task ? task.title : binned ? "🗑 งานนี้ถูกทิ้งลงถังขยะแล้ว" : "งานนี้ไม่อยู่บนบอร์ดแล้ว"}</strong>
            {(editable || note) && (
              <textarea
                rows={1}
                value={note}
                readOnly={!editable}
                ref={(element) => {
                  if (element) {
                    element.style.height = "auto";
                    element.style.height = `${element.scrollHeight}px`;
                  }
                }}
                onChange={(event) => onNote(taskId, event.target.value)}
                placeholder="Chef's note (optional)…"
              />
            )}
          </article>
        ))}
      </div>

      {editable && (
        <footer>
          <span className={`plan-state ${dirty ? "is-dirty" : ""}`}>
            {dirty ? "● ยังไม่ได้บันทึก" : entries.length ? "✓ บันทึกแล้ว" : ""}
          </span>
          <button className="save-plan" type="button" disabled={saving || loading} onClick={onSave}>
            <FloppyDisk size={16} weight="bold" /> {saving ? "Saving…" : "Save today's menu"}
          </button>
        </footer>
      )}
    </section>
  );
}
