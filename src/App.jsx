import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise, BowlSteam, CalendarBlank, ChefHat, ClipboardText, CookingPot, Fire, ForkKnife,
  Info, Knife, Plus, SignOut, Sparkle, Timer, Trash, UsersThree, WarningCircle,
} from "@phosphor-icons/react";
import { api, MODE } from "./api.js";
import { daysUntil, formatLongDate, isoDate, sortByDueDateOldestFirst } from "./lib/dates.js";
import { ALL_STATUSES, BOARD_STATUSES, PRIORITIES, STATIONS, normalizeTask } from "./lib/kitchen.js";
import { sortCrew } from "./team.js";
import { BacklogTable } from "./components/BacklogTable.jsx";
import { BinTable } from "./components/BinTable.jsx";
import { EditModal } from "./components/EditModal.jsx";
import { CreateModal } from "./components/CreateModal.jsx";
import { CrewPage } from "./components/CrewPage.jsx";
import { CrewContext, Filter } from "./components/common.jsx";
import { LoginScreen, SetupNotice } from "./components/LoginScreen.jsx";
import { TaskCard } from "./components/TaskCard.jsx";
import { TaskDetailModal } from "./components/TaskDetailModal.jsx";
import { Timeline } from "./components/Timeline.jsx";
import { TodayPlan } from "./components/TodayPlan.jsx";

const STATION_ICONS = { "To Do": Knife, "In Progress": Fire, Done: BowlSteam };
const EMPTY_FILTERS = { menu: "All", course: "All", chef: "All", status: "All", priority: "All" };

export function App() {
  const [authenticated, setAuthenticated] = useState(() => api.hasSession());
  const [notice, setNotice] = useState("");

  if (MODE === "unconfigured") return <SetupNotice />;
  if (!authenticated) {
    return <LoginScreen notice={notice} onAuthenticated={() => { setNotice(""); setAuthenticated(true); }} />;
  }
  return (
    <Kitchen
      onSignOut={(reason = "") => {
        api.logout();
        setNotice(reason);
        setAuthenticated(false);
      }}
    />
  );
}

function toKitchenData(result) {
  const now = new Date();
  return {
    tasks: (result.tasks || []).map((task) => normalizeTask(task, now)).filter((task) => task.id),
    trash: (result.trash || []).map((task) => normalizeTask(task, now)).filter((task) => task.id),
    people: (result.people || []).map((person) => ({ ...person, id: String(person.id).toLowerCase() })),
    epics: result.epics || [],
    stories: result.stories || [],
  };
}

