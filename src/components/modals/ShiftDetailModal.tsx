import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';
import { explain, instanceStatus, isAssigned } from '../../engine';
import { DAY_NAMES } from '../../types';

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  empty: { cls: 'b-red', label: 'לא מאוישת' },
  manual: { cls: 'b-blue', label: 'שונתה ידנית' },
  warn: { cls: 'b-amber', label: 'חריגה מאושרת' },
  temp: { cls: 'b-violet', label: 'מאוישת ע"י מתגבר' },
  filled: { cls: 'b-green', label: 'מאוישת' },
};

/** accepts 24-hour "HH:MM", with or without a leading zero on the hour (e.g. both "5:45" and "05:45") */
function isValidTime(value: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function normalizeTime(value: string): string {
  const [h, m] = value.trim().split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

export default function ShiftDetailModal({ instanceId }: { instanceId: string }) {
  const {
    state,
    instances,
    carryOverFromPreviousWeek,
    assignMode,
    setAssignMode,
    assignEmployee,
    assignTemp,
    removeTemp,
    setInstanceTime,
    closeModal,
    openModal,
  } = useScheduler();
  const inst = instances.find((i) => i.id === instanceId);
  const [selectedEmp, setSelectedEmp] = useState<string>(inst?.employeeId ?? '');
  const [tempName, setTempName] = useState<string>(inst?.tempWorkerName ?? '');
  const [feedback, setFeedback] = useState<{ reasons: string[] } | null>(null);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState(false);
  const [customStart, setCustomStart] = useState<string>(inst?.start ?? '');
  const [customEnd, setCustomEnd] = useState<string>(inst?.end ?? '');

  if (!inst) return null;
  const status = instanceStatus(inst);
  const badge = STATUS_BADGE[status];

  function save(force = false) {
    if (assignMode === 'temp') {
      const name = tempName.trim();
      if (!name) return;
      assignTemp(instanceId, name);
      closeModal();
      return;
    }
    const empId = selectedEmp || null;
    const res = assignEmployee(instanceId, empId, { force });
    if (!res.ok && res.reasons) {
      setFeedback({ reasons: res.reasons });
      return;
    }
    closeModal();
  }

  function handleExplain() {
    if (inst!.tempWorkerName) {
      setExplainText(
        `המשמרת מאוישת ע"י מתגבר חד-פעמי (${inst!.tempWorkerName}), שאינו חלק ממאגר העובדים הקבועים ואינו נבדק מול האילוצים שלהם.`
      );
      return;
    }
    if (!inst!.employeeId) {
      setExplainText('משמרת זו ריקה — לחץ "מצא מחליף" לרשימת מועמדים.');
      return;
    }
    const e = state.employees.find((x) => x.id === inst!.employeeId)!;
    setExplainText(explain(e, inst!, instances, state.weekStartDate, carryOverFromPreviousWeek));
  }

  return (
    <Modal
      title={
        <>
          {DAY_NAMES[inst.day]} · {inst.name}{' '}
          <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
            {inst.start}–{inst.end}
          </span>
        </>
      }
    >
      <div style={{ marginBottom: 14 }}>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
      </div>

      <div className="mode-toggle">
        <button type="button" className={assignMode === 'regular' ? 'active' : ''} onClick={() => setAssignMode('regular')}>
          עובד קבוע
        </button>
        <button type="button" className={assignMode === 'temp' ? 'active' : ''} onClick={() => setAssignMode('temp')}>
          מתגבר (חד־פעמי)
        </button>
      </div>

      {assignMode === 'temp' ? (
        <>
          <div className="field">
            <label>שם המתגבר</label>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="לדוגמה: דוד כהן (חברת כוח אדם)"
            />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: -6, marginBottom: 6 }}>
            מתגבר לא נכנס לרשימת העובדים הקבועים ולא נספר במגבלות/הוגנות שלהם — הוא משויך רק למשמרת הזו.
          </div>
        </>
      ) : (
        <div className="field">
          <label>עובד משובץ</label>
          <select value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
            <option value="">— ריק —</option>
            {state.employees.map((e) => (
              <option value={e.id} key={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginTop: 6, marginBottom: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
          <input type="checkbox" checked={customTime} onChange={(ev) => setCustomTime(ev.target.checked)} />
          שעות מותאמות אישית לתא הזה בלבד (לדוגמה: העובד הזה מגיע 7:00–15:00 במקום השעות הרגילות)
        </label>
        {customTime && (
          <>
            <div className="field-row" style={{ marginTop: 8 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>שעת התחלה (HH:MM)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="05:45"
                  value={customStart}
                  onChange={(ev) => setCustomStart(ev.target.value)}
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>שעת סיום (HH:MM)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="14:00"
                  value={customEnd}
                  onChange={(ev) => setCustomEnd(ev.target.value)}
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </div>
              <button
                className="btn sm"
                style={{ marginBottom: 1 }}
                disabled={!isValidTime(customStart) || !isValidTime(customEnd)}
                onClick={() => setInstanceTime(instanceId, normalizeTime(customStart), normalizeTime(customEnd))}
              >
                עדכן שעות
              </button>
            </div>
            {(customStart && !isValidTime(customStart)) || (customEnd && !isValidTime(customEnd)) ? (
              <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
                יש להזין שעה בפורמט 24 שעות, לדוגמה 05:45 או 22:00
              </div>
            ) : null}
          </>
        )}
      </div>

      {feedback && (
        <div className="card" style={{ background: 'var(--amber-dim)', borderColor: 'var(--amber)', padding: '12px 14px', margin: '10px 0' }}>
          <b>⚠️ שים לב!</b>
          <div style={{ fontSize: 12.5, marginTop: 6 }}>{feedback.reasons.join('; ')}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn sm" onClick={() => setFeedback(null)}>
              ביטול
            </button>
            <button className="btn sm primary" onClick={() => save(true)}>
              שבץ בכל זאת
            </button>
          </div>
        </div>
      )}

      <div className="modal-foot" style={{ padding: 0, marginTop: 16, border: 'none', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button className="btn primary sm" onClick={() => save(false)}>
          שמור שיבוץ
        </button>
        {inst.employeeId && (
          <button className="btn danger sm" onClick={() => openModal({ type: 'markUnavailable', instanceId })}>
            העובד לא יכול להגיע
          </button>
        )}
        {inst.tempWorkerName && (
          <button className="btn danger sm" onClick={() => removeTemp(instanceId)}>
            הסר מתגבר
          </button>
        )}
        {!isAssigned(inst) && (
          <button className="btn sm" onClick={() => openModal({ type: 'replacements', instanceId })}>
            מצא מחליף
          </button>
        )}
        <button className="btn sm ghost" onClick={handleExplain}>
          למה?
        </button>
      </div>
      {explainText && <div className="reason-item">💬 {explainText}</div>}
    </Modal>
  );
}
