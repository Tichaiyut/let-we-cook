import { addDays, isoDate } from "./lib/dates.js";

// In-browser stand-in for the Apps Script API, used by `npm run dev`.
// It mirrors the real responses closely enough to exercise every screen,
// and keeps its data in localStorage so created work survives a reload.
const STORAGE_KEY = "lwc:sample-kitchen:v1";

function seed() {
  const today = new Date();
  const day = (offset) => isoDate(addDays(today, offset));
  const people = [
    { id: "arparat", name: "Arparat", active: true, characterName: "Saint - Chan", role: "Data Provider" },
    { id: "tichaiyut", name: "Tichaiyut", active: true, characterName: "Topu - Kun", role: "Data Scientist" },
    { id: "chonlasit", name: "Chonlasit", active: true, characterName: "Bon - Kun", role: "AI Engineer" },
    { id: "sorawee", name: "Sorawee", active: true, characterName: "Ing - Kun", role: "Web Developer" },
  ];
  const epics = [
    { code: "IFM", name: "iFarm", color: "#2f72e8", status: "Active" },
    { code: "SUP", name: "SuperAPP", color: "#e8742a", status: "Active" },
    { code: "AIP", name: "AI Lab", color: "#8a4fd0", status: "Active" },
  ];
  const stories = [
    { id: "IFM-PER", epicCode: "IFM", code: "PER", name: "Performance Dashboard", status: "Active" },
    { id: "IFM-DEN", epicCode: "IFM", code: "DEN", name: "Daily Entry", status: "Active" },
    { id: "SUP-NOT", epicCode: "SUP", code: "NOT", name: "Notification", status: "Active" },
    { id: "AIP-RAG", epicCode: "AIP", code: "RAG", name: "RAG Assistant", status: "Active" },
  ];
  const rows = [
    ["IFM-PER-T0001", "สร้าง Dashboard ประสิทธิภาพรายสัปดาห์", "To Do", ["tichaiyut"], -6, 5],
    ["IFM-PER-T0002", "ปรับกราฟ FCR ให้ดูย้อนหลัง 12 สัปดาห์", "In Progress", ["tichaiyut", "sorawee"], -10, 12],
    ["IFM-PER-B0001", "กราฟ Performance แสดงค่าผิดเมื่อไม่มีข้อมูล", "In Progress", ["sorawee"], -3, 2],
    ["IFM-DEN-T0001", "หน้าบันทึกข้อมูลรายวันสำหรับฟาร์ม", "To Do", ["sorawee"], -2, 20],
    ["IFM-DEN-T0002", "ตรวจความถูกต้องข้อมูลนำเข้าจาก Excel", "Backlog", ["arparat"], -1, 40],
    ["IFM-DEN-T0003", "เตรียมข้อมูลฟาร์มตัวอย่าง", "Done", ["arparat"], -25, -15],
    ["SUP-NOT-T0001", "ระบบแจ้งเตือนผ่าน LINE", "To Do", ["sorawee", "chonlasit"], -8, 9],
    ["SUP-NOT-T0002", "ออกแบบข้อความแจ้งเตือนอุณหภูมิต่ำ", "Done", ["arparat"], -20, -6],
    ["SUP-NOT-T0003", "สรุปจำนวนการแจ้งเตือนรายเดือน", "Done", ["tichaiyut"], -30, -12],
    ["AIP-RAG-T0001", "เชื่อม RAG Chat กับคู่มือฟาร์ม", "In Progress", ["chonlasit"], -14, 16],
    ["AIP-RAG-T0002", "เทรนโมเดลคาดการณ์ราคาไข่ไก่", "To Do", ["chonlasit", "tichaiyut"], -4, 33],
    ["AIP-RAG-B0001", "คำตอบ AI ภาษาไทยตัดคำผิด", "To Do", ["chonlasit"], -5, -2],
  ];
  const tasks = rows.map(([id, title, status, assignees, created, due]) => {
    const [epicCode, storyCode, itemCode] = id.split("-");
    return {
      id,
      itemCode,
      epicCode,
      storyId: `${epicCode}-${storyCode}`,
      issueType: itemCode.startsWith("B") ? "Bug" : "Task",
      title,
      description: "",
      status,
      assignees,
      reporter: assignees[0],
      createdDate: day(created),
      dueDate: day(due),
    };
  });
  return { people, epics, stories, tasks, plans: {} };
}

function load() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.tasks) return saved;
  } catch {
    // Fall through to fresh sample data.
  }
  return seed();
}

