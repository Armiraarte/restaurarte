import React from 'react';
import { LogOut, Settings } from 'lucide-react';
import { Usuario } from '../services/authService';
import { IndicadorTurno } from './IndicadorTurno';
import { IndicadorImpresora } from './MonitorImpresora';

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
      {/* Tres columnas: logo a la izquierda, turno al centro y usuario a la derecha */}
      <div className="px-4 lg:px-8 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Logo de la cenaduría (public/images/icono-160.png) */}
        <div className="flex items-center gap-2.5 justify-self-start min-w-0">
          <img
            src="/images/icono-160.png"
            alt="Cenaduría Los Diablitos"
            className="w-11 h-11 shrink-0 rounded-full bg-white ring-2 ring-red-800/80 object-contain"
          />
          <div className="leading-none min-w-0">
            <div className="text-[10px] font-extrabold tracking-[0.2em] text-red-500">CENADURÍA</div>
            <div className="text-lg font-black tracking-tight text-red-800 truncate">LOS DIABLITOS</div>
          </div>
        </div>

        {/* Turno de caja abierto (BD: turnos), al centro */}
        <IndicadorTurno className="hidden sm:inline-flex justify-self-center" />

        {/* Usuario en sesión (y, solo para el usuario autorizado, el monitor de la computadora de las impresoras) */}
        <div className="flex items-center gap-2 justify-self-end col-start-3">
          <IndicadorImpresora usuario={usuario} />
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
            className="p-2 text-white bg-red-600 hover:bg-red-700 border border-red-700 rounded-lg transition-colors cursor-pointer"
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
