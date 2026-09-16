import React from 'react';
import { Flame, Minus } from 'lucide-react';
import { Priority } from '../types';

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md';
}

export function TicketPriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const isUrgent = priority === 'urgent';
  const isHigh = priority === 'high';

  const sizeClasses =
    size === 'sm'
      ? 'text-xs px-2 py-0.5 gap-1'
      : 'text-xs px-2.5 py-1 gap-1.5 font-semibold';

  return (
    <span
      id={`priority-badge-${priority}`}
      className={`inline-flex items-center rounded-md border tracking-wide uppercase transition-colors select-none ${sizeClasses} ${
        isUrgent
          ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
          : isHigh
          ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
          : 'bg-slate-100 border-slate-200 text-slate-700 font-medium'
      }`}
      title={`Priority: ${isUrgent ? 'Urgent (2h SLA)' : isHigh ? 'High (8h SLA)' : 'Normal (24h SLA)'}`}
    >
      {isUrgent ? (
        <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" aria-hidden="true" />
      ) : isHigh ? (
        <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
      ) : (
        <Minus className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
      )}
      <span>{isUrgent ? 'Urgent' : isHigh ? 'High' : 'Normal'}</span>
    </span>
  );
}
