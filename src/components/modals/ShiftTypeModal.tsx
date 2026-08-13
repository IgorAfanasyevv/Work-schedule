import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';
import type { Category } from '../../types';

export default function ShiftTypeModal({ shiftTypeId }: { shiftTypeId: string | null }) {
  const { state, addShiftType, updateShiftType, closeModal, toast } = useScheduler();
  const existing = shiftTypeId ? state.shiftTypes.find((s) => s.id === shiftTypeId) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [start, setStart] = useState(existing?.start ?? '06:00');
  const [end, setEnd] = useState(existing?.end ?? '18:00');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'other');

  function save() {
    if (!name.trim() || !start || !end) {
      toast('נא למלא את כל השדות');
      return;
    }
    if (shiftTypeId) updateShiftType(shiftTypeId, name.trim(), start, end, category);
    else addShiftType(name.trim(), start, end, category);
    closeModal();
  }

  return (
    <Modal
      title={shiftTypeId ? 'עריכת סוג משמרת' : 'סוג משמרת חדש'}
      footer={
        <>
          <button className="btn ghost" onClick={closeModal}>
            ביטול
          </button>
          <button className="btn primary" onClick={save}>
            שמור
          </button>
        </>
      }
    >
      <div className="field">
        <label>שם המשמרת</label>
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
        <label>סוג (לחישוב לילות/חסימות)</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          <option value="morning">בוקר</option>
          <option value="afternoon">צהריים</option>
          <option value="night">לילה</option>
          <option value="other">אחר</option>
        </select>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
        משך המשמרת יחושב אוטומטית לפי שעות ההתחלה והסיום.
      </div>
    </Modal>
  );
}
