import React from 'react';
import { Flame, Minus } from 'lucide-react';

export function TicketPriorityBadge({ priority, size = 'md' }) {
  const isUrgent = priority === 'urgent';

  const sizeClasses =
    size === 'sm'
      ? 'text-xs px-2 py-0.5 gap-1'
      : 'text-xs px-2.5 py-1 gap-1.5 font-semibold';

  return (
    <span
      id={`priority-badge-${priority}`}
      className={`inline-flex items-center rounded-md border tracking-wide uppercase select-none ${sizeClasses} ${
        isUrgent
          ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
          : 'bg-slate-100 border-slate-200 text-slate-700 font-medium'
      }`}
      title={`Priority: ${isUrgent ? 'Urgent (2h SLA)' : 'Normal (24h SLA)'}`}
    >
      {isUrgent ? (
        <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" aria-hidden="true" />
      ) : (
        <Minus className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
      )}
      <span>{isUrgent ? 'Urgent' : 'Normal'}</span>
    </span>
  );
}
