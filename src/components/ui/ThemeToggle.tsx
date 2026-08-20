import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'shift-scheduler-theme';

function getInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* ignore */
  }
  return 'dark';
}

/** Theme is a personal browser preference, not shared schedule data - kept purely in
 *  localStorage, never synced to Firestore, so each device/person can pick their own. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      title={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
      style={{
        position: 'fixed',
        bottom: 18,
        left: 18,
        zIndex: 50,
        width: 46,
        height: 46,
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'var(--panel)',
        color: 'var(--text)',
        fontSize: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: 'var(--shadow)',
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
