import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Ticket, Priority, TicketStatus, User, UpdateTicketPayload } from '../types';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { AssigneeSelect } from './AssigneeSelect';

interface EditTicketModalProps {
  isOpen: boolean;
  ticket: Ticket | null;
  usersList?: User[];
  onClose: () => void;
  onSuccess: (updated: Ticket) => void;
}

export function EditTicketModal({
  isOpen,
  ticket,
  usersList,
  onClose,
  onSuccess,
}: EditTicketModalProps) {
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [status, setStatus] = useState<TicketStatus>('open');
  const [assignedTo, setAssignedTo] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title || '');
      setDescription(ticket.description || '');
      setPriority(ticket.priority || 'normal');
      setStatus(ticket.status || 'open');
      setAssignedTo(ticket.assigned_to);
      setError(null);
    }
  }, [ticket]);

  if (!isOpen || !ticket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be blank');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: UpdateTicketPayload = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        assigned_to: assignedTo,
      };

      const updated = await api.updateTicket(ticket.id, payload);
      showToast(`Ticket #${ticket.id} updated successfully.`, 'success');
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed updating ticket:', err);
      setError(err.message || 'Failed to update ticket');
      showToast(err.message || 'Failed to update ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="edit-ticket-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="edit-ticket-modal"
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Edit Ticket #{ticket.id}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer: {ticket.customer_name} {ticket.customer_email ? `(${ticket.customer_email})` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="edit-ticket-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              id="edit-ticket-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
            />
          </div>

          {/* Priority & Status in grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                id="edit-ticket-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >
                <option value="normal">Normal (24h SLA)</option>
                <option value="high">High (8h SLA)</option>
                <option value="urgent">Urgent (2h SLA)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                id="edit-ticket-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Assignee
            </label>
            <AssigneeSelect
              currentAssignedTo={assignedTo}
              usersList={usersList}
              onSelect={(uid) => setAssignedTo(uid)}
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md border border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="edit-ticket-save-btn"
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-md shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
