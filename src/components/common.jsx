import { createContext, useContext } from "react";
import { Bug, CaretDown, ChefHat, Carrot } from "@phosphor-icons/react";
import { chefProfile } from "../team.js";
import { countdownLabel, daysUntil } from "../lib/dates.js";
import { TERMS } from "../lib/kitchen.js";

// People from the sheet, keyed by id, so any component can show a chef.
export const CrewContext = createContext({});

export function useChef(id) {
  const peopleById = useContext(CrewContext);
  return chefProfile(id, peopleById[String(id || "").toLowerCase()]);
}

export function ChefAvatar({ id, size = 28, ring = true }) {
  const chef = useChef(id);
  const Icon = chef.icon;
  return (
    <span
      className={`chef-avatar ${ring ? "has-ring" : ""}`}
      style={{ "--chef": chef.color, width: size, height: size }}
      title={`${chef.name} · ${chef.title}`}
    >
      {chef.image ? <img src={chef.image} alt={chef.name} /> : <Icon size={Math.round(size * 0.52)} weight="bold" />}
    </span>
  );
}

export function ChefStack({ ids = [], size = 22 }) {
  const values = ids.filter(Boolean);
  if (!values.length) return <span className="chef-stack is-empty">—</span>;
  return (
    <span className="chef-stack">
      {values.slice(0, 4).map((id) => <ChefAvatar key={id} id={id} size={size} />)}
      {values.length > 4 && <b>+{values.length - 4}</b>}
    </span>
  );
}

export function ChefNames({ ids = [] }) {
  const peopleById = useContext(CrewContext);
  const names = ids.filter(Boolean).map((id) => chefProfile(id, peopleById[id]).name);
  return <>{names.length ? names.join(", ") : "No chef yet"}</>;
}

// Large character card art. Uses `image` from team.js when artwork exists,
// otherwise a plated role emblem under a chef hat — never a real face.
export function CharacterArt({ chef }) {
  const Icon = chef.icon;
  return (
    <div className="character-art" style={{ "--chef": chef.color }}>
      {chef.image ? (
        <img src={chef.image} alt={chef.name} />
      ) : (
        <>
          <span className="character-art__tiles" aria-hidden="true" />
          <span className="character-art__hat" aria-hidden="true"><ChefHat size={46} weight="fill" /></span>
          <span className="character-art__plate" aria-hidden="true"><Icon size={58} weight="duotone" /></span>
          <span className="character-art__steam" aria-hidden="true"><i /><i /><i /></span>
        </>
      )}
    </div>
  );
}

export function TypeChip({ type }) {
  const isBug = type === "Bug";
  return (
    <span className={`type-chip ${isBug ? "is-bug" : ""}`}>
      {isBug ? <Bug size={10} weight="bold" /> : <Carrot size={10} weight="bold" />}
      {TERMS[type]}
    </span>
  );
}

export function PriorityPill({ task, compact = false }) {
  const overdue = task.status !== "Done" && daysUntil(task.dueDate) < 0;
  return (
    <span className="priority-wrap">
      <span className={`priority-pill priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
      {!compact && <b className={overdue ? "is-overdue" : ""}>{countdownLabel(task.dueDate, task.status)}</b>}
    </span>
  );
}

export function Filter({ label, icon: Icon, value, options, onChange }) {
  const active = value !== "All";
  return (
    <label className={`filter-control ${active ? "is-active" : ""}`}>
      <span className="sr-only">{label}</span>
      {Icon && <Icon size={16} weight="duotone" />}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="All">{label}: All</option>
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: option } : option;
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </select>
      <CaretDown size={13} weight="bold" />
    </label>
  );
}
