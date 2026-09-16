import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { TicketPriorityBadge } from '../components/TicketPriorityBadge.jsx';
import { TicketStatusBadge } from '../components/TicketStatusBadge.jsx';
import { OverdueBadge, formatDate } from '../components/OverdueBadge.jsx';
import { AssigneeSelect } from '../components/AssigneeSelect.jsx';
import { EditTicketModal } from '../components/EditTicketModal.jsx';
import {
  ArrowLeft,
  Clock,
  Calendar,
  Mail,
  Edit3,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

export function TicketDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [ticket, setTicket] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [editModalOpen, setEditModalOpen] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  const loadTicket = useCallback(
    async (isRefresh = false) => {
      if (!id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        setError(null);
        const [ticketData, usersData] = await Promise.all([
          api.getTicket(Number(id)),
          api.getUsers(),
        ]);
        setTicket(ticketData);
        setUsers(usersData || []);
      } catch (err) {
        console.error('Failed loading ticket:', err);
        setError(err.message || `Ticket #${id} could not be loaded.`);
        showToast(err.message || 'Ticket not found', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, showToast]
  );

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  const handleStatusChange = async (newStatus) => {
    if (!ticket || newStatus === ticket.status) return;
    try {
      setUpdatingStatus(true);
      const updated = await api.updateTicket(ticket.id, { status: newStatus });
      setTicket(updated);
      showToast(`Status updated to "${newStatus}"`, 'success');
      window.dispatchEvent(new CustomEvent('helpdesk_ticket_created'));
    } catch (err) {
      console.error('Status change error:', err);
      showToast(err.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    if (!ticket || newPriority === ticket.priority) return;
    try {
      setUpdatingPriority(true);
      const updated = await api.updateTicket(ticket.id, { priority: newPriority });
      setTicket(updated);
      showToast(`Priority changed to "${newPriority}"`, 'success');
      window.dispatchEvent(new CustomEvent('helpdesk_ticket_created'));
    } catch (err) {
      console.error('Priority change error:', err);
      showToast(err.message || 'Failed to update priority', 'error');
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleAssignTicket = async (userId) => {
    if (!ticket) return;
    try {
      const updated = await api.assignTicket(ticket.id, userId);
      setTicket(updated);
      showToast(
        userId === null ? 'Ticket unassigned successfully' : 'Assignee updated successfully',
        'success'
      );
      window.dispatchEvent(new CustomEvent('helpdesk_ticket_created'));
    } catch (err) {
      console.error('Assignment error:', err);
      showToast(err.message || 'Failed to assign ticket', 'error');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm">Loading ticket #{id}...</span>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="py-16 max-w-lg mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Ticket Not Found</h2>
        <p className="text-sm text-slate-500">{error || 'The requested ticket does not exist.'}</p>
        <div className="pt-2">
          <Link
            to="/tickets"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Ticket Queue</span>
          </Link>
        </div>
      </div>
    );
  }

  const isOverdueActive =
    ticket.overdue && ticket.status !== 'resolved' && ticket.status !== 'closed';

  return (
    <div id="ticket-details-page" className="space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="back-to-queue-btn"
            onClick={() => navigate('/tickets')}
            className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition-colors"
            title="Return to queue"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold text-slate-500">#{ticket.id}</span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                {ticket.title}
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <TicketPriorityBadge priority={ticket.priority} size="sm" />
              <TicketStatusBadge status={ticket.status} size="sm" />
              {isOverdueActive && (
                <span className="text-[11px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded">
                  OVERDUE
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => loadTicket(true)}
            disabled={refreshing}
            className="p-2 rounded text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition-colors"
            title="Refresh details"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            type="button"
            id="details-edit-ticket-btn"
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shadow-xs transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Ticket</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {isOverdueActive && (
            <div
              id="details-overdue-banner"
              className="p-4 rounded-lg bg-rose-50 border border-rose-300 text-rose-950 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">SLA Resolution Window Breached</div>
                <p className="text-xs text-rose-800 mt-0.5">
                  Target response time was {formatDate(ticket.due_at)}. Immediate operational escalation required.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Issue Description
            </h3>
            <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed min-h-[80px]">
              {ticket.description || (
                <span className="text-slate-400 italic">No description provided for this ticket.</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Contact Name</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {ticket.customer_name}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Contact Email</span>
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{ticket.customer_email || 'Not specified'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-3 text-xs">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Timestamps & SLA Audit
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">Created At</span>
                  <span className="font-mono text-slate-700">{formatDate(ticket.created_at)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">SLA Target Due</span>
                  <span
                    className={`font-mono font-semibold ${
                      isOverdueActive ? 'text-rose-600 font-bold' : 'text-slate-700'
                    }`}
                  >
                    {formatDate(ticket.due_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">Last Modified</span>
                  <span className="font-mono text-slate-700">{formatDate(ticket.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100">
              Operations Controls
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Current Assignee
              </label>
              <AssigneeSelect
                currentAssignedTo={ticket.assigned_to}
                usersList={users}
                onSelect={handleAssignTicket}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Workflow Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['open', 'in_progress', 'resolved', 'closed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    id={`quick-status-${st}`}
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(st)}
                    className={`px-2.5 py-2 rounded text-xs font-medium border transition-all text-center capitalize cursor-pointer disabled:opacity-50 ${
                      ticket.status === st
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Priority SLA Tier
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="quick-priority-normal"
                  disabled={updatingPriority}
                  onClick={() => handlePriorityChange('normal')}
                  className={`px-2.5 py-2 rounded text-xs font-medium border transition-all text-center cursor-pointer disabled:opacity-50 ${
                    ticket.priority === 'normal'
                      ? 'bg-slate-800 text-white border-slate-800 font-bold'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Normal (24h)
                </button>
                <button
                  type="button"
                  id="quick-priority-urgent"
                  disabled={updatingPriority}
                  onClick={() => handlePriorityChange('urgent')}
                  className={`px-2.5 py-2 rounded text-xs font-medium border transition-all text-center cursor-pointer disabled:opacity-50 ${
                    ticket.priority === 'urgent'
                      ? 'bg-rose-600 text-white border-rose-600 font-bold'
                      : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  Urgent (2h)
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
            <Link
              to="/tickets"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to all tickets</span>
            </Link>
          </div>
        </div>
      </div>

      <EditTicketModal
        isOpen={editModalOpen}
        ticket={ticket}
        usersList={users}
        onClose={() => setEditModalOpen(false)}
        onSuccess={(updated) => setTicket(updated)}
      />
    </div>
  );
}
