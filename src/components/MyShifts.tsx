import React, { useEffect } from 'react';
import { useScheduler } from '../SchedulerContext';
import { instanceStatus } from '../engine';
import { DAY_NAMES } from '../types';

export default function MyShifts() {
  const { state, instances, selectedEmployeeId, setSelectedEmployeeId } = useScheduler();
  const { employees } = state;

  useEffect(() => {
    if (!selectedEmployeeId && employees.length) setSelectedEmployeeId(employees[0].id);
  }, [selectedEmployeeId, employees, setSelectedEmployeeId]);

  const e = employees.find((x) => x.id === selectedEmployeeId);
  const mine = e ? instances.filter((i) => i.employeeId === e.id).sort((a, b) => a.day - b.day) : [];
  const nights = mine.filter((i) => i.category === 'night').length;
  const weekends = mine.filter((i) => i.day === 5 || i.day === 6).length;

  return (
    <>
      <div className="topbar">
        <h2>המשמרות שלי</h2>
        <select
          value={selectedEmployeeId ?? ''}
          onChange={(ev) => setSelectedEmployeeId(ev.target.value)}
          style={{
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '9px 12px',
            borderRadius: 8,
          }}
        >
          {employees.map((emp) => (
            <option value={emp.id} key={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </div>
      <div className="card">
        {!e ? (
          <div className="empty-state">בחר עובד לצפייה במשמרות שלו</div>
        ) : (
          <>
            <div className="ticker">
              <div className="pill-stat neu">
                <div className="n mono">
                  {mine.length}/{e.desiredShifts}
                </div>
                <div className="l">מספר משמרות</div>
              </div>
              <div className="pill-stat neu">
                <div className="n mono">{nights}/3</div>
                <div className="l">משמרות לילה</div>
              </div>
              <div className="pill-stat neu">
                <div className="n mono">{weekends}</div>
                <div className="l">משמרות סופ"ש</div>
              </div>
            </div>
            {mine.length === 0 ? (
              <div className="empty-state">אין משמרות משובצות השבוע</div>
            ) : (
              mine.map((i) => (
                <div className="employee-row" key={i.id}>
                  <div className="info">
                    <div className="name">
                      {DAY_NAMES[i.day]} · {i.name}
                    </div>
                    <div className="meta">
                      {i.start}–{i.end} {i.category === 'night' ? '· 🌙 לילה' : ''}
                    </div>
                  </div>
                  <span className={`badge b-${instanceStatus(i) === 'manual' ? 'blue' : 'green'}`}>
                    {instanceStatus(i) === 'manual' ? 'שונה ידנית' : 'מאושרת'}
                  </span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </>
  );
}
