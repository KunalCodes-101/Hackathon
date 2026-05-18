import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, signin, signup } from './api.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'founderos-token';
const USER_KEY = 'founderos-user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setChecking(false);
      localStorage.removeItem(USER_KEY);
      return;
    }
    let mounted = true;
    setChecking(true);
    getMe()
      .then((nextUser) => {
        if (!mounted) return;
        setUser(nextUser);
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      })
      .catch(() => {
        if (!mounted) return;
        setToken('');
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function signIn(credentials) {
    const result = await signin(credentials);
    setToken(result.token);
    setUser(result.user);
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    return result.user;
  }

  async function signUp(payload) {
    const result = await signup(payload);
    setToken(result.token);
    setUser(result.user);
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    return result.user;
  }

  function signOut() {
    setToken('');
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  const value = useMemo(() => ({ checking, token, user, signIn, signUp, signOut }), [checking, token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
