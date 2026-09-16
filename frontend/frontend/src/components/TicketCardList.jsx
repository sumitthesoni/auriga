import React from 'react';
import { TicketPriorityBadge } from './TicketPriorityBadge.jsx';
import { TicketStatusBadge } from './TicketStatusBadge.jsx';
import { OverdueBadge } from './OverdueBadge.jsx';
import { AssigneeSelect } from './AssigneeSelect.jsx';
import { Edit2, ChevronRight, User } from 'lucide-react';

export function TicketCardList({
  tickets,
  usersList,
  onSelectTicket,
  onEditTicket,
  onAssignTicket,
}) {
  return (
    <div className="space-y-2.5">
      {tickets.map((ticket) => {
        const isOverdueActive =
          ticket.overdue && ticket.status !== 'resolved' && ticket.status !== 'closed';

        return (
          <div
            key={ticket.id}
            id={`ticket-card-${ticket.id}`}
            onClick={() => onSelectTicket(ticket)}
            className={`p-3.5 rounded-lg border text-xs cursor-pointer shadow-xs transition-all ${
              isOverdueActive
                ? 'bg-rose-50/50 border-rose-300'
                : ticket.priority === 'urgent' && ticket.status !== 'resolved' && ticket.status !== 'closed'
                ? 'bg-amber-50/40 border-amber-200'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            {/* Header: ID, badges, edit */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-slate-700">#{ticket.id}</span>
                <TicketPriorityBadge priority={ticket.priority} size="sm" />
                <TicketStatusBadge status={ticket.status} size="sm" />
              </div>
              <button
                type="button"
                onClick={(e) => onEditTicket(ticket, e)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="Edit ticket"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Title */}
            <h3 className="font-bold text-sm text-slate-900 mb-1 leading-snug">
              {ticket.title}
            </h3>

            {/* Customer & Description */}
            <div className="text-slate-600 mb-2.5 space-y-0.5">
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <User className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Customer: <strong className="text-slate-700">{ticket.customer_name}</strong></span>
              </div>
              {ticket.description && (
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                  {ticket.description}
                </p>
              )}
            </div>

            {/* SLA Due & Overdue */}
            <div className="mb-2.5">
              <OverdueBadge
                overdue={ticket.overdue}
                dueAt={ticket.due_at}
                status={ticket.status}
                size="sm"
              />
            </div>

            {/* Footer: Assignee */}
            <div
              className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Assignee:</span>
              <div className="flex items-center gap-1">
                <AssigneeSelect
                  currentAssignedTo={ticket.assigned_to}
                  usersList={usersList}
                  size="sm"
                  onSelect={(userId) => onAssignTicket(ticket.id, userId)}
                />
                <ChevronRight className="w-4 h-4 text-slate-300 ml-1" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
