import React from 'react';
import { useScheduler } from '../SchedulerContext';
import { assigneeLabel, isAssigned, isSlotCovered, instanceStatus, toMinutes } from '../engine';
import { DAY_NAMES } from '../types';
import type { ShiftInstance } from '../types';
import AvailabilityGrid from './AvailabilityGrid';
import { dateForDayIndex, formatDDMM, yearOfWeek } from '../dateUtils';

export default function ScheduleView() {
  const {
    state,
    instances,
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
  const { state, openModal, setAssignMode, deleteInstance } = useScheduler();
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
      </div>
      <div className="cell-badges">
        {slotLabel && <span className="mini-badge b-violet-tint">{slotLabel}</span>}
        {inst.durationHours >= 11.5 && (
          <span className="mini-badge b-amber-tint" title="משמרת של 12 שעות">
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
  const allMatches = instances.filter((i) => i.day === day && i.shiftTypeId === stId);
  // hide any slot that's unassigned AND already redundant (fully covered - alone or jointly with
  // other assigned shifts that day) instead of showing it as an empty "not staffed" card
  const matches = allMatches.filter((i) => isAssigned(i) || !isSlotCovered(instances, i));

  if (allMatches.length > 0 && matches.length === 0) {
    // every slot in this row is covered - the whole row is redundant, collapse it away entirely
    return null;
  }

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
        onClick={() => duplicateInstance(matches[0]?.id ?? allMatches[allMatches.length - 1]?.id)}
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

  return (
    <div className="table-wrap">
      <div className="day-columns">
        {DAY_NAMES.map((dayName, d) => {
          // every distinct shift-type present this day, keeping only ones that still have at
          // least one visible (assigned or genuinely-needed) slot, sorted by start time so the
          // column reads top-to-bottom in chronological order with nothing wasted in between
          const stIdsToday = Array.from(new Set(instances.filter((i) => i.day === d).map((i) => i.shiftTypeId)));
          const rows = stIdsToday
            .map((stId) => {
              const matches = instances.filter((i) => i.day === d && i.shiftTypeId === stId);
              const visible = matches.filter((i) => isAssigned(i) || !isSlotCovered(instances, i));
              return { stId, visible, sortKey: matches.length ? toMinutes(matches[0].start) : 0 };
            })
            .filter((r) => r.visible.length > 0)
            .sort((a, b) => a.sortKey - b.sortKey);

          const isWeekend = d === 5 || d === 6;
          return (
            <div className={`day-column ${isWeekend ? 'weekend-col' : ''}`} key={d}>
              <div className="day-col-header">
                {dayName}
                <span className="day-date">{formatDDMM(dateForDayIndex(weekStartDate, d))}</span>
              </div>
              {rows.map(({ stId }) => {
                const st = shiftTypes.find((s) => s.id === stId);
                const sample = instances.find((i) => i.day === d && i.shiftTypeId === stId);
                const label = st ? st.name : sample?.name ?? '';
                return (
                  <div className="day-col-row" key={stId}>
                    <div className="day-col-row-label">{label}</div>
                    <DaySlotCell day={d} stId={stId} instances={instances} />
                  </div>
                );
              })}
              {rows.length === 0 && <div className="day-col-empty">אין משמרות</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarView() {
  const { state, instances, openModal, setAssignMode } = useScheduler();

  return (
    <>
      {DAY_NAMES.map((dayName, d) => {
        const dayInsts = instances
          .filter((i) => i.day === d && (isAssigned(i) || !isSlotCovered(instances, i)))
          .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
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
