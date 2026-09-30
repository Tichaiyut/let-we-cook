import { useEffect, useState } from "react";
import { MagicWand, Plus, Receipt, X } from "@phosphor-icons/react";
import { suggestCode } from "../lib/codes.js";
import { isoDate, priorityFor } from "../lib/dates.js";
import { ALL_STATUSES, STATIONS, TERMS } from "../lib/kitchen.js";

const MENU_SWATCHES = ["#d8572a", "#e0a100", "#2e8b57", "#1f8a70", "#2f72e8", "#8a4fd0", "#c2417a", "#8b5e3c"];
const NEW = "__new__";
const codeInput = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);

function HierarchyGuide() {
  return (
    <section className="hierarchy-guide" aria-label="How work is organised">
      <div>
        <span><b>Menu</b><em>Epic</em></span><i>›</i>
        <span><b>Course</b><em>Story</em></span><i>›</i>
        <span><b>Food Piece</b><em>Task</em></span><i>+</i>
        <span className="is-bug"><b>Kitchen Issue</b><em>Bug</em></span>
      </div>
      <p>Menu คือโปรเจกต์ · Course คือฟีเจอร์ในโปรเจกต์ · Food Piece / Kitchen Issue คือชิ้นงานที่ต้องทำ</p>
    </section>
  );
}

// Code field that fills itself from the name until someone types in it.
function CodeField({ label, value, auto, onChange, onReset }) {
  return (
    <label className="code-field">
      <span>{label} code {auto ? <em><MagicWand size={11} weight="bold" /> อัตโนมัติ</em> : <button type="button" onClick={onReset}>ใช้รหัสอัตโนมัติ</button>}</span>
      <input required minLength={3} maxLength={3} value={value} placeholder="—" onChange={(event) => onChange(codeInput(event.target.value))} />
    </label>
  );
}

