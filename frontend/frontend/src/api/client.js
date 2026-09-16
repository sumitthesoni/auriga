/**
 * Reusable API Client for Helpdesk Ticket Management System
 */

const TOKEN_KEY = 'helpdesk_access_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('helpdesk_user_email');
}

export function getApiBaseUrl() {
  const custom = localStorage.getItem('helpdesk_api_base_url');
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, '');
  }
  const envUrl = import.meta.env?.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

/**
 * Universal apiRequest helper
 */
export async function apiRequest(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const baseUrl = getApiBaseUrl();
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    throw new Error(`Backend server at ${baseUrl} is unreachable. Please ensure the FastAPI server is running.`);
  }

  if (response.status === 401) {
    clearStoredToken();
    sessionStorage.setItem('helpdesk_session_expired', 'Your session has expired. Please sign in again.');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized: Session expired');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      (typeof data?.detail === 'string' && data.detail) ||
      (Array.isArray(data?.detail) && data.detail.map((d) => d.msg || d).join(', ')) ||
      data?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  health: () => apiRequest('/api/health'),

  login: (email) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  getUsers: () => apiRequest('/api/users'),

  getStats: () => apiRequest('/api/tickets/stats'),

  getTickets: (filters = {}) => {
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
    return apiRequest(query ? `/api/tickets?${query}` : '/api/tickets');
  },

  getTicket: (id) => apiRequest(`/api/tickets/${id}`),

  createTicket: (payload) =>
    apiRequest('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTicket: (id, payload) =>
    apiRequest(`/api/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  assignTicket: (id, userId) =>
    apiRequest(`/api/tickets/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
};
