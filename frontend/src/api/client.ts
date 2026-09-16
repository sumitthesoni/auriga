import {
  AuthResponse,
  CreateTicketPayload,
  Ticket,
  TicketFilters,
  TicketListResponse,
  TicketStats,
  UpdateTicketPayload,
  User,
} from '../types';
import { localSimulator } from './localSimulator';

const TOKEN_KEY = 'helpdesk_access_token';
const API_URL_KEY = 'helpdesk_api_base_url';
const SIMULATOR_KEY = 'helpdesk_use_simulator';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('helpdesk_user_email');
}

export function getApiBaseUrl(): string {
  const custom = localStorage.getItem(API_URL_KEY);
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, '');
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

export function setApiBaseUrl(url: string) {
  if (!url || !url.trim()) {
    localStorage.removeItem(API_URL_KEY);
  } else {
    localStorage.setItem(API_URL_KEY, url.trim().replace(/\/+$/, ''));
  }
  window.dispatchEvent(new Event('helpdesk_api_config_change'));
}

export function isSimulatorForced(): boolean {
  return localStorage.getItem(SIMULATOR_KEY) === 'true';
}

export function setSimulatorForced(val: boolean) {
  localStorage.setItem(SIMULATOR_KEY, val ? 'true' : 'false');
  window.dispatchEvent(new Event('helpdesk_api_config_change'));
}

export type BackendConnectionState = 'connected' | 'unreachable' | 'simulator' | 'checking';

let currentBackendState: BackendConnectionState = 'checking';
const stateListeners = new Set<(state: BackendConnectionState) => void>();

export function subscribeBackendState(listener: (state: BackendConnectionState) => void) {
  stateListeners.add(listener);
  listener(currentBackendState);
  return () => {
    stateListeners.delete(listener);
  };
}

function updateBackendState(newState: BackendConnectionState) {
  if (currentBackendState !== newState) {
    currentBackendState = newState;
    stateListeners.forEach((fn) => fn(newState));
  }
}

/**
 * Main API request execution helper
 */
