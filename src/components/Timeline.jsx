import { CalendarDots, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { formatDate, parseDate } from "../lib/dates.js";

const MONTHS_PER_QUARTER = 3;

// Non-overlapping Gantt: one work item per row, bar from created date to due date.
export function Timeline({ tasks, quarter, onQuarterChange }) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(quarter.year, quarter.index * 3, 1);
  const end = new Date(quarter.year, quarter.index * 3 + 3, 0, 23, 59);
  const span = end.getTime() - start.getTime();
  const months = Array.from({ length: MONTHS_PER_QUARTER }, (_, index) =>
    new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" })
      .format(new Date(start.getFullYear(), start.getMonth() + index, 1))
      .replace(" ", " ’"));
  const todayOffset = (now.getTime() - start.getTime()) / span;
  const rows = tasks
    .filter((task) => {
      const due = parseDate(task.dueDate);
      return due && due >= start && due <= end;
    })
    .sort((a, b) => {
      const aDue = parseDate(a.dueDate);
      const bDue = parseDate(b.dueDate);
      const aPast = aDue < currentMonthStart;
      const bPast = bDue < currentMonthStart;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aDue - bDue;
    });

  return (
    <section className="timeline-card panel">
      <header className="panel-head">
        <span className="panel-icon"><CalendarDots size={18} weight="duotone" /></span>
        <div>
          <strong>Service Schedule</strong>
          <small>ตารางเสิร์ฟ · ช่วงเวลาของแต่ละจาน</small>
        </div>
        <div className="quarter-nav">
          <button type="button" onClick={() => onQuarterChange(-1)} aria-label="Previous quarter"><CaretLeft size={14} weight="bold" /></button>
          <b>{`Q${quarter.index + 1} ${quarter.year}`}</b>
          <button type="button" onClick={() => onQuarterChange(1)} aria-label="Next quarter"><CaretRight size={14} weight="bold" /></button>
        </div>
      </header>
      <div className="timeline-scroll">
        <div className="timeline-gantt" style={{ "--month-count": MONTHS_PER_QUARTER }}>
          <div className="timeline-gantt__header">
            <strong>Food piece</strong>
            <div className="month-labels">{months.map((month) => <span key={month}>{month}</span>)}</div>
          </div>
          <div className="timeline-rows">
            {rows.map((task) => {
              const due = parseDate(task.dueDate);
              const rawCreated = parseDate(task.createdDate);
              const created = rawCreated && rawCreated <= due ? rawCreated : new Date(due.getTime() - 4 * 86400000);
              const dueAt = Math.max(0, Math.min(1, (due.getTime() - start.getTime()) / span));
              const startAt = Math.max(0, Math.min(dueAt, (created.getTime() - start.getTime()) / span));
              const width = Math.max(1.6, (dueAt - startAt) * 100);
              return (
                <div className={`timeline-row ${due < currentMonthStart ? "is-past" : ""}`} key={task.id}>
                  <div className="timeline-label">
                    <i style={{ background: task.color }} />
                    <span>
                      <b>{task.id}</b>
                      <strong title={task.title}>{task.title}</strong>
                    </span>
                    <small>{formatDate(created, false)} – {formatDate(due, false)}</small>
                  </div>
                  <div className="timeline-track">
                    {months.map((month) => <i key={month} />)}
                    {todayOffset >= 0 && todayOffset <= 1 && <em className="timeline-today" style={{ left: `${todayOffset * 100}%` }} />}
                    <span
                      className="timeline-bar"
                      title={`${task.id} · ${formatDate(created)} – ${formatDate(due)}`}
                      style={{ left: `${startAt * 100}%`, width: `${Math.min(width, 100 - startAt * 100)}%`, background: task.color }}
                    >
                      {width > 10 ? task.epic : ""}
                    </span>
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && <div className="timeline-empty">ยังไม่มีจานที่ครบกำหนดในไตรมาสนี้</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
