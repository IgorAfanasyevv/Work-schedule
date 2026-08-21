import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';
import { DAY_NAMES } from '../../types';
import type { Category } from '../../types';
import { addHoursToTime } from '../../engine';

function isValidTime(value: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function normalizeTime(value: string): string {
  const [h, m] = value.trim().split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

export default function AdhocShiftModal() {
  const { addAdhocShift, closeModal, toast } = useScheduler();
  const [day, setDay] = useState(0);
  const [name, setName] = useState('משמרת מיוחדת');
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('18:00');
  const [category, setCategory] = useState<Category>('other');

  const validTimes = isValidTime(start) && isValidTime(end);

  function makeTwelveHours() {
    if (!isValidTime(start)) {
      toast('קודם יש להזין שעת התחלה תקינה (HH:MM)');
      return;
    }
    setEnd(addHoursToTime(normalizeTime(start), 12));
  }

  function save() {
    if (!validTimes) return;
    addAdhocShift(day, name.trim() || 'משמרת מיוחדת', normalizeTime(start), normalizeTime(end), category);
    closeModal();
  }

  return (
    <Modal
      title="הוספת משמרת ליום ספציפי"
      footer={
        <>
          <button className="btn ghost" onClick={closeModal}>
            ביטול
          </button>
          <button className="btn primary" onClick={save} disabled={!validTimes}>
            הוסף משמרת
          </button>
        </>
      }
    >
      <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 0, marginBottom: 14 }}>
        המשמרת נוצרת פתוחה (ללא עובד משובץ) - אחרי ההוספה אפשר ללחוץ עליה ולבחור עובד ישירות, או
        ללחוץ "מצא מחליף" כדי לחפש מי מתאים מתוך כל העובדים - כולל מי שלא היה בסידור המקורי של אותו
        יום.
      </p>
      <div className="field">
        <label>יום</label>
        <select value={day} onChange={(e) => setDay(+e.target.value)}>
          {DAY_NAMES.map((d, i) => (
            <option value={i} key={i}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>שם</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field-row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>שעת התחלה (HH:MM)</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="06:00"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>שעת סיום (HH:MM)</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="18:00"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          />
        </div>
        <button className="btn sm" style={{ marginBottom: 1 }} onClick={makeTwelveHours} type="button">
          ⏱ 12 שעות
        </button>
      </div>
      {!validTimes && (start || end) && (
        <div style={{ fontSize: 11, color: 'var(--red)', marginTop: -6, marginBottom: 10 }}>
          יש להזין שעה בפורמט 24 שעות, לדוגמה 06:00 או 18:00
        </div>
      )}
      <div className="field">
        <label>סוג</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          <option value="morning">בוקר</option>
          <option value="afternoon">צהריים</option>
          <option value="night">לילה</option>
          <option value="other">אחר</option>
        </select>
      </div>
    </Modal>
  );
}
