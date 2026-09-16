import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  LogOut,
  Menu,
  X,
  LifeBuoy,
  Wifi,
  WifiOff,
  Settings,
  Server,
  RefreshCw,
} from 'lucide-react';
import { CreateTicketModal } from './CreateTicketModal';
import {
  getApiBaseUrl,
  setApiBaseUrl,
  isSimulatorForced,
  setSimulatorForced,
  subscribeBackendState,
  BackendConnectionState,
} from '../api/client';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [backendState, setBackendState] = useState<BackendConnectionState>('checking');

  // Backend settings config
  const [tempApiUrl, setTempApiUrl] = useState(getApiBaseUrl());
  const [tempForcedSim, setTempForcedSim] = useState(isSimulatorForced());

  useEffect(() => {
    return subscribeBackendState((state) => {
      setBackendState(state);
    });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setApiBaseUrl(tempApiUrl);
    setSimulatorForced(tempForcedSim);
    setSettingsModalOpen(false);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100/70 text-slate-800">
      {/* Mobile top bar */}
      <div className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 z-30 sticky top-0">
        <div className="flex items-center gap-2 font-bold tracking-tight text-base">
          <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white">
            <LifeBuoy className="w-4 h-4" />
          </div>
          <span>Helpdesk</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="mobile-quick-create-btn"
            onClick={() => setCreateModalOpen(true)}
            className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
            aria-label="New ticket"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside
        id="app-sidebar"
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col justify-between z-40 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header & Brand */}
        <div>
          <div className="px-5 py-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-white text-base leading-tight tracking-tight">
                  Helpdesk
                </h1>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                  Operations Console
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Create Action Button */}
          <div className="p-4">
            <button
              type="button"
              id="sidebar-create-ticket-btn"
              onClick={() => {
                setCreateModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Ticket</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1" aria-label="Sidebar Navigation">
            <NavLink
              to="/dashboard"
              id="nav-dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4 text-blue-400" />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/tickets"
              id="nav-tickets"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive || location.pathname.startsWith('/tickets/')
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <Ticket className="w-4 h-4 text-amber-400" />
              <span>Ticket Queue</span>
            </NavLink>
          </nav>
        </div>

        {/* Sidebar Footer: User profile, Backend status & Logout */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Backend Connection Pill */}
          <button
            type="button"
            id="backend-status-indicator"
            onClick={() => setSettingsModalOpen(true)}
            className="w-full p-2 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left text-xs transition-colors flex items-center justify-between group"
            title="Configure Backend API URL and connection mode"
          >
            <div className="flex items-center gap-2 truncate">
              {backendState === 'connected' ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : backendState === 'simulator' ? (
                <Server className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="truncate text-slate-300 font-mono text-[11px]">
                {backendState === 'connected'
                  ? 'FastAPI Connected'
                  : backendState === 'simulator'
                  ? 'Sandbox Simulator'
                  : 'Backend Offline'}
              </span>
            </div>
            <Settings className="w-3 h-3 text-slate-400 group-hover:text-slate-200 shrink-0" />
          </button>

          {/* User Account Info */}
          <div className="p-2 rounded bg-slate-800/40 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="truncate flex-1">
              <div className="text-xs font-medium text-slate-200 truncate" title={user?.email}>
                {user?.email || 'Helpdesk Agent'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">Operator</div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            id="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main id="main-content-area" className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Offline notice bar if backend unreachable and running in simulator */}
        {backendState === 'unreachable' && (
          <div
            id="backend-offline-banner"
            className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-medium flex items-center justify-between gap-3 border-b border-amber-600"
          >
            <div className="flex items-center gap-2 truncate">
              <Server className="w-4 h-4 shrink-0" />
              <span>
                Backend on <strong>{getApiBaseUrl()}</strong> is offline. Running interactive sandbox mode for instant full testing.
              </span>
            </div>
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="underline hover:no-underline font-semibold shrink-0 cursor-pointer"
            >
              Configure API
            </button>
          </div>
        )}

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Create Ticket Modal */}
      <CreateTicketModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(ticketId) => {
          // Trigger custom refresh event for listening pages
          window.dispatchEvent(new CustomEvent('helpdesk_ticket_created', { detail: ticketId }));
        }}
      />

      {/* Backend Settings Dialog */}
      {settingsModalOpen && (
        <div
          id="settings-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div
            id="settings-modal"
            className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
            role="dialog"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-600" />
                <span>Backend API Configuration</span>
              </h3>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  FastAPI Backend URL
                </label>
                <input
                  type="text"
                  value={tempApiUrl}
                  onChange={(e) => setTempApiUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 font-mono"
                />
                <p className="text-slate-400 mt-1">
                  Default: <code className="text-slate-600">http://localhost:8000</code>
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempForcedSim}
                    onChange={(e) => setTempForcedSim(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Always use Sandbox Simulator Mode</span>
                </label>
                <p className="text-slate-500 text-[11px] leading-normal pl-6">
                  Allows full testing of ticket queues, assignment, SLA calculation, and search even when no backend is running locally.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('helpdesk_mock_tickets');
                    localStorage.removeItem('helpdesk_mock_users');
                    window.location.reload();
                  }}
                  className="text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Mock Data</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsModalOpen(false)}
                    className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
                  >
                    Apply & Reload
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
