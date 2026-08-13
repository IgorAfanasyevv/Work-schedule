import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';
import { DAY_NAMES } from '../../types';
import type { Category } from '../../types';

export default function AdhocShiftModal() {
  const { addAdhocShift, closeModal } = useScheduler();
  const [day, setDay] = useState(0);
  const [name, setName] = useState('משמרת מיוחדת');
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('18:00');
  const [category, setCategory] = useState<Category>('other');

  function save() {
    addAdhocShift(day, name.trim() || 'משמרת מיוחדת', start, end, category);
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
          <button className="btn primary" onClick={save}>
            הוסף משמרת
          </button>
        </>
      }
    >
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
      <div className="field-row">
        <div className="field">
          <label>שעת התחלה</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>שעת סיום</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
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
