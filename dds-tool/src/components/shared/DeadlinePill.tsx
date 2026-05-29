'use client';

import { differenceInDays } from 'date-fns';

interface DeadlinePillProps {
  date: Date | null;
  className?: string;
}

export function DeadlinePill({ date, className = '' }: DeadlinePillProps) {
  if (!date) return <span className="text-muted text-xs">—</span>;

  const days = differenceInDays(date, new Date());

  let label = '';
  let style = '';

  if (days < 0) {
    label = `${Math.abs(days)}d overdue`;
    style = 'bg-fail-bg text-fail-text';
  } else if (days <= 3) {
    label = days === 0 ? 'Today' : `${days}d`;
    style = 'bg-warn-bg text-warn-text';
  } else {
    label = `${days}d`;
    style = 'bg-pass-bg text-pass-text';
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style} ${className}`}>
      {label}
    </span>
  );
}
