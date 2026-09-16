import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  LogOut,
  Menu,
  X,
  LifeBuoy,
  Server,
} from 'lucide-react';
import { CreateTicketModal } from './CreateTicketModal.jsx';
import { getApiBaseUrl } from '../api/client.js';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
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

        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Backend Info Pill */}
          <div className="p-2 rounded bg-slate-800/60 border border-slate-700/60 text-xs flex items-center gap-2 truncate">
            <Server className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate text-slate-300 font-mono text-[11px]">
              {getApiBaseUrl()}
            </span>
          </div>

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
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Create Ticket Modal */}
      <CreateTicketModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(ticketId) => {
          window.dispatchEvent(new CustomEvent('helpdesk_ticket_created', { detail: ticketId }));
        }}
      />
    </div>
  );
}
