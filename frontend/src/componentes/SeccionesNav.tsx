// Menú de secciones de la caja.
//   Pantallas grandes (lg): barra lateral a la izquierda; se puede contraer a solo íconos (se recuerda en esta PC).
//   Pantallas angostas: barra horizontal bajo el encabezado.
import React, { useState } from 'react';
import { ChefHat, Clock, Home, LayoutGrid, PackageX, PanelLeftClose, PanelLeftOpen, Receipt, Tablet, TrendingUp, LucideIcon } from 'lucide-react';

export type MainNavTab = 'inicio' | 'tablets' | 'cajas' | 'ventas' | 'mesas' | 'turnos' | 'agotados' | 'cocina';

interface SeccionesNavProps {
  currentTab: MainNavTab;
  onTabChange: (tab: MainNavTab) => void;
  hasDisconnectedTablet: boolean;
  openAccountsCount: number;
  solicitadasCount: number;
  mesasOcupadas: number;
  mesasTotal: number;
  ventasCount: number;
}

interface Seccion {
  id: MainNavTab;
  label: string;
  icon: LucideIcon;
  badge?: string;
  alerta?: boolean; // punto rojo (p. ej. cuenta pedida o tablet desconectada)
}

// Color de cada sección: ícono, fondo al pasar el cursor y sección activa (tonos que dejan leer bien el texto).
const COLORES: Record<MainNavTab, { icono: string; hover: string; activo: string }> = {
  inicio: { icono: 'text-slate-500', hover: 'hover:bg-slate-100', activo: 'bg-slate-600 text-white shadow-slate-600/30' },
  cajas: { icono: 'text-emerald-600', hover: 'hover:bg-emerald-50', activo: 'bg-emerald-700 text-white shadow-emerald-700/30' },
  ventas: { icono: 'text-amber-600', hover: 'hover:bg-amber-50', activo: 'bg-amber-500 text-neutral-950 shadow-amber-500/30' },
  mesas: { icono: 'text-violet-600', hover: 'hover:bg-violet-50', activo: 'bg-violet-600 text-white shadow-violet-600/30' },
  tablets: { icono: 'text-sky-600', hover: 'hover:bg-sky-50', activo: 'bg-sky-700 text-white shadow-sky-700/30' },
  turnos: { icono: 'text-red-600', hover: 'hover:bg-red-50', activo: 'bg-red-600 text-white shadow-red-600/30' },
  agotados: { icono: 'text-rose-600', hover: 'hover:bg-rose-50', activo: 'bg-rose-700 text-white shadow-rose-700/30' },
  cocina: { icono: 'text-orange-600', hover: 'hover:bg-orange-50', activo: 'bg-orange-600 text-white shadow-orange-600/30' },
};

const CLAVE_CONTRAIDO = 'caja_menu_contraido';

function leerContraido(): boolean {
  try {
    return localStorage.getItem(CLAVE_CONTRAIDO) === '1';
  } catch {
    return false;
  }
}

export const SeccionesNav: React.FC<SeccionesNavProps> = ({
  currentTab,
  onTabChange,
  hasDisconnectedTablet,
  openAccountsCount,
  solicitadasCount,
  mesasOcupadas,
  mesasTotal,
  ventasCount,
}) => {
  const [contraido, setContraido] = useState(leerContraido);
  const alternar = () => {
    const nuevo = !contraido;
    setContraido(nuevo);
    try {
      localStorage.setItem(CLAVE_CONTRAIDO, nuevo ? '1' : '0');
    } catch {
      // sin almacenamiento: solo dura mientras la página esté abierta
    }
  };

  const secciones: Seccion[] = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'cajas', label: 'Cajas', icon: Receipt, badge: String(openAccountsCount), alerta: solicitadasCount > 0 },
    { id: 'ventas', label: 'Ventas', icon: TrendingUp, badge: ventasCount > 0 ? String(ventasCount) : undefined },
    { id: 'mesas', label: 'Órdenes', icon: LayoutGrid, badge: `${mesasOcupadas}/${mesasTotal}` },
    { id: 'agotados', label: 'Agotados', icon: PackageX },
    { id: 'cocina', label: 'Cocina', icon: ChefHat },
    { id: 'tablets', label: 'Tablet', icon: Tablet, alerta: hasDisconnectedTablet },
    { id: 'turnos', label: 'Turnos', icon: Clock },
  ].sort((a, b) => Number(b.id === 'inicio') - Number(a.id === 'inicio') || a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })) as Seccion[];

  return (
    <nav
      aria-label="Secciones"
      className={`relative z-20 shrink-0 bg-white border-b border-neutral-200 lg:border-b-0 lg:border-r lg:flex lg:flex-col transition-[width] duration-200 ${
        contraido ? 'lg:w-20' : 'lg:w-60'
      }`}
    >
      <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto px-4 py-2 lg:px-3 lg:py-4 lg:flex-1">
        <div className={`hidden px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500 ${contraido ? '' : 'lg:block'}`}>
          Secciones
        </div>
        {secciones.map(({ id, label, icon: Icon, badge, alerta }) => {
          const activo = currentTab === id;
          const color = COLORES[id];
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-current={activo ? 'page' : undefined}
              title={contraido ? label : undefined}
              className={`relative shrink-0 flex items-center gap-3 h-11 lg:h-12 px-3.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                contraido ? 'lg:justify-center lg:px-0' : ''
              } ${activo ? `${color.activo} shadow-md` : `text-neutral-700 ${color.hover}`}`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${activo ? '' : color.icono}`} />
              <span className={contraido ? 'lg:sr-only' : ''}>{label}</span>
              {badge && (
                <span
                  className={`font-mono text-[11px] leading-5 px-1.5 rounded-full ${
                    contraido ? 'lg:absolute lg:-top-1.5 lg:-right-1.5 lg:shadow-sm' : 'ml-auto'
                  } ${activo ? 'bg-white/90 text-neutral-900' : 'bg-neutral-100 text-neutral-700'}`}
                >
                  {badge}
                </span>
              )}
              {alerta && (
                <span
                  className="absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse"
                  aria-label="Requiere atención"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Contraer / expandir (solo pantallas grandes) */}
      <button
        type="button"
        onClick={alternar}
        aria-label={contraido ? 'Expandir menú' : 'Contraer menú'}
        title={contraido ? 'Expandir menú' : undefined}
        className={`hidden lg:flex items-center gap-2 m-3 h-10 rounded-xl text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
          contraido ? 'justify-center' : 'px-3'
        }`}
      >
        {contraido ? (
          <PanelLeftOpen className="w-5 h-5" />
        ) : (
          <>
            <PanelLeftClose className="w-5 h-5" /> Contraer menú
          </>
        )}
      </button>
    </nav>
  );
};
