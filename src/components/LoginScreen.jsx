import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChefHat, Key, LockKey, UsersThree, Wrench } from "@phosphor-icons/react";
import { api } from "../api.js";
import { chefProfile, sortCrew } from "../team.js";
import { ChefAvatar } from "./common.jsx";

const LAST_CHEF_KEY = "lwc:last-chef";

function rememberChef(id) {
  try {
    window.localStorage.setItem(LAST_CHEF_KEY, id);
  } catch {
    // Not remembering is fine.
  }
}

function lastChef() {
  try {
    return window.localStorage.getItem(LAST_CHEF_KEY) || "";
  } catch {
    return "";
  }
}

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

// Four boxes over a single numeric input, so phones show the number pad.
export function PinInput({ value, onChange, onComplete, autoFocus = false, disabled = false, label }) {
  const input = useRef(null);
  return (
    <label className="pin-field" onClick={() => input.current?.focus()}>
      {label && <span>{label}</span>}
      <div className="pin-boxes">
        {[0, 1, 2, 3].map((index) => <i key={index} className={value.length > index ? "is-filled" : value.length === index ? "is-next" : ""} />)}
        <input
          ref={input}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          aria-label={label || "PIN"}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
            onChange(digits);
            if (digits.length === 4) onComplete?.(digits);
          }}
        />
      </div>
    </label>
  );
}

function useLockTimer() {
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, setTick] = useState(0);
  const seconds = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  useEffect(() => {
    if (!seconds) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [seconds > 0]);
  return [seconds, (retryAfter) => setLockedUntil(retryAfter ? Date.now() + retryAfter * 1000 : 0)];
}

