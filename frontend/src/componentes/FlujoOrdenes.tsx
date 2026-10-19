// Flujo compartido de Órdenes en caja y tablet: alta, llamada, borradores y pedido.
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Hash, Loader2, Minus, Phone, Plus, Send, User } from 'lucide-react';
import { BORRADOR_LLAMADA, piezasSinEnviar } from '../services/borradorPedido';
import { esOrdenActiva, etiquetaMesaRegistrada, MesaRegistrada, registrarMesa } from '../services/mesasService';
import { useMesasTurno } from '../services/sincronizacion';
import { SelectorTipoOrden } from './AppTabletCuenta';
import { PedidoOrden } from './PedidoOrden';
import { LimiteDeErrores } from './AlertasErrores';

export function FlujoOrdenes({ origen, cabecera, acciones }: {
  /** Identifica quién toma el pedido en los tickets; no cambia su flujo. */
  origen: string;
  cabecera?: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  // Orden abierta en pantalla (BD: orden.idOrden); su pedido se toma con PedidoOrden.
  const [ordenAbierta, setOrdenAbierta] = useState<number | null>(null);
  // LLAMADA: pedido por teléfono que aún no es orden (se registra con el nombre al terminar).
  const [llamada, setLlamada] = useState(false);
  const enOrden = ordenAbierta !== null || llamada;
  const [agregandoMesa, setAgregandoMesa] = useState(false);

  // La caja y la tablet comparten la lista y su actualización en vivo.
  const { mesas: mesasTurno, error: errorMesas, recargar: cargarMesas } = useMesasTurno();
  const mesas = mesasTurno === null ? null : mesasTurno.filter(esOrdenActiva);

  // Siguiente número consecutivo: el mayor número de mesa activa en el turno + 1 (o 1 si no hay).
  const siguienteMesa = (mesas ?? []).reduce((max, m) => (/^\d+$/.test(m.nombre) ? Math.max(max, Number(m.nombre)) : max), 0) + 1;

  // "Agregar mesa": se registra en la base (en el turno abierto) y se abre su pedido.
  const abrirCuenta = async (_tipo: 'mesa' | 'nombre', identificador: string, paraLlevar: boolean) => {
    const { mesa } = await registrarMesa(identificador, paraLlevar);
    setAgregandoMesa(false);
    setLlamada(false);
    setOrdenAbierta(mesa.id);
    cargarMesas();
  };
  // "LLAMADA": se abre el menú sin registrar la orden; si ya había una llamada a medias, se retoma.
  const abrirLlamada = () => {
    setAgregandoMesa(false);
    setOrdenAbierta(null);
    setLlamada(true);
  };

  const abrirMesaRegistrada = (mesa: MesaRegistrada) => setOrdenAbierta(mesa.id);
  const volverAOrdenes = () => {
    setOrdenAbierta(null);
    setLlamada(false);
    cargarMesas();
  };

  return (
    // Ocupa el espacio disponible: solo se desplazan la lista y los recuadros que no quepan.
    <div data-flujo-ordenes className="h-full min-h-0 overflow-hidden text-neutral-900 flex flex-col select-none">
      {/* Medidas en px (no rem): la pantalla de pedido escala el texto con rem y el encabezado no debe cambiar de tamaño. */}
      <header className="shrink-0 h-[80px] bg-white border-b border-neutral-200">
        <div className="h-full px-[16px] flex items-center justify-between gap-[12px]">
          {cabecera ?? (
            <div className="min-w-0 leading-tight">
              <h2 className="text-[20px] font-bold">Órdenes</h2>
              <p className="mt-[6px] text-[12px] text-neutral-500">
                {(mesas ?? []).length} órdenes en el turno · {(mesas ?? []).filter((m) => Number(m.total) > 0).length} con pedido
              </p>
            </div>
          )}
          <div className="flex items-center gap-[8px] shrink-0">
            {/* Con una orden abierta: volver a la lista. Lo que no se envió queda guardado (services/borradorPedido.ts). */}
            {enOrden && (
              <button
                onClick={volverAOrdenes}
                className="neon-solido neon-azul h-[56px] px-[24px] rounded-[12px] flex items-center gap-[8px] text-[18px] font-bold tracking-wide cursor-pointer"
              >
                <ArrowLeft className="w-[24px] h-[24px]" />
                ÓRDENES
              </button>
            )}
            {/* Agregar mesa (o cuenta a nombre de un cliente) */}
            <button
              onClick={() => setAgregandoMesa(true)}
              aria-label="Agregar orden"
              className={`neon-solido neon-fresco h-[56px] rounded-[12px] flex items-center gap-[8px] text-[18px] font-bold cursor-pointer ${
                enOrden ? 'px-[16px] sm:px-[24px]' : 'px-[24px]'
              }`}
            >
              <Plus className="w-[24px] h-[24px]" />
              {/* En tablets angostas, con ÓRDENES a la vista, solo el ícono para que quepa el encabezado */}
              <span className={enOrden ? 'hidden sm:inline' : undefined}>Agregar orden</span>
            </button>
            {acciones}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-3">
        {/* Si la pantalla falla, se ve el problema y se puede volver a las órdenes sin cerrar la app. */}
        <LimiteDeErrores
          key={llamada ? 'llamada' : (ordenAbierta ?? 'mesas')}
          salida={enOrden ? { texto: 'Volver a las órdenes', accion: volverAOrdenes } : undefined}
        >
          {llamada ? (
            // LLAMADA: al terminar se registra con el nombre del cliente y se pasa a esa orden.
            <PedidoOrden
              idOrden={null}
              origen={origen}
              pantallaCompleta
              onVolver={volverAOrdenes}
              onOrdenCreada={(id) => {
                setLlamada(false);
                setOrdenAbierta(id);
                cargarMesas();
              }}
            />
          ) : ordenAbierta !== null ? (
            // Pedido desde la base: menú (producto), envío a cocina (orden_has_detalle) y total.
            <PedidoOrden idOrden={ordenAbierta} origen={origen} pantallaCompleta onVolver={volverAOrdenes} />
          ) : (
            <VistaMesas
              mesas={mesas}
              error={errorMesas}
              onAbrir={abrirMesaRegistrada}
              piezasLlamada={piezasSinEnviar(BORRADOR_LLAMADA)}
              onAbrirLlamada={abrirLlamada}
            />
          )}
        </LimiteDeErrores>
      </main>

      <AnimatePresence>
        {agregandoMesa && (
          <DialogoNuevaCuenta
            siguienteMesa={siguienteMesa}
            onAbrir={abrirCuenta}
            onLlamada={abrirLlamada}
            onCancelar={() => setAgregandoMesa(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Mesas ---------- */

/**
 * Cuadrícula de las mesas registradas en la base (tabla `mesas`) en el turno abierto (mesas.turno_id).
 * Se agregan con "Agregar mesa" del encabezado. Por tarjeta:
 *   - título          → mesas.codigo ("5" se muestra "Mesa 5"; un nombre tal cual)
 *   - PARA LLEVAR/... → mesas.tipo_venta_id (2 = para llevar)
 *   - estado y total  → del pedido de esta tablet si ya lo tiene; si no, mesas.total
 * Orden: el que manda la base (números de menor a mayor, después nombres).
 */
function VistaMesas({
  mesas,
  error,
  onAbrir,
  piezasLlamada,
  onAbrirLlamada,
}: {
  mesas: MesaRegistrada[] | null;
  error: string | null;
  onAbrir: (mesa: MesaRegistrada) => void;
  /** Piezas de una LLAMADA a medias (aún no es orden); 0 si no hay. */
  piezasLlamada: number;
  onAbrirLlamada: () => void;
}) {
  return (
    <section className="h-full min-h-0 flex flex-col gap-2">
      <h2 className="shrink-0 text-sm font-bold text-neutral-700">Órdenes</h2>

      {error && (
        <div className="shrink-0 flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {mesas === null && !error && (
        <div className="py-8 flex justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}
      {mesas?.length === 0 && piezasLlamada === 0 && (
        <p className="text-sm text-neutral-500">No hay órdenes en este turno. Toca «Agregar orden» para abrir una.</p>
      )}

      {/* Si hay más mesas de las que caben, solo esta zona se desplaza (la página no) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 auto-rows-min content-start gap-2">
        {/* LLAMADA a medias: todavía no es orden; se retoma aquí */}
        {piezasLlamada > 0 && (
          <button
            onClick={onAbrirLlamada}
            className="neon neon-azul min-h-20 rounded-xl border-2 p-2.5 text-left flex flex-col justify-between gap-2 cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-sm font-black tracking-wide">
              <Phone className="w-4 h-4" /> LLAMADA
            </span>
            <span className="leading-tight">
              <span className="block text-xs font-medium">Sin nombre todavía</span>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">
                <Send className="w-3 h-3" />
                {piezasLlamada} sin enviar
              </span>
            </span>
          </button>
        )}
        {(mesas ?? []).map((mesa) => {
          const titulo = etiquetaMesaRegistrada(mesa);
          const paraLlevar = mesa.tipo_venta_id === 2;
          // BD: orden.total (suma de orden_has_detalle).
          const total = Number(mesa.total);
          const pidio = mesa.estatus === 1; // orden.estatus 1 = PAGANDO (pidió la cuenta)
          // Productos agregados en esta tablet que todavía no se envían a cocina (borrador guardado).
          const sinEnviar = pidio ? 0 : piezasSinEnviar(mesa.id);
          return (
            <button
              key={mesa.id}
              onClick={() => onAbrir(mesa)}
              className={`neon ${pidio ? 'neon-fuego' : 'neon-cian'} min-h-20 rounded-xl border-2 p-2.5 text-left flex flex-col justify-between gap-2 cursor-pointer`}
            >
              {/* Título y, en el otro extremo, el tipo de venta (mesas.tipo_venta_id) */}
              <div className="flex items-start justify-between gap-1.5">
                <span className="text-sm font-bold leading-tight break-words min-w-0">{titulo}</span>
                <span
                  className={`shrink-0 text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded border ${
                    paraLlevar ? 'bg-violet-100 text-violet-800 border-violet-300' : 'bg-white text-sky-800 border-sky-200'
                  }`}
                >
                  {paraLlevar ? 'PARA LLEVAR' : 'COMER AQUÍ'}
                </span>
              </div>
              <div className="leading-tight">
                <div className={`text-xs font-medium ${pidio ? 'text-amber-800' : 'text-sky-800'}`}>
                  {pidio ? 'Cuenta pedida' : total > 0 ? 'Con pedido' : 'Sin pedido'} · ${total.toFixed(2)}
                </div>
                {sinEnviar > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">
                    <Send className="w-3 h-3" />
                    {sinEnviar} sin enviar
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

type ModoNuevaCuenta = 'nombre' | 'mesa';

/**
 * Abrir cuenta: dos opciones, "Por nombre" y, justo abajo, "Núm. de mesa".
 * El número de mesa es libre (cualquier N ≥ 1, sin límite ni lista fija de mesas) y se sugiere el
 * siguiente consecutivo; así escala a cualquier cantidad de mesas.
 * BD: no depende de la tabla `mesas`; la cuenta guarda el número (ver comentario de `abrir`).
 */
function DialogoNuevaCuenta({
  siguienteMesa,
  onAbrir,
  onLlamada,
  onCancelar,
}: {
  siguienteMesa: number;
  onAbrir: (tipo: 'mesa' | 'nombre', identificador: string, paraLlevar: boolean) => Promise<void>;
  /** Pedido por teléfono: abre el menú sin registrar la orden; el nombre se pide al terminar. */
  onLlamada: () => void;
  onCancelar: () => void;
}) {
  const [modo, setModo] = useState<ModoNuevaCuenta>('mesa');
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState(String(siguienteMesa));
  const [paraLlevar, setParaLlevar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numeroMesa = Number(numero);
  const numeroValido = Number.isInteger(numeroMesa) && numeroMesa >= 1;
  const listo = modo === 'nombre' ? !!nombre.trim() : numeroValido;

  const cambiarNumero = (delta: number) => setNumero((n) => String(Math.max(1, (Number(n) || 0) + delta)));

  const [guardando, setGuardando] = useState(false);

  const confirmar = async () => {
    setGuardando(true);
    setError(null);
    try {
      // "Mesa N" es la misma etiqueta que usa la caja; en la base se guarda como código "N".
      if (modo === 'mesa') await onAbrir('mesa', `Mesa ${numeroMesa}`, paraLlevar);
      else await onAbrir('nombre', nombre, paraLlevar);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la cuenta.');
      setGuardando(false);
    }
  };

  const claseOpcion = (activo: boolean) =>
    `rounded-xl border-2 px-3 py-2.5 space-y-1.5 transition-colors cursor-pointer ${
      activo ? 'border-emerald-400 bg-emerald-50/50' : 'border-neutral-200 bg-white hover:border-neutral-300'
    }`;

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancelar}
    >
      {/* Sin scroll: en horizontal va en dos columnas (llamada y nombre | mesa y tipo) para que quepa completo. */}
      <motion.div
        role="dialog"
        aria-labelledby="nueva-cuenta-titulo"
        className="w-full max-w-sm landscape:max-w-3xl max-h-full overflow-hidden bg-white rounded-2xl shadow-xl p-4 flex flex-col gap-3"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nueva-cuenta-titulo" className="text-base font-bold">
          Abrir cuenta
        </h2>

        <div className="grid gap-3 landscape:grid-cols-2">
          <div className="flex flex-col gap-3">
            {/* Pedido por teléfono: se toma de una vez y el nombre se guarda al colgar */}
            <button
              type="button"
              onClick={onLlamada}
              className="neon-solido neon-azul w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left cursor-pointer"
            >
              <Phone className="w-7 h-7 shrink-0" />
              <span>
                <span className="block text-lg font-black tracking-wide">LLAMADA</span>
                <span className="block text-xs font-medium opacity-90">Toma el pedido ya; el nombre se guarda al terminar</span>
              </span>
            </button>

            {/* Opción 1: por nombre (cuentas.tipo_identificador = 'nombre') */}
            <div className={claseOpcion(modo === 'nombre')} onClick={() => setModo('nombre')}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <User className="w-4 h-4 text-neutral-500" /> Por nombre
              </div>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onFocus={() => setModo('nombre')}
                placeholder="Nombre del cliente"
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm focus:outline-none focus:border-amber-500 select-text"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Opción 2: número de mesa (cuentas.tipo_identificador = 'mesa'), consecutivo y sin límite */}
            <div className={claseOpcion(modo === 'mesa')} onClick={() => setModo('mesa')}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Hash className="w-4 h-4 text-neutral-500" /> Núm. de mesa
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModo('mesa');
                    cambiarNumero(-1);
                  }}
                  aria-label="Mesa anterior"
                  className="w-10 h-10 rounded-lg border border-neutral-300 bg-white flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
                  onFocus={() => setModo('mesa')}
                  inputMode="numeric"
                  aria-label="Número de mesa"
                  className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-neutral-300 bg-white text-center font-mono text-base font-bold focus:outline-none focus:border-amber-500 select-text"
                />
                <button
                  type="button"
                  onClick={() => {
                    setModo('mesa');
                    cambiarNumero(1);
                  }}
                  aria-label="Mesa siguiente"
                  className="w-10 h-10 rounded-lg border border-neutral-300 bg-white flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-neutral-500">Siguiente consecutivo: Mesa {siguienteMesa}</p>
            </div>

            {/* cuentas.para_llevar */}
            <SelectorTipoOrden paraLlevar={paraLlevar} onChange={setParaLlevar} compacto />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancelar} className="h-11 rounded-xl text-sm text-neutral-600 hover:bg-neutral-100 font-medium cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!listo || guardando}
            className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {guardando ? 'Guardando…' : 'Abrir'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
