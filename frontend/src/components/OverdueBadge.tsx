import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { TicketStatus } from '../types';

interface OverdueBadgeProps {
  overdue: boolean;
  dueAt: string;
  status: TicketStatus;
  size?: 'sm' | 'md';
}

export function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function OverdueBadge({ overdue, dueAt, status, size = 'md' }: OverdueBadgeProps) {
  const isResolvedOrClosed = status === 'resolved' || status === 'closed';

  // If resolved or closed, never show as actively overdue
  if (isResolvedOrClosed) {
    return (
      <span
        id="sla-completed"
        className="inline-flex items-center gap-1 text-xs text-slate-500"
        title={`Due: ${formatDate(dueAt)} (Completed)`}
      >
        <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
        <span>{formatDate(dueAt)}</span>
      </span>
    );
  }

  if (overdue) {
    const sizeClasses =
      size === 'sm'
        ? 'text-xs px-2 py-0.5 gap-1'
        : 'text-xs px-2.5 py-1 gap-1.5 font-semibold';

    return (
      <span
        id="overdue-badge-warning"
        className={`inline-flex items-center rounded-md border bg-rose-100 border-rose-300 text-rose-900 ${sizeClasses}`}
        title={`SLA Breached! Was due ${formatDate(dueAt)}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" aria-hidden="true" />
        <span>Overdue ({formatDate(dueAt)})</span>
      </span>
    );
  }

  return (
    <span
      id="sla-on-schedule"
      className="inline-flex items-center gap-1 text-xs text-slate-600"
      title={`Due: ${formatDate(dueAt)}`}
    >
      <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
      <span>Due {formatDate(dueAt)}</span>
    </span>
  );
}
