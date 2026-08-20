import React from 'react';
import { SchedulerProvider, useScheduler, Tab } from './SchedulerContext';
import { needsAttention } from './engine';
import Dashboard from './components/Dashboard';
import ScheduleView from './components/ScheduleView';
import MyShifts from './components/MyShifts';
import Employees from './components/Employees';
import ShiftTypes from './components/ShiftTypes';
import RefresherTracking from './components/RefresherTracking';
import ModalHost from './components/ModalHost';
import Toasts from './components/ui/Toasts';
import ThemeToggle from './components/ui/ThemeToggle';

const NAV_ITEMS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'לוח בקרה' },
  { id: 'schedule', label: 'סידור עבודה' },
  { id: 'myshifts', label: 'המשמרות שלי' },
  { id: 'employees', label: 'עובדים' },
  { id: 'shifttypes', label: 'סוגי משמרות' },
  { id: 'refreshers', label: 'מעקב ריענונים' },
];

function Shell() {
  const { tab, setTab, state, instances, isLoaded, isShared, sites, currentSiteId, switchSite } = useScheduler();

  if (!isLoaded) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>טוען...</div>
    );
  }

  const unfilledCount = instances.filter((i) => needsAttention(instances, i)).length;
  const filledCount = instances.length - unfilledCount;
  // same rule as the in-page banner: don't flag a week nobody has touched yet
  const showGapBadge = unfilledCount > 0 && filledCount > 0;

  return (
    <div id="app">
      <div className="sidebar">
        <div className="brand">
          <div className="k">Ops · 24/7</div>
          <h1>מוקד סידורים</h1>
          <div className="sub">{state.weekLabel}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '0 8px 14px 8px' }}>
          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => switchSite(site.id)}
              style={{
                textAlign: 'right',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid ' + (site.id === currentSiteId ? 'var(--teal)' : 'var(--border)'),
                background: site.id === currentSiteId ? 'rgba(79,209,197,.1)' : 'var(--panel-2)',
                color: site.id === currentSiteId ? 'var(--teal)' : 'var(--text-dim)',
                fontSize: 12.5,
                fontWeight: site.id === currentSiteId ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {site.id === currentSiteId ? '● ' : ''}
              {site.name}
            </button>
          ))}
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
            {showGapBadge && (item.id === 'dashboard' || item.id === 'schedule') && (
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
        {tab === 'refreshers' && <RefresherTracking />}
      </div>
      <ModalHost />
      <Toasts />
      <ThemeToggle />
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
