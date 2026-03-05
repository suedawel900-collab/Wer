import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();
const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('bingo_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(u => { if (!u.error) setUser(u); else logout(); })
        .catch(logout).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const r = await fetch(`${API}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    localStorage.setItem('bingo_token', data.token);
    setToken(data.token); setUser(data.user);
    return data;
  };

  const register = async (username, email, password) => {
    const r = await fetch(`${API}/api/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    localStorage.setItem('bingo_token', data.token);
    setToken(data.token); setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('bingo_token');
    setToken(null); setUser(null); setLoading(false);
  };

  const refreshUser = async () => {
    if (!token) return;
    const r = await fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
    const u = await r.json();
    if (!u.error) setUser(u);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading, refreshUser, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
