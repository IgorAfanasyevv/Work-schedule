import React from 'react';
import { useScheduler } from '../SchedulerContext';
import { CATEGORY_LABEL, DAY_NAMES } from '../types';
import type { AppState, Employee } from '../types';

type CellView =
  | { kind: 'dayOff'; label: string }
  | { kind: 'partial'; count: number }
  | { kind: 'assigned'; label: string }
  | { kind: 'blank' };

function cellView(e: Employee, day: number, instances: AppState['instances']): CellView {
  const dayOffBlock = e.blocks.find((b) => b.scope === 'day' && b.day === day);
  if (dayOffBlock) return { kind: 'dayOff', label: dayOffBlock.reason || 'חופש' };

  const shiftBlockCount = e.blocks.filter((b) => b.scope === 'shift' && b.day === day).length;
  const hasCategoryBlock = e.blocks.some((b) => b.scope === 'category' && (b.day === day || b.day === 'all'));
  const totalPartial = shiftBlockCount + (hasCategoryBlock ? 1 : 0);
  if (totalPartial > 0) return { kind: 'partial', count: totalPartial };

  const assignedInstance = instances.find((i) => i.employeeId === e.id && i.day === day);
  if (assignedInstance) return { kind: 'assigned', label: CATEGORY_LABEL[assignedInstance.category] };

  return { kind: 'blank' };
}

export default function AvailabilityGrid() {
  const { state, openModal } = useScheduler();
  const { employees, instances } = state;

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3>זמינות שבועית וסיכום</h3>
      <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: -6, marginBottom: 14 }}>
        לחצו על תא כדי לפתוח חלון ולסמן לאותו עובד ויום: יום חופש (כולל סיבה כמו מילואים), או משמרות
        ספציפיות שהוא לא יכול לעבוד באותו יום. תא ריק אומר שאין שום אילוץ ידוע — הוא יתמלא לבד ברגע
        שתסמנו משהו, או יציג את המשמרת בפועל אם כבר שובץ בסידור.
      </p>

      <div className="legend">
        <span>
          <i style={{ background: 'var(--green)' }} />
          משובץ בפועל למשמרת
        </span>
        <span>
          <i style={{ background: 'var(--amber)' }} />
          חלק מהמשמרות חסומות
        </span>
        <span>
          <i style={{ background: 'var(--red)' }} />
          יום חופש / מילואים
        </span>
      </div>

      <div className="table-wrap">
        <table className="sched">
          <thead>
            <tr>
              <th style={{ textAlign: 'right' }}>עובד</th>
              <th>סה"כ משמרות</th>
              <th>משמרות לילה</th>
              {DAY_NAMES.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const mine = instances.filter((i) => i.employeeId === e.id);
              const nights = mine.filter((i) => i.category === 'night').length;
              return (
                <tr key={e.id}>
                  <td className="rowlabel">{e.name}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }} className="mono">
                    {mine.length}/{e.desiredShifts}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }} className="mono">
                    {nights}/3
                  </td>
                  {DAY_NAMES.map((_, day) => {
                    const view = cellView(e, day, instances);
                    return (
                      <td key={day}>
                        <button
                          type="button"
                          onClick={() => openModal({ type: 'dayConstraints', employeeId: e.id, day })}
                          title="לחצו לעריכת אילוצים ליום זה"
                          style={{
                            width: '100%',
                            minHeight: 44,
                            borderRadius: 8,
                            border: view.kind === 'blank' ? '1px dashed var(--border-soft)' : '1px solid var(--border)',
                            cursor: 'pointer',
                            fontSize: 12.5,
                            fontWeight: 600,
                            color:
                              view.kind === 'dayOff'
                                ? 'var(--red)'
                                : view.kind === 'partial'
                                ? 'var(--amber)'
                                : view.kind === 'assigned'
                                ? 'var(--green)'
                                : 'var(--text-faint)',
                            background:
                              view.kind === 'dayOff'
                                ? 'rgba(239,91,91,.08)'
                                : view.kind === 'partial'
                                ? 'rgba(240,169,78,.08)'
                                : view.kind === 'assigned'
                                ? 'rgba(95,211,130,.06)'
                                : 'transparent',
                          }}
                        >
                          {view.kind === 'dayOff' && view.label}
                          {view.kind === 'partial' && (
                            <span>
                              חלקי
                              <span style={{ display: 'block', fontSize: 10.5, fontWeight: 400, marginTop: 2 }}>
                                {view.count} משמרות חסומות
                              </span>
                            </span>
                          )}
                          {view.kind === 'assigned' && view.label}
                          {view.kind === 'blank' && ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {employees.length === 0 && <div className="empty-state">אין עדיין עובדים במערכת</div>}
    </div>
  );
}
