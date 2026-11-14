import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const result = await api.get('/auth/me');
      setUser(result.user);
      setAuthError('');
      return result.user;
    } catch (error) {
      setUser(null);
      if (error.status && error.status !== 401) setAuthError(error.message);
      return null;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (values) => {
    setAuthError('');
    const result = await api.post('/auth/login', values);
    setUser(result.user);
    return result.user;
  }, []);
  const register = useCallback(async (values) => {
    setAuthError('');
    const result = await api.post('/auth/register', values);
    setUser(result.user);
    return result.user;
  }, []);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout', {}); }
    finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, loading, authError, login, register, logout, refresh }), [user, loading, authError, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider.');
  return ctx;
}
