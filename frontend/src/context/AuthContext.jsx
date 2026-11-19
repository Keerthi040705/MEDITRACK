import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Api, setAuthToken, setUnauthorizedHandler } from '../api/client';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);
const STORAGE_KEY = 'meditrack_session';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* storage unavailable */ }
}

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const [session, setSession] = useState(() => {
    const s = loadSession();
    setAuthToken(s?.token);
    return s;
  });

  const applySession = useCallback((s) => {
    setAuthToken(s?.token);
    saveSession(s);
    setSession(s);
  }, []);

  const logout = useCallback((message) => {
    applySession(null);
    if (message) showToast(message, 'error');
  }, [applySession, showToast]);

  // Expired / invalid token anywhere -> back to login
  useEffect(() => {
    setUnauthorizedHandler((msg) => logout(msg || 'Session expired. Please sign in again.'));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Re-validate a stored session once on page load
  useEffect(() => {
    if (!session?.token) return;
    Api.me()
      .then((user) => applySession({ token: session.token, user }))
      .catch(() => { /* 401 handled above; network errors keep the session */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (userId, password, role) => {
    const res = await Api.login(userId, password, role);
    applySession(res);
    return res.user;
  }, [applySession]);

  const register = useCallback(async (data) => {
    const res = await Api.register(data);
    applySession(res);
    return res.user;
  }, [applySession]);

  const updateUser = useCallback((user) => {
    setSession((s) => {
      const next = { ...s, user: { ...s.user, ...user } };
      saveSession(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user: session?.user || null, token: session?.token || null, login, register, logout, updateUser }),
    [session, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
