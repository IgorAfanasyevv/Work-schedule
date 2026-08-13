import React from 'react';
import { useScheduler } from '../SchedulerContext';

export default function AuditLog() {
  const { state, clearAuditLog } = useScheduler();

  return (
    <>
      <div className="topbar">
        <h2>יומן שינויים</h2>
        {state.auditLog.length > 0 && (
          <button
            className="btn danger sm"
            onClick={() => {
              if (confirm('לנקות את כל יומן השינויים? הפעולה הזו לא הפיכה.')) clearAuditLog();
            }}
          >
            🗑 נקה יומן
          </button>
        )}
      </div>
      <div className="card">
        {state.auditLog.length === 0 ? (
          <div className="empty-state">אין עדיין שינויים רשומים</div>
        ) : (
          state.auditLog.map((a) => (
            <div className="audit-item" key={a.id}>
              <div className="ts">{a.ts}</div>
              <div className="txt">{a.text}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
