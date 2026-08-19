import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';

export default function EmployeeModal({ employeeId }: { employeeId: string | null }) {
  const { state, sites, currentSiteId, addEmployee, updateEmployee, moveEmployeeToSite, closeModal, toast } =
    useScheduler();
  const existing = employeeId ? state.employees.find((e) => e.id === employeeId) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [desired, setDesired] = useState(existing?.desiredShifts ?? 5);
  const [max, setMax] = useState(existing?.maxShifts ?? 6);
  const [targetSiteId, setTargetSiteId] = useState(currentSiteId);
  const [moving, setMoving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast('יש להזין שם');
      return;
    }
    if (employeeId) {
      updateEmployee(employeeId, name.trim(), desired, max);
      if (targetSiteId !== currentSiteId) {
        setMoving(true);
        await moveEmployeeToSite(employeeId, targetSiteId);
      }
    } else {
      addEmployee(name.trim(), desired, max);
    }
    closeModal();
  }

  return (
    <Modal
      title={employeeId ? 'עריכת עובד' : 'עובד חדש'}
      footer={
        <>
          <button className="btn ghost" onClick={closeModal} disabled={moving}>
            ביטול
          </button>
          <button className="btn primary" onClick={save} disabled={moving}>
            {moving ? '⏳ מעביר...' : 'שמור'}
          </button>
        </>
      }
    >
      <div className="field">
        <label>שם</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label>מספר משמרות רצוי</label>
          <input type="number" min={0} max={14} value={desired} onChange={(e) => setDesired(+e.target.value)} />
        </div>
        <div className="field">
          <label>מספר משמרות מקסימלי</label>
          <input type="number" min={0} max={14} value={max} onChange={(e) => setMax(+e.target.value)} />
        </div>
      </div>

      {employeeId && sites.length > 1 && (
        <div className="field">
          <label>אתר עבודה</label>
          <select value={targetSiteId} onChange={(e) => setTargetSiteId(e.target.value)}>
            {sites.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {targetSiteId !== currentSiteId && (
            <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 6 }}>
              ⚠️ העובד יועבר לאתר אחר בלחיצה על "שמור": הוא יוסר מכל השבועות באתר הנוכחי, ויתווסף
              לאתר החדש כעובד חדש (ללא ההעדפות הקודמות שלו, שהיו שייכות לשבועות של האתר הזה).
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