export function createSampleKitchen(ApiError) {
  const db = load();
  db.usedIds = db.usedIds || db.tasks.map((task) => task.id);
  const persist = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Demo data just won't survive a reload.
    }
  };
  const wait = (value) => new Promise((resolve) => window.setTimeout(() => resolve(value), 280));
  const decorate = (task) => {
    const epic = db.epics.find((item) => item.code === task.epicCode) || {};
    const story = db.stories.find((item) => item.id === task.storyId) || {};
    return { ...task, deleted: Boolean(task.deleted), epic: epic.name || task.epicCode, epicColor: epic.color || "", story: story.name || "" };
  };
  const snapshot = () => ({
    ok: true,
    people: db.people,
    epics: db.epics,
    stories: db.stories,
    tasks: db.tasks.filter((task) => !task.deleted).map(decorate),
    trash: db.tasks.filter((task) => task.deleted).map(decorate),
    generatedAt: new Date().toISOString(),
  });
  const find = (id) => {
    const task = db.tasks.find((item) => item.id === id);
    if (!task) throw new ApiError("Work item not found");
    return task;
  };
  // Like the Apps Script, an ID that was ever issued is never issued again.
  const nextId = (storyId, issueType) => {
    const typeCode = issueType === "Bug" ? "B" : "T";
    const prefix = `${storyId}-${typeCode}`;
    const next = db.usedIds.reduce((max, id) => {
      const match = id.match(new RegExp(`^${prefix}(\d{4})$`));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    const itemCode = `${typeCode}${String(next).padStart(4, "0")}`;
    return { id: `${storyId}-${itemCode}`, itemCode };
  };

  return {
    async login() {
      return wait({ ok: true });
    },
    async bootstrap() {
      return wait(snapshot());
    },
    async getDailyPlan(planDate, personId) {
      return wait({ ok: true, entries: db.plans[`${planDate}:${personId}`] || [] });
    },
    async saveDailyPlan(planDate, personId, entries) {
      db.plans[`${planDate}:${personId}`] = entries;
      persist();
      return wait({ ok: true, saved: entries.length });
    },
    async createTask(payload, actor) {
      let epicCode = payload.epicCode;
      if (payload.newEpic) {
        epicCode = payload.newEpic.code;
        if (db.epics.some((epic) => epic.code === epicCode)) throw new ApiError("Menu code already exists");
        db.epics.push({ code: epicCode, name: payload.newEpic.name, color: payload.newEpic.color, status: "Active" });
      }
      let storyId = payload.storyId;
      if (payload.newStory) {
        storyId = `${epicCode}-${payload.newStory.code}`;
        if (db.stories.some((story) => story.id === storyId)) throw new ApiError("Course code already exists in this menu");
        db.stories.push({ id: storyId, epicCode, code: payload.newStory.code, name: payload.newStory.name, status: "Active" });
      }
      const { id, itemCode } = nextId(storyId, payload.issueType);
      const task = {
        id,
        itemCode,
        epicCode,
        storyId,
        issueType: payload.issueType,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        assignees: payload.assignees,
        reporter: actor,
        createdDate: isoDate(new Date()),
        dueDate: payload.dueDate,
      };
      db.tasks.push(task);
      db.usedIds.push(id);
      persist();
      const data = snapshot();
      return wait({ ok: true, task: decorate(task), epics: data.epics, stories: data.stories });
    },
    async updateStatus(id, status) {
      const task = find(id);
      if (task.deleted) throw new ApiError("งานนี้อยู่ในถังขยะ กู้คืนก่อนเปลี่ยนสถานะ");
      task.status = status;
      persist();
      return wait({ ok: true, task: decorate(task) });
    },
    async updateTask(payload) {
      const task = find(payload.id);
      if (task.deleted) throw new ApiError("งานนี้อยู่ในถังขยะ กู้คืนก่อนแก้ไข");
      const story = db.stories.find((item) => item.id === payload.storyId);
      if (!story) throw new ApiError("Choose a valid course");
      const previousId = task.id;
      const prefix = `${story.id}-${payload.issueType === "Bug" ? "B" : "T"}`;
      if (!new RegExp(`^${prefix}\d{4}$`).test(task.id)) {
        const { id, itemCode } = nextId(story.id, payload.issueType);
        Object.assign(task, { id, itemCode });
        db.usedIds.push(id);
        Object.values(db.plans).forEach((entries) => entries.forEach((entry) => {
          if (entry.taskId === previousId) entry.taskId = id;
        }));
      }
      Object.assign(task, {
        epicCode: story.epicCode,
        storyId: story.id,
        issueType: payload.issueType,
        title: payload.title,
        description: payload.description,
        dueDate: payload.dueDate,
        assignees: payload.assignees,
        status: payload.status,
      });
      persist();
      return wait({ ok: true, task: decorate(task), previousId: task.id === previousId ? "" : previousId });
    },
    async deleteTask(id, _reason, actor) {
      const task = find(id);
      if (task.deleted) throw new ApiError("งานนี้อยู่ในถังขยะแล้ว");
      Object.assign(task, { deleted: true, deletedAt: new Date().toISOString(), deletedBy: actor });
      persist();
      return wait({ ok: true, task: decorate(task) });
    },
    async restoreTask(id) {
      const task = find(id);
      if (!task.deleted) throw new ApiError("งานนี้ไม่ได้อยู่ในถังขยะ");
      Object.assign(task, { deleted: false, deletedAt: "", deletedBy: "" });
      persist();
      return wait({ ok: true, task: decorate(task) });
    },
  };
}
