import {
  Ticket,
  User,
  TicketStats,
  TicketListResponse,
  TicketFilters,
  CreateTicketPayload,
  UpdateTicketPayload,
} from '../types';
import { INITIAL_TICKETS, INITIAL_USERS } from './mockData';

const TICKETS_STORAGE_KEY = 'helpdesk_mock_tickets';
const USERS_STORAGE_KEY = 'helpdesk_mock_users';

function getStoredTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(TICKETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return recomputeOverdue(parsed);
      }
    }
  } catch (e) {
    console.error('Error reading stored tickets:', e);
  }
  const initialized = recomputeOverdue([...INITIAL_TICKETS]);
  saveStoredTickets(initialized);
  return initialized;
}

function saveStoredTickets(tickets: Ticket[]) {
  try {
    localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
  } catch (e) {
    console.error('Error saving tickets:', e);
  }
}

export function getStoredUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading stored users:', e);
  }
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_USERS));
  } catch {}
  return [...INITIAL_USERS];
}

function recomputeOverdue(tickets: Ticket[]): Ticket[] {
  const now = new Date();
  return tickets.map((t) => {
    const isResolvedOrClosed = t.status === 'resolved' || t.status === 'closed';
    const isOverdue = !isResolvedOrClosed && new Date(t.due_at) < now;
    return {
      ...t,
      overdue: isOverdue,
    };
  });
}

/**
 * Backend sorting order required by spec:
 * 1. Overdue tickets first
 * 2. Urgent tickets before high before normal tickets
 * 3. Earlier due_at first
 * 4. Older created_at first
 * 5. Lower ticket ID first
 */
function sortTicketsBackendOrder(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    // 1. Overdue tickets first
    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }
    // 2. Urgent tickets before normal tickets
    if (a.priority !== b.priority) {
      const rank = { urgent: 0, high: 1, normal: 2 };
      return rank[a.priority] - rank[b.priority];
    }
    // 3. Earlier due_at first
    const dueA = new Date(a.due_at).getTime();
    const dueB = new Date(b.due_at).getTime();
    if (dueA !== dueB) {
      return dueA - dueB;
    }
    // 4. Older created_at first (earlier created_at first)
    const createdA = new Date(a.created_at).getTime();
    const createdB = new Date(b.created_at).getTime();
    if (createdA !== createdB) {
      return createdA - createdB;
    }
    // 5. Lower ticket ID first
    return a.id - b.id;
  });
}

