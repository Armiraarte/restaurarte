// Dividir la cuenta (botón junto al historial): cuánto le toca a cada persona, en partes iguales o por productos.
// «Guardar e imprimir» la registra como Cuenta 1…N de la orden e imprime un ticket por persona en caja.
// La orden y el cobro no cambian (la caja cobra el total como siempre); en Ventas se ve que fue dividida.
import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Lock, Minus, Plus, Printer, Split, Users, X } from 'lucide-react';
import {
  CuentaDividida, DetalleOrdenBD, divisionVigente, ExtraOrdenBD, guardarCuentasDivididas, nombreDetalle, reimprimirCuentasDivididas,
} from '../services/pedidosService';
import { alternarAsignacion, partesIguales, totalesPorPersona, unidadesDeCuenta } from '../services/dividirCuenta';

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
const hora = (fecha: string) => new Date(fecha).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });

type Aviso = { tipo: 'ok' | 'aviso' | 'error'; texto: string; reimprimir?: boolean };

/** Texto del resultado de imprimir: todo bien, o cuántos salieron y por qué falló. */
function avisoImpresion(n: number, impresion: { ok: boolean; impresas: number; error?: string }, guardadas: boolean): Aviso {
  const inicio = guardadas ? `Se guardaron Cuenta 1 a ${n}` : 'Las cuentas siguen guardadas';
  if (impresion.ok) return { tipo: 'ok', texto: `${guardadas ? `Listo: se guardaron Cuenta 1 a ${n} y se` : 'Se'} imprimieron ${n} tickets en caja.` };
  const cuantas = impresion.impresas ? `solo se imprimieron ${impresion.impresas} de ${n}` : 'no se imprimieron los tickets';
  return { tipo: 'aviso', texto: `${inicio}, pero ${cuantas}: ${impresion.error ?? 'falló la impresora'}.`, reimprimir: true };
}

