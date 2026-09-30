import { useState } from "react";
import { Key, X } from "@phosphor-icons/react";
import { PinInput } from "./LoginScreen.jsx";

export function ChangePinModal({ onClose, onSave }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (next !== again) {
      setError("PIN ใหม่สองช่องไม่ตรงกัน");
      return;
    }
    setSaving(true);
    setError("");
    const saved = await onSave(current, next, setError);
    if (!saved) {
      setSaving(false);
      setCurrent("");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <form className="order-form pin-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Change PIN">
        <header>
          <span className="order-form__icon"><Key size={22} weight="duotone" /></span>
          <div>
            <strong>เปลี่ยน PIN</strong>
            <small>เครื่องอื่นที่ login ด้วย PIN เดิมอยู่จะถูกให้ออกจากระบบ</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} weight="bold" /></button>
        </header>
        <PinInput label="PIN ปัจจุบัน" value={current} onChange={setCurrent} autoFocus disabled={saving} />
        <div className="pin-pair">
          <PinInput label="PIN ใหม่" value={next} onChange={setNext} disabled={saving} />
          <PinInput label="ยืนยัน PIN ใหม่" value={again} onChange={setAgain} disabled={saving} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving || current.length !== 4 || next.length !== 4 || again.length !== 4}>
            {saving ? "Saving…" : "เปลี่ยน PIN"}
          </button>
        </footer>
      </form>
    </div>
  );
}
