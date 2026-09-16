import React from 'react';
import { TicketPriorityBadge } from './TicketPriorityBadge.jsx';
import { TicketStatusBadge } from './TicketStatusBadge.jsx';
import { OverdueBadge, formatDate } from './OverdueBadge.jsx';
import { AssigneeSelect } from './AssigneeSelect.jsx';
import { Edit2, ChevronRight } from 'lucide-react';

export function TicketTable({
  tickets,
  usersList,
  onSelectTicket,
  onEditTicket,
  onAssignTicket,
}) {
  return (
    <div className="overflow-x-auto">
      <table id="ticket-table" className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <th className="py-2.5 px-3 w-14">ID</th>
            <th className="py-2.5 px-3 w-24">Priority</th>
            <th className="py-2.5 px-3 w-28">Status</th>
            <th className="py-2.5 px-3 min-w-[200px]">Title</th>
            <th className="py-2.5 px-3 min-w-[140px]">Customer</th>
            <th className="py-2.5 px-3 min-w-[160px]">Assignee</th>
            <th className="py-2.5 px-3 min-w-[150px]">SLA / Due Date</th>
            <th className="py-2.5 px-3 min-w-[110px]">Updated</th>
            <th className="py-2.5 px-3 w-20 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tickets.map((ticket) => {
            const isOverdueActive =
              ticket.overdue && ticket.status !== 'resolved' && ticket.status !== 'closed';

            return (
              <tr
                key={ticket.id}
                id={`ticket-row-${ticket.id}`}
                onClick={() => onSelectTicket(ticket)}
                className={`group cursor-pointer transition-colors hover:bg-slate-50/80 ${
                  isOverdueActive
                    ? 'bg-rose-50/40 hover:bg-rose-50/70'
                    : ticket.priority === 'urgent' && ticket.status !== 'resolved' && ticket.status !== 'closed'
                    ? 'bg-amber-50/30 hover:bg-amber-50/60'
                    : ''
                }`}
              >
                {/* ID */}
                <td className="py-3 px-3 font-mono font-bold text-slate-700">
                  #{ticket.id}
                </td>

                {/* Priority */}
                <td className="py-3 px-3">
                  <TicketPriorityBadge priority={ticket.priority} size="sm" />
                </td>

                {/* Status */}
                <td className="py-3 px-3">
                  <TicketStatusBadge status={ticket.status} size="sm" />
                </td>

                {/* Title */}
                <td className="py-3 px-3">
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
                <td className="py-3 px-3">
                  <div className="font-medium text-slate-800">{ticket.customer_name}</div>
                  {ticket.customer_email && (
                    <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                      {ticket.customer_email}
                    </div>
                  )}
                </td>

                {/* Assignee */}
                <td
                  className="py-3 px-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AssigneeSelect
                    currentAssignedTo={ticket.assigned_to}
                    usersList={usersList}
                    size="sm"
                    onSelect={(userId) => onAssignTicket(ticket.id, userId)}
                  />
                </td>

                {/* Due Date & Overdue Indicator */}
                <td className="py-3 px-3">
                  <OverdueBadge
                    overdue={ticket.overdue}
                    dueAt={ticket.due_at}
                    status={ticket.status}
                    size="sm"
                  />
                </td>

                {/* Updated At */}
                <td className="py-3 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                  {formatDate(ticket.updated_at)}
                </td>

                {/* Actions */}
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      id={`edit-action-btn-${ticket.id}`}
                      onClick={(e) => onEditTicket(ticket, e)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                      title="Edit Ticket"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
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
