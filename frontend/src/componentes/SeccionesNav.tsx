import React from 'react';
import { Clock, Home, LayoutGrid, Receipt, Tablet, TrendingUp, LucideIcon } from 'lucide-react';

export type MainNavTab = 'inicio' | 'tablets' | 'cajas' | 'ventas' | 'mesas' | 'turnos';

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
  alerta?: boolean; // resalta el botón (p. ej. cuenta pedida o tablet desconectada)
}

// Color pastel propio de cada sección (clases completas para que Tailwind las genere).
const COLORES: Record<MainNavTab, { normal: string; activo: string; icono: string }> = {
  inicio: {
    normal: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100',
    activo: 'bg-slate-600 border-slate-600 text-white ring-2 ring-slate-300 ring-offset-2',
    icono: 'text-slate-500',
  },
  tablets: {
    normal: 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100',
    activo: 'bg-sky-500 border-sky-500 text-white ring-2 ring-sky-300 ring-offset-2',
    icono: 'text-sky-500',
  },
  cajas: {
    normal: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100',
    activo: 'bg-emerald-500 border-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-2',
    icono: 'text-emerald-500',
  },
  ventas: {
    normal: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',
    activo: 'bg-amber-500 border-amber-500 text-white ring-2 ring-amber-300 ring-offset-2',
    icono: 'text-amber-500',
  },
  turnos: {
    normal: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100',
    activo: 'bg-red-500 border-red-500 text-white ring-2 ring-red-300 ring-offset-2',
    icono: 'text-red-500',
  },
  mesas: {
    normal: 'bg-violet-50 border-violet-200 text-violet-800 hover:bg-violet-100',
    activo: 'bg-violet-500 border-violet-500 text-white ring-2 ring-violet-300 ring-offset-2',
    icono: 'text-violet-500',
  },
};

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
  const secciones: Seccion[] = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'cajas', label: 'Cajas', icon: Receipt, badge: String(openAccountsCount), alerta: solicitadasCount > 0 },
    { id: 'ventas', label: 'Ventas', icon: TrendingUp, badge: ventasCount > 0 ? String(ventasCount) : undefined },
    { id: 'mesas', label: 'Órdenes', icon: LayoutGrid, badge: `${mesasOcupadas}/${mesasTotal}` },
    { id: 'tablets', label: 'Tablet', icon: Tablet, alerta: hasDisconnectedTablet },
    { id: 'turnos', label: 'Turnos', icon: Clock },
  ];

  return (
    <nav aria-label="Secciones" className="relative z-10 bg-white border-b border-neutral-200">
      <div className="px-4 lg:px-8 py-3 grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
        {secciones.map(({ id, label, icon: Icon, badge, alerta }) => {
          const activo = currentTab === id;
          const color = COLORES[id];
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-current={activo ? 'page' : undefined}
              className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-xl border-2 text-sm transition-colors cursor-pointer ${
                activo ? `${color.activo} font-bold shadow-md` : `${color.normal} font-medium`
              }`}
            >
              <Icon className={`w-6 h-6 shrink-0 ${activo ? '' : color.icono}`} />
              <span className="leading-tight whitespace-nowrap">{label}</span>
              {badge && (
                <span
                  className={`absolute top-1.5 right-1.5 font-mono text-[11px] leading-4 px-1.5 rounded-full border ${
                    activo ? 'bg-white text-neutral-800 border-white' : 'bg-white/80 border-current/20'
                  }`}
                >
                  {badge}
                </span>
              )}
              {alerta && (
                <span
                  className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"
                  aria-label="Requiere atención"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
