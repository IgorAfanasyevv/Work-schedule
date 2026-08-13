import React from 'react';
import { useScheduler } from '../SchedulerContext';
import { CATEGORY_LABEL } from '../types';
import { durationHours } from '../engine';

export default function ShiftTypes() {
  const { state, openModal, deleteShiftType } = useScheduler();

  return (
    <>
      <div className="topbar">
        <h2>סוגי משמרות</h2>
        <button className="btn primary" onClick={() => openModal({ type: 'shiftType', shiftTypeId: null })}>
          + סוג משמרת חדש
        </button>
      </div>
      {state.shiftTypes.map((st) => (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }} key={st.id}>
          <div>
            <div style={{ fontWeight: 700 }}>
              {st.name} <span className="badge b-grey">{CATEGORY_LABEL[st.category]}</span>
            </div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>
              {st.start}–{st.end} · {durationHours(st.start, st.end)} שעות
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm" onClick={() => openModal({ type: 'shiftType', shiftTypeId: st.id })}>
              ערוך
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                if (confirm(`למחוק את סוג המשמרת "${st.name}"? כל המופעים שלו השבוע יימחקו.`)) deleteShiftType(st.id);
              }}
            >
              מחק
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
