import React from 'react';
import { useScheduler } from '../SchedulerContext';
import { DAY_NAMES, CATEGORY_LABEL } from '../types';
import type { Employee, EmployeeBlock } from '../types';

function blockLabel(b: EmployeeBlock, shiftTypes: { id: string; name: string }[]): string {
  if (b.scope === 'day') return `🚫 ${DAY_NAMES[b.day as number]} — יום שלם`;
  if (b.scope === 'category')
    return `🚫 ${b.day === 'all' ? 'כל השבוע' : DAY_NAMES[b.day as number]} — ${CATEGORY_LABEL[b.category!]}`;
  if (b.scope === 'shift') {
    const st = shiftTypes.find((s) => s.id === b.shiftTypeId);
    return `🚫 ${DAY_NAMES[b.day as number]} — ${st ? st.name : b.shiftTypeId}`;
  }
  return '🚫 חסימה';
}

export default function Employees() {
  const { state, openModal, deleteEmployee, removeBlock } = useScheduler();
  const { employees, instances, shiftTypes } = state;

  return (
    <>
      <div className="topbar">
        <h2>עובדים</h2>
        <button className="btn primary" onClick={() => openModal({ type: 'addEditEmployee', employeeId: null })}>
          + עובד חדש
        </button>
      </div>
      {employees.map((e: Employee) => {
        const mine = instances.filter((i) => i.employeeId === e.id).length;
        const nights = instances.filter((i) => i.employeeId === e.id && i.category === 'night').length;
        return (
          <div className="card" style={{ padding: '16px 20px' }} key={e.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>{e.name}</h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
                  רצוי: {e.desiredShifts} · מקסימום: {e.maxShifts} · הושבצו: {mine} · לילות: {nights}/3
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sm" onClick={() => openModal({ type: 'addEditEmployee', employeeId: e.id })}>
                  ערוך
                </button>
                <button
                  className="btn sm danger"
                  onClick={() => {
                    if (confirm(`למחוק את ${e.name}? כל המשמרות שלו יתפנו.`)) deleteEmployee(e.id);
                  }}
                >
                  מחק
                </button>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              {(e.blocks || []).map((b, idx) => (
                <span className="block-chip" key={idx}>
                  {blockLabel(b, shiftTypes)}
                  <button onClick={() => removeBlock(e.id, idx)}>✕</button>
                </span>
              ))}
              <button
                className="btn sm ghost"
                style={{ marginTop: 4 }}
                onClick={() => openModal({ type: 'addBlock', employeeId: e.id })}
              >
                + הוסף חסימה
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
