import React from 'react';
import { Ticket, User } from '../types';
import { TicketPriorityBadge } from './TicketPriorityBadge';
import { TicketStatusBadge } from './TicketStatusBadge';
import { OverdueBadge, formatDate } from './OverdueBadge';
import { AssigneeSelect } from './AssigneeSelect';
import { Edit3, ChevronRight } from 'lucide-react';

interface TicketCardListProps {
  tickets: Ticket[];
  usersList?: User[];
  onSelectTicket: (ticket: Ticket) => void;
  onEditTicket: (ticket: Ticket, e: React.MouseEvent) => void;
  onAssignTicket: (ticketId: number, userId: number | null) => Promise<void> | void;
}

export function TicketCardList({
  tickets,
  usersList,
  onSelectTicket,
  onEditTicket,
  onAssignTicket,
}: TicketCardListProps) {
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
            className={`p-3.5 rounded-lg border bg-white shadow-xs hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer ${
              isOverdueActive ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
            }`}
          >
            {/* Top row: ID, Badges, Edit button */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  #{ticket.id}
                </span>
                <TicketPriorityBadge priority={ticket.priority} size="sm" />
                <TicketStatusBadge status={ticket.status} size="sm" />
              </div>

              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => onEditTicket(ticket, e)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  aria-label="Edit ticket"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="mb-2">
              <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                {ticket.title}
              </h4>
              {ticket.description && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {ticket.description}
                </p>
              )}
            </div>

            {/* Middle row: Customer info & SLA */}
            <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2 mb-2.5">
              <div>
                <span className="font-medium text-slate-700">{ticket.customer_name}</span>
                {ticket.customer_email && (
                  <span className="text-slate-400 text-[11px] block">{ticket.customer_email}</span>
                )}
              </div>
              <div>
                <OverdueBadge
                  overdue={ticket.overdue}
                  dueAt={ticket.due_at}
                  status={ticket.status}
                  size="sm"
                />
              </div>
            </div>

            {/* Bottom row: Assignee and Updated timestamp */}
            <div
              className="flex items-center justify-between gap-2 pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs text-slate-500">
                <AssigneeSelect
                  currentAssignedTo={ticket.assigned_to}
                  usersList={usersList}
                  size="sm"
                  onSelect={(uid) => onAssignTicket(ticket.id, uid)}
                />
              </div>
              <span className="text-[10px] text-slate-400">
                Updated {formatDate(ticket.updated_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
