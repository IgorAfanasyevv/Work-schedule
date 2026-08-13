import React from 'react';
import { useScheduler } from '../SchedulerContext';
import { DAY_NAMES } from '../types';
import type { Employee, ShiftType } from '../types';

type DayState = 'available' | 'blocked' | 'partial';

function dayState(e: Employee, day: number): DayState {
  const fullDay = e.blocks.some((b) => b.scope === 'day' && b.day === day);
  if (fullDay) return 'blocked';
  const partial = e.blocks.some(
    (b) =>
      (b.scope === 'category' && (b.day === day || b.day === 'all')) ||
      (b.scope === 'shift' && b.day === day)
  );
  return partial ? 'partial' : 'available';
}

function partialCount(e: Employee, day: number, shiftTypes: ShiftType[]): number {
  return e.blocks.filter((b) => b.scope === 'shift' && b.day === day).length +
    (e.blocks.some((b) => b.scope === 'category' && (b.day === day || b.day === 'all')) ? shiftTypes.length : 0);
}

const LABEL: Record<DayState, string> = {
  available: 'פנוי',
  blocked: 'יום חופש',
  partial: 'חלקי',
};

export default function AvailabilityGrid() {
  const { state, openModal } = useScheduler();
  const { employees, shiftTypes } = state;

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3>זמינות שבועית של העובדים</h3>
      <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: -6, marginBottom: 14 }}>
        לחצו על תא כדי לפתוח חלון ולסמן לאותו עובד ויום: יום חופש מלא, או משמרות ספציפיות שהוא לא יכול
        לעבוד באותו יום (אפשר לבחור כמה שרוצים). כל סימון כאן משפיע ישירות על מנוע התכנון — הוא לוקח את
        זה בחשבון בדיוק כמו חסימה שהוגדרה בטאב "עובדים", ומחפש עבור כל עובד את השיבוץ הטוב ביותר שעדיין
        מכבד את מה שסימנתם.
      </p>

      <div className="legend">
        <span>
          <i style={{ background: 'var(--green)' }} />
          פנוי לכל המשמרות
        </span>
        <span>
          <i style={{ background: 'var(--amber)' }} />
          חלק מהמשמרות חסומות
        </span>
        <span>
          <i style={{ background: 'var(--red)' }} />
          יום חופש מלא
        </span>
      </div>

      <div className="table-wrap">
        <table className="sched">
          <thead>
            <tr>
              <th style={{ textAlign: 'right' }}>עובד</th>
              {DAY_NAMES.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="rowlabel">{e.name}</td>
                {DAY_NAMES.map((_, day) => {
                  const st = dayState(e, day);
                  const count = st === 'partial' ? partialCount(e, day, shiftTypes) : 0;
                  return (
                    <td key={day}>
                      <button
                        type="button"
                        onClick={() => openModal({ type: 'dayConstraints', employeeId: e.id, day })}
                        title="לחצו לעריכת אילוצים ליום זה"
                        style={{
                          width: '100%',
                          minHeight: 46,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: st === 'blocked' ? 'var(--red)' : st === 'partial' ? 'var(--amber)' : 'var(--green)',
                          background:
                            st === 'blocked'
                              ? 'rgba(239,91,91,.08)'
                              : st === 'partial'
                              ? 'rgba(240,169,78,.08)'
                              : 'rgba(95,211,130,.06)',
                        }}
                      >
                        {LABEL[st]}
                        {st === 'partial' && count > 0 && (
                          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 400, marginTop: 2 }}>
                            {count} משמרות חסומות
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {employees.length === 0 && <div className="empty-state">אין עדיין עובדים במערכת</div>}
    </div>
  );
}
