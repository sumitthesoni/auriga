import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, getApiBaseUrl } from '../api/client.js';
import {
  LifeBuoy,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Server,
  ShieldCheck,
} from 'lucide-react';

export function LoginPage() {
  const { login, isAuthenticated, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('priya.patel@helpdesk.example.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendHealth, setBackendHealth] = useState('checking');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    let active = true;
    api
      .health()
      .then((res) => {
        if (active && res?.status === 'ok') {
          setBackendHealth('healthy');
        }
      })
      .catch(() => {
        if (active) {
          setBackendHealth('unreachable');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    setError(null);
    clearSessionExpiredMessage();

    try {
      setLoading(true);
      await login(trimmed);
      showToast(`Welcome back, ${trimmed}`, 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
      showToast(err.message || 'Failed to authenticate', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sampleStaff = [
    { name: 'Priya Patel', email: 'priya.patel@helpdesk.example.com' },
    { name: 'Marcus Chen', email: 'marcus.chen@helpdesk.example.com' },
    { name: 'Sarah Miller', email: 'sarah.miller@helpdesk.example.com' },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-100 text-slate-800">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-md mb-3">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Helpdesk Ticket System
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Internal Support Operations Console
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200/80 p-6 sm:p-8">
          {sessionExpiredMessage && (
            <div
              id="session-expired-banner"
              className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{sessionExpiredMessage}</div>
            </div>
          )}

          {error && (
            <div
              id="login-error-banner"
              className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-email-input"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email-input"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="operator@helpdesk.example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-medium text-slate-900"
                />
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
                Quick Sign-in as:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {sampleStaff.map((staff) => (
                  <button
                    key={staff.email}
                    type="button"
                    onClick={() => {
                      setEmail(staff.email);
                      setError(null);
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                      email === staff.email
                        ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {staff.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono">{getApiBaseUrl()}</span>
            </div>
            <div className="flex items-center gap-1">
              {backendHealth === 'healthy' ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Online
                </span>
              ) : backendHealth === 'checking' ? (
                <span className="text-slate-400">Verifying...</span>
              ) : (
                <span className="text-slate-500 font-medium">
                  Port 8000
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <span>FastAPI Bearer Authentication with Local Token Persistence</span>
        </div>
      </div>
    </div>
  );
}
