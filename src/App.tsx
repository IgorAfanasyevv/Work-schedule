import React from 'react';
import { SchedulerProvider, useScheduler, Tab } from './SchedulerContext';
import Dashboard from './components/Dashboard';
import ScheduleView from './components/ScheduleView';
import MyShifts from './components/MyShifts';
import Employees from './components/Employees';
import ShiftTypes from './components/ShiftTypes';
import ModalHost from './components/ModalHost';
import Toasts from './components/ui/Toasts';

const NAV_ITEMS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'לוח בקרה' },
  { id: 'schedule', label: 'סידור עבודה' },
  { id: 'myshifts', label: 'המשמרות שלי' },
  { id: 'employees', label: 'עובדים' },
  { id: 'shifttypes', label: 'סוגי משמרות' },
];

function Shell() {
  const { tab, setTab, state, isLoaded, isShared } = useScheduler();

  if (!isLoaded) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>טוען...</div>
    );
  }

  const unfilledCount = state.instances.filter((i) => !i.employeeId && !i.tempWorkerName).length;

  return (
    <div id="app">
      <div className="sidebar">
        <div className="brand">
          <div className="k">Ops · 24/7</div>
          <h1>מוקד סידורים</h1>
          <div className="sub">{state.weekLabel}</div>
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-btn ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
            style={{ position: 'relative' }}
          >
            <span className="dot" />
            {item.label}
            {unfilledCount > 0 && (item.id === 'dashboard' || item.id === 'schedule') && (
              <span
                title={`${unfilledCount} משמרות לא מאוישות`}
                style={{
                  marginRight: 'auto',
                  background: 'var(--red)',
                  color: '#1a0d0d',
                  fontSize: 10.5,
                  fontWeight: 800,
                  borderRadius: 100,
                  padding: '1px 6px',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                {unfilledCount}
              </span>
            )}
          </button>
        ))}
        <div className="sidebar-foot">
          מנוע תכנון: Constraint Satisfaction
          <br />+ איזון הוגנות שבועי
          {!isShared && (
            <div style={{ marginTop: 10, color: 'var(--amber)' }}>
              ⚠️ מצב מקומי בלבד — הנתונים נשמרים בדפדפן הזה בלבד ולא משותפים.
            </div>
          )}
        </div>
      </div>
      <div className="main">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'schedule' && <ScheduleView />}
        {tab === 'myshifts' && <MyShifts />}
        {tab === 'employees' && <Employees />}
        {tab === 'shifttypes' && <ShiftTypes />}
      </div>
      <ModalHost />
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <SchedulerProvider>
      <Shell />
    </SchedulerProvider>
  );
}
