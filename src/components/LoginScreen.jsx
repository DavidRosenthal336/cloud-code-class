import { useState } from 'react';
import Logo from './Logo.jsx';

export default function LoginScreen({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      onAuthenticated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <form
          onSubmit={onSubmit}
          className="bg-white rounded-md shadow-2xl px-8 pt-10 pb-8 space-y-6"
        >
          <div className="text-center">
            <Logo className="h-16 w-auto mx-auto" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mt-4">
              Deal Underwriting
            </p>
          </div>
          <div className="border-t border-slate-100" />
          <div>
            <label className="rvc-label">Access Password</label>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rvc-input"
              placeholder="Enter password"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-md">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="rvc-btn-primary w-full"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <p className="text-xs text-slate-500 text-center pt-2 border-t border-slate-100">
            Internal use only. Confidential.
          </p>
        </form>
      </div>
    </div>
  );
}
