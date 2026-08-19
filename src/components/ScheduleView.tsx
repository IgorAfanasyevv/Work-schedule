import React from 'react';
import { useScheduler } from '../SchedulerContext';
import { assigneeLabel, instanceStatus, toMinutes } from '../engine';
import { DAY_NAMES } from '../types';
import type { ShiftInstance } from '../types';
import AvailabilityGrid from './AvailabilityGrid';
import { dateForDayIndex, formatDDMM, yearOfWeek } from '../dateUtils';

export default function ScheduleView() {
  const {
    state,
    calendarView,
    setCalendarView,
    openModal,
    setWeekLabel,
    navigateWeek,
    goToCurrentWeek,
    goToDate,
    clearSchedule,
  } = useScheduler();

  return (
    <>
      <div className="topbar">
        <h2>סידור עבודה</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="week-pill">
            📅 <input type="text" value={state.weekLabel} onChange={(e) => setWeekLabel(e.target.value)} />
          </div>
          <button className={`btn ${!calendarView ? 'primary' : ''}`} onClick={() => setCalendarView(false)}>
            טבלה
          </button>
          <button className={`btn ${calendarView ? 'primary' : ''}`} onClick={() => setCalendarView(true)}>
            לוח שנה
          </button>
          <button className="btn" onClick={() => openModal({ type: 'adhocShift' })}>
            + הוסף משמרת
          </button>
          <HeaderActions />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          marginBottom: 16,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 16px',
          flexWrap: 'wrap',
        }}
      >
        <button className="btn sm" onClick={() => navigateWeek(-1)} title="שבוע קודם">
          ◀ שבוע קודם
        </button>
        <div style={{ textAlign: 'center', minWidth: 90 }}>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
            {yearOfWeek(state.weekStartDate)}
          </div>
          <button
            className="btn ghost sm"
            style={{ padding: '2px 8px', fontSize: 11, marginTop: 2 }}
            onClick={goToCurrentWeek}
            title="חזרה לשבוע הנוכחי"
          >
            השבוע הנוכחי
          </button>
        </div>
        <button className="btn sm" onClick={() => navigateWeek(1)} title="שבוע הבא">
          שבוע הבא ▶
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRight: '1px solid var(--border)', paddingRight: 14, marginRight: 4 }}>
          <label
            htmlFor="jump-to-date"
            style={{ fontSize: 12.5, color: 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            📅 קפוץ לתאריך:
          </label>
          <input
            id="jump-to-date"
            type="date"
            onChange={(e) => goToDate(e.target.value)}
            style={{
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 7,
              padding: '6px 9px',
              fontFamily: 'inherit',
              fontSize: 13,
              colorScheme: 'dark',
            }}
          />
        </div>
      </div>

      <div className="legend">
        <span>
          <i style={{ background: 'var(--green)' }} />
          מאוישת
        </span>
        <span>
          <i style={{ background: 'var(--red)' }} />
          לא מאוישת
        </span>
        <span>
          <i style={{ background: 'var(--blue)' }} />
          שונתה ידנית
        </span>
        <span>
          <i style={{ background: 'var(--violet)' }} />
          מתגבר
        </span>
        <span>
          <i style={{ background: 'var(--amber)' }} />
          דורשת תשומת לב / חריגה
        </span>
      </div>
      {calendarView ? <CalendarView /> : <TableView />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button
          className="btn danger sm"
          title="מנקה רק מי משובץ לאיזו משמרת. לא נוגע להעדפות/חסימות של העובדים."
          onClick={() => {
            if (confirm('לנקות את כל השיבוצים בסידור הנוכחי? הפעולה הזו לא הפיכה (העדפות העובדים לא יימחקו).'))
              clearSchedule();
          }}
        >
          🗑 נקה סידור לגמרי
        </button>
      </div>

      <AvailabilityGrid />
    </>
  );
}

function HeaderActions() {
  const { localRecalc, fullGenerate, isGenerating } = useScheduler();
  return (
    <>
      <button className="btn" onClick={localRecalc} disabled={isGenerating} title="בודק את השיבוצים הקיימים בלבד ומסיר הפרות חוקים - לא ממלא תאים ריקים">
        {isGenerating ? '⏳ מחשב...' : '🔍 בדוק תקינות'}
      </button>
      <button className="btn primary" onClick={fullGenerate} disabled={isGenerating}>
        {isGenerating ? '⏳ יוצר סידור...' : '✨ צור סידור מלא'}
      </button>
    </>
  );
}

function statusClass(status: ReturnType<typeof instanceStatus>): string {
  if (status === 'empty') return 'st-empty';
  if (status === 'manual') return 'st-manual';
  if (status === 'warn') return 'st-warn';
  if (status === 'temp') return 'st-temp';
  return 'st-filled';
}

function ShiftCell({ inst, showDelete, slotLabel }: { inst: ShiftInstance; showDelete?: boolean; slotLabel?: string }) {
  const { state, instances, openModal, setAssignMode, deleteInstance } = useScheduler();
  const status = instanceStatus(inst);
  const label = assigneeLabel(inst, state.employees);

  return (
    <div
      className={`shift-cell ${statusClass(status)}`}
      style={{ marginBottom: 3 }}
      onClick={() => {
        setAssignMode(inst.tempWorkerName ? 'temp' : 'regular');
        openModal({ type: 'shiftDetail', instanceId: inst.id });
      }}
    >
      <div className="time mono">
        {inst.start}–{inst.end}
        {slotLabel && (
          <span
            style={{
              marginRight: 6,
              color: 'var(--violet)',
              background: 'rgba(199,146,234,.14)',
              borderRadius: 4,
              padding: '0 5px',
              fontWeight: 700,
            }}
          >
            {slotLabel}
          </span>
        )}
        {inst.durationHours >= 11.5 && (
          <span
            title="משמרת של 12 שעות"
            style={{
              marginRight: 6,
              color: 'var(--amber)',
              background: 'rgba(240,169,78,.14)',
              borderRadius: 4,
              padding: '0 5px',
              fontWeight: 700,
            }}
          >
            12 שעות
          </span>
        )}
      </div>
      {label ? (
        <div className="who">
          {label}
          {inst.tempWorkerName && (
            <span className="badge b-violet" style={{ padding: '1px 6px', marginRight: 6 }}>
              מתגבר
            </span>
          )}
        </div>
      ) : (
        <div className="empty-msg">⛔ לא מאוישת</div>
      )}
      {inst.exception && (
        <div className="cell-icons">
          <span className="mini-dot" style={{ background: 'var(--amber)' }} title="חריגה" />
        </div>
      )}
      {showDelete && (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            if (confirm('להסיר את התא הנוסף הזה?')) deleteInstance(inst.id);
          }}
          title="הסר תא זה"
          style={{
            position: 'absolute',
            bottom: 3,
            left: 3,
            background: 'none',
            border: 'none',
            color: 'var(--text-faint)',
            fontSize: 10,
            padding: 1,
            cursor: 'pointer',
          }}
        >
          🗑
        </button>
      )}
    </div>
  );
}

