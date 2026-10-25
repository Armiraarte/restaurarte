// CAMBIAR (Órdenes): pasa una mesa abierta a una libre con todo lo que tiene su cuenta (pedido, extras y total).
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, ArrowRightLeft, Loader2, X } from 'lucide-react';
import { cambiarMesa, MesaRegistrada } from '../services/mesasService';
import { ordenesPorMesa } from './CroquisMesas';

const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function DialogoCambiarMesa({
  mesas,
  onCambiada,
  onCerrar,
}: {
  /** Órdenes activas del turno. */
  mesas: MesaRegistrada[];
  onCambiada: (anterior: string, nueva: string) => void;
  onCerrar: () => void;
}) {
  const porNumero = ordenesPorMesa(mesas); // solo 1 a 9 (la de prueba no se cambia)
  const abiertas = NUMEROS.filter((n) => porNumero.has(n));
  const libres = NUMEROS.filter((n) => !porNumero.has(n));
  const [origen, setOrigen] = useState<number | null>(null);
  const [destino, setDestino] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async () => {
    const orden = origen !== null ? porNumero.get(origen) : undefined;
    if (!orden || destino === null || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await cambiarMesa(orden.id, String(destino));
      onCambiada(String(origen), String(destino));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar de mesa.');
      setGuardando(false);
    }
  };

  const botonMesa = (activo: boolean) =>
    `h-16 rounded-xl border-2 flex flex-col items-center justify-center leading-tight cursor-pointer touch-manipulation ${
      activo ? 'bg-sky-600 border-sky-700 text-white' : 'bg-white border-neutral-200 hover:border-sky-300 text-neutral-800'
    }`;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-labelledby="cambiar-mesa-titulo"
        className="w-full max-w-xl max-h-full overflow-y-auto bg-white rounded-2xl shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="cambiar-mesa-titulo" className="text-xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-sky-700" /> Cambiar de mesa
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="w-10 h-10 flex items-center justify-center cursor-pointer">
            <X />
          </button>
        </div>
        <p className="text-sm text-neutral-500">La cuenta completa (lo pedido, los extras y el total) pasa a la mesa nueva.</p>

        <div>
          <h3 className="text-sm font-bold text-neutral-700 mb-2">1. ¿Qué mesa se cambia?</h3>
          {abiertas.length === 0 ? (
            <p className="text-sm text-neutral-500">No hay mesas abiertas.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {abiertas.map((n) => {
                const orden = porNumero.get(n)!;
                return (
                  <button key={n} type="button" onClick={() => setOrigen(n)} aria-pressed={origen === n} className={botonMesa(origen === n)}>
                    <span className="text-lg font-black">Mesa {n}</span>
                    <span className={`text-[11px] font-mono ${origen === n ? 'text-sky-100' : 'text-neutral-500'}`}>
                      ${Number(orden.total).toFixed(2)}{orden.estatus === 1 ? ' · cuenta' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-neutral-700 mb-2">2. ¿A qué mesa libre?</h3>
          {libres.length === 0 ? (
            <p className="text-sm text-neutral-500">No hay mesas libres.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {libres.map((n) => (
                <button key={n} type="button" onClick={() => setDestino(n)} aria-pressed={destino === n} className={botonMesa(destino === n)}>
                  <span className="text-lg font-black">Mesa {n}</span>
                  <span className={`text-[11px] ${destino === n ? 'text-sky-100' : 'text-emerald-700'}`}>libre</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={confirmar}
          disabled={origen === null || destino === null || guardando}
          className="w-full h-14 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-200 disabled:text-neutral-500 text-white text-lg font-bold flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {guardando ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : origen !== null && destino !== null ? (
            <>
              Cambiar Mesa {origen} <ArrowRight className="w-5 h-5" /> Mesa {destino}
            </>
          ) : (
            'Elige la mesa y a dónde va'
          )}
        </button>
      </div>
    </div>,
    document.body,
  );
}
