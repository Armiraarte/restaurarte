// Turno de caja: ya no se abre solo al iniciar sesión. Sin turno abierto no se puede cobrar ni activar tabletas.
//   AvisoIniciarTurno  → ventana al entrar a la caja si no hay turno ("Debes iniciar el turno…")
//   BannerSinTurno     → franja bajo las secciones mientras no haya turno
//   SeccionSinTurno    → lo que se muestra en Cajas / Ventas / Órdenes sin turno
// Al iniciarlo (POST /api/turnos/iniciar) el servidor avisa en vivo y todas las pantallas se actualizan.
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, Loader2, Lock, Play } from 'lucide-react';
import { iniciarTurno } from '../services/turnosService';

function useIniciar(onIniciado?: () => void) {
  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iniciar = async () => {
    setIniciando(true);
    setError(null);
    try {
      await iniciarTurno();
      onIniciado?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el turno.');
    } finally {
      setIniciando(false);
    }
  };
  return { iniciar, iniciando, error };
}

const BotonIniciar: React.FC<{ iniciar: () => void; iniciando: boolean; grande?: boolean }> = ({ iniciar, iniciando, grande }) => (
  <button
    onClick={iniciar}
    disabled={iniciando}
    className={`${grande ? 'h-14 px-6 text-lg w-full' : 'h-10 px-4 text-sm'} rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2 cursor-pointer`}
  >
    {iniciando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
    Iniciar turno
  </button>
);

/** Ventana al entrar a la caja cuando no hay turno abierto. */
export const AvisoIniciarTurno: React.FC<{ onCerrar: () => void }> = ({ onCerrar }) => {
  const { iniciar, iniciando, error } = useIniciar(onCerrar);
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        role="alertdialog"
        aria-label="Iniciar turno"
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 text-center space-y-4"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <span className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <Clock className="w-8 h-8" />
        </span>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Debes iniciar el turno</h2>
          <p className="text-sm text-neutral-600">
            Sin turno abierto no se puede <b>cobrar</b> ni <b>activar las tabletas</b>. Al iniciarlo, las tabletas que estén esperando
            entran solas.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg text-left">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <BotonIniciar iniciar={iniciar} iniciando={iniciando} grande />
        <button onClick={onCerrar} className="text-sm text-neutral-500 hover:text-neutral-800 cursor-pointer">
          Ahora no
        </button>
      </motion.div>
    </motion.div>
  );
};

/** Franja bajo las secciones mientras no haya turno. */
export const BannerSinTurno: React.FC = () => {
  const { iniciar, iniciando, error } = useIniciar();
  return (
    <div className="relative z-10 bg-amber-50 border-b border-amber-200">
      <div className="px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <b>No hay turno abierto.</b> Inícialo para cobrar y activar las tabletas.
            {error && <span className="ml-2 text-rose-700">{error}</span>}
          </span>
        </div>
        <BotonIniciar iniciar={iniciar} iniciando={iniciando} />
      </div>
    </div>
  );
};

/** Contenido de Cajas / Ventas / Órdenes sin turno abierto. */
export const SeccionSinTurno: React.FC<{ seccion: string }> = ({ seccion }) => {
  const { iniciar, iniciando, error } = useIniciar();
  return (
    <div className="max-w-md mx-auto mt-10 bg-white border border-neutral-200 rounded-2xl p-8 text-center space-y-4">
      <span className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 text-neutral-500 flex items-center justify-center">
        <Lock className="w-7 h-7" />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-bold">{seccion} necesita un turno abierto</h2>
        <p className="text-sm text-neutral-500">Inicia el turno para registrar órdenes, cobrar y activar las tabletas.</p>
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <div className="flex justify-center">
        <BotonIniciar iniciar={iniciar} iniciando={iniciando} />
      </div>
    </div>
  );
};
