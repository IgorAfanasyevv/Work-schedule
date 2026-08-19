import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useScheduler } from '../../SchedulerContext';
import { ABSENCE_REASONS, CATEGORY_LABEL, DAY_NAMES } from '../../types';
import type { Category } from '../../types';
import { dateForDayIndex, formatDDMM } from '../../dateUtils';

const PLAIN_DAY_OFF = 'חופש';

export default function DayConstraintsModal({ employeeId, day }: { employeeId: string; day: number }) {
  const { state, setDayConstraints, closeModal } = useScheduler();
  const e = state.employees.find((x) => x.id === employeeId);
  const week = state.weekStartDate;
  // only blocks tagged for THIS week (or untagged/standing ones) are relevant here — a block saved
  // for a different week is intentionally invisible/inert while looking at this one
  const thisWeekBlocks = (e?.blocks || []).filter((b) => !b.weekStartDate || b.weekStartDate === week);

  const existingDayOffBlock = thisWeekBlocks.find((b) => b.scope === 'day' && b.day === day);
  const existingCategories = new Set(
    thisWeekBlocks.filter((b) => b.scope === 'category' && b.day === day).map((b) => b.category as Category)
  );
  // a standing "all week" category block from the "עובדים" tab is shown as a note, not editable here
  const standingCategoryBlocks = (e?.blocks || []).filter((b) => b.scope === 'category' && b.day === 'all');

  const [dayOff, setDayOff] = useState(!!existingDayOffBlock);
  const [reason, setReason] = useState<string>(existingDayOffBlock?.reason || PLAIN_DAY_OFF);
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(new Set(existingCategories));

  if (!e) return null;

  // one checkbox per CATEGORY (not per shift type) — so "night" covers every night-category shift
  // definition together (e.g. 21:45–06:00 and 23:00–07:00 both), instead of asking the employee to
  // separately opt in/out of what is really the same "can I work nights" preference
  const categories = Array.from(new Set(state.shiftTypes.map((st) => st.category)));

  function toggleCategory(cat: Category) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function save() {
    setDayConstraints(
      employeeId,
      day,
      dayOff,
      dayOff ? [] : Array.from(selectedCategories),
      dayOff ? (reason === PLAIN_DAY_OFF ? undefined : reason) : undefined
    );
    closeModal();
  }

  return (
    <Modal
      title={
        <>
          אילוצים ל{e.name} — יום {DAY_NAMES[day]}{' '}
          <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
            ({formatDDMM(dateForDayIndex(week, day))})
          </span>
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
      <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 0, marginBottom: 14 }}>
        הסימון הזה חל רק על השבוע הנוכחי שאתם צופים בו. שבועות אחרים לא נמחקים ולא מושפעים — כל שבוע
        שומר את הסימונים שלו בנפרד.
      </p>
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
        <span style={{ fontWeight: 600 }}>יום חופש / לא במשמרת — לא עובד משמרת ביום זה</span>
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
          {reason === 'רענון' && (
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>
              יום רענון נחשב יום עבודה לצורך נוכחות, אך העובד לא זמין למשמרת ביום זה. את תאריך
              הריענון האחרון מנהלים בטאב "מעקב ריענונים".
            </div>
          )}
        </div>
      )}

      {!dayOff && (
        <div className="field">
          <label>אילו סוגי משמרת לא ניתן לעבוד ביום זה? (ניתן לבחור כמה שרוצים)</label>
          {categories.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>אין עדיין סוגי משמרות מוגדרים.</div>
          ) : (
            categories.map((cat) => (
              <label
                key={cat}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.has(cat)}
                  onChange={() => toggleCategory(cat)}
                />
                <span>{CATEGORY_LABEL[cat]}</span>
              </label>
            ))
          )}
        </div>
      )}

      {standingCategoryBlocks.length > 0 && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-faint)',
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px dashed var(--border-soft)',
          }}
        >
          לעובד יש גם חסימה קבועה (לכל השבועות) שחלה על היום הזה, שהוגדרה בטאב "עובדים" — היא לא
          נערכת מכאן.
        </div>
      )}
    </Modal>
  );
}
