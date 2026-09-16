import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Ticket, TicketStats, User } from '../types';
import { useToast } from '../context/ToastContext';
import { TicketTable } from '../components/TicketTable';
import { TicketCardList } from '../components/TicketCardList';
import { CreateTicketModal } from '../components/CreateTicketModal';
import { EditTicketModal } from '../components/EditTicketModal';
import {
  AlertTriangle,
  Flame,
  UserX,
  CircleDot,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  Loader2,
  Inbox,
} from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [stats, setStats] = useState<TicketStats>({
    open_tickets: 0,
    overdue: 0,
    urgent: 0,
    unassigned: 0,
  });

  const [priorityTickets, setPriorityTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsData, queueData, usersData] = await Promise.all([
        api.getStats(),
        api.getTickets({ page: 1, page_size: 5 }),
        api.getUsers(),
      ]);

      setStats(statsData);
      setPriorityTickets(queueData.items || []);
      setUsers(usersData || []);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      showToast(err.message || 'Failed loading dashboard metrics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboardData();

    const handleCreated = () => loadDashboardData(true);
    window.addEventListener('helpdesk_ticket_created', handleCreated);
    return () => {
      window.removeEventListener('helpdesk_ticket_created', handleCreated);
    };
  }, [loadDashboardData]);

  const handleAssignTicket = async (ticketId: number, userId: number | null) => {
    try {
      await api.assignTicket(ticketId, userId);
      showToast(
        userId === null ? `Ticket #${ticketId} unassigned` : `Ticket #${ticketId} assigned`,
        'success'
      );
      loadDashboardData(true);
    } catch (err: any) {
      console.error('Assignment failed:', err);
      showToast(err.message || 'Failed to update assignment', 'error');
    }
  };

  return (
    <div id="dashboard-page" className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Support Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time ticket queue status, SLA compliance, and immediate action items.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="dashboard-refresh-btn"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            id="dashboard-create-ticket-btn"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Ticket</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Panels */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white rounded-lg border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Overdue Tickets - High visual emphasis */}
          <div
            id="metric-card-overdue"
            onClick={() => navigate('/tickets?overdue=true')}
            className={`p-4 rounded-lg border transition-all cursor-pointer shadow-xs hover:shadow-sm ${
              stats.overdue > 0
                ? 'bg-rose-50/70 border-rose-300 text-rose-950 ring-1 ring-rose-300/60'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Overdue
              </span>
              <div
                className={`p-1.5 rounded ${
                  stats.overdue > 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-rose-700">
                {stats.overdue}
              </span>
              <span className="text-[11px] text-rose-600 font-medium">SLA Breached</span>
            </div>
          </div>

          {/* Urgent Tickets - High visual emphasis */}
          <div
            id="metric-card-urgent"
            onClick={() => navigate('/tickets?priority=urgent')}
            className={`p-4 rounded-lg border transition-all cursor-pointer shadow-xs hover:shadow-sm ${
              stats.urgent > 0
                ? 'bg-amber-50/70 border-amber-300 text-amber-950 ring-1 ring-amber-300/50'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Urgent Priority
              </span>
              <div
                className={`p-1.5 rounded ${
                  stats.urgent > 0 ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-700">
                {stats.urgent}
              </span>
              <span className="text-[11px] text-amber-600 font-medium">2h Immediate SLA</span>
            </div>
          </div>

          {/* Open Tickets */}
          <div
            id="metric-card-open"
            onClick={() => navigate('/tickets?status=open')}
            className="p-4 rounded-lg border border-slate-200 bg-white text-slate-800 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Queue
              </span>
              <div className="p-1.5 rounded bg-blue-50 text-blue-600">
                <CircleDot className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">
                {stats.open_tickets}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Open / In Progress</span>
            </div>
          </div>

          {/* Unassigned Tickets */}
          <div
            id="metric-card-unassigned"
            onClick={() => navigate('/tickets?assigned_to=null')}
            className={`p-4 rounded-lg border transition-all cursor-pointer shadow-xs hover:shadow-sm ${
              stats.unassigned > 0
                ? 'bg-slate-50 border-slate-300 text-slate-900'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Unassigned
              </span>
              <div
                className={`p-1.5 rounded ${
                  stats.unassigned > 0 ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <UserX className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-800">
                {stats.unassigned}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Needs Owner</span>
            </div>
          </div>
        </div>
      )}

      {/* Priority Queue Section (Top 5 preview) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Priority Dispatch Queue (Top 5)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict backend ordering: Overdue first, followed by urgent priority and SLA due dates.
            </p>
          </div>

          <Link
            to="/tickets"
            id="view-all-tickets-link"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>View Full Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Loading queue records...</span>
            </div>
          ) : priorityTickets.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Inbox className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-medium">Queue is currently clear</p>
              <p className="text-xs text-slate-400">All pending tickets have been resolved.</p>
            </div>
          ) : (
            <>
              {/* Desktop view */}
              <div className="hidden md:block">
                <TicketTable
                  tickets={priorityTickets}
                  usersList={users}
                  onSelectTicket={(t) => navigate(`/tickets/${t.id}`)}
                  onEditTicket={(t, e) => {
                    e.stopPropagation();
                    setEditingTicket(t);
                  }}
                  onAssignTicket={handleAssignTicket}
                />
              </div>

              {/* Mobile view */}
              <div className="md:hidden">
                <TicketCardList
                  tickets={priorityTickets}
                  usersList={users}
                  onSelectTicket={(t) => navigate(`/tickets/${t.id}`)}
                  onEditTicket={(t, e) => {
                    e.stopPropagation();
                    setEditingTicket(t);
                  }}
                  onAssignTicket={handleAssignTicket}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateTicketModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => loadDashboardData(true)}
      />

      <EditTicketModal
        isOpen={!!editingTicket}
        ticket={editingTicket}
        usersList={users}
        onClose={() => setEditingTicket(null)}
        onSuccess={() => loadDashboardData(true)}
      />
    </div>
  );
}
