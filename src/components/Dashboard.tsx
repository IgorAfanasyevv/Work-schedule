import React from 'react';
import { useScheduler } from '../SchedulerContext';
import { isAssigned } from '../engine';
import { DAY_NAMES } from '../types';
import { addMonthsISO, todayISO } from '../dateUtils';

export default function Dashboard() {
  const { state, instances, fullGenerate, localRecalc, openModal, setTab, isGenerating } = useScheduler();
  const { employees } = state;

  const total = instances.length;
  const filled = instances.filter((i) => isAssigned(i)).length;
  const empty = total - filled;
  const belowTarget = employees.filter(
    (e) => instances.filter((i) => i.employeeId === e.id).length < e.desiredShifts
  ).length;
  const exceptions = instances.filter((i) => i.exception).length;
  const problems = empty + exceptions;

  const today = todayISO();
  const refresherDue = employees.filter((e) => {
    if (!e.lastRefresherDate) return false;
    return today >= addMonthsISO(e.lastRefresherDate, 2);
  });

  return (
    <>
      <div className="topbar">
        <h2>לוח בקרה</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={localRecalc} disabled={isGenerating}>
            {isGenerating ? '⏳ מחשב...' : '🔄 חשב מחדש'}
          </button>
          <button className="btn primary" onClick={fullGenerate} disabled={isGenerating}>
            {isGenerating ? '⏳ יוצר סידור...' : '✨ צור סידור מלא'}
          </button>
        </div>
      </div>

      <div className="ticker">
        <div className="pill-stat neu">
          <div className="n mono">{total}</div>
          <div className="l">סה"כ משמרות השבוע</div>
        </div>
        <div className="pill-stat ok">
          <div className="n mono">{filled}</div>
          <div className="l">משמרות מאוישות</div>
        </div>
        <div className={`pill-stat ${empty > 0 ? 'bad' : 'ok'}`}>
          <div className="n mono">{empty}</div>
          <div className="l">משמרות לא מאוישות</div>
        </div>
        <div className={`pill-stat ${problems > 0 ? 'warn' : 'ok'}`}>
          <div className="n mono">{problems}</div>
          <div className="l">בעיות פתוחות</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>
            עובדים <span className="n">{employees.length}</span>
          </h3>
          {employees.map((e) => {
            const mine = instances.filter((i) => i.employeeId === e.id).length;
            const nights = instances.filter((i) => i.employeeId === e.id && i.category === 'night').length;
            const pct = Math.min(100, Math.round((mine / Math.max(1, e.desiredShifts)) * 100));
            return (
              <div className="employee-row" key={e.id}>
                <div className="info">
                  <div className="name">{e.name}</div>
                  <div className="meta">
                    {mine}/{e.desiredShifts} משמרות · {nights}/3 לילות
                  </div>
                </div>
                <div className="progress-bar">
                  <div style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h3>התראות</h3>
          {empty > 0 && <div className="reason-item">🔴 {empty} משמרות לא מאוישות השבוע</div>}
          {belowTarget > 0 && <div className="reason-item">🟡 {belowTarget} עובדים מתחת ליעד המשמרות שלהם</div>}
          {exceptions > 0 && <div className="reason-item">🟡 {exceptions} שיבוצים חורגים מהחוקים (אושרו ידנית)</div>}
          {empty === 0 && belowTarget === 0 && exceptions === 0 && (
            <div className="reason-item">🟢 כל האילוצים תקינים, אין בעיות פתוחות</div>
          )}
          {refresherDue.length > 0 && (
            <div className="reason-item" style={{ justifyContent: 'space-between' }}>
              <span>🟡 {refresherDue.length} עובדים קרובים לפקיעת תוקף ריענון (או פג תוקף)</span>
              <button className="btn sm" onClick={() => setTab('refreshers')}>
                לצפייה
              </button>
            </div>
          )}

          <h3 style={{ marginTop: 18 }}>משמרות לא מאוישות</h3>
          {empty === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>אין משמרות פתוחות 🎉</div>
          ) : (
            instances
              .filter((i) => !isAssigned(i))
              .slice(0, 8)
              .map((i) => (
                <div className="reason-item" style={{ justifyContent: 'space-between' }} key={i.id}>
                  <span>
                    🔴 {DAY_NAMES[i.day]} · {i.name} · {i.start}–{i.end}
                  </span>
                  <button className="btn sm" onClick={() => openModal({ type: 'replacements', instanceId: i.id })}>
                    מצא מחליף
                  </button>
                </div>
              ))
          )}
        </div>
      </div>
    </>
  );
}
