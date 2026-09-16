import React, { useState } from 'react';
import { X, Flame, AlertCircle, Loader2, Clock, CheckCircle } from 'lucide-react';
import { CreateTicketPayload, Priority } from '../types';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (ticketId?: number) => void;
}

export function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
  const { showToast } = useToast();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!customerName.trim()) {
      newErrors.customerName = 'Customer name cannot be blank.';
    }

    if (!title.trim()) {
      newErrors.title = 'Title cannot be blank.';
    }

    if (customerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail.trim())) {
        newErrors.customerEmail = 'Customer email must be valid if provided.';
      }
    }

    if (priority !== 'urgent' && priority !== 'high' && priority !== 'normal') {
      newErrors.priority = 'Priority must be urgent, high, or normal.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      const payload: CreateTicketPayload = {
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || null,
        title: title.trim(),
        description: description.trim() || null,
        priority,
      };

      const created = await api.createTicket(payload);
      showToast(`Ticket #${created.id} created successfully.`, 'success');

      // Reset form
      setCustomerName('');
      setCustomerEmail('');
      setTitle('');
      setDescription('');
      setPriority('normal');
      setErrors({});

      onSuccess(created.id);
      onClose();
    } catch (err: any) {
      console.error('Failed creating ticket:', err);
      showToast(err.message || 'Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="create-ticket-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="create-ticket-modal"
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h2 id="modal-title" className="text-base font-bold text-slate-900">
              Create New Helpdesk Ticket
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Backend will automatically calculate SLA target dates.
            </p>
          </div>
          <button
            type="button"
            id="create-ticket-close-btn"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Priority selector cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Priority <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                id="priority-select-normal"
                onClick={() => setPriority('normal')}
                className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  priority === 'normal'
                    ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div
                  className={`mt-0.5 p-1 rounded ${
                    priority === 'normal' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Normal Priority</div>
                  <div className="text-xs text-slate-500 mt-0.5">24-hour response SLA</div>
                </div>
              </button>

              <button
                type="button"
                id="priority-select-high"
                onClick={() => setPriority('high')}
                className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  priority === 'high'
                    ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`mt-0.5 p-1 rounded ${priority === 'high' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Flame className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-amber-900">High Priority</div>
                  <div className="text-xs text-amber-700 mt-0.5 font-medium">8-hour response SLA</div>
                </div>
              </button>

              <button
                type="button"
                id="priority-select-urgent"
                onClick={() => setPriority('urgent')}
                className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  priority === 'urgent'
                    ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div
                  className={`mt-0.5 p-1 rounded ${
                    priority === 'urgent' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-rose-900">Urgent Priority</div>
                  <div className="text-xs text-rose-600 mt-0.5 font-medium">2-hour immediate SLA</div>
                </div>
              </button>
            </div>
            {errors.priority && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.priority}
              </p>
            )}
          </div>

          {/* Ticket Title */}
          <div>
            <label htmlFor="ticket-title-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ticket Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="ticket-title-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
              }}
              placeholder="e.g. VPN not working from home office"
              className={`w-full px-3 py-2 text-sm rounded-md border transition-colors ${
                errors.title
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
              }`}
            />
            {errors.title && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.title}
              </p>
            )}
          </div>

          {/* Customer info (Name & Email) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="customer-name-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="customer-name-input"
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (errors.customerName) setErrors((prev) => ({ ...prev, customerName: '' }));
                }}
                placeholder="e.g. Alice Johnson"
                className={`w-full px-3 py-2 text-sm rounded-md border transition-colors ${
                  errors.customerName
                    ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                    : 'border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
                }`}
              />
              {errors.customerName && (
                <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.customerName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="customer-email-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Customer Email <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                id="customer-email-input"
                type="email"
                value={customerEmail}
                onChange={(e) => {
                  setCustomerEmail(e.target.value);
                  if (errors.customerEmail) setErrors((prev) => ({ ...prev, customerEmail: '' }));
                }}
                placeholder="e.g. alice@example.com"
                className={`w-full px-3 py-2 text-sm rounded-md border transition-colors ${
                  errors.customerEmail
                    ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                    : 'border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
                }`}
              />
              {errors.customerEmail && (
                <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.customerEmail}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="ticket-description-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Description <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              id="ticket-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide diagnostic details, steps to reproduce, or affected user accounts..."
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
            />
          </div>

          {/* SLA Calculation Notice */}
          <div className="rounded-md bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700">Automatic SLA Target: </span>
              {priority === 'urgent'
                ? 'Backend sets due date to +2 hours from submission with high-priority queue placement.'
                : 'Backend sets due date to +24 hours from submission.'}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              id="cancel-create-ticket-btn"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md border border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-create-ticket-btn"
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-md shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Create Ticket</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
