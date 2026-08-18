import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';
import { ABSENCE_REASONS, DAY_NAMES } from '../../types';

export default function MarkUnavailableModal({ instanceId }: { instanceId: string }) {
  const { state, instances, markUnavailable, closeModal, openModal } = useScheduler();
  const inst = instances.find((i) => i.id === instanceId);
  const [reason, setReason] = useState<string>(ABSENCE_REASONS[0]);
  if (!inst) return null;

  const empName = state.employees.find((e) => e.id === inst.employeeId)?.name ?? '—';

  function confirmUnavailable() {
    markUnavailable(instanceId, reason);
    openModal({ type: 'replacements', instanceId });
  }

  return (
    <Modal
      title="העובד לא יכול להגיע"
      footer={
        <>
          <button className="btn ghost" onClick={closeModal}>
            ביטול
          </button>
          <button className="btn primary" onClick={confirmUnavailable}>
            אשר והצע מחליפים
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-dim)', fontSize: 13.5, marginTop: 0 }}>
        {empName} · {DAY_NAMES[inst.day]} {inst.start}–{inst.end}
      </p>
      <div className="field">
        <label>סיבה</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {ABSENCE_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
    </Modal>
  );
}
