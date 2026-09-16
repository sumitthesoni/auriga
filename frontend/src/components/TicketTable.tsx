import React from 'react';
import { Ticket, User } from '../types';
import { TicketPriorityBadge } from './TicketPriorityBadge';
import { TicketStatusBadge } from './TicketStatusBadge';
import { OverdueBadge, formatDate } from './OverdueBadge';
import { AssigneeSelect } from './AssigneeSelect';
import { ExternalLink, Edit3 } from 'lucide-react';

interface TicketTableProps {
  tickets: Ticket[];
  usersList?: User[];
  onSelectTicket: (ticket: Ticket) => void;
  onEditTicket: (ticket: Ticket, e: React.MouseEvent) => void;
  onAssignTicket: (ticketId: number, userId: number | null) => Promise<void> | void;
}

export function TicketTable({
  tickets,
  usersList,
  onSelectTicket,
  onEditTicket,
  onAssignTicket,
}: TicketTableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
          <tr>
            <th scope="col" className="py-2.5 px-3 w-16 text-center">ID</th>
            <th scope="col" className="py-2.5 px-3 w-28">Priority</th>
            <th scope="col" className="py-2.5 px-3 w-32">Status</th>
            <th scope="col" className="py-2.5 px-4 min-w-[220px]">Title & Description</th>
            <th scope="col" className="py-2.5 px-3 min-w-[150px]">Customer</th>
            <th scope="col" className="py-2.5 px-3 min-w-[170px]">Assignee</th>
            <th scope="col" className="py-2.5 px-3 min-w-[150px]">SLA / Due Date</th>
            <th scope="col" className="py-2.5 px-3 w-28 text-slate-400">Updated</th>
            <th scope="col" className="py-2.5 px-3 w-20 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tickets.map((ticket) => {
            const isOverdueActive = ticket.overdue && ticket.status !== 'resolved' && ticket.status !== 'closed';

            return (
              <tr
                key={ticket.id}
                id={`ticket-row-${ticket.id}`}
                onClick={() => onSelectTicket(ticket)}
                className={`hover:bg-slate-50/80 cursor-pointer transition-colors group ${
                  isOverdueActive ? 'bg-rose-50/30' : ''
                }`}
              >
                {/* ID */}
                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                  #{ticket.id}
                </td>

                {/* Priority */}
                <td className="py-2.5 px-3">
                  <TicketPriorityBadge priority={ticket.priority} size="sm" />
                </td>

                {/* Status */}
                <td className="py-2.5 px-3">
                  <TicketStatusBadge status={ticket.status} size="sm" />
                </td>

                {/* Title & Description */}
                <td className="py-2.5 px-4 max-w-sm">
                  <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {ticket.title}
                  </div>
                  {ticket.description && (
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {ticket.description}
                    </div>
                  )}
                </td>

                {/* Customer */}
                <td className="py-2.5 px-3">
                  <div className="font-medium text-slate-800 truncate max-w-[140px]">
                    {ticket.customer_name}
                  </div>
                  {ticket.customer_email && (
                    <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                      {ticket.customer_email}
                    </div>
                  )}
                </td>

                {/* Assignee with inline dropdown */}
                <td
                  className="py-2.5 px-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AssigneeSelect
                    currentAssignedTo={ticket.assigned_to}
                    usersList={usersList}
                    size="sm"
                    onSelect={(userId) => onAssignTicket(ticket.id, userId)}
                  />
                </td>

                {/* Due date & Overdue indicator */}
                <td className="py-2.5 px-3">
                  <OverdueBadge
                    overdue={ticket.overdue}
                    dueAt={ticket.due_at}
                    status={ticket.status}
                    size="sm"
                  />
                </td>

                {/* Updated at */}
                <td className="py-2.5 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                  {formatDate(ticket.updated_at)}
                </td>

                {/* Actions */}
                <td
                  className="py-2.5 px-3 text-right whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      id={`edit-ticket-row-btn-${ticket.id}`}
                      onClick={(e) => onEditTicket(ticket, e)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                      title="Quick edit"
                      aria-label="Edit ticket"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      id={`view-ticket-row-btn-${ticket.id}`}
                      onClick={() => onSelectTicket(ticket)}
                      className="p-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                      title="View details"
                      aria-label="View details"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
