import { useState } from 'react';
import { X, LogIn, Loader2, KeyRound } from 'lucide-react';
import { loginAdmin } from '../api';

interface Props {
  onLogin: (token: string) => void;
  onClose: () => void;
}

export default function LoginModal({ onLogin, onClose }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError(null);
    setIsLoading(true);
    try {
      const token = await loginAdmin(username.trim(), password);
      onLogin(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-600/30 border border-brand-500/40 flex items-center justify-center">
              <KeyRound className="w-3.5 h-3.5 text-brand-400" />
            </div>
            <span className="text-white font-semibold text-sm">Admin Login</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              autoComplete="username"
              autoFocus
              disabled={isLoading}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm
                placeholder-slate-600 outline-none focus:border-brand-500/60 focus:bg-white/8
                transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              autoComplete="current-password"
              disabled={isLoading}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm
                placeholder-slate-600 outline-none focus:border-brand-500/60 focus:bg-white/8
                transition-all disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40
              disabled:cursor-not-allowed text-white font-semibold text-sm transition-all
              flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign in
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
