import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';
import { DAY_NAMES } from '../../types';
import type { BlockScope, Category, EmployeeBlock } from '../../types';

export default function BlockModal({ employeeId }: { employeeId: string }) {
  const { state, addBlock, closeModal } = useScheduler();
  const [scope, setScope] = useState<BlockScope>('day');
  const [day, setDay] = useState<number | 'all'>('all');
  const [category, setCategory] = useState<Category>('morning');
  const [shiftTypeId, setShiftTypeId] = useState<string>(state.shiftTypes[0]?.id ?? '');

  function save() {
    const resolvedDay: number | 'all' = scope === 'day' ? (day === 'all' ? 0 : day) : day;
    const block: EmployeeBlock = { scope, day: resolvedDay };
    if (scope === 'category') block.category = category;
    if (scope === 'shift') block.shiftTypeId = shiftTypeId;
    addBlock(employeeId, block);
    closeModal();
  }

  return (
    <Modal
      title="הוספת חסימה"
      footer={
        <>
          <button className="btn ghost" onClick={closeModal}>
            ביטול
          </button>
          <button className="btn primary" onClick={save}>
            הוסף חסימה
          </button>
        </>
      }
    >
      <div className="field">
        <label>סוג חסימה</label>
        <select value={scope} onChange={(e) => setScope(e.target.value as BlockScope)}>
          <option value="day">יום שלם</option>
          <option value="category">סוג משמרת (בוקר/צהריים/לילה)</option>
          <option value="shift">משמרת ספציפית</option>
        </select>
      </div>
      <div className="field">
        <label>יום</label>
        <select value={String(day)} onChange={(e) => setDay(e.target.value === 'all' ? 'all' : +e.target.value)}>
          <option value="all">כל השבוע</option>
          {DAY_NAMES.map((d, i) => (
            <option value={i} key={i}>
              {d}
            </option>
          ))}
        </select>
      </div>
      {scope === 'category' && (
        <div className="field">
          <label>קטגוריה</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            <option value="morning">בוקר</option>
            <option value="afternoon">צהריים</option>
            <option value="night">לילה</option>
            <option value="other">אחר</option>
          </select>
        </div>
      )}
      {scope === 'shift' && (
        <div className="field">
          <label>משמרת</label>
          <select value={shiftTypeId} onChange={(e) => setShiftTypeId(e.target.value)}>
            {state.shiftTypes.map((st) => (
              <option value={st.id} key={st.id}>
                {st.name} ({st.start}-{st.end})
              </option>
            ))}
          </select>
        </div>
      )}
    </Modal>
  );
}
