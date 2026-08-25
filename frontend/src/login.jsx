import { useState } from 'react';

const API = 'http://localhost:8000';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) return;
    setBusy(true);
    setError('');
    try {
      let res, data;
      if (mode === 'register') {
        res = await fetch(`${API}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      } else {
        const form = new URLSearchParams();
        form.append('username', email);
        form.append('password', password);
        res = await fetch(`${API}/login`, { method: 'POST', body: form });
      }
      data = await res.json();
      if (!res.ok) setError(data.detail || 'Something went wrong');
      else onAuth(data.access_token, data.email);
    } catch {
      setError('Cannot reach the server.');
    }
    setBusy(false);
  };

  return (
    <div style={L.wrap}>
      <div style={L.card}>
        <h1 style={L.title}>Equity Research</h1>
        <p style={L.sub}>{mode === 'login' ? 'Sign in to your workspace' : 'Create an account'}</p>

        <input
          style={L.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <input
          style={L.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {error && <div style={L.error}>{error}</div>}

        <button style={L.primary} onClick={submit} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button style={L.switch} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'No account? Register' : 'Already registered? Sign in'}
        </button>
      </div>
    </div>
  );
}

const L = {
  wrap: {
    height: '100vh', display: 'grid', placeItems: 'center',
    background: '#262624',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: 360, display: 'flex', flexDirection: 'column', gap: 14, padding: 36,
    background: '#2d2d2b', border: '1px solid #40403d', borderRadius: 16,
  },
  title: {
    fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, margin: 0, color: '#f5f4ef',
  },
  sub: { fontSize: 14, color: '#b0aea6', margin: '0 0 10px' },
  input: {
    padding: '12px 14px',
    border: '1px solid #4a4a46',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    color: '#f5f4ef',
    background: '#3a3a37',
    caretColor: '#f5f4ef',
  },
  error: { fontSize: 13, color: '#e5877a' },
  primary: {
    padding: '12px', background: '#da7756', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4,
  },
  switch: {
    background: 'none', border: 'none', color: '#b0aea6', fontSize: 13,
    cursor: 'pointer', marginTop: 4,
  },
};