function Kitchen({ onSignOut }) {
  const [data, setData] = useState({ tasks: [], trash: [], people: [], epics: [], stories: [] });
  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState("kitchen");
  const [tab, setTab] = useState("board");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [currentUser, setCurrentUser] = useState("All");
  const [planDate, setPlanDate] = useState(() => isoDate(new Date()));
  const [plan, setPlan] = useState({ entries: [], loading: false, saving: false, dirty: false });
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [quarter, setQuarter] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), index: Math.floor(now.getMonth() / 3) };
  });

  const notify = useCallback((message, tone = "success", action = null) => setToast({ message, tone, action, at: Date.now() }), []);

  const handleError = useCallback((error) => {
    if (error?.isAuth) {
      onSignOut("เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบอีกครั้ง");
      return;
    }
    notify(error?.message || "ทำรายการไม่สำเร็จ", "error");
  }, [notify, onSignOut]);

  const load = useCallback(async () => {
    setLoadState((state) => (state === "ready" ? state : "loading"));
    try {
      setData(toKitchenData(await api.bootstrap()));
      setLoadState("ready");
    } catch (error) {
      if (error?.isAuth) {
        handleError(error);
        return;
      }
      setLoadError(error?.message || "โหลดข้อมูลไม่สำเร็จ");
      setLoadState("error");
    }
  }, [handleError]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), toast.action ? 10000 : toast.tone === "error" ? 5200 : 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function onKey(event) {
      if (event.key !== "Escape") return;
      setShowCreate(false);
      setSelectedId(null);
      setEditingId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Today's menu follows the chosen chef and date.
  useEffect(() => {
    if (currentUser === "All") {
      setPlan({ entries: [], loading: false, saving: false, dirty: false });
      return undefined;
    }
    let active = true;
    setPlan((current) => ({ ...current, entries: [], loading: true, dirty: false }));
    api.getDailyPlan(planDate, currentUser)
      .then((result) => {
        if (!active) return;
        const entries = (result.entries || []).map((entry) => ({ taskId: entry.taskId, note: entry.note || "" }));
        setPlan({ entries, loading: false, saving: false, dirty: false });
      })
      .catch((error) => {
        if (!active) return;
        setPlan((current) => ({ ...current, loading: false }));
        handleError(error);
      });
    return () => { active = false; };
  }, [currentUser, planDate, handleError]);

  const peopleById = useMemo(() => Object.fromEntries(data.people.map((person) => [person.id, person])), [data.people]);
  const crew = useMemo(() => sortCrew(data.people.filter((person) => person.active !== false)), [data.people]);
  const tasksById = useMemo(() => Object.fromEntries(data.tasks.map((task) => [task.id, task])), [data.tasks]);

  const menuOptions = useMemo(
    () => [...new Set([...data.epics.map((epic) => epic.name), ...data.tasks.map((task) => task.epic)])].filter(Boolean).sort(),
    [data.epics, data.tasks],
  );
  const courseOptions = useMemo(() => {
    const epicCodes = filters.menu === "All" ? null : new Set(data.epics.filter((epic) => epic.name === filters.menu).map((epic) => epic.code));
    const names = data.stories.filter((story) => !epicCodes || epicCodes.has(story.epicCode)).map((story) => story.name);
    return [...new Set(names)].filter(Boolean).sort();
  }, [data.stories, data.epics, filters.menu]);

  const filtered = useMemo(() => data.tasks.filter((task) => {
    if (filters.menu !== "All" && task.epic !== filters.menu) return false;
    if (filters.course !== "All" && task.story !== filters.course) return false;
    if (filters.chef !== "All" && !task.assignees.includes(filters.chef)) return false;
    if (filters.status !== "All" && task.status !== filters.status) return false;
    if (filters.priority !== "All" && task.priority !== filters.priority) return false;
    return true;
  }), [data.tasks, filters]);

  const board = useMemo(() => Object.fromEntries(BOARD_STATUSES.map((status) => [
    status,
    filtered.filter((task) => task.status === status).sort(sortByDueDateOldestFirst),
  ])), [filtered]);
  const pantry = useMemo(() => filtered.filter((task) => task.status === "Backlog").sort(sortByDueDateOldestFirst), [filtered]);

  const stats = useMemo(() => {
    const total = data.tasks.length;
    const served = data.tasks.filter((task) => task.status === "Done").length;
    const open = data.tasks.filter((task) => task.status !== "Done");
    return {
      total,
      servedRate: total ? Math.round((served / total) * 100) : 0,
      overdue: open.filter((task) => daysUntil(task.dueDate) < 0).length,
      hot: open.filter((task) => task.priority === "Urgent").length,
    };
  }, [data.tasks]);

  const binnedIds = useMemo(() => new Set(data.trash.map((task) => task.id)), [data.trash]);
  const planEntries = plan.entries.map((entry) => ({ ...entry, task: tasksById[entry.taskId] || null, binned: binnedIds.has(entry.taskId) }));
  const selectedTask = selectedId ? tasksById[selectedId] : null;
  const actor = currentUser !== "All" ? currentUser : "team";

  function confirmLeavingPlan() {
    return !plan.dirty || window.confirm("เมนูวันนี้ยังไม่ได้บันทึก ต้องการเปลี่ยนโดยไม่บันทึกใช่ไหม?");
  }

  function chooseChef(value) {
    if (value === currentUser || !confirmLeavingPlan()) return;
    setCurrentUser(value);
    setFilters((current) => ({ ...current, chef: value }));
  }

  function setFilter(key, value) {
    if (key === "chef") {
      const isCrew = crew.some((person) => person.id === value);
      const nextUser = value === "All" || isCrew ? value : "All";
      if (nextUser !== currentUser && !confirmLeavingPlan()) return;
      setCurrentUser(nextUser);
    }
    setFilters((current) => ({ ...current, [key]: value, ...(key === "menu" ? { course: "All" } : {}) }));
  }

  function clearFilters() {
    if (currentUser !== "All" && !confirmLeavingPlan()) return;
    setCurrentUser("All");
    setFilters(EMPTY_FILTERS);
  }

  function addToPlan(task) {
    if (currentUser === "All") {
      notify("เลือกเชฟในกระดานเมนูวันนี้ก่อน", "error");
      return;
    }
    if (plan.entries.some((entry) => entry.taskId === task.id)) {
      notify(`${task.id} อยู่ในเมนูวันนี้แล้ว`);
      return;
    }
    setPlan((current) => ({ ...current, dirty: true, entries: [...current.entries, { taskId: task.id, note: "" }] }));
    notify(`เพิ่ม ${task.id} ลงเมนูวันนี้`);
  }

  async function savePlan() {
    setPlan((current) => ({ ...current, saving: true }));
    try {
      await api.saveDailyPlan(planDate, currentUser, plan.entries.map(({ taskId, note }) => ({ taskId, note })), actor);
      setPlan((current) => ({ ...current, saving: false, dirty: false }));
      notify(MODE === "sample" ? "บันทึกเมนูวันนี้แล้ว (ข้อมูลตัวอย่าง)" : "บันทึกเมนูวันนี้ลง Google Sheet แล้ว");
    } catch (error) {
      setPlan((current) => ({ ...current, saving: false }));
      handleError(error);
    }
  }

  async function createTask(payload, showFormError) {
    try {
      const result = await api.createTask(payload, currentUser !== "All" ? currentUser : payload.assignees[0]);
      const task = normalizeTask(result.task);
      setData((current) => ({
        ...current,
        tasks: [task, ...current.tasks.filter((item) => item.id !== task.id)],
        epics: result.epics || current.epics,
        stories: result.stories || current.stories,
      }));
      setShowCreate(false);
      notify(`ส่งออเดอร์เข้าครัวแล้ว: ${task.id}`);
      return true;
    } catch (error) {
      if (error?.isAuth) handleError(error);
      else showFormError(error?.message || "สร้างงานไม่สำเร็จ");
      return false;
    }
  }

  async function editTask(payload, showFormError) {
    try {
      const result = await api.updateTask(payload, actor);
      const task = normalizeTask(result.task);
      const previousId = result.previousId || "";
      setData((current) => ({ ...current, tasks: current.tasks.map((item) => (item.id === payload.id ? task : item)) }));
      if (previousId) {
        setPlan((current) => ({ ...current, entries: current.entries.map((entry) => (entry.taskId === previousId ? { ...entry, taskId: task.id } : entry)) }));
      }
      setEditingId(null);
      notify(previousId ? `บันทึกแล้ว · ${previousId} → ${task.id}` : `บันทึกการแก้ไข ${task.id}`);
      return true;
    } catch (error) {
      if (error?.isAuth) handleError(error);
      else showFormError(error?.message || "แก้ไขไม่สำเร็จ");
      return false;
    }
  }

  async function restoreTask(task) {
    try {
      const result = await api.restoreTask(task.id, actor);
      const restored = normalizeTask(result.task);
      setData((current) => ({
        ...current,
        trash: current.trash.filter((item) => item.id !== task.id),
        tasks: [restored, ...current.tasks.filter((item) => item.id !== task.id)],
      }));
      notify(`กู้คืน ${task.id} กลับขึ้นบอร์ดแล้ว`);
    } catch (error) {
      handleError(error);
    }
  }

  async function deleteTask(task, reason) {
    try {
      const result = await api.deleteTask(task.id, reason, actor);
      const binned = normalizeTask(result.task);
      setData((current) => ({
        ...current,
        tasks: current.tasks.filter((item) => item.id !== task.id),
        trash: [binned, ...current.trash.filter((item) => item.id !== task.id)],
      }));
      setSelectedId(null);
      notify(`ทิ้ง ${task.id} ลงถังขยะแล้ว`, "success", { label: "Undo", run: () => restoreTask(task) });
      return true;
    } catch (error) {
      handleError(error);
      return false;
    }
  }

  async function updateStatus(id, status) {
    try {
      const result = await api.updateStatus(id, status, actor);
      const updated = normalizeTask(result.task || { ...tasksById[id], status });
      setData((current) => ({ ...current, tasks: current.tasks.map((task) => (task.id === id ? updated : task)) }));
      setSelectedId(null);
      notify(`${id} → ${STATIONS[status].name}`);
      return true;
    } catch (error) {
      handleError(error);
      return false;
    }
  }

  return (
    <CrewContext.Provider value={peopleById}>
      <main className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-emblem"><ChefHat size={26} weight="fill" /></span>
            <div>
              <strong>Let We Cook</strong>
              <small>TechFeed Kitchen · Task Tracker</small>
            </div>
          </div>
          <nav className="page-nav" aria-label="Pages">
            <button type="button" className={page === "kitchen" ? "active" : ""} onClick={() => setPage("kitchen")}>
              <CookingPot size={16} weight="duotone" /> Kitchen
            </button>
            <button type="button" className={page === "crew" ? "active" : ""} onClick={() => setPage("crew")}>
              <UsersThree size={16} weight="duotone" /> Crew
            </button>
          </nav>
          <div className="topbar-date"><CalendarBlank size={15} weight="bold" />{formatLongDate()}</div>
          {MODE === "sample" && <span className="mode-badge" title="npm run dev ใช้ข้อมูลตัวอย่างในเบราว์เซอร์">Sample data</span>}
          <button className="create-button" type="button" onClick={() => setShowCreate(true)} disabled={loadState !== "ready"}>
            <Plus size={16} weight="bold" /> Add Food Piece
          </button>
          {MODE === "live" && (
            <button className="icon-button" type="button" onClick={() => onSignOut()} title="Sign out" aria-label="Sign out">
              <SignOut size={18} weight="bold" />
            </button>
          )}
        </header>
        <div className="tablecloth" aria-hidden="true" />

        {loadState === "loading" && (
          <div className="kitchen-state">
            <span className="pan"><CookingPot size={42} weight="duotone" /></span>
            <strong>Preheating the oven…</strong>
            <small>กำลังโหลดงานจาก Google Sheet</small>
          </div>
        )}

        {loadState === "error" && (
          <div className="kitchen-state is-error">
            <WarningCircle size={42} weight="duotone" />
            <strong>ครัวยังเปิดไม่ได้</strong>
            <small>{loadError}</small>
            <button type="button" className="primary-button" onClick={load}><ArrowClockwise size={15} weight="bold" /> ลองใหม่</button>
          </div>
        )}

        {loadState === "ready" && page === "crew" && (
          <div className="content"><CrewPage crew={crew} tasks={data.tasks} /></div>
        )}

        {loadState === "ready" && page === "kitchen" && (
          <div className="content">
            {data.tasks.length === 0 && (
              <section className="welcome-banner">
                <Sparkle size={26} weight="duotone" />
                <div>
                  <strong>ครัวพร้อมแล้ว! ยังไม่มีออเดอร์เลย</strong>
                  <span>เริ่มจากกด “Add Food Piece” แล้วสร้าง Menu และ Course แรกของทีมได้ในฟอร์มเดียว</span>
                </div>
                <button type="button" className="primary-button" onClick={() => setShowCreate(true)}><Plus size={15} weight="bold" /> สร้างออเดอร์แรก</button>
              </section>
            )}

            <section className="filters">
              <Filter label="Menu" icon={ForkKnife} value={filters.menu} options={menuOptions} onChange={(value) => setFilter("menu", value)} />
              <Filter label="Course" icon={BowlSteam} value={filters.course} options={courseOptions} onChange={(value) => setFilter("course", value)} />
              <Filter label="Chef" icon={ChefHat} value={filters.chef} options={crew.map((person) => ({ value: person.id, label: person.name }))} onChange={(value) => setFilter("chef", value)} />
              <Filter label="Station" icon={CookingPot} value={filters.status} options={ALL_STATUSES.map((status) => ({ value: status, label: STATIONS[status].name }))} onChange={(value) => setFilter("status", value)} />
              <Filter label="Heat" icon={Fire} value={filters.priority} options={PRIORITIES} onChange={(value) => setFilter("priority", value)} />
              {Object.values(filters).some((value) => value !== "All") && (
                <button type="button" className="clear-filters" onClick={clearFilters}>Clear</button>
              )}
            </section>

            <section className="kpi-strip">
              <div className="kpi kpi-total"><ClipboardText size={24} weight="duotone" /><span><small>Total orders</small><strong>{stats.total}</strong><em>ออเดอร์ทั้งหมด</em></span></div>
              <div className="kpi kpi-served">
                <BowlSteam size={24} weight="duotone" />
                <span><small>Served</small><strong>{stats.servedRate}%</strong><i className="kpi-bar"><b style={{ width: `${stats.servedRate}%` }} /></i></span>
              </div>
              <div className="kpi kpi-overdue"><Timer size={24} weight="duotone" /><span><small>Overdue</small><strong>{stats.overdue}</strong><em>เลยเวลาเสิร์ฟ</em></span></div>
              <div className="kpi kpi-hot"><Fire size={24} weight="duotone" /><span><small>Hot orders</small><strong>{stats.hot}</strong><em>ด่วน ภายใน 7 วัน</em></span></div>
              <div className="kpi kpi-visible"><ForkKnife size={24} weight="duotone" /><span><small>On the board</small><strong>{filtered.length}</strong><em>ตามตัวกรอง</em></span></div>
            </section>

            <Timeline tasks={filtered} quarter={quarter} onQuarterChange={(delta) => setQuarter((current) => {
              const value = current.year * 4 + current.index + delta;
              return { year: Math.floor(value / 4), index: ((value % 4) + 4) % 4 };
            })} />

            <nav className="tabs" aria-label="Views">
              <button type="button" className={tab === "board" ? "active" : ""} onClick={() => setTab("board")}>
                <CookingPot size={16} weight="duotone" /> Kitchen Board
              </button>
              <button type="button" className={tab === "pantry" ? "active" : ""} onClick={() => setTab("pantry")}>
                Pantry <span>{pantry.length}</span>
              </button>
              <button type="button" className={tab === "bin" ? "active" : ""} onClick={() => setTab("bin")}>
                <Trash size={15} weight="duotone" /> Bin <span>{data.trash.length}</span>
              </button>
            </nav>

            {tab === "board" ? (
              <div className="work-area">
                <TodayPlan
                  crew={crew}
                  currentUser={currentUser}
                  onUserChange={chooseChef}
                  planDate={planDate}
                  onDateChange={(value) => {
                    if (value && value !== planDate && confirmLeavingPlan()) setPlanDate(value);
                  }}
                  entries={planEntries}
                  loading={plan.loading}
                  saving={plan.saving}
                  dirty={plan.dirty}
                  onDropTask={(id) => tasksById[id] && addToPlan(tasksById[id])}
                  onRemove={(id) => setPlan((current) => ({ ...current, dirty: true, entries: current.entries.filter((entry) => entry.taskId !== id) }))}
                  onNote={(id, note) => setPlan((current) => ({ ...current, dirty: true, entries: current.entries.map((entry) => (entry.taskId === id ? { ...entry, note } : entry)) }))}
                  onSave={savePlan}
                />
                <section className="kanban">
                  {BOARD_STATUSES.map((status) => {
                    const station = STATIONS[status];
                    const Icon = STATION_ICONS[status];
                    return (
                      <section className={`station station-${station.tone}`} key={status}>
                        <header>
                          <span className="station-icon"><Icon size={18} weight="duotone" /></span>
                          <div><strong>{station.name}</strong><small>{status} · {station.thai}</small></div>
                          <b>{board[status].length}</b>
                        </header>
                        <div className="station-body">
                          {board[status].map((task) => (
                            <TaskCard key={task.id} task={task} canPlan={currentUser !== "All"} onAddToPlan={addToPlan} onOpen={(item) => setSelectedId(item.id)} />
                          ))}
                          {board[status].length === 0 && (
                            <div className="station-empty"><Icon size={26} weight="duotone" />ไม่มีออเดอร์ที่นี่<br /><small>Station is clear</small></div>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </section>
              </div>
            ) : tab === "pantry" ? (
              <BacklogTable tasks={pantry} onOpen={(task) => setSelectedId(task.id)} />
            ) : (
              <BinTable tasks={data.trash} onRestore={restoreTask} />
            )}

            <footer className="page-note">
              <Info size={15} weight="bold" />
              ลากตั๋วงานจาก Kitchen Board ไปวางบนกระดานเมนูวันนี้ได้ ตั๋วต้นทางจะยังอยู่บนบอร์ดเพื่อติดตามสถานะจริง
            </footer>
          </div>
        )}

        {showCreate && (
          <CreateModal
            epics={data.epics}
            stories={data.stories}
            taskIds={data.tasks.map((task) => task.id)}
            crew={crew}
            defaultChef={currentUser !== "All" ? currentUser : ""}
            onClose={() => setShowCreate(false)}
            onCreate={createTask}
          />
        )}
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            onClose={() => setSelectedId(null)}
            onSave={updateStatus}
            onEdit={(task) => { setSelectedId(null); setEditingId(task.id); }}
            onDelete={deleteTask}
          />
        )}
        {editingId && tasksById[editingId] && (
          <EditModal
            task={tasksById[editingId]}
            epics={data.epics}
            stories={data.stories}
            crew={crew}
            onClose={() => setEditingId(null)}
            onSave={editTask}
          />
        )}
        {toast && (
          <div className={`toast ${toast.tone === "error" ? "is-error" : ""}`} role="status" key={toast.at}>
            {toast.message}
            {toast.action && (
              <button type="button" onClick={() => { setToast(null); toast.action.run(); }}>{toast.action.label}</button>
            )}
          </div>
        )}
      </main>
    </CrewContext.Provider>
  );
}
