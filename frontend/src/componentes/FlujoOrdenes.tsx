// Flujo compartido de Órdenes en caja y tablet: croquis de mesas, nombre, llamada, borradores y pedido.
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, ArrowRightLeft, Loader2, Phone, Send, User } from 'lucide-react';
import { BORRADOR_LLAMADA, piezasSinEnviar } from '../services/borradorPedido';
import { esOrdenActiva, etiquetaMesaRegistrada, MesaRegistrada, registrarMesa } from '../services/mesasService';
import { useMesasTurno } from '../services/sincronizacion';
import { SelectorTipoOrden } from './AppTabletCuenta';
import { PedidoOrden } from './PedidoOrden';
import { LimiteDeErrores } from './AlertasErrores';
import { CroquisMesas, esMesaDelCroquis, ordenesPorMesa } from './CroquisMesas';
import { DialogoCambiarMesa } from './DialogoCambiarMesa';

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
  const [pidiendoNombre, setPidiendoNombre] = useState(false);
  const [cambiandoMesa, setCambiandoMesa] = useState(false);
  // Mesa del croquis que se está registrando en el servidor, y el error si no se pudo.
  const [abriendoMesa, setAbriendoMesa] = useState<number | null>(null);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);

  // La caja y la tablet comparten la lista y su actualización en vivo.
  const { mesas: mesasTurno, error: errorMesas, mesaPrueba, recargar: cargarMesas } = useMesasTurno();
  const mesas = mesasTurno === null ? null : mesasTurno.filter(esOrdenActiva);

  // Croquis: mesa ocupada → su orden; libre → se registra con ese número (en el turno abierto) y se abre.
  const tocarMesa = async (numero: number, orden: MesaRegistrada | undefined) => {
    setErrorAlta(null);
    if (orden) return setOrdenAbierta(orden.id);
    setAbriendoMesa(numero);
    try {
      // Si otra tablet la acaba de abrir, el servidor devuelve esa misma orden.
      const { mesa } = await registrarMesa(String(numero), false);
      setOrdenAbierta(mesa.id);
      cargarMesas();
    } catch (err) {
      setErrorAlta(err instanceof Error ? err.message : `No se pudo abrir la mesa ${numero}.`);
    } finally {
      setAbriendoMesa(null);
    }
  };
  // NOMBRE: orden a nombre del cliente (comer aquí o para llevar).
  const abrirPorNombre = async (nombre: string, paraLlevar: boolean) => {
    const { mesa } = await registrarMesa(nombre, paraLlevar, 'nombre');
    setPidiendoNombre(false);
    setOrdenAbierta(mesa.id);
    cargarMesas();
  };
  // "LLAMADA": se abre el menú sin registrar la orden; si ya había una llamada a medias, se retoma.
  const abrirLlamada = () => {
    setPidiendoNombre(false);
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
            {/* Las órdenes se abren desde el croquis (mesas) o con NOMBRE / LLAMADA debajo de él. */}
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
              error={errorAlta ?? errorMesas}
              abriendoMesa={abriendoMesa}
              onTocarMesa={tocarMesa}
              onAbrir={abrirMesaRegistrada}
              piezasLlamada={piezasSinEnviar(BORRADOR_LLAMADA)}
              onAbrirLlamada={abrirLlamada}
              onNombre={() => setPidiendoNombre(true)}
              mesaPrueba={mesaPrueba}
              onCambiar={() => setCambiandoMesa(true)}
            />
          )}
        </LimiteDeErrores>
      </main>

      <AnimatePresence>
        {pidiendoNombre && <DialogoNombre onAbrir={abrirPorNombre} onCancelar={() => setPidiendoNombre(false)} />}
        {cambiandoMesa && mesas && (
          <DialogoCambiarMesa
            mesas={mesas}
            onCambiada={() => {
              setCambiandoMesa(false);
              cargarMesas();
            }}
            onCerrar={() => setCambiandoMesa(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Mesas ---------- */

/**
 * SALÓN: el croquis de las 9 mesas (CroquisMesas) con las órdenes activas del turno.
 * PEDIDOS: a su derecha, las órdenes a nombre y la LLAMADA a medias, con los botones NOMBRE y LLAMADA. Por tarjeta:
 *   - título          → orden.nombre (el nombre del cliente)
 *   - PARA LLEVAR/... → orden.tipo_orden (2 = para llevar)
 *   - estado y total  → orden.estatus y orden.total
 */
function VistaMesas({
  mesas,
  error,
  abriendoMesa,
  onTocarMesa,
  onAbrir,
  piezasLlamada,
  onAbrirLlamada,
  onNombre,
  mesaPrueba,
  onCambiar,
}: {
  mesas: MesaRegistrada[] | null;
  error: string | null;
  abriendoMesa: number | null;
  onTocarMesa: (numero: number, orden: MesaRegistrada | undefined) => void;
  onAbrir: (mesa: MesaRegistrada) => void;
  /** Piezas de una LLAMADA a medias (aún no es orden); 0 si no hay. */
  piezasLlamada: number;
  onAbrirLlamada: () => void;
  onNombre: () => void;
  /** Mesa de prueba del croquis (solo PC de desarrollo); null en producción. */
  mesaPrueba: string | null;
  /** Abre «Cambiar de mesa». */
  onCambiar: () => void;
}) {
  const otras = (mesas ?? []).filter((m) => !esMesaDelCroquis(m.nombre, mesaPrueba));
  // El conteo del salón es de las 9 mesas reales (la de prueba no cuenta).
  const enMesas = [...ordenesPorMesa(mesas ?? []).values()];
  const ocupadas = enMesas.length;
  const enCuenta = enMesas.filter((m) => m.estatus === 1).length;
  return (
    <section className="h-full min-h-0 flex flex-col gap-2">
      {error && (
        <div className="shrink-0 flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3">
        {/* Salón: el croquis con cuántas mesas hay libres, abiertas y con la cuenta pedida.
            En pantallas anchas mide lo justo para el croquis (proporción del dibujo) y PEDIDOS toma el resto. */}
        <div className="flex-1 md:flex-none md:h-full md:aspect-[33/25] md:max-w-[72%] min-w-0 min-h-0 flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black tracking-wide text-neutral-800">SALÓN</h3>
              <span className="text-xs text-neutral-500">{ocupadas} de 9 ocupadas</span>
              {/* Pasar una mesa abierta a una libre, con toda su cuenta */}
              <button
                type="button"
                onClick={onCambiar}
                disabled={ocupadas === 0 || ocupadas === 9}
                title={ocupadas === 0 ? 'No hay mesas abiertas' : ocupadas === 9 ? 'No hay mesas libres' : 'Cambiar una mesa abierta a una libre'}
                className="h-8 px-3 rounded-lg border-2 border-sky-300 bg-white text-sky-800 text-xs font-black tracking-wide flex items-center gap-1.5 hover:bg-sky-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowRightLeft className="w-4 h-4" /> CAMBIAR
              </button>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-neutral-600">
              <Leyenda clase="bg-[#efe7dc] border-[#d3c7b8]" texto={`Libres ${9 - ocupadas}`} />
              <Leyenda clase="bg-cyan-200 border-cyan-600" texto={`Abiertas ${ocupadas - enCuenta}`} />
              <Leyenda clase="bg-orange-200 border-orange-600" texto={`Cuenta ${enCuenta}`} />
            </div>
          </div>
          <div
            className="flex-1 min-h-0 px-4 py-2 flex items-center justify-center bg-neutral-50"
            style={{ backgroundImage: 'radial-gradient(circle, rgb(0 0 0 / 0.07) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
          >
            {mesas === null ? (
              !error && <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            ) : (
              <CroquisMesas ordenes={mesas} abriendo={abriendoMesa} onTocar={onTocarMesa} mesaPrueba={mesaPrueba} />
            )}
          </div>
        </div>

        {/* PEDIDOS: órdenes a nombre y LLAMADA a medias (no tienen mesa en el croquis), con sus dos botones */}
        <aside className="md:flex-1 min-w-0 shrink-0 md:shrink min-h-0 max-h-[45%] md:max-h-none flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-neutral-100">
            <h3 className="text-sm font-black tracking-wide text-neutral-800">PEDIDOS:</h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onNombre}
                className="neon-solido neon-violeta h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-black tracking-wide cursor-pointer"
              >
                <User className="w-4 h-4 shrink-0" /> NOMBRE
              </button>
              <button
                onClick={onAbrirLlamada}
                className="neon-solido neon-azul h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-black tracking-wide cursor-pointer"
              >
                <Phone className="w-4 h-4 shrink-0" /> LLAMADA
              </button>
            </div>
          </div>
          {/* Con el panel ancho, las tarjetas se acomodan en columnas */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] auto-rows-min content-start gap-2">
            {otras.length === 0 && piezasLlamada === 0 && (
              <p className="col-span-full py-6 text-center text-xs text-neutral-500">Sin pedidos a nombre ni llamadas.</p>
            )}
            {piezasLlamada > 0 && (
              <button
                onClick={onAbrirLlamada}
                className="neon neon-azul shrink-0 min-h-20 rounded-xl border-2 p-2.5 text-left flex flex-col justify-between gap-2 cursor-pointer"
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
            {otras.map((mesa) => {
              const paraLlevar = mesa.tipo_venta_id === 2;
              const total = Number(mesa.total);
              const pidio = mesa.estatus === 1; // orden.estatus 1 = PAGANDO (pidió la cuenta)
              const sinEnviar = pidio ? 0 : piezasSinEnviar(mesa.id);
              return (
                <button
                  key={mesa.id}
                  onClick={() => onAbrir(mesa)}
                  className={`neon ${pidio ? 'neon-fuego' : 'neon-cian'} shrink-0 min-h-20 rounded-xl border-2 p-2.5 text-left flex flex-col justify-between gap-2 cursor-pointer`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-sm font-bold leading-tight break-words min-w-0">{etiquetaMesaRegistrada(mesa)}</span>
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
        </aside>
      </div>
    </section>
  );
}

/** Muestra del color de un estado de mesa, con su texto ("Libres 7"). */
function Leyenda({ clase, texto }: { clase: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={`w-3 h-3 rounded-[4px] border-2 ${clase}`} />
      {texto}
    </span>
  );
}

/** Orden a nombre de un cliente (sin mesa del croquis), para comer aquí o para llevar. */
function DialogoNombre({
  onAbrir,
  onCancelar,
}: {
  onAbrir: (nombre: string, paraLlevar: boolean) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [paraLlevar, setParaLlevar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  // Un número se guardaría como esa mesa: las mesas se abren tocándolas en el croquis.
  const esNumero = /^(mesa\s*)?\d+$/i.test(limpio);

  const confirmar = async () => {
    if (!limpio || guardando) return;
    if (esNumero) {
      setError('Para una mesa, tócala en el croquis. Aquí escribe el nombre del cliente.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onAbrir(limpio, paraLlevar);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la orden.');
      setGuardando(false);
    }
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancelar}
    >
      <motion.div
        role="dialog"
        aria-labelledby="orden-nombre-titulo"
        className="w-full max-w-[22rem] max-h-full overflow-hidden bg-white rounded-xl shadow-xl p-3 flex flex-col gap-2"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="orden-nombre-titulo" className="text-sm font-bold flex items-center gap-1.5">
          <User className="w-4 h-4" /> Orden a nombre
        </h2>
        <input
          autoFocus
          aria-label="Nombre del cliente"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && confirmar()}
          placeholder="Nombre del cliente"
          className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm focus:outline-none focus:border-amber-500 select-text"
        />
        <div className="[&_button]:h-9 [&_button]:text-xs">
          <SelectorTipoOrden paraLlevar={paraLlevar} onChange={setParaLlevar} compacto />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancelar} className="h-9 rounded-lg text-xs text-neutral-600 hover:bg-neutral-100 font-medium cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!limpio || guardando}
            className="h-9 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {guardando ? 'Guardando…' : 'Abrir orden'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
