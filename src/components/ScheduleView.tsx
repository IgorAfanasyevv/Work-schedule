import React from 'react';
import { useScheduler } from '../SchedulerContext';
import { assigneeLabel, instanceStatus, toMinutes } from '../engine';
import { DAY_NAMES } from '../types';
import type { ShiftInstance } from '../types';
import AvailabilityGrid from './AvailabilityGrid';

export default function ScheduleView() {
  const { state, calendarView, setCalendarView, openModal, setWeekLabel } = useScheduler();

  return (
    <>
      <div className="topbar">
        <h2>סידור עבודה</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="week-pill">
            📅{' '}
            <input type="text" value={state.weekLabel} onChange={(e) => setWeekLabel(e.target.value)} />
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
      <AvailabilityGrid />
    </>
  );
}

function HeaderActions() {
  const { localRecalc, fullGenerate } = useScheduler();
  return (
    <>
      <button className="btn" onClick={localRecalc}>
        🔄 חשב מחדש
      </button>
      <button className="btn primary" onClick={fullGenerate}>
        ✨ צור סידור מלא
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

function ShiftCell({ inst }: { inst: ShiftInstance }) {
  const { state, openModal, setAssignMode } = useScheduler();
  const status = instanceStatus(inst);
  const label = assigneeLabel(inst, state.employees);

  return (
    <div
      className={`shift-cell ${statusClass(status)}`}
      onClick={() => {
        setAssignMode(inst.tempWorkerName ? 'temp' : 'regular');
        openModal({ type: 'shiftDetail', instanceId: inst.id });
      }}
    >
      <div className="time mono">
        {inst.start}–{inst.end}
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
    </div>
  );
}

function TableView() {
  const { state } = useScheduler();
  const { instances, shiftTypes } = state;

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
            {DAY_NAMES.map((d) => (
              <th key={d}>{d}</th>
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
                  <span className="sub">
                    {sample ? `${sample.start}–${sample.end}` : ''}
                  </span>
                </td>
                {DAY_NAMES.map((_, d) => {
                  const inst = instances.find((i) => i.day === d && i.shiftTypeId === stId);
                  return <td key={d}>{inst ? <ShiftCell inst={inst} /> : <div style={{ minHeight: 58 }} />}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CalendarView() {
  const { state, openModal, setAssignMode } = useScheduler();

  return (
    <>
      {DAY_NAMES.map((dayName, d) => {
        const dayInsts = state.instances.filter((i) => i.day === d).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
        const isWeekend = d === 5 || d === 6;
        return (
          <div className="timeline-day" key={d}>
            <div className="dname">
              {dayName}
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
