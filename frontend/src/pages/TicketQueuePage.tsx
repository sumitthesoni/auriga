import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Ticket, TicketFilters, User, Priority, TicketStatus } from '../types';
import { useToast } from '../context/ToastContext';
import { TicketTable } from '../components/TicketTable';
import { TicketCardList } from '../components/TicketCardList';
import { Pagination } from '../components/Pagination';
import { CreateTicketModal } from '../components/CreateTicketModal';
import { EditTicketModal } from '../components/EditTicketModal';
import {
  Search,
  Filter,
  RotateCcw,
  PlusCircle,
  RefreshCw,
  Loader2,
  Inbox,
  X,
} from 'lucide-react';

export function TicketQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  // Filters state initialized from URL
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [priority, setPriority] = useState<Priority | ''>(
    (searchParams.get('priority') as Priority) || ''
  );
  const [status, setStatus] = useState<TicketStatus | ''>(
    (searchParams.get('status') as TicketStatus) || ''
  );
  const [overdue, setOverdue] = useState<string>(searchParams.get('overdue') || '');
  const [assignedTo, setAssignedTo] = useState<string>(searchParams.get('assigned_to') || '');
  const [customer, setCustomer] = useState<string>(searchParams.get('customer') || '');

  // Pagination
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState<number>(Number(searchParams.get('page_size')) || 20);

  // Data
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [users, setUsers] = useState<User[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  // Load staff for filter dropdown
  useEffect(() => {
    let mounted = true;
    api
      .getUsers()
      .then((res) => {
        if (mounted) setUsers(res || []);
      })
      .catch((e) => console.error('Error fetching users:', e));
    return () => {
      mounted = false;
    };
  }, []);

  // Synchronize URL search params
  const updateUrlParams = useCallback(
    (newFilters: Record<string, any>) => {
      const params = new URLSearchParams();
      Object.entries(newFilters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.set(key, String(val));
        }
      });
      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  const fetchTickets = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const filterPayload: TicketFilters = {
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        priority: priority || undefined,
        status: status || undefined,
        overdue: overdue ? overdue === 'true' : undefined,
        assigned_to: assignedTo !== '' ? (assignedTo === 'null' ? 'null' : Number(assignedTo)) : undefined,
        customer: customer.trim() || undefined,
      };

      try {
        const response = await api.getTickets(filterPayload);
        setTickets(response.items || []);
        setTotalItems(response.total || 0);
        setTotalPages(response.total_pages || 1);

        updateUrlParams({
          page: page > 1 ? page : undefined,
          page_size: pageSize !== 20 ? pageSize : undefined,
          search: search.trim() || undefined,
          priority: priority || undefined,
          status: status || undefined,
          overdue: overdue || undefined,
          assigned_to: assignedTo || undefined,
          customer: customer.trim() || undefined,
        });
      } catch (err: any) {
        console.error('Failed to load tickets:', err);
        showToast(err.message || 'Error loading tickets', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, search, priority, status, overdue, assignedTo, customer, showToast, updateUrlParams]
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchTickets(true);
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [fetchTickets]);

  // Listen to create ticket global event
  useEffect(() => {
    const handleCreated = () => fetchTickets(true);
    window.addEventListener('helpdesk_ticket_created', handleCreated);
    return () => {
      window.removeEventListener('helpdesk_ticket_created', handleCreated);
    };
  }, [fetchTickets]);

  const handleClearFilters = () => {
    setSearch('');
    setPriority('');
    setStatus('');
    setOverdue('');
    setAssignedTo('');
    setCustomer('');
    setPage(1);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasActiveFilters = useMemo(() => {
    return (
      !!search.trim() ||
      priority !== '' ||
      status !== '' ||
      overdue !== '' ||
      assignedTo !== '' ||
      !!customer.trim()
    );
  }, [search, priority, status, overdue, assignedTo, customer]);

  const handleAssignTicket = async (ticketId: number, userId: number | null) => {
    try {
      await api.assignTicket(ticketId, userId);
      showToast(
        userId === null ? `Ticket #${ticketId} unassigned` : `Ticket #${ticketId} assigned`,
        'success'
      );
      fetchTickets(true);
    } catch (err: any) {
      console.error('Assignment failed:', err);
      showToast(err.message || 'Failed updating assignee', 'error');
    }
  };

  return (
    <div id="ticket-queue-page" className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Ticket Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Operational triage dispatch. Ordered by SLA priority and response times.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="queue-refresh-btn"
            onClick={() => fetchTickets(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
            title="Refresh queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            id="queue-create-ticket-btn"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Ticket</span>
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div
        id="queue-filter-bar"
        className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="queue-search-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search title, desc, ID..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
            />
          </div>

          {/* Customer filter */}
          <div>
            <input
              type="text"
              id="queue-customer-filter"
              value={customer}
              onChange={(e) => {
                setCustomer(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by customer name/email..."
              className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-slate-50/50"
            />
          </div>

          {/* Priority filter */}
          <div>
            <select
              id="queue-priority-filter"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value as Priority | '');
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent Priority (2h SLA)</option>
              <option value="high">High Priority (8h SLA)</option>
              <option value="normal">Normal Priority (24h SLA)</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              id="queue-status-filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as TicketStatus | '');
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Secondary filters row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Overdue filter */}
            <select
              id="queue-overdue-filter"
              value={overdue}
              onChange={(e) => {
                setOverdue(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">All SLA States</option>
              <option value="true">Overdue Only</option>
              <option value="false">On Schedule</option>
            </select>

            {/* Assignee filter */}
            <select
              id="queue-assignee-filter"
              value={assignedTo}
              onChange={(e) => {
                setAssignedTo(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">All Assignees</option>
              <option value="null">Unassigned Only</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              type="button"
              id="queue-clear-filters-btn"
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Queue Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-medium">Loading ticket queue...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2.5">
            <Inbox className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-800">No tickets found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'No tickets match the selected filters. Try clearing filters or search terms.'
                : 'The helpdesk ticket queue is currently empty.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-2 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 rounded-md inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset all filters</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <TicketTable
                tickets={tickets}
                usersList={users}
                onSelectTicket={(t) => navigate(`/tickets/${t.id}`)}
                onEditTicket={(t, e) => {
                  e.stopPropagation();
                  setEditingTicket(t);
                }}
                onAssignTicket={handleAssignTicket}
              />
            </div>

            {/* Mobile Stacked List */}
            <div className="md:hidden p-3">
              <TicketCardList
                tickets={tickets}
                usersList={users}
                onSelectTicket={(t) => navigate(`/tickets/${t.id}`)}
                onEditTicket={(t, e) => {
                  e.stopPropagation();
                  setEditingTicket(t);
                }}
                onAssignTicket={handleAssignTicket}
              />
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(ps) => {
                setPageSize(ps);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateTicketModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => fetchTickets(true)}
      />

      <EditTicketModal
        isOpen={!!editingTicket}
        ticket={editingTicket}
        usersList={users}
        onClose={() => setEditingTicket(null)}
        onSuccess={() => fetchTickets(true)}
      />
    </div>
  );
}
