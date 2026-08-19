import React, { useState } from 'react';
import { useScheduler } from '../SchedulerContext';
import { addMonthsISO, todayISO } from '../dateUtils';

type Status = 'ok' | 'due_soon' | 'overdue' | 'unknown';

function statusOf(lastDate: string | undefined): Status {
  if (!lastDate) return 'unknown';
  const today = todayISO();
  const dueDate = addMonthsISO(lastDate, 3);
  const reminderDate = addMonthsISO(lastDate, 2);
  if (today >= dueDate) return 'overdue';
  if (today >= reminderDate) return 'due_soon';
  return 'ok';
}

const STATUS_INFO: Record<Status, { label: string; badge: string; note: string }> = {
  ok: { label: 'בתוקף', badge: 'b-green', note: '' },
  due_soon: { label: 'יש לתאם בקרוב', badge: 'b-amber', note: 'עברו כבר 2 חודשים מהריענון האחרון — נדרש ריענון נוסף תוך כחודש.' },
  overdue: { label: 'פג תוקף!', badge: 'b-red', note: 'עברו יותר מ-3 חודשים מהריענון האחרון — לא ניתן להמשיך לעבוד בלי ריענון.' },
  unknown: { label: 'לא הוזן תאריך', badge: 'b-grey', note: 'לא הוזן תאריך ריענון אחרון עבור עובד זה.' },
};

export default function RefresherTracking() {
  const { state, setLastRefresherDate } = useScheduler();
  const { employees } = state;
  const [editing, setEditing] = useState<Record<string, string>>({});

  const sorted = [...employees].sort((a, b) => {
    const order: Record<Status, number> = { overdue: 0, due_soon: 1, unknown: 2, ok: 3 };
    return order[statusOf(a.lastRefresherDate)] - order[statusOf(b.lastRefresherDate)];
  });

  return (
    <>
      <div className="topbar">
        <h2>מעקב ריענונים</h2>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: -10, marginBottom: 18 }}>
        מעקב אחרי ריענון אבטחה מתקדם (נדרש כל כ-3 חודשים לכל עובד). לאחר חודשיים מהריענון האחרון
        מוצגת התראה שיש לתאם ריענון נוסף תוך החודש הקרוב; לאחר 3 חודשים העובד מוצג כפג תוקף.
      </p>

      {employees.length === 0 && <div className="empty-state">אין עדיין עובדים במערכת</div>}

      {sorted.map((e) => {
        const status = statusOf(e.lastRefresherDate);
        const info = STATUS_INFO[status];
        const dueDate = e.lastRefresherDate ? addMonthsISO(e.lastRefresherDate, 3) : null;
        const draftValue = editing[e.id] ?? e.lastRefresherDate ?? '';

        return (
          <div className="card" style={{ padding: '16px 20px' }} key={e.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>{e.name}</h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
                  ריענון אחרון: {e.lastRefresherDate || '—'}
                  {dueDate && <> · תוקף עד: {dueDate}</>}
                </div>
              </div>
              <span className={`badge ${info.badge}`}>{info.label}</span>
            </div>

            {info.note && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: status === 'overdue' ? 'var(--red)' : 'var(--amber)' }}>
                ⚠️ {info.note}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>עדכון תאריך ריענון אחרון</label>
                <input
                  type="date"
                  value={draftValue}
                  onChange={(ev) => setEditing((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                />
              </div>
              <button
                className="btn primary sm"
                disabled={!draftValue}
                onClick={() => {
                  setLastRefresherDate(e.id, draftValue);
                  setEditing((prev) => {
                    const next = { ...prev };
                    delete next[e.id];
                    return next;
                  });
                }}
              >
                שמור
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
