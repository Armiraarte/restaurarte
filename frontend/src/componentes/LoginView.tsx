import React, { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, User, UtensilsCrossed } from 'lucide-react';
import { login, Usuario } from '../services/authService';

interface LoginViewProps {
  onLoginSuccess: (usuario: Usuario) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }

    setCargando(true);
    setError(null);
    try {
      const u = await login(usuario, password);
      onLoginSuccess(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex items-center justify-center p-4 font-sans selection:bg-amber-500 selection:text-neutral-950">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm shadow-amber-500/40">
            <UtensilsCrossed className="w-6 h-6 text-neutral-950" />
          </span>
          <span className="text-2xl font-bold tracking-tight text-neutral-900">RESTAURARTE</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xl shadow-black/40 space-y-5"
        >
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Iniciar sesión</h1>
            <p className="text-xs text-neutral-600 mt-0.5">Ingresa con tu usuario del sistema.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="usuario" className="text-xs font-medium text-neutral-700">
              Usuario
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="usuario"
                type="text"
                autoComplete="username"
                autoFocus
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/40 transition-colors select-text"
                placeholder="usuario"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-neutral-700">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type={mostrarPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-9 pr-10 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/40 transition-colors select-text"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-700 cursor-pointer"
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50/60 border border-rose-200/80 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-neutral-950 font-semibold text-sm py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{cargando ? 'Verificando…' : 'Entrar'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