export const localSimulator = {
  health(): { status: string } {
    return { status: 'ok' };
  },

  login(email: string): { access_token: string; token_type: string } {
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }
    const token = `sim_jwt_${btoa(email.trim().toLowerCase())}_${Date.now()}`;
    return {
      access_token: token,
      token_type: 'bearer',
    };
  },

  getUsers(): User[] {
    return getStoredUsers();
  },

  getTickets(filters: TicketFilters = {}): TicketListResponse {
    let tickets = getStoredTickets();
    const users = getStoredUsers();

    // Ensure assignee objects match user list
    tickets = tickets.map((t) => {
      const assignee = t.assigned_to ? users.find((u) => u.id === t.assigned_to) || null : null;
      return { ...t, assignee };
    });

    // Filtering
    if (filters.priority) {
      tickets = tickets.filter((t) => t.priority === filters.priority);
    }

    if (filters.status) {
      tickets = tickets.filter((t) => t.status === filters.status);
    }

    if (filters.overdue !== undefined && filters.overdue !== '') {
      const boolOverdue = filters.overdue === true || filters.overdue === 'true';
      tickets = tickets.filter((t) => t.overdue === boolOverdue);
    }

    if (filters.assigned_to !== undefined && filters.assigned_to !== '') {
      if (filters.assigned_to === 'null' || filters.assigned_to === null) {
        tickets = tickets.filter((t) => t.assigned_to === null);
      } else {
        const uid = Number(filters.assigned_to);
        tickets = tickets.filter((t) => t.assigned_to === uid);
      }
    }

    if (filters.customer && filters.customer.trim()) {
      const query = filters.customer.toLowerCase().trim();
      tickets = tickets.filter(
        (t) =>
          t.customer_name.toLowerCase().includes(query) ||
          (t.customer_email && t.customer_email.toLowerCase().includes(query))
      );
    }

    if (filters.search && filters.search.trim()) {
      const query = filters.search.toLowerCase().trim();
      tickets = tickets.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.description && t.description.toLowerCase().includes(query)) ||
          t.customer_name.toLowerCase().includes(query) ||
          String(t.id).includes(query)
      );
    }

    // Sort according to backend order specification
    const sorted = sortTicketsBackendOrder(tickets);

    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.max(1, Number(filters.page_size) || 20);
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const startIndex = (page - 1) * pageSize;
    const items = sorted.slice(startIndex, startIndex + pageSize);

    return {
      items,
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
    };
  },

  getTicket(id: number): Ticket {
    const tickets = getStoredTickets();
    const users = getStoredUsers();
    const ticket = tickets.find((t) => t.id === Number(id));
    if (!ticket) {
      throw new Error(`Ticket with ID ${id} not found`);
    }
    const assignee = ticket.assigned_to ? users.find((u) => u.id === ticket.assigned_to) || null : null;
    return { ...ticket, assignee };
  },

  createTicket(payload: CreateTicketPayload): Ticket {
    if (!payload.customer_name || !payload.customer_name.trim()) {
      throw new Error('Customer name cannot be blank.');
    }
    if (!payload.title || !payload.title.trim()) {
      throw new Error('Title cannot be blank.');
    }
    if (payload.priority !== 'urgent' && payload.priority !== 'high' && payload.priority !== 'normal') {
      throw new Error('Priority must be urgent, high, or normal.');
    }
    if (payload.customer_email && payload.customer_email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(payload.customer_email.trim())) {
        throw new Error('Customer email must be valid if provided.');
      }
    }

    const tickets = getStoredTickets();
    const maxId = tickets.reduce((max, t) => Math.max(max, t.id), 0);
    const newId = maxId + 1;

    const now = new Date();
    // Urgent SLA: 2 hours, High SLA: 8 hours, Normal SLA: 24 hours
    const slaHours = payload.priority === 'urgent' ? 2 : payload.priority === 'high' ? 8 : 24;
    const dueTime = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

    const newTicket: Ticket = {
      id: newId,
      customer_name: payload.customer_name.trim(),
      customer_email: payload.customer_email?.trim() || null,
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      priority: payload.priority,
      status: 'open',
      created_at: now.toISOString(),
      due_at: dueTime.toISOString(),
      updated_at: now.toISOString(),
      assigned_to: null,
      assignee: null,
      overdue: false,
    };

    tickets.push(newTicket);
    saveStoredTickets(tickets);
    return newTicket;
  },

  updateTicket(id: number, payload: UpdateTicketPayload): Ticket {
    const tickets = getStoredTickets();
    const users = getStoredUsers();
    const index = tickets.findIndex((t) => t.id === Number(id));
    if (index === -1) {
      throw new Error(`Ticket with ID ${id} not found`);
    }

    const current = tickets[index];
    const now = new Date();

    let updatedPriority = payload.priority !== undefined ? payload.priority : current.priority;
    let dueAt = current.due_at;

    // If priority changed, recompute SLA from created_at
    if (payload.priority && payload.priority !== current.priority) {
      const slaHours = payload.priority === 'urgent' ? 2 : payload.priority === 'high' ? 8 : 24;
      const created = new Date(current.created_at);
      dueAt = new Date(created.getTime() + slaHours * 60 * 60 * 1000).toISOString();
    }

    const updatedStatus = payload.status !== undefined ? payload.status : current.status;
    const updatedAssignedTo = payload.assigned_to !== undefined ? payload.assigned_to : current.assigned_to;
    const assignee = updatedAssignedTo ? users.find((u) => u.id === updatedAssignedTo) || null : null;

    const isResolvedOrClosed = updatedStatus === 'resolved' || updatedStatus === 'closed';
    const isOverdue = !isResolvedOrClosed && new Date(dueAt) < now;

    const updated: Ticket = {
      ...current,
      title: payload.title !== undefined ? payload.title.trim() : current.title,
      description: payload.description !== undefined ? (payload.description ? payload.description.trim() : null) : current.description,
      priority: updatedPriority,
      status: updatedStatus,
      assigned_to: updatedAssignedTo,
      assignee,
      due_at: dueAt,
      updated_at: now.toISOString(),
      overdue: isOverdue,
    };

    tickets[index] = updated;
    saveStoredTickets(tickets);
    return updated;
  },

  assignTicket(id: number, userId: number | null): Ticket {
    return this.updateTicket(id, { assigned_to: userId });
  },

  getStats(): TicketStats {
    const tickets = recomputeOverdue(getStoredTickets());

    const openCount = tickets.filter(
      (t) => t.status === 'open' || t.status === 'in_progress'
    ).length;

    const overdueCount = tickets.filter(
      (t) => t.overdue && t.status !== 'resolved' && t.status !== 'closed'
    ).length;

    const urgentCount = tickets.filter(
      (t) => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed'
    ).length;

    const unassignedCount = tickets.filter(
      (t) => t.assigned_to === null && t.status !== 'resolved' && t.status !== 'closed'
    ).length;

    return {
      open_tickets: openCount,
      overdue: overdueCount,
      urgent: urgentCount,
      unassigned: unassignedCount,
    };
  },

  resetData() {
    localStorage.removeItem(TICKETS_STORAGE_KEY);
    localStorage.removeItem(USERS_STORAGE_KEY);
    getStoredTickets();
    getStoredUsers();
  },
};
