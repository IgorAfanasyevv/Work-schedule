import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';

export default function EmployeeModal({ employeeId }: { employeeId: string | null }) {
  const { state, addEmployee, updateEmployee, closeModal, toast } = useScheduler();
  const existing = employeeId ? state.employees.find((e) => e.id === employeeId) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [desired, setDesired] = useState(existing?.desiredShifts ?? 5);
  const [max, setMax] = useState(existing?.maxShifts ?? 6);

  function save() {
    if (!name.trim()) {
      toast('יש להזין שם');
      return;
    }
    if (employeeId) updateEmployee(employeeId, name.trim(), desired, max);
    else addEmployee(name.trim(), desired, max);
    closeModal();
  }

  return (
    <Modal
      title={employeeId ? 'עריכת עובד' : 'עובד חדש'}
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
    </Modal>
  );
}
