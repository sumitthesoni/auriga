import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getStoredToken, setStoredToken, clearStoredToken } from '../api/client';
import { AuthUser } from '../types';

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpiredMessage: string | null;
  clearSessionExpiredMessage: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_EMAIL_KEY = 'helpdesk_user_email';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const restoreSession = useCallback(() => {
    try {
      const storedToken = getStoredToken();
      const storedEmail = localStorage.getItem(USER_EMAIL_KEY);
      const expiredMsg = sessionStorage.getItem('helpdesk_session_expired');

      if (expiredMsg) {
        setSessionExpiredMessage(expiredMsg);
        sessionStorage.removeItem('helpdesk_session_expired');
      }

      if (storedToken && storedEmail) {
        setToken(storedToken);
        setUser({ email: storedEmail });
      } else {
        setToken(null);
        setUser(null);
      }
    } catch (e) {
      console.error('Failed restoring auth session:', e);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const clearSessionExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null);
  }, []);

  const login = async (email: string, password: string) => {
    const trimmed = email.trim();
    if (!trimmed) {
      throw new Error('Email address cannot be empty.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password) {
      throw new Error('Password cannot be empty.');
    }

    const response = await api.login(trimmed, password);
    if (!response.access_token) {
      throw new Error('Login failed: no access token returned.');
    }

    setStoredToken(response.access_token);
    localStorage.setItem(USER_EMAIL_KEY, trimmed);

    setToken(response.access_token);
    setUser({ email: trimmed });
    setSessionExpiredMessage(null);
  };

  const logout = () => {
    clearStoredToken();
    localStorage.removeItem(USER_EMAIL_KEY);
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    token,
    user,
    isAuthenticated: !!token,
    isLoading,
    sessionExpiredMessage,
    clearSessionExpiredMessage,
    login,
    logout,
    restoreSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
