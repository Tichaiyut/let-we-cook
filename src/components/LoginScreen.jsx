import { useEffect, useState } from "react";
import { ChefHat, LockKey, Wrench } from "@phosphor-icons/react";
import { api } from "../api.js";

function formatWait(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${rest}`;
}

function KitchenDoor({ children }) {
  return (
    <main className="door-screen">
      <div className="door-awning" aria-hidden="true" />
      <section className="door-card">
        <div className="door-emblem"><ChefHat size={44} weight="fill" /></div>
        <small>TECHFEED TEAM KITCHEN</small>
        <h1>Let We Cook</h1>
        {children}
      </section>
    </main>
  );
}

export function LoginScreen({ notice = "", onAuthenticated }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, setTick] = useState(0);
  const lockedSeconds = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  const isLocked = lockedSeconds > 0;

  useEffect(() => {
    if (!isLocked) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isLocked]);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.login(password);
      onAuthenticated();
    } catch (loginError) {
      if (loginError.retryAfter) setLockedUntil(Date.now() + loginError.retryAfter * 1000);
      setError(loginError.message || "เข้าสู่ระบบไม่สำเร็จ");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KitchenDoor>
      <p>ครัวนี้เปิดเฉพาะสมาชิก TechFeed Team · ใส่รหัสผ่านทีมเพื่อเข้าครัว</p>
      {notice && !error && <p className="door-notice">{notice}</p>}
      <form onSubmit={submit}>
        <label>
          <span>Team password</span>
          <div>
            <LockKey size={18} weight="duotone" />
            <input autoFocus required disabled={isLocked} type="password" autoComplete="current-password"
              value={password} onChange={(event) => setPassword(event.target.value)} placeholder="รหัสผ่านทีม" />
          </div>
        </label>
        {error && <p className="door-error" role="alert">{error}</p>}
        {isLocked && <p className="door-lock">ลองใหม่ได้ในอีก {formatWait(lockedSeconds)}</p>}
        <button type="submit" disabled={submitting || isLocked}>
          {isLocked ? "Kitchen door locked" : submitting ? "Opening the kitchen…" : "Enter the kitchen"}
        </button>
      </form>
      <em>เซสชันอยู่ได้ 2 ชั่วโมง · ใส่รหัสผิด 5 ครั้งจะถูกล็อก 2 ชั่วโมง</em>
    </KitchenDoor>
  );
}

export function SetupNotice() {
  return (
    <KitchenDoor>
      <p className="door-setup"><Wrench size={18} weight="duotone" /> ครัวยังไม่ได้เชื่อมต่อกับ Google Sheet</p>
      <em>ผู้ดูแล: ใส่ URL ของ Apps Script (ลงท้ายด้วย /exec) ใน <code>src/config.js</code> แล้ว push ขึ้น GitHub อีกครั้ง — ดูขั้นตอนใน README</em>
    </KitchenDoor>
  );
}
