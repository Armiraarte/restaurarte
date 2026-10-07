import React from 'react';
import { LogOut, Settings, UtensilsCrossed } from 'lucide-react';
import { Usuario } from '../services/authService';

interface HeaderProps {
  usuario: Usuario;
  onLogout: () => void;
  /** Abre el módulo de configuración (el botón solo se muestra a administradores). */
  onOpenConfig?: () => void;
  configActiva?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ usuario, onLogout, onOpenConfig, configActiva = false }) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 text-neutral-900">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center shadow-sm shadow-amber-500/40">
            <UtensilsCrossed className="w-5 h-5 text-neutral-950" />
          </span>
          <span className="text-lg font-bold tracking-tight">RESTAURARTE</span>
        </div>

        {/* Usuario en sesión */}
        <div className="flex items-center gap-2">
          <div className="text-right text-xs leading-tight">
            <div className="text-neutral-800 font-medium truncate max-w-[140px]">{usuario.nombre}</div>
            <div className="text-neutral-500 font-mono text-[10px] uppercase">{usuario.rol}</div>
          </div>
          {usuario.rol === 'admin' && onOpenConfig && (
            <button
              onClick={onOpenConfig}
              className={`p-2 border rounded-lg transition-colors cursor-pointer ${
                configActiva
                  ? 'bg-neutral-900 border-neutral-900 text-white'
                  : 'bg-white border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
              }`}
              title="Configuración"
              aria-label="Configuración"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onLogout}
            className="p-2 text-neutral-500 hover:text-rose-700 bg-white border border-neutral-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
