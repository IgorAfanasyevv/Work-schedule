import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';
import { findReplacements, getEligibility } from '../../engine';
import { DAY_NAMES, REASON_LABELS } from '../../types';

export default function ReplacementsModal({ instanceId }: { instanceId: string }) {
  const { state, applyReplacementOption, assignTemp, closeModal } = useScheduler();
  const inst = state.instances.find((i) => i.id === instanceId);
  const [tempName, setTempName] = useState('');

  const options = useMemo(
    () => (inst ? findReplacements(instanceId, state.instances, state.employees, state.weekStartDate, 3) : []),
    [inst, instanceId, state.instances, state.employees]
  );

  const ineligible = useMemo(() => {
    if (!inst) return [];
    return state.employees
      .map((e) => ({ e, elig: getEligibility(e, inst, state.instances, state.weekStartDate, instanceId) }))
      .filter((x) => !x.elig.eligible);
  }, [inst, instanceId, state.employees, state.instances]);

  if (!inst) return null;

  function nameOf(id: string) {
    return state.employees.find((e) => e.id === id)?.name ?? '—';
  }

  return (
    <Modal title="אפשרויות מחליף">
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0 }}>
        {DAY_NAMES[inst.day]} · {inst.name} · {inst.start}–{inst.end}
      </p>

      {options.length === 0 ? (
        <div className="empty-state">🔴 לא נמצאו מחליפים זמינים, גם לא בשרשרת החלפות.</div>
      ) : (
        options.map((o, idx) => {
          const primary = nameOf(o.changes[0].toEmployeeId);
          return (
            <div className="opt-card" key={idx}>
              <div className="opt-head">
                <span className="opt-title">🟢 אפשרות {idx + 1}: {primary}</span>
                <span className="badge b-blue">
                  {o.changeCount} שינוי{o.changeCount > 1 ? 'ים' : ''}
                </span>
              </div>
              <ul>
                {o.changes.map((c, ci) => {
                  const ciInst = state.instances.find((x) => x.id === c.instanceId)!;
                  return (
                    <li key={ci}>
                      {DAY_NAMES[ciInst.day]} {ciInst.name} ({ciInst.start}–{ciInst.end}): ← {nameOf(c.toEmployeeId)}
                    </li>
                  );
                })}
              </ul>
              <button
                className="btn primary sm"
                onClick={() => {
                  applyReplacementOption(instanceId, idx);
                  closeModal();
                }}
              >
                בחר אפשרות זו
              </button>
            </div>
          );
        })
      )}

      {ineligible.length > 0 && (
        <>
          <h3 style={{ marginTop: 18, fontSize: 14 }}>לא מתאימים</h3>
          {ineligible.map((x, i) => (
            <div className="reason-item" key={i}>
              🔴 <b style={{ color: 'var(--text)' }}>{x.e.name}</b> — {x.elig.reasons.map((r) => REASON_LABELS[r.type]).join('; ')}
            </div>
          ))}
        </>
      )}

      <h3 style={{ marginTop: 20, fontSize: 14 }}>או שבצו מתגבר חד־פעמי</h3>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 10px' }}>
        מתגבר אינו נכנס לרשימת העובדים הקבועים ואינו נבדק מול חסימות/מכסות — מתאים לתגבור מיידי דרך חברת כוח אדם או
        עובד חיצוני.
      </p>
      <div className="field-row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>שם המתגבר</label>
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            placeholder="לדוגמה: דוד כהן (חברת כוח אדם)"
          />
        </div>
        <button
          className="btn primary sm"
          style={{ marginBottom: 1 }}
          onClick={() => {
            const name = tempName.trim();
            if (!name) return;
            assignTemp(instanceId, name);
            closeModal();
          }}
        >
          שבץ מתגבר
        </button>
      </div>
    </Modal>
  );
}
