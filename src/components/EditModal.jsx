import { useMemo, useState } from "react";
import { NotePencil, Plus, Warning, X } from "@phosphor-icons/react";
import { priorityFor } from "../lib/dates.js";
import { ALL_STATUSES, STATIONS, TERMS } from "../lib/kitchen.js";

// Edits an existing ticket. Menus and courses must already exist; moving to
// another course or switching Task ↔ Bug gives the ticket a new ID.
export function EditModal({ task, epics, stories, crew, onClose, onSave }) {
  const [epicCode, setEpicCode] = useState(task.epicCode);
  const [storyId, setStoryId] = useState(task.storyId);
  const [issueType, setIssueType] = useState(task.issueType);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [assignees, setAssignees] = useState(task.assignees.length ? task.assignees : [""]);
  const [status, setStatus] = useState(task.status);
  const [dueDate, setDueDate] = useState(task.dueDate.slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedEpic = epics.find((epic) => epic.code === epicCode);
  const storyOptions = stories.filter((story) => story.epicCode === epicCode);
  const color = selectedEpic?.color || task.color;
  const priority = priorityFor(dueDate, status);
  const crewIds = new Set(crew.map((person) => person.id));
  const keepsId = useMemo(() => {
    const story = stories.find((item) => item.id === storyId);
    const prefix = `${story?.epicCode}-${story?.code}-${issueType === "Bug" ? "B" : "T"}`;
    return new RegExp(`^${prefix}\\d{4}$`).test(task.id);
  }, [stories, storyId, issueType, task.id]);

  function chooseMenu(code) {
    setEpicCode(code);
    setStoryId(stories.find((story) => story.epicCode === code)?.id || "");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const saved = await onSave({
      id: task.id,
      storyId,
      issueType,
      title: title.trim(),
      description: description.trim(),
      assignees: [...new Set(assignees.filter(Boolean))],
      status,
      dueDate,
    }, setError);
    if (!saved) setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <form className="order-form" style={{ "--menu": color }} onSubmit={submit} role="dialog" aria-modal="true" aria-label={`Edit ${task.id}`}>
        <header>
          <span className="order-form__icon"><NotePencil size={22} weight="duotone" /></span>
          <div>
            <strong>Edit ticket</strong>
            <small>{task.id} · แก้ไขแล้วบันทึกลง Google Sheet ทันที</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} weight="bold" /></button>
        </header>

        <fieldset>
          <legend>Where does it belong?</legend>
          <div className="form-grid">
            <label>
              <span>Type</span>
              <div className="segmented">
                {["Task", "Bug"].map((type) => (
                  <button key={type} type="button" className={issueType === type ? "active" : ""} onClick={() => setIssueType(type)}>{TERMS[type]}</button>
                ))}
              </div>
            </label>
            <label>
              <span>{TERMS.epic}</span>
              <select value={epicCode} onChange={(event) => chooseMenu(event.target.value)}>
                {epics.map((epic) => <option key={epic.code} value={epic.code}>{epic.code} · {epic.name}</option>)}
              </select>
            </label>
            <label>
              <span>{TERMS.story}</span>
              <select required value={storyId} onChange={(event) => setStoryId(event.target.value)}>
                {!storyOptions.length && <option value="">ยังไม่มี Course ใน Menu นี้</option>}
                {storyOptions.map((story) => <option key={story.id} value={story.id}>{story.code} · {story.name}</option>)}
              </select>
            </label>
          </div>
          {!keepsId && (
            <p className="id-change-note">
              <Warning size={15} weight="bold" />
              ย้าย Course หรือเปลี่ยนประเภทแล้ว งานนี้จะได้ <b>ID ใหม่</b> (ID เดิม {task.id} ถูกเก็บไว้ใน Activity Log และแผนวันนี้จะย้ายตามไปเอง)
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend>What are we cooking?</legend>
          <label className="full-field">
            <span>Title</span>
            <input required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="full-field">
            <span>Recipe notes</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Chefs & timing</legend>
          <div className="form-grid">
            {assignees.map((assignee, index) => (
              <label key={index}>
                <span>Chef {index + 1}</span>
                <select required={index === 0} value={crewIds.has(assignee) ? assignee : ""}
                  onChange={(event) => setAssignees((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}>
                  <option value="">{index === 0 ? "Select chef" : "— none —"}</option>
                  {crew.map((person) => (
                    <option key={person.id} value={person.id} disabled={assignees.includes(person.id) && assignee !== person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
            ))}
            {assignees.length < 4 && (
              <button className="add-chef" type="button" onClick={() => setAssignees((current) => [...current, ""])}>
                <Plus size={13} weight="bold" /> Add chef {assignees.length + 1}
              </button>
            )}
            <label>
              <span>Station</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {ALL_STATUSES.map((item) => <option key={item} value={item}>{STATIONS[item].name} · {item}</option>)}
              </select>
            </label>
            <label>
              <span>Due date</span>
              <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label>
              <span>Heat (auto)</span>
              <output className={`priority-preview priority-${priority.toLowerCase()}`}>{priority}</output>
            </label>
          </div>
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </footer>
      </form>
    </div>
  );
}