export function DividirCuenta({
  idOrden,
  etiqueta,
  total,
  detalle,
  extras,
  guardadas,
  onGuardadas,
  onCerrar,
}: {
  idOrden: number;
  etiqueta: string;
  total: number;
  detalle: DetalleOrdenBD[];
  extras: ExtraOrdenBD[];
  /** Cuenta 1…N si ya se guardó una división. */
  guardadas: CuentaDividida[];
  onGuardadas: (cuentas: CuentaDividida[]) => void;
  onCerrar: () => void;
}) {
  // Si ya se dividió, abre como quedó (modo y personas); los productos de cada quien se vuelven a tocar.
  const [modo, setModo] = useState<'iguales' | 'productos'>(guardadas[0]?.modo ?? 'iguales');
  const [personas, setPersonas] = useState(guardadas[0]?.personas ?? 2);
  const [activa, setActiva] = useState(0);
  // Pieza → persona (índice). Lo que no está aquí está «sin asignar».
  const [asignadas, setAsignadas] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

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
    setAviso(null);
    if (activa >= nuevas) setActiva(nuevas - 1);
    if (nuevas < personas) {
      setAsignadas((actual) => Object.fromEntries(Object.entries(actual).filter(([, persona]) => persona < nuevas)));
    }
  };
  // Tocar una pieza la da a la persona elegida; tocarla otra vez (misma persona) la deja sin asignar.
  const tocarPieza = (clave: string) => {
    setAsignadas((actual) => alternarAsignacion(actual, clave, activa));
    setAviso(null);
  };

  // Por productos solo se guarda con todo asignado y cada persona con algo.
  const sinNada = modo === 'productos'
    ? Array.from({ length: personas }, (_, i) => i).find((i) => !unidades.some((u) => asignadas[u.clave] === i))
    : undefined;
  const motivoNoGuardar =
    modo === 'productos' && unidades.length === 0 ? 'Todavía no hay nada enviado.'
      : modo === 'productos' && sinAsignar > 0 ? `Falta asignar ${pesos(sinAsignar)} para poder guardar.`
        : sinNada !== undefined ? `La Persona ${sinNada + 1} no tiene productos.`
          : null;
  const ocupado = guardando || imprimiendo;

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    try {
      const r = await guardarCuentasDivididas(idOrden, {
        modo, personas, total,
        ...(modo === 'productos' && { asignadas: Object.fromEntries(Object.entries(asignadas).filter(([, p]) => p < personas)) }),
      });
      onGuardadas(r.cuentas);
      setAviso(avisoImpresion(r.cuentas.length, r.impresion, true));
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo guardar la cuenta dividida.' });
    } finally {
      setGuardando(false);
    }
  };
  const reimprimir = async () => {
    setImprimiendo(true);
    try {
      const r = await reimprimirCuentasDivididas(idOrden);
      setAviso(avisoImpresion(guardadas.length, r.impresion, false));
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudieron imprimir los tickets.', reimprimir: true });
    } finally {
      setImprimiendo(false);
    }
  };
  const vigente = divisionVigente(guardadas, total);

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
        <div className="flex flex-wrap gap-1 p-1 bg-neutral-100 rounded-xl">
          {(
            [
              ['iguales', 'Partes iguales'],
              ['productos', 'Por productos'],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setModo(id);
                setAviso(null);
              }}
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
        {aviso ? (
          <div
            role={aviso.tipo === 'ok' ? 'status' : 'alert'}
            className={`rounded-xl border px-3 py-2 text-sm flex items-start gap-2 ${
              aviso.tipo === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : aviso.tipo === 'aviso' ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {aviso.tipo === 'ok' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="flex-1 min-w-0">{aviso.texto}</span>
          </div>
        ) : guardadas.length > 0 && (
          // Ya se guardó antes: se avisa de cuándo y, si se agregó algo después, que hay que volver a guardarla.
          <div className={`rounded-xl border px-3 py-2 text-sm flex items-start gap-2 ${vigente ? 'bg-violet-50 border-violet-200 text-violet-900' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
            {vigente ? <Split className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="flex-1 min-w-0">
              {vigente
                ? `Ya está guardada en ${guardadas.length} cuentas (${guardadas[0].creado_por}, ${hora(guardadas[0].creado_en)}). Si guardas otra vez, se reemplaza.`
                : `Se guardó en ${guardadas.length} cuentas por ${pesos(Math.round(guardadas[0].total_orden * 100))}, pero la orden cambió después. Vuelve a guardarla.`}
            </span>
          </div>
        )}
        {modo === 'iguales' ? (
          <ul className="space-y-2">
            {iguales.map((centavos, i) => (
              <li key={i} className={`rounded-xl border-2 px-3 py-2 flex items-center justify-between gap-3 ${color(i)}`}>
                <span className="text-sm font-bold">Persona {i + 1}</span>
                <span className="font-mono text-2xl font-black">{pesos(centavos)}</span>
              </li>
            ))}
          </ul>
        ) : unidades.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no hay nada enviado en esta orden.</p>
        ) : (
          <>
            {/* Persona a la que se le dan las piezas que se toquen */}
            <div>
              <div className="text-xs font-semibold text-neutral-500 mb-1.5">Elige la persona y toca lo que va a pagar:</div>
              <ul className="space-y-2">
                {totales.map((centavos, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setActiva(i)}
                      aria-pressed={activa === i}
                      className={`w-full min-h-12 px-3 py-2 rounded-xl border-2 flex items-center justify-between gap-3 text-left leading-tight cursor-pointer ${color(i)} ${activa === i ? 'ring-4 ring-neutral-900/20' : 'opacity-70'}`}
                    >
                      <span className="text-sm font-bold">Persona {i + 1}</span>
                      <span className="font-mono text-lg font-black">{pesos(centavos)}</span>
                    </button>
                  </li>
                ))}
                <li className="min-h-12 px-3 py-2 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500 leading-tight flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">Sin asignar</span>
                  <span className="font-mono text-lg font-black">{pesos(sinAsignar)}</span>
                </li>
              </ul>
              <p className="mt-2 text-xs text-neutral-500">Para cambiar un producto de persona, desmárcalo primero con quien lo tiene asignado.</p>
            </div>

            <ul className="space-y-2">
              {unidades.map((u) => {
                const persona = asignadas[u.clave];
                const asignada = persona !== undefined && persona < personas;
                const bloqueada = asignada && persona !== activa;
                return (
                  <li key={u.clave}>
                    <button
                      type="button"
                      onClick={() => tocarPieza(u.clave)}
                      disabled={bloqueada}
                      aria-pressed={asignada && persona === activa}
                      className={`w-full min-h-14 px-3 py-2 rounded-xl border-2 flex items-center justify-between gap-2 text-left cursor-pointer touch-manipulation disabled:cursor-not-allowed disabled:opacity-60 ${
                        asignada ? color(persona) : 'bg-white border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-tight break-words">{u.nombre}</span>
                        {u.detalle && <span className="block text-[11px] text-neutral-500">{u.detalle}</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono text-sm font-bold">{pesos(u.centavos)}</span>
                        {asignada && <span className="flex items-center justify-end gap-1 text-[11px] font-black">{bloqueada && <Lock aria-hidden="true" className="w-3 h-3" />}Persona {persona + 1}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="text-xs text-neutral-500">
          «Guardar e imprimir» la registra como Cuenta 1 a {personas} de esta orden e imprime un ticket por persona en caja.
          El cobro sigue siendo uno solo, por el total.
        </p>
      </div>

      <div className="shrink-0 p-3 border-t border-neutral-100 space-y-2">
        {motivoNoGuardar && <p className="text-xs font-semibold text-amber-800 text-center">{motivoNoGuardar}</p>}
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="h-12 px-4 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200 text-base font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <X className="w-5 h-5" /> Cerrar
          </button>
          {aviso?.reimprimir ? (
            <button
              type="button"
              onClick={reimprimir}
              disabled={ocupado}
              className="h-12 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-base font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {imprimiendo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />} Volver a imprimir
            </button>
          ) : (
            <button
              type="button"
              onClick={guardar}
              disabled={ocupado || !!motivoNoGuardar}
              className="h-12 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-base font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
              {guardando ? 'Guardando e imprimiendo…' : `Guardar e imprimir ${personas} cuentas`}
            </button>
          )}
        </div>
        {guardadas.length > 0 && vigente && !aviso?.reimprimir && (
          <button
            type="button"
            onClick={reimprimir}
            disabled={ocupado}
            className="w-full h-10 rounded-xl text-sm font-semibold text-violet-700 hover:bg-violet-50 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {imprimiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Reimprimir los {guardadas.length} tickets guardados
          </button>
        )}
      </div>
    </div>
  );
}
