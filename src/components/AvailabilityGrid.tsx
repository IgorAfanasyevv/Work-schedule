import React from 'react';
import { useScheduler } from '../SchedulerContext';
import { DAY_NAMES, CATEGORY_LABEL } from '../types';
import type { Employee } from '../types';

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

const LABEL: Record<DayState, string> = {
  available: 'פנוי',
  blocked: 'לא זמין',
  partial: 'חלקי',
};

export default function AvailabilityGrid() {
  const { state, toggleDayAvailability } = useScheduler();
  const { employees } = state;

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3>זמינות שבועית של העובדים</h3>
      <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: -6, marginBottom: 14 }}>
        כל עובד (או המנהל בשמו) יכול לסמן כאן ישירות באילו ימים הוא זמין לעבודה. לחיצה על תא עוברת בין
        "פנוי" ל"לא זמין ליום שלם". הסידור האוטומטי מתחשב בסימונים האלה בדיוק כמו בחסימות המפורטות
        בטאב "עובדים". לחסימה חלקית (רק בוקר/לילה וכו') עדיין נכנסים לטאב "עובדים".
      </p>

      <div className="legend">
        <span>
          <i style={{ background: 'var(--green)' }} />
          פנוי
        </span>
        <span>
          <i style={{ background: 'var(--red)' }} />
          לא זמין (יום שלם)
        </span>
        <span>
          <i style={{ background: 'var(--amber)' }} />
          חסימה חלקית (ראו טאב עובדים)
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
                  const clickable = st !== 'partial';
                  return (
                    <td key={day}>
                      <button
                        type="button"
                        disabled={!clickable}
                        onClick={() => clickable && toggleDayAvailability(e.id, day)}
                        title={
                          st === 'partial'
                            ? partialTitle(e, day)
                            : st === 'blocked'
                            ? 'לחצו כדי לסמן כזמין'
                            : 'לחצו כדי לסמן כלא זמין'
                        }
                        style={{
                          width: '100%',
                          minHeight: 46,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          cursor: clickable ? 'pointer' : 'default',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color:
                            st === 'blocked' ? 'var(--red)' : st === 'partial' ? 'var(--amber)' : 'var(--green)',
                          background:
                            st === 'blocked'
                              ? 'rgba(239,91,91,.08)'
                              : st === 'partial'
                              ? 'rgba(240,169,78,.08)'
                              : 'rgba(95,211,130,.06)',
                        }}
                      >
                        {LABEL[st]}
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

function partialTitle(e: Employee, day: number): string {
  const parts = e.blocks
    .filter(
      (b) =>
        (b.scope === 'category' && (b.day === day || b.day === 'all')) ||
        (b.scope === 'shift' && b.day === day)
    )
    .map((b) => (b.scope === 'category' ? CATEGORY_LABEL[b.category!] : 'משמרת ספציפית'));
  return `חסימות חלקיות ביום זה: ${parts.join(', ')} — לעריכה עברו לטאב "עובדים"`;
}
