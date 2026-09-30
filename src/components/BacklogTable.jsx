import { Package } from "@phosphor-icons/react";
import { formatDate } from "../lib/dates.js";
import { ChefNames, ChefStack, TypeChip } from "./common.jsx";

export function BacklogTable({ tasks, onOpen }) {
  return (
    <section className="pantry panel">
      <header className="panel-head">
        <span className="panel-icon"><Package size={18} weight="duotone" /></span>
        <div>
          <strong>Pantry</strong>
          <small>{tasks.length} ชิ้นงานที่ยังเก็บไว้ในคลัง รอหยิบขึ้นเตา</small>
        </div>
      </header>
      <div className="pantry-scroll">
        <table>
          <thead>
            <tr><th>Food piece</th><th>Type</th><th>Menu</th><th>Course</th><th>Chefs</th><th>Created</th><th>Due</th><th>Heat</th></tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} onClick={() => onOpen(task)} tabIndex={0} onKeyDown={(event) => {
                if (event.key === "Enter") onOpen(task);
              }}>
                <td><span className="row-menu" style={{ background: task.color }} /><b>{task.id}</b><span>{task.title}</span></td>
                <td><TypeChip type={task.issueType} /></td>
                <td>{task.epic}</td>
                <td>{task.story || "—"}</td>
                <td><span className="pantry-chefs"><ChefStack ids={task.assignees} size={20} /><ChefNames ids={task.assignees} /></span></td>
                <td>{formatDate(task.createdDate)}</td>
                <td>{formatDate(task.dueDate)}</td>
                <td><span className={`priority-pill priority-${task.priority.toLowerCase()}`}>{task.priority}</span></td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={8} className="pantry-empty">คลังว่าง ไม่มีงานค้างใน Backlog</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
