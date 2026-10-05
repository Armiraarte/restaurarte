import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Account, Mesa, ProductCatalogItem } from '../types/pos';
import { cuentaDeMesa, etiquetaMesa, posDataService } from '../services/dataService';
import { AlertTriangle, BellRing, Clock, Eye, LayoutGrid, Plus, ShoppingBag, Trash2, User } from 'lucide-react';
import { AppTabletCuenta, DialogoTipoOrden } from './AppTabletCuenta';

interface MesasViewProps {
  mesas: Mesa[];
  accounts: Account[];
  productos: ProductCatalogItem[];
  /** Nombre con el que la caja envía las comandas (p. ej. el usuario en sesión). */
  nombreUsuario: string;
  onSelectAccount: (account: Account) => void;
}

type EstadoMesa = 'libre' | 'ocupada' | 'cuenta_solicitada';

const ESTILOS: Record<EstadoMesa, { label: string; card: string; badge: string; dot: string }> = {
  libre: {
    label: 'Libre',
    card: 'border-neutral-200 hover:border-neutral-300',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  ocupada: {
    label: 'Ocupada',
    card: 'border-sky-200',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
  },
  cuenta_solicitada: {
    label: 'Cuenta pedida',
    card: 'border-amber-300 ring-2 ring-amber-100',
    badge: 'bg-amber-50 text-amber-700 border-amber-300',
    dot: 'bg-amber-500 animate-pulse',
  },
};

export const MesasView: React.FC<MesasViewProps> = ({
  mesas,
  accounts,
  productos,
  nombreUsuario,
  onSelectAccount,
}) => {
  const siguienteNumero =
    mesas.reduce((max, m) => (/^\d+$/.test(m.nombre) ? Math.max(max, Number(m.nombre)) : max), 0) + 1;
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null);
  const [pedidoCuentaId, setPedidoCuentaId] = useState<string | null>(null);

  const origen = { name: 'CAJA', assignedWaiter: nombreUsuario };

  const cuentaDe = (mesa: Mesa) => cuentaDeMesa(mesa, accounts);

  const estadoDe = (cuenta: Account | undefined): EstadoMesa =>
    !cuenta ? 'libre' : cuenta.status === 'cuenta_solicitada' ? 'cuenta_solicitada' : 'ocupada';

  const ocupadas = mesas.filter((m) => cuentaDe(m)).length;

  const abrirForm = () => {
    setNombre(String(siguienteNumero));
    setError(null);
    setMostrarForm(true);
  };

  const handleAgregar = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      posDataService.addMesa(nombre);
      setMostrarForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la mesa.');
    }
  };

  const handleEliminar = (mesa: Mesa) => {
    try {
      posDataService.removeMesa(mesa.id);
      setConfirmarEliminarId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la mesa.');
    }
  };

  /** Abre la pantalla de pedido; si la mesa está libre, primero abre su cuenta. */
  // Mesa libre: antes de abrirla se pregunta el tipo de orden.
  const [mesaPorAbrir, setMesaPorAbrir] = useState<Mesa | null>(null);

  const agregarProductos = (mesa: Mesa) => {
    const cuenta = cuentaDe(mesa);
    if (cuenta) setPedidoCuentaId(cuenta.id);
    else setMesaPorAbrir(mesa);
  };

  const abrirMesa = (mesa: Mesa, paraLlevar: boolean) => {
    try {
      const cuenta = posDataService.simulateIncomingAccount(
        'mesa',
        etiquetaMesa(mesa),
        origen.name,
        origen.assignedWaiter,
        paraLlevar
      );
      setError(null);
      setMesaPorAbrir(null);
      setPedidoCuentaId(cuenta.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la mesa.');
      setMesaPorAbrir(null);
    }
  };

  const cuentaPedido = pedidoCuentaId ? posDataService.getAccountById(pedidoCuentaId) : undefined;
  if (cuentaPedido) {
    return (
      <AppTabletCuenta
        cuenta={cuentaPedido}
        origen={origen}
        productos={productos}
        onVolver={() => setPedidoCuentaId(null)}
        permitirNuevoProducto
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
            <span>Mesas</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {mesas.length} {mesas.length === 1 ? 'mesa' : 'mesas'} · {ocupadas} ocupadas · {mesas.length - ocupadas} libres
          </p>
        </div>

        {!mostrarForm && (
          <button
            onClick={abrirForm}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar mesa</span>
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
          <button
            type="submit"
            className="px-4 py-1.5 text-sm font-semibold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer"
          >
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

      {error && (
        <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}

      {/* Cuadrícula de mesas */}
      {mesas.length === 0 ? (
        <div className="text-center text-sm text-neutral-500 py-10 border border-dashed border-neutral-300 rounded-lg">
          No hay mesas registradas. Agrega la primera.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {mesas.map((mesa) => {
            const cuenta = cuentaDe(mesa);
            const estado = estadoDe(cuenta);
            const estilo = ESTILOS[estado];
            const confirmando = confirmarEliminarId === mesa.id;

            return (
              <div
                key={mesa.id}
                className={`bg-white border rounded-xl p-4 flex flex-col gap-3 transition-colors ${estilo.card}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-2xl font-bold tracking-tight leading-tight break-words min-w-0">
                    {etiquetaMesa(mesa)}
                    {cuenta?.paraLlevar && (
                      <span className="block w-fit mt-1 text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
                        PARA LLEVAR
                      </span>
                    )}
                  </div>
                  <span
                    className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${estilo.badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${estilo.dot}`} />
                    {estilo.label}
                  </span>
                </div>

                {cuenta ? (
                  <div className="space-y-1.5 text-xs text-neutral-600 border-t border-neutral-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="truncate">{cuenta.waiterName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Abierta {cuenta.openedAt}</span>
                    </div>
                    {estado === 'cuenta_solicitada' && (
                      <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Pidió la cuenta {cuenta.requestedAt}</span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-neutral-500">{cuenta.items.length} productos</span>
                      <span className="text-base font-bold font-mono text-neutral-900">
                        ${cuenta.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => agregarProductos(mesa)}
                        disabled={estado === 'cuenta_solicitada'}
                        title={estado === 'cuenta_solicitada' ? 'La cuenta ya fue pedida' : undefined}
                        className="h-10 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" /> Agregar
                      </button>
                      <button
                        onClick={() => onSelectAccount(cuenta)}
                        className="h-10 rounded-lg bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-700 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver cuenta
                      </button>
                    </div>
                  </div>
                ) : confirmando ? (
                  <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs">
                    <span className="text-neutral-600">¿Eliminar?</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleEliminar(mesa)}
                        className="px-2.5 py-1 font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md cursor-pointer"
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => setConfirmarEliminarId(null)}
                        className="px-2.5 py-1 font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-md cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 border-t border-neutral-100 pt-3">
                    <button
                      onClick={() => agregarProductos(mesa)}
                      className="flex-1 h-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> Agregar productos
                    </button>
                    <button
                      onClick={() => setConfirmarEliminarId(mesa.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      title={`Eliminar ${etiquetaMesa(mesa)}`}
                      aria-label={`Eliminar ${etiquetaMesa(mesa)}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {mesaPorAbrir && (
          <DialogoTipoOrden
            titulo={`Abrir ${etiquetaMesa(mesaPorAbrir)}`}
            onElegir={(paraLlevar) => abrirMesa(mesaPorAbrir, paraLlevar)}
            onCancelar={() => setMesaPorAbrir(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
