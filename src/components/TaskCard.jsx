import { CalendarBlank, Plus } from "@phosphor-icons/react";
import { formatDate } from "../lib/dates.js";
import { ChefNames, ChefStack, PriorityPill, TypeChip } from "./common.jsx";

// A kitchen order ticket. Height is fixed (see .task-card) so each station
// shows exactly five complete tickets before it scrolls.
export function TaskCard({ task, canPlan, onAddToPlan, onOpen }) {
  return (
    <article
      className="task-card"
      style={{ "--menu": task.color }}
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
        event.dataTransfer.setData("text/task-id", task.id);
        event.dataTransfer.effectAllowed = "copy";
      }}
    >
      <div className="ticket-top">
        <span className="ticket-key">{task.id}</span>
        <TypeChip type={task.issueType} />
      </div>
      <h3 title={task.title}>{task.title}</h3>
      <div className="ticket-menu" title={`${task.epic} › ${task.story}`}>
        <b>{task.epic}</b><span>›</span><em>{task.story || "No course"}</em>
      </div>
      <div className="ticket-chefs">
        <ChefStack ids={task.assignees} size={18} />
        <span><ChefNames ids={task.assignees} /></span>
      </div>
      <div className="ticket-dates">
        <span><CalendarBlank size={11} /> {formatDate(task.createdDate)}</span>
        <span>Due {formatDate(task.dueDate)}</span>
      </div>
      <div className="ticket-foot">
        <button
          type="button"
          disabled={!canPlan}
          onClick={(event) => {
            event.stopPropagation();
            if (canPlan) onAddToPlan(task);
          }}
          aria-label={canPlan ? `Add ${task.title} to today's menu` : "Choose a chef before planning"}
        >
          <Plus size={11} weight="bold" /> Today
        </button>
        <PriorityPill task={task} />
      </div>
    </article>
  );
}
