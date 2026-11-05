// Solo caja: quitar de la cuenta lo que se mandó por error. Un producto (uno o varios renglones del mismo, de varios
// envíos) se quita completo o por piezas; MIXTAS y extras, completos. El servidor recalcula el total.
import React, { useEffect, useState } from 'react';
import { Loader2, Minus, Plus, Trash2, X } from 'lucide-react';
import { DetalleOrdenBD, ExtraOrdenBD, OrdenBD, quitarDelPedido, quitarExtraDelPedido } from '../services/pedidosService';
import { importeAQuitar, repartoAQuitar } from '../services/quitarDelPedido';

export type AQuitar =
  | { tipo: 'producto'; nombre: string; lineas: DetalleOrdenBD[] }
  | { tipo: 'extra'; extra: ExtraOrdenBD };

type OrdenActualizada = { orden: OrdenBD; detalle: DetalleOrdenBD[]; extras: ExtraOrdenBD[] };

const dinero = (n: number) => `$${n.toFixed(2)}`;

export function DialogoQuitarDelPedido({ idOrden, aQuitar, dividida = false, onQuitado, onCancelar }: {
  idOrden: number;
  aQuitar: AQuitar;
  /** La cuenta está dividida (y nadie ha pagado): al quitar algo, las cuentas dejan de cuadrar. */
  dividida?: boolean;
  onQuitado: (datos: OrdenActualizada) => void;
  onCancelar: () => void;
}) {
  const lineas = aQuitar.tipo === 'producto' ? aQuitar.lineas : [];
  const total = lineas.reduce((acc, l) => acc + l.cantidad, 0);
  // MIXTAS no se quitan por piezas.
  const porPiezas = aQuitar.tipo === 'producto' && total > 1 && !lineas.some((l) => l.opciones?.reparto?.length);
  const [piezas, setPiezas] = useState(total);
  const [quitando, setQuitando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pasos = repartoAQuitar(lineas, piezas);
  const importe = aQuitar.tipo === 'producto' ? importeAQuitar(pasos) : aQuitar.extra.importe;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !quitando) onCancelar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar, quitando]);

  const quitar = async () => {
    setQuitando(true);
    setError(null);
    try {
      let datos: OrdenActualizada | null = null;
      if (aQuitar.tipo === 'extra') {
        datos = await quitarExtraDelPedido(idOrden, aQuitar.extra.id);
      } else {
        for (const paso of pasos) datos = await quitarDelPedido(idOrden, paso.linea.idDetalle_Orden, paso.piezas);
      }
      if (datos) onQuitado(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar de la cuenta.');
      setQuitando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={() => !quitando && onCancelar()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="titulo-quitar" onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-quitar" className="text-xl font-bold">Quitar de la cuenta</h2>
          <button type="button" onClick={onCancelar} disabled={quitando} aria-label="Cerrar" className="w-10 h-10 flex items-center justify-center cursor-pointer disabled:opacity-40"><X /></button>
        </div>

        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
          <div className="font-semibold text-neutral-900 break-words">
            {aQuitar.tipo === 'extra' ? `Extra: ${aQuitar.extra.descripcion}` : aQuitar.nombre}
          </div>
          {aQuitar.tipo === 'producto' && (
            <div className="text-sm text-neutral-600">{total} {total === 1 ? 'pieza enviada' : 'piezas enviadas'}</div>
          )}
        </div>

        {porPiezas && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">¿Cuántas quitar?</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPiezas((n) => Math.max(1, n - 1))} disabled={quitando || piezas <= 1} aria-label="Quitar una pieza menos" className="w-12 h-12 rounded-xl border border-neutral-300 flex items-center justify-center cursor-pointer disabled:opacity-40"><Minus className="w-5 h-5" /></button>
              <span className="min-w-12 text-center text-2xl font-bold font-mono" aria-live="polite">{piezas}</span>
              <button type="button" onClick={() => setPiezas((n) => Math.min(total, n + 1))} disabled={quitando || piezas >= total} aria-label="Quitar una pieza más" className="w-12 h-12 rounded-xl border border-neutral-300 flex items-center justify-center cursor-pointer disabled:opacity-40"><Plus className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        <p className="text-sm text-neutral-600">
          Se descuentan <b className="font-mono text-neutral-900">{dinero(importe)}</b> del total. No se imprime nada en cocina.
        </p>
        {dividida && (
          <p className="text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2">
            Esta cuenta está dividida: después de quitarlo, vuelve a dividirla (en Cajas sale «Volver a dividir»).
          </p>
        )}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancelar} disabled={quitando} className="h-12 rounded-xl border border-neutral-300 font-semibold cursor-pointer disabled:opacity-40">Cancelar</button>
          <button type="button" onClick={quitar} disabled={quitando} className="h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
            {quitando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            {porPiezas && piezas < total ? `Quitar ${piezas}` : 'Quitar'}
          </button>
        </div>
      </div>
    </div>
  );
}
