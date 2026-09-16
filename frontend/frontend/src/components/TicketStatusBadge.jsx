import React from 'react';
import { CircleDot, Clock, CheckCircle2, Archive } from 'lucide-react';

export function TicketStatusBadge({ status, size = 'md' }) {
  const sizeClasses =
    size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5 font-medium';

  switch (status) {
    case 'open':
      return (
        <span
          id={`status-badge-${status}`}
          className={`inline-flex items-center rounded-md border bg-amber-50 border-amber-200 text-amber-900 ${sizeClasses}`}
        >
          <CircleDot className="w-3 h-3 text-amber-600 shrink-0" aria-hidden="true" />
          <span>Open</span>
        </span>
      );
    case 'in_progress':
      return (
        <span
          id={`status-badge-${status}`}
          className={`inline-flex items-center rounded-md border bg-sky-50 border-sky-200 text-sky-900 ${sizeClasses}`}
        >
          <Clock className="w-3 h-3 text-sky-600 shrink-0 animate-pulse" aria-hidden="true" />
          <span>In Progress</span>
        </span>
      );
    case 'resolved':
      return (
        <span
          id={`status-badge-${status}`}
          className={`inline-flex items-center rounded-md border bg-emerald-50 border-emerald-200 text-emerald-900 opacity-90 ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>Resolved</span>
        </span>
      );
    case 'closed':
      return (
        <span
          id={`status-badge-${status}`}
          className={`inline-flex items-center rounded-md border bg-slate-100 border-slate-200 text-slate-600 opacity-80 ${sizeClasses}`}
        >
          <Archive className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
          <span>Closed</span>
        </span>
      );
    default:
      return null;
  }
}
