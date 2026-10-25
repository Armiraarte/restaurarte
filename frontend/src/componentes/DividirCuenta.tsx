// Dividir la cuenta (botón junto al historial): cuánto le toca a cada persona, en partes iguales o por productos.
// Solo calcula: la orden y el cobro no cambian (la caja cobra el total como siempre).
import React, { useMemo, useState } from 'react';
import { Minus, Plus, Split, Users, X } from 'lucide-react';
import { DetalleOrdenBD, ExtraOrdenBD, nombreDetalle } from '../services/pedidosService';
import { partesIguales, totalesPorPersona, unidadesDeCuenta } from '../services/dividirCuenta';

const pesos = (centavos: number) => `$${(centavos / 100).toFixed(2)}`;
const MAX_PERSONAS = 12;
// Un color por persona (se repiten después de 8).
const COLORES = [
  'bg-sky-100 border-sky-400 text-sky-900',
  'bg-amber-100 border-amber-400 text-amber-900',
  'bg-emerald-100 border-emerald-400 text-emerald-900',
  'bg-rose-100 border-rose-400 text-rose-900',
  'bg-violet-100 border-violet-400 text-violet-900',
  'bg-lime-100 border-lime-500 text-lime-900',
  'bg-orange-100 border-orange-400 text-orange-900',
  'bg-cyan-100 border-cyan-400 text-cyan-900',
];
const color = (persona: number) => COLORES[persona % COLORES.length];

export function DividirCuenta({
  etiqueta,
  total,
  detalle,
  extras,
  onCerrar,
}: {
  etiqueta: string;
  total: number;
  detalle: DetalleOrdenBD[];
  extras: ExtraOrdenBD[];
  onCerrar: () => void;
}) {
  const [modo, setModo] = useState<'iguales' | 'productos'>('iguales');
  const [personas, setPersonas] = useState(2);
  const [activa, setActiva] = useState(0);
  // Pieza → persona (índice). Lo que no está aquí está «sin asignar».
  const [asignadas, setAsignadas] = useState<Record<string, number>>({});

  const unidades = useMemo(
    () =>
      unidadesDeCuenta(
        detalle.map((d) => ({
          clave: String(d.idDetalle_Orden),
          nombre: nombreDetalle(d),
          detalle: d.categoria,
          cantidad: d.cantidad,
          subtotal: d.subtotal,
          // MIXTAS: cada pieza con su sabor (y el tamaño, si lo tiene) y su precio.
          reparto: d.opciones?.reparto?.map((r) => ({ ...r, nombre: d.tamano ? `${r.nombre} (${d.tamano})` : r.nombre })),
        })),
        extras.map((e) => ({ clave: String(e.id), descripcion: e.descripcion, importe: e.importe })),
      ),
    [detalle, extras],
  );
  const iguales = partesIguales(total, personas);
  const { totales, sinAsignar } = totalesPorPersona(unidades, asignadas, personas);

  const cambiarPersonas = (delta: number) => {
    const nuevas = Math.min(MAX_PERSONAS, Math.max(2, personas + delta));
    setPersonas(nuevas);
    if (activa >= nuevas) setActiva(nuevas - 1);
  };
  // Tocar una pieza la da a la persona elegida; tocarla otra vez (misma persona) la deja sin asignar.
  const tocarPieza = (clave: string) =>
    setAsignadas((actual) => {
      const nuevo = { ...actual };
      if (nuevo[clave] === activa) delete nuevo[clave];
      else nuevo[clave] = activa;
      return nuevo;
    });

  return (
    <div className="w-full max-w-3xl max-h-full overflow-hidden bg-white rounded-2xl shadow-xl flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-neutral-100">
        <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
          <Split className="w-5 h-5 text-violet-600" /> Dividir cuenta · {etiqueta}
        </h2>
        <div className="text-right leading-tight">
          <div className="text-xs text-neutral-500">Total</div>
          <div className="font-mono text-xl font-bold">{pesos(Math.round(total * 100))}</div>
        </div>
      </div>

      <div className="shrink-0 px-5 pt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-xl">
          {(
            [
              ['iguales', 'Partes iguales'],
              ['productos', 'Por productos'],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              onClick={() => setModo(id)}
              className={`h-11 px-4 rounded-lg text-sm font-bold cursor-pointer ${modo === id ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}
            >
              {texto}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-neutral-500" />
          <span className="text-sm font-semibold text-neutral-700">Personas</span>
          <button type="button" onClick={() => cambiarPersonas(-1)} disabled={personas <= 2} aria-label="Menos personas" className="w-11 h-11 rounded-xl border-2 border-neutral-200 flex items-center justify-center cursor-pointer disabled:opacity-40">
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-8 text-center font-mono text-2xl font-bold">{personas}</span>
          <button type="button" onClick={() => cambiarPersonas(1)} disabled={personas >= MAX_PERSONAS} aria-label="Más personas" className="w-11 h-11 rounded-xl border-2 border-neutral-200 flex items-center justify-center cursor-pointer disabled:opacity-40">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {modo === 'iguales' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {iguales.map((centavos, i) => (
              <div key={i} className={`rounded-xl border-2 p-3 ${color(i)}`}>
                <div className="text-xs font-bold">Persona {i + 1}</div>
                <div className="font-mono text-2xl font-black">{pesos(centavos)}</div>
              </div>
            ))}
          </div>
        ) : unidades.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no hay nada enviado en esta orden.</p>
        ) : (
          <>
            {/* Persona a la que se le dan las piezas que se toquen */}
            <div>
              <div className="text-xs font-semibold text-neutral-500 mb-1.5">Elige la persona y toca lo que va a pagar:</div>
              <div className="flex flex-wrap gap-2">
                {totales.map((centavos, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiva(i)}
                    aria-pressed={activa === i}
                    className={`h-12 px-3 rounded-xl border-2 text-left leading-tight cursor-pointer ${color(i)} ${activa === i ? 'ring-4 ring-neutral-900/20' : 'opacity-70'}`}
                  >
                    <span className="block text-xs font-bold">Persona {i + 1}</span>
                    <span className="block font-mono text-sm font-black">{pesos(centavos)}</span>
                  </button>
                ))}
                <span className="h-12 px-3 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500 leading-tight flex flex-col justify-center">
                  <span className="block text-xs font-bold">Sin asignar</span>
                  <span className="block font-mono text-sm font-black">{pesos(sinAsignar)}</span>
                </span>
              </div>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {unidades.map((u) => {
                const persona = asignadas[u.clave];
                const asignada = persona !== undefined && persona < personas;
                return (
                  <li key={u.clave}>
                    <button
                      type="button"
                      onClick={() => tocarPieza(u.clave)}
                      className={`w-full min-h-14 px-3 py-2 rounded-xl border-2 flex items-center justify-between gap-2 text-left cursor-pointer touch-manipulation ${
                        asignada ? color(persona) : 'bg-white border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-tight break-words">{u.nombre}</span>
                        {u.detalle && <span className="block text-[11px] text-neutral-500">{u.detalle}</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono text-sm font-bold">{pesos(u.centavos)}</span>
                        {asignada && <span className="block text-[11px] font-black">P{persona + 1}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="text-xs text-neutral-500">Solo es para saber cuánto le toca a cada quien: la orden y el cobro no cambian.</p>
      </div>

      <div className="shrink-0 p-3 border-t border-neutral-100">
        <button
          type="button"
          onClick={onCerrar}
          className="w-full h-12 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200 text-base font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <X className="w-5 h-5" /> Cerrar
        </button>
      </div>
    </div>
  );
}