export function CreateModal({ epics, stories, taskIds, crew, defaultChef, onClose, onCreate }) {
  const [epicChoice, setEpicChoice] = useState(epics[0]?.code || NEW);
  const [newEpic, setNewEpic] = useState({ code: "", name: "", color: MENU_SWATCHES[0] });
  const [epicCodeTyped, setEpicCodeTyped] = useState(false);
  const [storyChoice, setStoryChoice] = useState(NEW);
  const [newStory, setNewStory] = useState({ code: "", name: "" });
  const [storyCodeTyped, setStoryCodeTyped] = useState(false);
  const [issueType, setIssueType] = useState("Task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState([defaultChef || crew[0]?.id || ""]);
  const [status, setStatus] = useState("To Do");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedEpic = epics.find((epic) => epic.code === epicChoice);
  const storyOptions = stories.filter((story) => story.epicCode === epicChoice);
  const color = selectedEpic?.color || newEpic.color;
  const priority = priorityFor(dueDate, status);

  const epicCode = epicCodeTyped ? newEpic.code : suggestCode(newEpic.name, epics.map((epic) => epic.code), "M");
  const storyCode = storyCodeTyped ? newStory.code : suggestCode(newStory.name, storyOptions.map((story) => story.code), "C");
  const menuPart = epicChoice === NEW ? epicCode : epicChoice;
  const coursePart = storyChoice === NEW ? storyCode : stories.find((story) => story.id === storyChoice)?.code || "";
  const idPrefix = `${menuPart || "???"}-${coursePart || "???"}-${issueType === "Bug" ? "B" : "T"}`;
  const nextNumber = taskIds.reduce((max, id) => {
    const match = id.startsWith(idPrefix) ? id.slice(idPrefix.length).match(/^(\d{4})$/) : null;
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  const idPreview = `${idPrefix}${String(nextNumber).padStart(4, "0")}`;

  useEffect(() => {
    setStoryChoice(stories.find((story) => story.epicCode === epicChoice)?.id || NEW);
    setNewStory({ code: "", name: "" });
    setStoryCodeTyped(false);
  }, [epicChoice, stories]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const created = await onCreate({
      epicCode: epicChoice === NEW ? "" : epicChoice,
      newEpic: epicChoice === NEW ? { ...newEpic, code: epicCode, name: newEpic.name.trim() } : null,
      storyId: storyChoice === NEW ? "" : storyChoice,
      newStory: storyChoice === NEW ? { ...newStory, code: storyCode, name: newStory.name.trim() } : null,
      title: title.trim(),
      description: description.trim(),
      issueType,
      assignees: [...new Set(assignees.filter(Boolean))],
      status,
      dueDate,
    }, setError);
    if (!created) setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <form className="order-form" style={{ "--menu": color }} onSubmit={submit} role="dialog" aria-modal="true" aria-label="New order ticket">
        <header>
          <span className="order-form__icon"><Receipt size={22} weight="duotone" /></span>
          <div>
            <strong>New order ticket</strong>
            <small>บันทึกลง Google Sheet ของ Let We Cook</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} weight="bold" /></button>
        </header>

        <HierarchyGuide />

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
              <select value={epicChoice} onChange={(event) => setEpicChoice(event.target.value)}>
                {epics.map((epic) => <option key={epic.code} value={epic.code}>{epic.code} · {epic.name}</option>)}
                <option value={NEW}>+ New menu</option>
              </select>
            </label>
            {epicChoice === NEW && (
              <>
                <label>
                  <span>Menu name</span>
                  <input required value={newEpic.name} placeholder="เช่น iFarm"
                    onChange={(event) => setNewEpic((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <CodeField
                  label="Menu"
                  value={epicCode}
                  auto={!epicCodeTyped}
                  onChange={(code) => {
                    setEpicCodeTyped(code !== "");
                    setNewEpic((current) => ({ ...current, code }));
                  }}
                  onReset={() => setEpicCodeTyped(false)}
                />
                <div className="swatch-field">
                  <span>Menu color</span>
                  <div>
                    {MENU_SWATCHES.map((swatch) => (
                      <button key={swatch} type="button" className={newEpic.color === swatch ? "active" : ""} style={{ background: swatch }}
                        aria-label={`Use color ${swatch}`} onClick={() => setNewEpic((current) => ({ ...current, color: swatch }))} />
                    ))}
                    <input type="color" value={newEpic.color} aria-label="Custom color"
                      onChange={(event) => setNewEpic((current) => ({ ...current, color: event.target.value }))} />
                  </div>
                </div>
              </>
            )}
            <label>
              <span>{TERMS.story}</span>
              <select value={storyChoice} onChange={(event) => setStoryChoice(event.target.value)}>
                {storyOptions.map((story) => <option key={story.id} value={story.id}>{story.code} · {story.name}</option>)}
                <option value={NEW}>+ New course</option>
              </select>
            </label>
            {storyChoice === NEW && (
              <>
                <label>
                  <span>Course name</span>
                  <input required value={newStory.name} placeholder="เช่น Performance Dashboard"
                    onChange={(event) => setNewStory((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <CodeField
                  label="Course"
                  value={storyCode}
                  auto={!storyCodeTyped}
                  onChange={(code) => {
                    setStoryCodeTyped(code !== "");
                    setNewStory((current) => ({ ...current, code }));
                  }}
                  onReset={() => setStoryCodeTyped(false)}
                />
              </>
            )}
          </div>
          <p className="id-preview">ID ของงานนี้จะเป็น <b>{idPreview}</b></p>
        </fieldset>

        <fieldset>
          <legend>What are we cooking?</legend>
          <label className="full-field">
            <span>Title</span>
            <input required autoFocus maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="ต้องทำอะไร?" />
          </label>
          <label className="full-field">
            <span>Recipe notes</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="รายละเอียด ผลลัพธ์ที่คาดหวัง หรือเงื่อนไขการรับงาน…" />
          </label>
        </fieldset>

        <fieldset>
          <legend>Chefs & timing</legend>
          <div className="form-grid">
            {assignees.map((assignee, index) => (
              <label key={index}>
                <span>Chef {index + 1}</span>
                <select required={index === 0} value={assignee}
                  onChange={(event) => setAssignees((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}>
                  <option value="">Select chef</option>
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
              <input required type="date" min={isoDate(new Date())} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label>
              <span>Heat (auto)</span>
              <output className={`priority-preview priority-${priority.toLowerCase()}`}>{dueDate ? priority : "เลือกวันส่งก่อน"}</output>
            </label>
          </div>
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Sending to kitchen…" : `Add ${TERMS[issueType]}`}</button>
        </footer>
      </form>
    </div>
  );
}