function DaySlotCell({ day, stId, instances }: { day: number; stId: string; instances: ShiftInstance[] }) {
  const { duplicateInstance } = useScheduler();
  const matches = instances.filter((i) => i.day === day && i.shiftTypeId === stId);

  return (
    <div style={{ position: 'relative' }}>
      {matches.map((inst, idx) => (
        <ShiftCell
          inst={inst}
          key={inst.id}
          showDelete={matches.length > 1}
          slotLabel={idx > 0 ? `קנה ${idx + 1}` : undefined}
        />
      ))}
      <button
        type="button"
        onClick={() => duplicateInstance(matches[0]?.id ?? matches[matches.length - 1]?.id)}
        title="הוסף תא נוסף לאותה משמרת (לחגים/סופ״ש עם שני עובדים)"
        disabled={matches.length === 0}
        style={{
          width: '100%',
          background: 'none',
          border: '1px dashed var(--border-soft)',
          borderRadius: 6,
          color: 'var(--text-faint)',
          fontSize: 9.5,
          padding: '2px 0',
          cursor: matches.length === 0 ? 'default' : 'pointer',
          opacity: matches.length === 0 ? 0.4 : 1,
        }}
      >
        + הוסף עובד שני
      </button>
    </div>
  );
}

function TableView() {
  const { state, instances } = useScheduler();
  const { shiftTypes, weekStartDate } = state;

  const rowKeys: string[] = [];
  const seen = new Set<string>();
  instances.forEach((i) => {
    if (!seen.has(i.shiftTypeId)) {
      seen.add(i.shiftTypeId);
      rowKeys.push(i.shiftTypeId);
    }
  });
  rowKeys.sort((a, b) => {
    const ia = shiftTypes.findIndex((s) => s.id === a);
    const ib = shiftTypes.findIndex((s) => s.id === b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  return (
    <div className="table-wrap">
      <table className="sched">
        <thead>
          <tr>
            <th style={{ textAlign: 'right' }}>משמרת</th>
            {DAY_NAMES.map((d, i) => (
              <th key={d} className={i === 5 || i === 6 ? 'weekend-col' : ''}>
                {d}
                <span className="day-date">{formatDDMM(dateForDayIndex(weekStartDate, i))}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((stId) => {
            const st = shiftTypes.find((s) => s.id === stId);
            const sample = instances.find((i) => i.shiftTypeId === stId);
            const label = st ? st.name : sample?.name ?? '';
            return (
              <tr key={stId}>
                <td className="rowlabel">
                  {label}
                  <span className="sub">{sample ? `${sample.start}–${sample.end}` : ''}</span>
                </td>
                {DAY_NAMES.map((_, d) => (
                  <td key={d}>
                    <DaySlotCell day={d} stId={stId} instances={instances} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CalendarView() {
  const { state, instances, openModal, setAssignMode } = useScheduler();

  return (
    <>
      {DAY_NAMES.map((dayName, d) => {
        const dayInsts = instances.filter((i) => i.day === d).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
        const isWeekend = d === 5 || d === 6;
        return (
          <div className="timeline-day" key={d}>
            <div className="dname">
              {dayName}
              <span className="day-date">{formatDDMM(dateForDayIndex(state.weekStartDate, d))}</span>
              {isWeekend && <span className="badge b-blue">סופ"ש</span>}
            </div>
            <div className="timeline-axis">
              {dayInsts.map((inst) => {
                const sMin = toMinutes(inst.start);
                let eMin = toMinutes(inst.end);
                if (eMin <= sMin) eMin = 24 * 60;
                const left = ((sMin / 1440) * 100).toFixed(2);
                const width = Math.max(3, ((eMin - sMin) / 1440) * 100).toFixed(2);
                const status = instanceStatus(inst);
                const color =
                  status === 'empty'
                    ? 'var(--red-dim)'
                    : status === 'manual'
                    ? 'var(--blue-dim)'
                    : status === 'warn'
                    ? 'var(--amber-dim)'
                    : status === 'temp'
                    ? 'var(--violet-dim)'
                    : 'var(--green-dim)';
                const fg =
                  status === 'empty'
                    ? 'var(--red)'
                    : status === 'manual'
                    ? 'var(--blue)'
                    : status === 'warn'
                    ? 'var(--amber)'
                    : status === 'temp'
                    ? 'var(--violet)'
                    : 'var(--green)';
                const label = assigneeLabel(inst, state.employees);
                return (
                  <div
                    className="tbar"
                    key={inst.id}
                    onClick={() => {
                      setAssignMode(inst.tempWorkerName ? 'temp' : 'regular');
                      openModal({ type: 'shiftDetail', instanceId: inst.id });
                    }}
                    style={{ right: `${left}%`, width: `${width}%`, background: color, color: fg }}
                  >
                    <span className="who">
                      {label ? label : 'לא מאוישת'}
                      {inst.tempWorkerName ? ' 🔶' : ''}
                    </span>
                    <span className="tm">
                      {inst.start}–{inst.end}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
