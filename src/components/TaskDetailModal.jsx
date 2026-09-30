import { useEffect, useState } from "react";
import { NotePencil, Trash, X } from "@phosphor-icons/react";
import { formatDate, priorityFor } from "../lib/dates.js";
import { BOARD_STATUSES, STATIONS, TERMS } from "../lib/kitchen.js";
import { ChefNames, ChefStack, PriorityPill, TypeChip } from "./common.jsx";

export function TaskDetailModal({ task, onClose, onSave, onEdit, onDelete }) {
  const [status, setStatus] = useState(task.status);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState("");
  const statuses = BOARD_STATUSES.includes(task.status) ? BOARD_STATUSES : ["Backlog", ...BOARD_STATUSES];

  useEffect(() => setStatus(task.status), [task]);

  async function run(action) {
    setSaving(true);
    const done = await action();
    if (!done) setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="recipe-card" style={{ "--menu": task.color }} role="dialog" aria-modal="true" aria-label={task.title}>
        <header>
          <div><span className="ticket-key">{task.id}</span><TypeChip type={task.issueType} /></div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} weight="bold" /></button>
        </header>
        <div className="recipe-card__title">
          <h2>{task.title}</h2>
          <p>{task.description || "ไม่มีรายละเอียดเพิ่มเติมสำหรับจานนี้"}</p>
        </div>
        <div className="recipe-path">
          <div><small>{TERMS.epic}</small><b>{task.epic}</b></div>
          <span>›</span>
          <div><small>{TERMS.story}</small><b>{task.story || "—"}</b></div>
        </div>
        <div className="recipe-grid">
          <div><small>Chefs</small><span><ChefStack ids={task.assignees} size={24} /><ChefNames ids={task.assignees} /></span></div>
          <label>
            <small>Station</small>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statuses.map((item) => <option key={item} value={item}>{STATIONS[item].name} · {item}</option>)}
            </select>
          </label>
          <div><small>Created</small><b>{formatDate(task.createdDate)}</b></div>
          <div><small>Due</small><b>{formatDate(task.dueDate)}</b></div>
          <div><small>Heat</small><PriorityPill task={{ ...task, status, priority: priorityFor(task.dueDate, status) }} /></div>
          <div><small>Reporter</small><b><ChefNames ids={[task.reporter]} /></b></div>
        </div>

        {confirmDelete ? (
          <div className="bin-confirm" role="alertdialog" aria-label="Confirm delete">
            <strong><Trash size={17} weight="duotone" /> ทิ้ง {task.id} ลงถังขยะ?</strong>
            <span>งานจะหายจากบอร์ด แต่ยังกู้คืนได้จากแท็บ Bin</span>
            <input autoFocus maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="เหตุผล (ไม่บังคับ) เช่น สร้างซ้ำ, ยกเลิกงาน" />
            <div>
              <button type="button" className="secondary-button" disabled={saving} onClick={() => setConfirmDelete(false)}>ไม่ทิ้ง</button>
              <button type="button" className="danger-button" disabled={saving} onClick={() => run(() => onDelete(task, reason.trim()))}>
                {saving ? "กำลังทิ้ง…" : "ทิ้งจานนี้"}
              </button>
            </div>
          </div>
        ) : (
          <footer>
            <button type="button" className="ghost-danger" onClick={() => setConfirmDelete(true)}><Trash size={16} weight="bold" /> ทิ้งจาน</button>
            <button type="button" className="secondary-button" onClick={() => onEdit(task)}><NotePencil size={16} weight="bold" /> แก้ไข</button>
            <button type="button" className="primary-button" disabled={saving || status === task.status} onClick={() => run(() => onSave(task.id, status))}>
              {saving ? "Saving…" : "Update station"}
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
