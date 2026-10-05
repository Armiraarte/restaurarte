import React from 'react';
import { ChefHat, ClipboardList, Home, LayoutGrid, Receipt, Tablet, LucideIcon } from 'lucide-react';

export type MainNavTab = 'inicio' | 'cocina' | 'tablets' | 'cajas' | 'mesas' | 'comandas';

interface SeccionesNavProps {
  currentTab: MainNavTab;
  onTabChange: (tab: MainNavTab) => void;
  cocinaActiveCount: number;
  hasDisconnectedTablet: boolean;
  openAccountsCount: number;
  solicitadasCount: number;
  mesasOcupadas: number;
  mesasTotal: number;
  nuevasComandasCount: number;
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
  cocina: {
    normal: 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100',
    activo: 'bg-orange-500 border-orange-500 text-white ring-2 ring-orange-300 ring-offset-2',
    icono: 'text-orange-500',
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
  mesas: {
    normal: 'bg-violet-50 border-violet-200 text-violet-800 hover:bg-violet-100',
    activo: 'bg-violet-500 border-violet-500 text-white ring-2 ring-violet-300 ring-offset-2',
    icono: 'text-violet-500',
  },
  comandas: {
    normal: 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100',
    activo: 'bg-teal-500 border-teal-500 text-white ring-2 ring-teal-300 ring-offset-2',
    icono: 'text-teal-500',
  },
};

export const SeccionesNav: React.FC<SeccionesNavProps> = ({
  currentTab,
  onTabChange,
  cocinaActiveCount,
  hasDisconnectedTablet,
  openAccountsCount,
  solicitadasCount,
  mesasOcupadas,
  mesasTotal,
  nuevasComandasCount,
}) => {
  const secciones: Seccion[] = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'cocina', label: 'Cocina', icon: ChefHat, badge: cocinaActiveCount > 0 ? String(cocinaActiveCount) : undefined },
    { id: 'comandas', label: 'Comandas', icon: ClipboardList, badge: nuevasComandasCount > 0 ? String(nuevasComandasCount) : undefined },
    { id: 'cajas', label: 'Cajas', icon: Receipt, badge: String(openAccountsCount), alerta: solicitadasCount > 0 },
    { id: 'mesas', label: 'Mesas', icon: LayoutGrid, badge: `${mesasOcupadas}/${mesasTotal}` },
    { id: 'tablets', label: 'Tablet', icon: Tablet, alerta: hasDisconnectedTablet },
  ];

  return (
    <nav aria-label="Secciones" className="bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
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
