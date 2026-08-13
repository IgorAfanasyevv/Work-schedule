import React from 'react';
import { useScheduler } from '../../SchedulerContext';

export default function Toasts() {
  const { toasts } = useScheduler();
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
