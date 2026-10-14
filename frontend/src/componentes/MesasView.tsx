import React, { useState } from 'react';
import { esOrdenActiva, etiquetaMesaRegistrada, MesaRegistrada, registrarMesa } from '../services/mesasService';
import { useMesasTurno } from '../services/sincronizacion';
import { AlertTriangle, LayoutGrid, Loader2, Plus, ShoppingBag } from 'lucide-react';
import { PedidoOrden } from './PedidoOrden';
import { COLOR_ESTATUS_ORDEN } from './PedidoEnviado';
import { ESTATUS_ORDEN } from '../services/pedidosService';

interface MesasViewProps {
  /** Nombre con el que la caja envía los pedidos (aparece en el ticket de cocina). */
  nombreUsuario: string;
}

/**
 * Mesas de la caja: las mismas que ve la tablet, leídas de la base (tabla `orden`, turno abierto)
 * y actualizadas cada pocos segundos. El total y el pedido salen de la base (orden.total, orden_has_detalle).
 */
export const MesasView: React.FC<MesasViewProps> = ({ nombreUsuario }) => {
  const { mesas: mesasBd, error: errorMesas, recargar } = useMesasTurno();
  // Solo órdenes activas (ABIERTA o PAGANDO); las cobradas se ven en Ventas.
  const mesas = (mesasBd ?? []).filter(esOrdenActiva);
  const siguienteNumero = mesas.reduce((max, m) => (/^\d+$/.test(m.nombre) ? Math.max(max, Number(m.nombre)) : max), 0) + 1;

  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [paraLlevarNueva, setParaLlevarNueva] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Orden abierta (BD: orden.idOrden) para tomar su pedido.
  const [ordenAbierta, setOrdenAbierta] = useState<number | null>(null);

  const conPedido = mesas.filter((m) => Number(m.total) > 0).length;

  const abrirForm = () => {
    setNombre(String(siguienteNumero));
    setParaLlevarNueva(false);
    setError(null);
    setMostrarForm(true);
  };

  // Agregar: INSERT en `orden` dentro del turno abierto (o reutiliza la fila si ya existe).
  const handleAgregar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await registrarMesa(nombre, paraLlevarNueva);
      setMostrarForm(false);
      setError(null);
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la orden.');
    } finally {
      setGuardando(false);
    }
  };

  if (ordenAbierta !== null) {
    return (
      <PedidoOrden
        idOrden={ordenAbierta}
        origen={`CAJA · ${nombreUsuario}`}
        onVolver={() => {
          setOrdenAbierta(null);
          recargar();
        }}
      />
    );
  }

  return (
    <div className="bg-white text-neutral-900 rounded-xl p-5 space-y-5 shadow-sm">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-amber-500" />
            <span>Órdenes</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {mesas.length} {mesas.length === 1 ? 'orden' : 'órdenes'} en el turno · {conPedido} con pedido
          </p>
        </div>

        {!mostrarForm && (
          <button
            onClick={abrirForm}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar orden</span>
          </button>
        )}
      </div>

      {/* Formulario para agregar */}
      {mostrarForm && (
        <form
          onSubmit={handleAgregar}
          className="flex flex-wrap items-end gap-3 p-4 bg-neutral-50 border border-neutral-200 rounded-lg"
        >
          <div className="flex-1 min-w-48">
            <label htmlFor="mesa-nombre" className="text-[11px] font-medium text-neutral-600 block mb-1">
              Número o nombre
            </label>
            <input
              id="mesa-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              placeholder="Ej. 5 o Terraza"
              className="w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 select-text"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700 pb-1.5 cursor-pointer">
            <input type="checkbox" checked={paraLlevarNueva} onChange={(e) => setParaLlevarNueva(e.target.checked)} />
            Para llevar
          </label>
          <button
            type="submit"
            disabled={guardando || !nombre.trim()}
            className="px-4 py-1.5 text-sm font-semibold text-neutral-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              setMostrarForm(false);
              setError(null);
            }}
            className="px-4 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </form>
      )}

      {(error || errorMesas) && (
        <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{error ?? errorMesas}</span>
        </div>
      )}

      {/* Cuadrícula de mesas */}
      {mesasBd === null && !errorMesas ? (
        <div className="py-10 flex justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : mesas.length === 0 ? (
        <div className="text-center text-sm text-neutral-500 py-10 border border-dashed border-neutral-300 rounded-lg">
          No hay órdenes en este turno. Agrégalas desde una tablet o con «Agregar orden».
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {mesas.map((mesa: MesaRegistrada) => {
            const total = Number(mesa.total);
            const paraLlevar = mesa.tipo_venta_id === 2;
            const pagando = mesa.estatus === 1;
            return (
              <div
                key={mesa.id}
                className={`bg-white border rounded-xl p-4 flex flex-col gap-3 ${
                  pagando ? 'border-amber-400 ring-2 ring-amber-200' : total > 0 ? 'border-sky-200' : 'border-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-2xl font-bold tracking-tight leading-tight break-words min-w-0">
                    {etiquetaMesaRegistrada(mesa)}
                    {paraLlevar && (
                      <span className="block w-fit mt-1 text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
                        PARA LLEVAR
                      </span>
                    )}
                  </div>
                  {/* orden.estatus: 0 ABIERTA, 1 PAGANDO, 2 PAGADO */}
                  <span
                    className={`shrink-0 text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full border ${
                      COLOR_ESTATUS_ORDEN[mesa.estatus] ?? COLOR_ESTATUS_ORDEN[0]
                    }`}
                  >
                    {ESTATUS_ORDEN[mesa.estatus] ?? `ESTATUS ${mesa.estatus}`}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  <span>Total</span>
                  <span className="text-base font-bold font-mono text-neutral-900">${total.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setOrdenAbierta(mesa.id)}
                  className="h-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> {total > 0 ? 'Ver / agregar productos' : 'Agregar productos'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
