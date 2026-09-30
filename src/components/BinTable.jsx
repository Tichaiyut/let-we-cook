import { ArrowCounterClockwise, Trash } from "@phosphor-icons/react";
import { formatDate } from "../lib/dates.js";
import { ChefNames, TypeChip } from "./common.jsx";

// Soft-deleted tickets. They stay in the sheet (Deleted = TRUE) until restored.
export function BinTable({ tasks, onRestore }) {
  const sorted = [...tasks].sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
  return (
    <section className="pantry bin panel">
      <header className="panel-head">
        <span className="panel-icon"><Trash size={18} weight="duotone" /></span>
        <div>
          <strong>Bin</strong>
          <small>{tasks.length} จานที่ถูกทิ้ง · กู้คืนได้ตลอด งานยังอยู่ใน Google Sheet</small>
        </div>
      </header>
      <div className="pantry-scroll">
        <table>
          <thead>
            <tr><th>Food piece</th><th>Type</th><th>Menu</th><th>Course</th><th>Tossed by</th><th>Tossed on</th><th /></tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <tr key={task.id}>
                <td><span className="row-menu" style={{ background: task.color }} /><b>{task.id}</b><span>{task.title}</span></td>
                <td><TypeChip type={task.issueType} /></td>
                <td>{task.epic}</td>
                <td>{task.story || "—"}</td>
                <td><ChefNames ids={[task.deletedBy]} /></td>
                <td>{formatDate(task.deletedAt)}</td>
                <td><button type="button" className="restore-button" onClick={() => onRestore(task)}><ArrowCounterClockwise size={14} weight="bold" /> กู้คืน</button></td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={7} className="pantry-empty">ถังขยะว่าง</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