async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {},
  allowSimulatorFallback = true
): Promise<T> {
  const forcedSimulator = isSimulatorForced();
  if (forcedSimulator) {
    updateBackendState('simulator');
    return handleSimulatorRoute<T>(path, options);
  }

  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Global 401 handling
    if (response.status === 401) {
      clearStoredToken();
      sessionStorage.setItem(
        'helpdesk_session_expired',
        'Your session has expired or the token is invalid. Please sign in again.'
      );
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized: Session expired or invalid token');
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg =
        (typeof data?.detail === 'string' && data.detail) ||
        (Array.isArray(data?.detail) && data.detail.map((d: any) => d.msg || d).join(', ')) ||
        data?.message ||
        `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    updateBackendState('connected');
    return data as T;
  } catch (error: any) {
    const isNetworkError =
      error?.name === 'AbortError' ||
      error?.message === 'Failed to fetch' ||
      error?.message?.includes('NetworkError') ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('Load failed');

    if (isNetworkError) {
      console.warn(`[Helpdesk API] Live backend at ${baseUrl} is unreachable.`);
      updateBackendState('unreachable');

      if (allowSimulatorFallback) {
        console.info('[Helpdesk API] Falling back to local interactive simulator for seamless operation.');
        return handleSimulatorRoute<T>(path, options);
      }
      throw new Error(
        `Backend server at ${baseUrl} is unavailable. Please make sure your FastAPI service is running.`
      );
    }

    throw error;
  }
}

/**
 * Routes requests to local simulator when backend is offline or sandbox mode is active
 */
function handleSimulatorRoute<T>(path: string, options: RequestInit = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    // Add artificial micro-latency (60ms) for realistic UX feel
    setTimeout(() => {
      try {
        const [cleanPath, queryString] = path.split('?');
        const queryParams = new URLSearchParams(queryString || '');
        const method = (options.method || 'GET').toUpperCase();
        const body = options.body ? JSON.parse(options.body as string) : {};

        // 1. Health
        if (cleanPath === '/api/health') {
          return resolve(localSimulator.health() as unknown as T);
        }

        // 2. Auth Login
        if (cleanPath === '/api/auth/login' && method === 'POST') {
          return resolve(localSimulator.login(body.email) as unknown as T);
        }

        // 3. Get Users
        if (cleanPath === '/api/users' && method === 'GET') {
          return resolve(localSimulator.getUsers() as unknown as T);
        }

        // 4. Get Tickets Stats
        if (cleanPath === '/api/tickets/stats' && method === 'GET') {
          return resolve(localSimulator.getStats() as unknown as T);
        }

        // 5. Assign Ticket: /api/tickets/:id/assign
        const assignMatch = cleanPath.match(/^\/api\/tickets\/(\d+)\/assign$/);
        if (assignMatch && method === 'POST') {
          const ticketId = parseInt(assignMatch[1], 10);
          return resolve(localSimulator.assignTicket(ticketId, body.user_id) as unknown as T);
        }

        // 6. Single Ticket: /api/tickets/:id
        const singleTicketMatch = cleanPath.match(/^\/api\/tickets\/(\d+)$/);
        if (singleTicketMatch) {
          const ticketId = parseInt(singleTicketMatch[1], 10);
          if (method === 'GET') {
            return resolve(localSimulator.getTicket(ticketId) as unknown as T);
          }
          if (method === 'PATCH') {
            return resolve(localSimulator.updateTicket(ticketId, body) as unknown as T);
          }
        }

        // 7. Tickets Collection: /api/tickets
        if (cleanPath === '/api/tickets') {
          if (method === 'GET') {
            const filters: TicketFilters = {
              page: queryParams.has('page') ? Number(queryParams.get('page')) : undefined,
              page_size: queryParams.has('page_size') ? Number(queryParams.get('page_size')) : undefined,
              priority: (queryParams.get('priority') as any) || undefined,
              status: (queryParams.get('status') as any) || undefined,
              overdue: queryParams.has('overdue') ? queryParams.get('overdue') === 'true' : undefined,
              assigned_to: queryParams.has('assigned_to') ? queryParams.get('assigned_to')! : undefined,
              customer: queryParams.get('customer') || undefined,
              search: queryParams.get('search') || undefined,
            };
            return resolve(localSimulator.getTickets(filters) as unknown as T);
          }

          if (method === 'POST') {
            return resolve(localSimulator.createTicket(body) as unknown as T);
          }
        }

        reject(new Error(`Unhandled route: ${method} ${path}`));
      } catch (err) {
        reject(err);
      }
    }, 60);
  });
}

/**
 * Exported API operations matching FastAPI endpoints exactly
 */
export const api = {
  health: () => apiRequest<{ status: string }>('/api/health'),

  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getUsers: () => apiRequest<User[]>('/api/users'),

  getStats: () => apiRequest<TicketStats>('/api/tickets/stats'),

  getTickets: (filters: TicketFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', String(filters.page));
    if (filters.page_size) params.append('page_size', String(filters.page_size));
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.status) params.append('status', filters.status);
    if (filters.overdue !== undefined && filters.overdue !== '') {
      params.append('overdue', String(filters.overdue));
    }
    if (filters.assigned_to !== undefined && filters.assigned_to !== '') {
      params.append('assigned_to', String(filters.assigned_to));
    }
    if (filters.customer && filters.customer.trim()) {
      params.append('customer', filters.customer.trim());
    }
    if (filters.search && filters.search.trim()) {
      params.append('search', filters.search.trim());
    }

    const query = params.toString();
    const endpoint = query ? `/api/tickets?${query}` : '/api/tickets';
    return apiRequest<TicketListResponse>(endpoint);
  },

  getTicket: (id: number) => apiRequest<Ticket>(`/api/tickets/${id}`),

  createTicket: (payload: CreateTicketPayload) =>
    apiRequest<Ticket>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTicket: (id: number, payload: UpdateTicketPayload) =>
    apiRequest<Ticket>(`/api/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  assignTicket: (id: number, userId: number | null) =>
    apiRequest<Ticket>(`/api/tickets/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  resetDemoData: () => {
    localSimulator.resetData();
  },
};
