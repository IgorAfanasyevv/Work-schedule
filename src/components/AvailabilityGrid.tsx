import React from 'react';
import { useScheduler } from '../SchedulerContext';
import { CATEGORY_LABEL, DAY_NAMES } from '../types';
import type { Category, Employee } from '../types';
import { dateForDayIndex, formatDDMM } from '../dateUtils';

type CellView = { kind: 'dayOff'; label: string } | { kind: 'available'; label: string };

function cellView(e: Employee, day: number, week: string, allCategories: Category[]): CellView {
  // only blocks tagged for THIS week (or untagged/standing ones from the "עובדים" tab) count here —
  // a block saved while looking at a different week stays inert and invisible on this one
  const thisWeekBlocks = e.blocks.filter((b) => !b.weekStartDate || b.weekStartDate === week);

  const dayOffBlock = thisWeekBlocks.find((b) => b.scope === 'day' && b.day === day);
  if (dayOffBlock) return { kind: 'dayOff', label: dayOffBlock.reason || 'חופש' };

  const blockedCategories = new Set(
    thisWeekBlocks
      .filter((b) => b.scope === 'category' && (b.day === day || b.day === 'all'))
      .map((b) => b.category as Category)
  );
  const available = allCategories.filter((c) => !blockedCategories.has(c));
  if (available.length === 0) return { kind: 'dayOff', label: 'לא זמין' };
  return { kind: 'available', label: available.map((c) => CATEGORY_LABEL[c]).join('/') };
}

export default function AvailabilityGrid() {
  const { state, instances, openModal, clearWeekPreferences } = useScheduler();
  const { employees, weekStartDate, shiftTypes } = state;
  const allCategories = Array.from(new Set(shiftTypes.map((st) => st.category)));

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ marginBottom: 0 }}>זמינות שבועית וסיכום</h3>
        <button
          className="btn danger sm"
          onClick={() => {
            if (confirm('לנקות את כל ההעדפות שסומנו לשבוע הנוכחי (לכל העובדים)? זה לא נוגע לשיבוצים בפועל ולא לשבועות אחרים.')) {
              clearWeekPreferences();
            }
          }}
        >
          🗑 נקה העדפות שבוע זה
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 10, marginBottom: 14 }}>
        לחצו על תא כדי לפתוח חלון ולסמן לאותו עובד ויום: יום חופש/רענון (לא במשמרת כלל), או סוגי
        משמרת ספציפיים שהוא לא יכול לעבוד באותו יום. התא הירוק מציג אילו סוגי משמרת העובד עדיין
        פתוח אליהם באותו יום. הטבלה מציגה תמיד את השבוע שנבחר למעלה — כל שבוע שומר את הסימונים שלו
        בנפרד, כך שהם לא נמחקים כשעוברים לשבוע הבא, אבל גם לא משפיעים עליו.
      </p>

      <div className="legend">
        <span>
          <i style={{ background: 'var(--green)' }} />
          פתוח (רואים לאילו משמרות)
        </span>
        <span>
          <i style={{ background: 'var(--red)' }} />
          חופש / רענון / לא זמין
        </span>
      </div>

      <div className="table-wrap">
        <table className="sched">
          <thead>
            <tr>
              <th style={{ textAlign: 'right' }}>עובד</th>
              <th>סה"כ משמרות</th>
              <th>משמרות לילה</th>
              {DAY_NAMES.map((d, i) => (
                <th key={d} className={i === 5 || i === 6 ? 'weekend-col' : ''}>
                  {d}
                  <span className="day-date">{formatDDMM(dateForDayIndex(weekStartDate, i))}</span>
                </th>
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
                    const view = cellView(e, day, weekStartDate, allCategories);
                    const isDayOff = view.kind === 'dayOff';
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
                            border: '1.5px solid ' + (isDayOff ? 'var(--cell-empty-border)' : 'var(--cell-filled-border)'),
                            cursor: 'pointer',
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: 'var(--text-strong)',
                            background: isDayOff ? 'var(--cell-empty-bg)' : 'var(--cell-filled-bg)',
                          }}
                        >
                          {view.label}
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
