import React from 'react';
import { useScheduler } from '../SchedulerContext';

export default function AuditLog() {
  const { state } = useScheduler();

  return (
    <>
      <div className="topbar">
        <h2>יומן שינויים</h2>
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
