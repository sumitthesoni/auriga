export type Priority = 'urgent' | 'high' | 'normal';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface Ticket {
  id: number;
  customer_name: string;
  customer_email: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  status: TicketStatus;
  created_at: string;
  due_at: string;
  updated_at: string;
  assigned_to: number | null;
  assignee: User | null;
  overdue: boolean;
}

export interface TicketStats {
  open_tickets: number;
  overdue: number;
  urgent: number;
  unassigned: number;
}

export interface TicketListResponse {
  items: Ticket[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface TicketFilters {
  page?: number;
  page_size?: number;
  priority?: Priority | '';
  status?: TicketStatus | '';
  overdue?: boolean | string;
  assigned_to?: number | string;
  customer?: string;
  search?: string;
}

export interface CreateTicketPayload {
  customer_name: string;
  customer_email?: string | null;
  title: string;
  description?: string | null;
  priority: Priority;
}

export interface UpdateTicketPayload {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TicketStatus;
  assigned_to?: number | null;
}

export interface AssignTicketPayload {
  user_id: number | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface AuthUser {
  email: string;
  name?: string;
}