export function LoginScreen({ notice = "", onAuthenticated }) {
  const [roster, setRoster] = useState(null);
  const [rosterError, setRosterError] = useState(false);
  const [step, setStep] = useState("pick");
  const [chefId, setChefId] = useState("");
  const [pin, setPin] = useState("");
  const [pinAgain, setPinAgain] = useState("");
  const [teamPassword, setTeamPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedSeconds, setLock] = useLockTimer();

  useEffect(() => {
    let active = true;
    api.roster()
      .then((result) => {
        if (!active) return;
        const chefs = sortCrew(result.chefs || []);
        setRoster(chefs);
        const remembered = chefs.find((person) => person.id === lastChef());
        if (remembered?.hasPin) {
          setChefId(remembered.id);
          setStep("pin");
        }
      })
      .catch(() => {
        if (!active) return;
        setRosterError(true);
        setStep("team");
      });
    return () => { active = false; };
  }, []);

  const chef = roster?.find((person) => person.id === chefId);
  const profile = chefProfile(chefId, chef);

  function go(nextStep, id = chefId) {
    setStep(nextStep);
    setChefId(id);
    setPin("");
    setPinAgain("");
    setTeamPassword("");
    setError("");
    setLock(0);
  }

  async function attempt(action) {
    setBusy(true);
    setError("");
    try {
      await action();
      if (chefId) rememberChef(chefId);
      onAuthenticated();
    } catch (loginError) {
      if (loginError.retryAfter) setLock(loginError.retryAfter);
      if (loginError.code === "PIN_NOT_SET") {
        go("setup");
        setRoster((current) => current?.map((person) => (person.id === chefId ? { ...person, hasPin: false } : person)));
      }
      setError(loginError.message || "เข้าสู่ระบบไม่สำเร็จ");
      setPin("");
      setPinAgain("");
    } finally {
      setBusy(false);
    }
  }

  const lockNote = lockedSeconds > 0 && <p className="door-lock">ลองใหม่ได้ในอีก {formatWait(lockedSeconds)}</p>;
  const errorNote = error && <p className="door-error" role="alert">{error}</p>;

  return (
    <KitchenDoor>
      {notice && !error && <p className="door-notice">{notice}</p>}

      {step === "pick" && (
        <>
          <p>ใครกำลังเข้าครัว? เลือกชื่อของคุณ</p>
          {!roster ? (
            <div className="chef-picker is-loading">กำลังเปิดประตูครัว…</div>
          ) : (
            <div className="chef-picker">
              {roster.map((person) => {
                const look = chefProfile(person.id, person);
                return (
                  <button key={person.id} type="button" onClick={() => go(person.hasPin ? "pin" : "setup", person.id)}>
                    <ChefAvatar id={person.id} size={46} />
                    <b>{look.name}</b>
                    <small>{person.hasPin ? look.title : "ตั้ง PIN ครั้งแรก"}</small>
                  </button>
                );
              })}
            </div>
          )}
          <button type="button" className="door-link" onClick={() => go("team", "")}><UsersThree size={15} weight="bold" /> เข้าด้วยรหัสทีม (สำรอง)</button>
        </>
      )}

      {step === "pin" && (
        <form onSubmit={(event) => { event.preventDefault(); if (pin.length === 4) attempt(() => api.chefLogin(chefId, pin)); }}>
          <div className="door-who"><ChefAvatar id={chefId} size={52} /><div><b>{profile.name}</b><small>{profile.title}</small></div></div>
          <PinInput label="PIN 4 หลัก" value={pin} onChange={setPin} autoFocus disabled={busy || lockedSeconds > 0}
            onComplete={(digits) => attempt(() => api.chefLogin(chefId, digits))} />
          {errorNote}
          {lockNote}
          <button type="submit" disabled={busy || pin.length !== 4 || lockedSeconds > 0}>{busy ? "Opening the kitchen…" : "Enter the kitchen"}</button>
          <button type="button" className="door-link" onClick={() => go("pick", "")}><ArrowLeft size={14} weight="bold" /> ไม่ใช่ {profile.name}? เปลี่ยนคน</button>
        </form>
      )}

      {step === "setup" && (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (pin !== pinAgain) {
            setError("PIN สองช่องไม่ตรงกัน");
            return;
          }
          attempt(() => api.setupPin(chefId, teamPassword, pin));
        }}>
          <div className="door-who"><ChefAvatar id={chefId} size={52} /><div><b>สวัสดี {profile.name} 👋</b><small>ตั้ง PIN 4 หลักสำหรับเข้าครัวครั้งต่อไป</small></div></div>
          <label className="door-field">
            <span>รหัสทีม (ยืนยันว่าเป็นคนในทีม)</span>
            <div><Key size={18} weight="duotone" /><input required type="password" autoComplete="off" value={teamPassword}
              onChange={(event) => setTeamPassword(event.target.value)} placeholder="รหัสผ่านทีม" autoFocus /></div>
          </label>
          <div className="pin-pair">
            <PinInput label="PIN ใหม่" value={pin} onChange={setPin} disabled={busy} />
            <PinInput label="ยืนยัน PIN" value={pinAgain} onChange={setPinAgain} disabled={busy} />
          </div>
          <p className="door-hint">ห้ามใช้ PIN ที่เดาง่าย เช่น 0000, 1111, 1234</p>
          {errorNote}
          {lockNote}
          <button type="submit" disabled={busy || pin.length !== 4 || pinAgain.length !== 4 || !teamPassword || lockedSeconds > 0}>
            {busy ? "Setting up…" : "ตั้ง PIN แล้วเข้าครัว"}
          </button>
          <button type="button" className="door-link" onClick={() => go("pick", "")}><ArrowLeft size={14} weight="bold" /> เปลี่ยนคน</button>
        </form>
      )}

      {step === "team" && (
        <form onSubmit={(event) => { event.preventDefault(); attempt(() => api.teamLogin(teamPassword)); }}>
          {rosterError && <p className="door-notice">ยังโหลดรายชื่อเชฟไม่ได้ เข้าด้วยรหัสทีมไปก่อนได้</p>}
          <label className="door-field">
            <span>Team password</span>
            <div><LockKey size={18} weight="duotone" /><input autoFocus required type="password" autoComplete="current-password"
              disabled={lockedSeconds > 0} value={teamPassword} onChange={(event) => setTeamPassword(event.target.value)} placeholder="รหัสผ่านทีม" /></div>
          </label>
          <p className="door-hint">เข้าด้วยรหัสทีมจะใช้ชื่อ “Team” · ดู Today's menu ได้อย่างเดียว</p>
          {errorNote}
          {lockNote}
          <button type="submit" disabled={busy || lockedSeconds > 0}>{busy ? "Opening the kitchen…" : "Enter the kitchen"}</button>
          {!rosterError && <button type="button" className="door-link" onClick={() => go("pick", "")}><ArrowLeft size={14} weight="bold" /> กลับไปเลือกชื่อ</button>}
        </form>
      )}

      <em>เซสชันอยู่ได้ 2 ชั่วโมง · PIN ผิด 5 ครั้งชื่อนั้นจะถูกล็อก 2 ชั่วโมง</em>
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
