import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';
import { ABSENCE_REASONS, DAY_NAMES } from '../../types';

const PLAIN_DAY_OFF = 'חופש';

export default function DayConstraintsModal({ employeeId, day }: { employeeId: string; day: number }) {
  const { state, setDayConstraints, closeModal } = useScheduler();
  const e = state.employees.find((x) => x.id === employeeId);

  const existingDayOffBlock = e?.blocks.find((b) => b.scope === 'day' && b.day === day);
  const existingShiftIds = new Set(
    (e?.blocks || []).filter((b) => b.scope === 'shift' && b.day === day).map((b) => b.shiftTypeId as string)
  );
  const existingCategoryBlocks = (e?.blocks || []).filter(
    (b) => b.scope === 'category' && (b.day === day || b.day === 'all')
  );

  const [dayOff, setDayOff] = useState(!!existingDayOffBlock);
  const [reason, setReason] = useState<string>(existingDayOffBlock?.reason || PLAIN_DAY_OFF);
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set(existingShiftIds));

  if (!e) return null;

  function toggleShift(id: string) {
    setSelectedShifts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setDayConstraints(
      employeeId,
      day,
      dayOff,
      dayOff ? [] : Array.from(selectedShifts),
      dayOff ? (reason === PLAIN_DAY_OFF ? undefined : reason) : undefined
    );
    closeModal();
  }

  return (
    <Modal
      title={
        <>
          אילוצים ל{e.name} — יום {DAY_NAMES[day]}
        </>
      }
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
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          marginBottom: dayOff ? 10 : 16,
          background: 'var(--panel-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 12px',
        }}
      >
        <input type="checkbox" checked={dayOff} onChange={(ev) => setDayOff(ev.target.checked)} />
        <span style={{ fontWeight: 600 }}>יום חופש — לא עובד כלל ביום זה</span>
      </label>

      {dayOff && (
        <div className="field">
          <label>סיבה (מוצגת בטבלת הסיכום)</label>
          <select value={reason} onChange={(ev) => setReason(ev.target.value)}>
            <option value={PLAIN_DAY_OFF}>חופש רגיל</option>
            {ABSENCE_REASONS.map((r) => (
              <option value={r} key={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      )}

      {!dayOff && (
        <div className="field">
          <label>אילו משמרות לא ניתן לעבוד ביום זה? (ניתן לבחור כמה שרוצים)</label>
          {state.shiftTypes.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>אין עדיין סוגי משמרות מוגדרים.</div>
          ) : (
            state.shiftTypes.map((st) => (
              <label
                key={st.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px', cursor: 'pointer' }}
              >
                <input type="checkbox" checked={selectedShifts.has(st.id)} onChange={() => toggleShift(st.id)} />
                <span>
                  {st.name}{' '}
                  <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>
                    ({st.start}–{st.end})
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      )}

      {existingCategoryBlocks.length > 0 && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-faint)',
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px dashed var(--border-soft)',
          }}
        >
          לעובד יש גם חסימת קטגוריה כללית שחלה על היום הזה (מוגדרת בטאב "עובדים") — היא לא נערכת מכאן, רק
          החסימות הספציפיות ליום הזה.
        </div>
      )}
    </Modal>
  );
}
