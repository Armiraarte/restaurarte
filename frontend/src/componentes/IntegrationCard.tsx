// Adaptado de "Integration Card" (shadcnspace en 21st.dev): RESTAURARTE al centro,
// conectado con líneas animadas a los nodos (módulos) alrededor.
import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, UtensilsCrossed } from 'lucide-react';

// Lienzo de 564x410 con el centro en (282, 205).
const SLOTS = [
  { x: 110, y: 90, path: 'M 270 205 V 105 Q 270 90 255 90 H 110' }, // arriba-izquierda
  { x: 360, y: 70, path: 'M 294 205 V 85 Q 294 70 309 70 H 360' }, // arriba-derecha
  { x: 160, y: 205, path: 'M 250 205 H 160' }, // centro-izquierda
  { x: 480, y: 205, path: 'M 314 205 H 480' }, // centro-derecha
  { x: 282, y: 360, path: 'M 282 205 V 360' }, // abajo-centro
  { x: 460, y: 340, path: 'M 314 215 V 325 Q 314 340 329 340 H 460' }, // abajo-derecha
];

const AMBER = '#f59e0b';

export interface NodoRed {
  id: string;
  label: string;
  icon: LucideIcon;
  activo: boolean; // false: línea roja punteada y nodo en alerta
  badge?: string;
  onClick?: () => void;
}

const AnimatedPath = ({ d, id, activo, delay }: { d: string; id: string; activo: boolean; delay: number }) => (
  <>
    <path
      d={d}
      strokeWidth={activo ? 1 : 1.5}
      strokeDasharray={activo ? undefined : '4 4'}
      fill="none"
      className={activo ? 'stroke-neutral-300' : 'stroke-rose-300'}
    />
    {activo && (
      <>
        <motion.path
          d={d}
          stroke={`url(#${id})`}
          strokeWidth="2"
          fill="none"
          strokeDasharray="40 160"
          initial={{ strokeDashoffset: 200 }}
          animate={{ strokeDashoffset: -200 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay }}
        />
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor={AMBER} stopOpacity="0.8" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </>
    )}
  </>
);

export const IntegrationVisual: React.FC<{ nodos: NodoRed[] }> = ({ nodos: todos }) => {
  const containerId = useId().replace(/:/g, '');
  const nodos = todos.slice(0, SLOTS.length);

  return (
    <div className="relative h-full w-full">
      {/* Líneas */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 564 410"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {nodos.map((nodo, i) => (
          <AnimatedPath
            key={nodo.id}
            d={SLOTS[i].path}
            id={`${containerId}-${nodo.id}`}
            activo={nodo.activo}
            delay={i * 0.6}
          />
        ))}
      </svg>

      {/* Logo central */}
      <div className="absolute top-1/2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-md sm:rounded-2xl sm:p-2 sm:shadow-xl">
        <div className="rounded-lg bg-amber-500 p-1.5 sm:rounded-xl sm:p-2.5">
          <UtensilsCrossed className="size-5 text-neutral-950 sm:size-8" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-amber-500/30 sm:rounded-2xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>

      {/* Nodos alrededor */}
      {nodos.map((nodo, i) => {
        const Icon = nodo.icon;
        return (
          <motion.button
            key={nodo.id}
            type="button"
            onClick={nodo.onClick}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.08 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            style={{ left: `${(SLOTS[i].x / 564) * 100}%`, top: `${(SLOTS[i].y / 410) * 100}%` }}
            className={`absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border bg-white shadow-sm sm:h-14 sm:w-14 sm:rounded-xl cursor-pointer ${
              nodo.activo ? 'border-neutral-200 text-neutral-900 hover:border-amber-400' : 'border-rose-300 text-rose-700'
            }`}
            aria-label={nodo.badge ? `${nodo.label}: ${nodo.badge}` : nodo.label}
          >
            <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
            {nodo.badge && (
              <span
                className={`absolute -top-2 -right-2 min-w-5 rounded-full px-1 font-mono text-[10px] font-bold leading-5 ${
                  nodo.activo ? 'bg-neutral-900 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {nodo.badge}
              </span>
            )}
            <span className="absolute top-full mt-1 whitespace-nowrap text-[10px] font-medium text-neutral-600 sm:text-xs">
              {nodo.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

// En celular el lienzo toma el ancho (564x410); en pantallas medianas en adelante, el alto disponible de la tarjeta,
// y el diagrama se escala para caber completo sin deformarse (las líneas del SVG siguen alineadas con los nodos).
export const VisualContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`relative flex aspect-564/410 md:aspect-auto md:h-full md:min-h-0 w-full items-center justify-center overflow-hidden bg-neutral-50 p-6 ${className}`}>
    {/* Fondo de puntos */}
    <div
      className="absolute inset-0 opacity-20"
      style={{ backgroundImage: 'radial-gradient(circle, #171717 1px, transparent 1px)', backgroundSize: '32px 32px' }}
    />
    <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/60 from-10% via-transparent to-90% to-white/60" />
    <div className="relative z-10 flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
      <div className="relative" style={{ width: 'min(100cqw, 100cqh * 564 / 410)', aspectRatio: '564 / 410' }}>
        {children}
      </div>
    </div>
  </div>
);

interface IntegrationCardProps {
  visual: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({ visual, title, description, action }) => (
  <div className="grid shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white md:flex-1 md:min-h-0 md:grid-cols-[3fr_2fr]">
    <VisualContainer>{visual}</VisualContainer>
    <div className="flex flex-col justify-center gap-5 p-6 sm:p-8 md:min-h-0 md:overflow-y-auto">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h3>
        <div className="text-sm leading-relaxed text-neutral-600">{description}</div>
      </div>
      {action}
    </div>
  </div>
);
