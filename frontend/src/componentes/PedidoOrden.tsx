// Pedido de una orden conectado a la base de datos. Lo usan la tablet (pantalla completa) y la caja.
//   Menú           → GET /api/menu (categorias, producto, producto_has_complemento)
//   Ya enviado     → GET /api/ordenes/:idOrden (orden_has_detalle)
//   Enviar a cocina→ POST /api/ordenes/:idOrden/pedido (orden_has_detalle + orden.total)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, CheckCircle2, HandCoins, ClipboardList, History, Home, Loader2, LockKeyhole, Minus, Plus, Printer, Send, ShoppingBag, Trash2, X } from 'lucide-react';
import {
  CategoriaMenu,
  ComplementoMenu,
  DetalleOrdenBD,
  enviarPedido,
  pedirCuenta,
  nombreProducto,
  PRECIO_CARNE_EXTRA,
  textoCarneExtra,
  obtenerMenu,
  obtenerOrden,
  OrdenBD,
  ProductoMenu,
} from '../services/pedidosService';
import { imprimirTicketCocina } from '../services/ticketCocinaService';
import { COLORES_CATEGORIA, iconoCategoria, NEON_CATEGORIA } from './iconosCategoria';
import { ExtrasLinea, OpcionesCategoria } from './OpcionesCategoria';
import { PedidoEnviado } from './PedidoEnviado';
import { useEnVivo } from '../services/enVivo';
import { useCadaTantoVisible } from '../services/sincronizacion';
import { guardarBorrador, leerBorrador } from '../services/borradorPedido';
import { TicketCocina } from '../types/ticketCocina';

interface LineaNueva {
  /** Cada vez que se agrega desde opciones es un plato aparte (3 y luego 5 = dos renglones). */
  id: number;
  /** Agregado con un toque en la cuadrícula rápida (Bebidas): esos sí se van sumando. */
  rapida: boolean;
  producto: ProductoMenu;
  categoria: string;
  cantidad: number;
  /** Complementos que el cliente no quiere ("sin Lechuga"). */
  sin: ComplementoMenu[];
  /** Mezcla de productos de la categoría ("Papa", "Frijol"): se guarda `producto` (el más caro) y en cocina sale la mezcla. */
  mezcla: string[];
  /** Solo Quesadillas: la pidieron sin queso (se guarda en la orden). Puede faltar en borradores viejos. */
  sinQueso?: boolean;
  /** Solo Hamburguesas: 1 = DOBLE CARNE, 2 = TRIPLE CARNE (+$20 por carne extra). Puede faltar en borradores viejos. */
  carneExtra?: number;
}

let siguienteLinea = 1;
/** "Papa con Frijol" si es mezcla; si no, el nombre del producto con su tamaño. */
const nombreLinea = (l: LineaNueva) => (l.mezcla.length > 1 ? l.mezcla.join(' con ') : nombreProducto(l.producto));
const textoSin = (l: LineaNueva) =>
  `${l.sinQueso ? ' · NO QUESO' : ''}${l.carneExtra ? ` · ${textoCarneExtra(l.carneExtra)}` : ''}${
    l.sin.length ? ` · sin ${l.sin.map((c) => c.nombre.toLowerCase()).join(', ')}` : ''
  }`;
/** Precio de una pieza con sus carnes extra (el servidor lo calcula igual al guardar). */
const precioLinea = (l: LineaNueva) => l.producto.precio + (l.carneExtra ?? 0) * PRECIO_CARNE_EXTRA;

/** Categorías que se muestran como cuadrícula rápida (Bebidas): sin complementos y con muchos productos. */
const esCuadricula = (c: CategoriaMenu) =>
  c.productos.every((p) => p.complementos.length === 0) && new Set(c.productos.map((p) => p.nombre)).size > 6;

/** Categorías que no van en el ticket de cocina (se guardan en la orden, pero no se imprimen). */
const FUERA_DEL_TICKET = new Set(['bebidas']);
const vaEnTicket = (l: LineaNueva) => !FUERA_DEL_TICKET.has(l.categoria.trim().toLowerCase());

interface Props {
  idOrden: number;
  /** Quién manda el pedido (aparece en el ticket de cocina): "Tablet 01", "CAJA". */
  origen: string;
  onVolver: () => void;
  /** Tablet: ocupa exactamente la pantalla, sin scroll de página. */
  pantallaCompleta?: boolean;
}


const dinero = (n: number) => `$${n.toFixed(2)}`;

/** JSON del ticket de cocina (types/ticketCocina.ts) a partir de lo que se acaba de enviar. */
function ticketDe(orden: OrdenBD, lineas: LineaNueva[], ronda: number, origen: string): TicketCocina {
  return {
    version: 1,
    orden_cocina: `#${String(orden.idOrden).padStart(5, '0')}-${ronda}`,
    comanda_id: `${orden.idOrden}-${ronda}`,
    cuenta_id: String(orden.idOrden),
    mesa: orden.etiqueta,
    tipo_identificador: /^\d+$/.test(orden.nombre) ? 'mesa' : 'nombre',
    para_llevar: orden.tipo_orden === 2,
    ronda,
    adicion: ronda > 1,
    mesero: origen,
    tablet: origen,
    enviada_en: new Date().toISOString(),
    productos: lineas.map((l) => ({
      partida_id: String(l.producto.id),
      producto_id: String(l.producto.id),
      nombre: `${l.categoria} · ${nombreLinea(l)}`,
      categoria: l.categoria,
      cantidad: l.cantidad,
      opciones: [],
      // Quesadilla sin queso: primero «NO QUESO» (con queso no se escribe, ya se sabe).
      // Complementos: si lleva todos, solo «TODO»; si se quitó alguno, solo lo que no quiere («Sin lechuga»).
      descripcion: [
        ...(l.sinQueso ? ['NO QUESO'] : []),
        ...(l.carneExtra ? [textoCarneExtra(l.carneExtra)] : []),
        ...(l.producto.complementos.length === 0
          ? []
          : l.sin.length === 0
            ? ['TODO']
            : l.sin.map((c) => `Sin ${c.nombre.toLowerCase()}`)),
      ],
    })),
    total_piezas: lineas.reduce((acc, l) => acc + l.cantidad, 0),
  };
}

export const PedidoOrden: React.FC<Props> = ({ idOrden, origen, onVolver, pantallaCompleta = false }) => {
  const [menu, setMenu] = useState<CategoriaMenu[] | null>(null);
  const [orden, setOrden] = useState<OrdenBD | null>(null);
  const ultimaOrden = useRef<OrdenBD | null>(null);
  const [detalle, setDetalle] = useState<DetalleOrdenBD[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [categoriaAbierta, setCategoriaAbierta] = useState<CategoriaMenu | null>(null);
  // Pantalla de opciones de una categoría (como la de antes): elige uno, tamaño, complementos y cantidad.
  const [opcionesDe, setOpcionesDe] = useState<CategoriaMenu | null>(null);
  // Lo agregado y aún no enviado se guarda en el dispositivo: si se sale a ÓRDENES, al volver sigue aquí.
  const [nuevo, setNuevo] = useState<LineaNueva[]>(() => {
    const guardado = leerBorrador<LineaNueva>(idOrden);
    // Los renglones recuperados conservan su id: los que se agreguen siguen después.
    siguienteLinea = Math.max(siguienteLinea, ...guardado.map((l) => l.id + 1));
    return guardado;
  });
  useEffect(() => guardarBorrador(idOrden, nuevo), [idOrden, nuevo]);
  // Pestañas: PEDIDO (lo ya enviado) y AGREGAR (menú + nuevo pedido).
  const [pestana, setPestana] = useState<'pedido' | 'agregar'>('pedido');
  // Tablet: lo ya enviado se ve en una ventana desde el botón de historial.
  const [verHistorial, setVerHistorial] = useState(false);
  const piezasEnviadas = detalle.reduce((acc, d) => acc + d.cantidad, 0);
  const [enviando, setEnviando] = useState(false);
  const [pidiendoCuenta, setPidiendoCuenta] = useState(false);
  const [alerta, setAlerta] = useState<{ titulo: string; detalle: string[]; impresion?: { ok: boolean | null; texto: string } } | null>(null);
  const bloqueada = orden !== null && orden.estatus !== 0;
  const puedeEditar = orden?.estatus === 0 && !enviando && !pidiendoCuenta;

  const textoOrden = useRef('');
  const actualizarOrden = useCallback((datos: { orden: OrdenBD; detalle: DetalleOrdenBD[] }) => {
    // Una respuesta anterior al cobro no puede volver a abrir la edición.
    const actual = ultimaOrden.current;
    if (actual?.idOrden === datos.orden.idOrden && actual.estatus > datos.orden.estatus) return;
    // Igual que la última: no se vuelve a dibujar el menú (la tablet relee la orden cada pocos segundos).
    const texto = JSON.stringify(datos);
    if (texto === textoOrden.current) return;
    textoOrden.current = texto;
    ultimaOrden.current = datos.orden;
    setOrden(datos.orden);
    setDetalle(datos.detalle);
  }, []);

  useEffect(() => {
    if (!bloqueada) return;
    setOpcionesDe(null);
    setCategoriaAbierta(null);
    setNuevo([]);
    setPestana('pedido');
  }, [bloqueada]);

  // En la tablet el menú usa la escala reducida para que todo quepa (ver index.css).
  useEffect(() => {
    if (!pantallaCompleta) return;
    document.documentElement.classList.add('app-tablet-menu');
    return () => document.documentElement.classList.remove('app-tablet-menu');
  }, [pantallaCompleta]);

  const cargarOrden = useCallback(async () => {
    try {
      const datos = await obtenerOrden(idOrden);
      actualizarOrden(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la orden.');
    }
  }, [idOrden, actualizarOrden]);

  useEffect(() => {
    obtenerMenu()
      .then(setMenu)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el menú.'));
    cargarOrden();
  }, [cargarOrden]);

  // Al momento: si otra pantalla envía un pedido o pide la cuenta, se ve aquí sin refrescar.
  // Respaldo: se vuelve a leer cada 5 s. (No toca lo que se está seleccionando en "Nuevo pedido".)
  const refrescar = useCallback(async () => {
    try {
      const datos = await obtenerOrden(idOrden);
      actualizarOrden(datos);
    } catch {
      // sin conexión: se conserva lo último y se reintenta
    }
  }, [idOrden, actualizarOrden]);
  useEnVivo(['ordenes'], refrescar);
  useCadaTantoVisible(refrescar, 5_000);

  useEffect(() => {
    if (!alerta) return;
    const t = setTimeout(() => setAlerta(null), 4000);
    return () => clearTimeout(t);
  }, [alerta]);

  /** Desde la pantalla de opciones: siempre un renglón nuevo, aunque sea el mismo producto. */
  const agregar = (
    producto: ProductoMenu,
    categoria: string,
    cantidad: number,
    sin: ComplementoMenu[],
    mezcla: string[],
    { sinQueso, carneExtra }: ExtrasLinea
  ) => {
    if (!puedeEditar) return;
    setNuevo((lista) => [
      ...lista,
      { id: siguienteLinea++, rapida: false, producto, categoria, cantidad, sin, mezcla, sinQueso, carneExtra },
    ]);
  };
  /** Toque en la cuadrícula rápida (Bebidas): suma 1 al renglón rápido de ese producto. */
  const agregarRapido = (producto: ProductoMenu, categoria: string) => {
    if (!puedeEditar) return;
    setNuevo((lista) =>
      lista.some((l) => l.rapida && l.producto.id === producto.id)
        ? lista.map((l) => (l.rapida && l.producto.id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l))
        : [...lista, { id: siguienteLinea++, rapida: true, producto, categoria, cantidad: 1, sin: [], mezcla: [] }]
    );
  };
  const cambiar = (id: number, delta: number) => {
    if (!puedeEditar) return;
    setNuevo((lista) => lista.map((l) => (l.id === id ? { ...l, cantidad: l.cantidad + delta } : l)).filter((l) => l.cantidad > 0));
  };

  const tocarCategoria = (categoria: CategoriaMenu) => {
    if (!puedeEditar) return;
    if (esCuadricula(categoria)) setCategoriaAbierta(categoria); // Bebidas: cuadrícula rápida
    else setOpcionesDe(categoria); // las demás: pantalla de opciones
  };

  const totalNuevo = nuevo.reduce((acc, l) => acc + precioLinea(l) * l.cantidad, 0);
  const rondasPrevias = new Set(detalle.map((d) => d.creado_en)).size;

  const enviar = async () => {
    if (!orden || !puedeEditar || nuevo.length === 0) return;
    setEnviando(true);
    setError(null);
    const enviado = nuevo;
    try {
      const datos = await enviarPedido(
        idOrden,
        enviado.map((l) => ({
          idProducto: l.producto.id,
          cantidad: l.cantidad,
          sin: l.sin.map((c) => c.id),
          ...(l.sinQueso && { sinQueso: true }),
          ...(l.carneExtra && { carneExtra: l.carneExtra }),
        }))
      );
      actualizarOrden(datos);
      setNuevo([]);
      setCategoriaAbierta(null);
      setOpcionesDe(null);
      setPestana('pedido');
      // Las bebidas no se imprimen; si el envío solo trae bebidas, no sale ticket.
      const paraTicket = enviado.filter(vaEnTicket);
      setAlerta({
        titulo: `Pedido enviado a cocina · ${datos.orden.etiqueta}`,
        detalle: enviado.map((l) => `${l.cantidad} × ${l.categoria} · ${nombreLinea(l)}${textoSin(l)}`),
        impresion:
          paraTicket.length > 0
            ? { ok: null, texto: 'Imprimiendo ticket de cocina…' }
            : { ok: true, texto: 'Solo bebidas: no se imprime ticket de cocina.' },
      });
      if (paraTicket.length === 0) return;
      // Ticket de cocina: si la impresora no responde, el pedido ya quedó guardado; solo se avisa.
      imprimirTicketCocina(ticketDe(datos.orden, paraTicket, rondasPrevias + 1, origen))
        .then(() => setAlerta((a) => (a ? { ...a, impresion: { ok: true, texto: 'Ticket de cocina impreso.' } } : a)))
        .catch((err) =>
          setAlerta((a) =>
            a ? { ...a, impresion: { ok: false, texto: `No se imprimió el ticket: ${err instanceof Error ? err.message : 'error'}` } } : a
          )
        );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el pedido.');
      await refrescar();
    } finally {
      setEnviando(false);
    }
  };

  const cuentaPedida = (orden?.estatus ?? 0) >= 1;
  const pedirLaCuenta = async () => {
    if (!orden || !puedeEditar || detalle.length === 0) return;
    setPidiendoCuenta(true);
    setError(null);
    try {
      const datos = await pedirCuenta(idOrden);
      actualizarOrden(datos);
      setAlerta({ titulo: `Cuenta pedida · ${datos.orden.etiqueta}`, detalle: [`Total ${dinero(datos.orden.total)}`, 'La caja hará el cobro.'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pedir la cuenta.');
      await refrescar();
    } finally {
      setPidiendoCuenta(false);
    }
  };

  const paraLlevar = orden?.tipo_orden === 2;

  return (
    <div className={pantallaCompleta ? 'h-full min-h-0 flex flex-col gap-2' : 'space-y-4'}>
      {/* Barra de la orden */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* En la tablet, el botón ÓRDENES va arriba, en el encabezado (AppTablet). */}
          {!pantallaCompleta && (
            <button
              onClick={onVolver}
              className="h-12 px-4 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 flex items-center gap-2 font-medium cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" /> Órdenes
            </button>
          )}
          <span
            title={paraLlevar ? 'Para llevar' : 'Comer aquí'}
            className={`${pantallaCompleta ? 'w-14 h-14' : 'w-12 h-12'} rounded-xl border-2 flex items-center justify-center ${
              paraLlevar ? 'bg-violet-100 border-violet-400 text-violet-900' : 'bg-sky-50 border-sky-300 text-sky-800'
            }`}
          >
            {paraLlevar ? <ShoppingBag className="w-6 h-6" /> : <Home className="w-6 h-6" />}
          </span>
          {pantallaCompleta && (
            <button
              onClick={() => setVerHistorial(true)}
              title="Historial de lo enviado"
              aria-label="Historial de lo enviado"
              className="relative w-14 h-14 rounded-xl bg-white border-2 border-neutral-200 hover:border-neutral-300 text-neutral-700 flex items-center justify-center cursor-pointer"
            >
              <History className="w-6 h-6" />
              {piezasEnviadas > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1.5 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">
                  {piezasEnviadas}
                </span>
              )}
            </button>
          )}
        </div>
        <div className="text-right">
          <div className={`${pantallaCompleta ? 'text-3xl' : 'text-2xl'} font-bold`}>{orden?.etiqueta ?? '…'}</div>
          <div className={`${pantallaCompleta ? 'text-base' : 'text-sm'} text-neutral-500`}>
            Total orden <span className="font-mono font-semibold text-neutral-900">{dinero(orden?.total ?? 0)}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="shrink-0 flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {bloqueada ? (
        <div className={pantallaCompleta ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3' : 'space-y-3'}>
          <div role="status" className="flex items-center gap-4 p-5 rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-950">
            <LockKeyhole className="w-9 h-9 shrink-0" />
            <div>
              <div className="text-lg font-bold">{orden.estatus === 2 ? 'ORDEN PAGADA' : 'ORDEN EN COBRO'}</div>
              <p className="text-sm">Ya no se pueden agregar productos ni modificar el pedido.</p>
            </div>
          </div>
          <PedidoEnviado orden={orden} detalle={detalle} />
        </div>
      ) : (
      <>
      {/* Pestañas (solo vista web; la tablet lo muestra todo junto) */}
      {!pantallaCompleta && (
      <div className="shrink-0 grid grid-cols-2 gap-1 p-1 bg-neutral-200/70 rounded-2xl">
        {(
          [
            { id: 'pedido', texto: 'PEDIDO', icon: ClipboardList, cuenta: piezasEnviadas },
            { id: 'agregar', texto: 'AGREGAR', icon: Plus, cuenta: nuevo.reduce((acc, l) => acc + l.cantidad, 0) },
          ] as const
        ).map((p) => {
          const activa = pestana === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={`${pantallaCompleta ? 'h-14 text-lg' : 'h-12'} rounded-xl font-bold tracking-wide flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                activa ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <p.icon className="w-5 h-5" />
              {p.texto}
              {p.cuenta > 0 && (
                <span
                  className={`min-w-6 h-6 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
                    p.id === 'agregar' ? 'bg-orange-500 text-white' : 'bg-neutral-900 text-white'
                  }`}
                >
                  {p.cuenta}
                </span>
              )}
            </button>
          );
        })}
      </div>
      )}

      {!pantallaCompleta && pestana === 'pedido' ? (
        <PedidoEnviado
          orden={orden}
          detalle={detalle}
          className="w-full"
          onAgregar={() => setPestana('agregar')}
        />
      ) : (
      <div
        className={
          pantallaCompleta
            ? 'flex-1 min-h-0 grid gap-2 grid-cols-[minmax(0,1fr)_minmax(13rem,32%)]'
            : 'grid gap-4 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_360px]'
        }
      >
        {/* Menú desde la base */}
        <section className={`bg-white border border-neutral-200 rounded-2xl p-3 ${pantallaCompleta ? 'min-h-0 flex flex-col overflow-hidden' : 'min-h-96 flex flex-col'}`}>
          {menu === null ? (
            <div className="flex-1 flex items-center justify-center text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : opcionesDe ? (
            <OpcionesCategoria
              key={opcionesDe.id}
              categoria={opcionesDe}
              pantallaCompleta={pantallaCompleta}
              onVolver={() => setOpcionesDe(null)}
              onAgregar={(producto, cantidad, sin, mezcla, extras) => agregar(producto, opcionesDe.nombre, cantidad, sin, mezcla, extras)}
            />
          ) : categoriaAbierta ? (
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <div className="shrink-0 flex items-center justify-between gap-3">
                <button
                  onClick={() => setCategoriaAbierta(null)}
                  className="h-10 px-3 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 flex items-center gap-2 text-sm font-medium cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" /> Categorías
                </button>
                <div className="text-lg font-bold">{categoriaAbierta.nombre}</div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] auto-rows-[minmax(4.5rem,1fr)] gap-2">
                {categoriaAbierta.productos.map((p) => {
                  const enPedido = nuevo.filter((l) => l.producto.id === p.id).reduce((acc, l) => acc + l.cantidad, 0) || undefined;
                  return (
                    <button
                      key={p.id}
                      onClick={() => agregarRapido(p, categoriaAbierta.nombre)}
                      disabled={!puedeEditar}
                      className={`relative rounded-2xl border-2 p-3 flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                        pantallaCompleta ? 'neon neon-cian' : 'border-orange-200 bg-orange-50/40 hover:bg-orange-50'
                      }`}
                    >
                      <span className="text-xl font-bold leading-tight">{p.nombre}</span>
                      {p.tamano && <span className="text-sm font-semibold text-orange-800">{p.tamano}</span>}
                      <span className="font-mono text-sm text-neutral-600">{dinero(p.precio)}</span>
                      {p.complementos.length > 0 && (
                        <span className="text-[11px] text-neutral-500 leading-tight">{p.complementos.map((c) => c.nombre).join(' · ')}</span>
                      )}
                      {enPedido && (
                        <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                          {enPedido}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] auto-rows-[minmax(5rem,1fr)] gap-2">
              {menu
                .filter((c) => c.productos.length > 0)
                .map((c, i) => {
                  const Icono = iconoCategoria(c.nombre);
                  const enPedido = nuevo.filter((l) => l.categoria === c.nombre).reduce((acc, l) => acc + l.cantidad, 0);
                  return (
                    <button
                      key={c.id}
                      onClick={() => tocarCategoria(c)}
                      disabled={!puedeEditar}
                      className={`relative rounded-2xl border-2 p-2 flex flex-col items-center justify-center gap-2 text-center cursor-pointer ${
                        pantallaCompleta ? NEON_CATEGORIA[i % NEON_CATEGORIA.length] : COLORES_CATEGORIA[i % COLORES_CATEGORIA.length].normal
                      }`}
                    >
                      <Icono className="w-12 h-12 shrink-0" />
                      <span className="text-lg font-bold leading-tight">{c.nombre}</span>
                      {enPedido > 0 && (
                        <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                          {enPedido}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </section>

        {/* Nuevo pedido */}
        <aside className={pantallaCompleta ? 'min-h-0 flex flex-col gap-2' : 'space-y-4'}>
          <section className={`bg-white border border-neutral-200 rounded-2xl p-4 space-y-3 ${pantallaCompleta ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
            <h3 className="font-bold shrink-0">Nuevo pedido</h3>
            <div className={pantallaCompleta ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-1' : 'space-y-2'}>
              {nuevo.length === 0 ? (
                <p className="text-sm text-neutral-500">Toca productos del menú para agregarlos.</p>
              ) : (
                nuevo.map((l) => (
                  <div key={l.id} className="border-b border-neutral-100 pb-2 last:border-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium leading-tight">
                        {nombreLinea(l)}
                        <span className="block text-xs font-normal text-neutral-500">{l.categoria}</span>
                        {l.sinQueso && <span className="block text-xs font-black tracking-wide text-violet-700">NO QUESO</span>}
                        {!!l.carneExtra && (
                          <span className="block text-xs font-black tracking-wide text-red-700">{textoCarneExtra(l.carneExtra)}</span>
                        )}
                        {l.sin.length > 0 && (
                          <span className="block text-xs font-normal text-rose-700">Sin {l.sin.map((c) => c.nombre.toLowerCase()).join(', ')}</span>
                        )}
                      </span>
                      <span className="font-mono text-sm">{dinero(precioLinea(l) * l.cantidad)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cambiar(l.id, -1)}
                        disabled={!puedeEditar}
                        aria-label="Quitar uno"
                        className="w-10 h-10 rounded-lg border border-neutral-200 flex items-center justify-center cursor-pointer"
                      >
                        {l.cantidad === 1 ? <Trash2 className="w-4 h-4 text-rose-600" /> : <Minus className="w-4 h-4" />}
                      </button>
                      <span className="w-8 text-center font-mono font-bold text-lg">{l.cantidad}</span>
                      <button
                        onClick={() => cambiar(l.id, 1)}
                        disabled={!puedeEditar}
                        aria-label="Agregar uno"
                        className="w-10 h-10 rounded-lg border border-neutral-200 flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {pantallaCompleta && nuevo.length === 0 ? (
              // Tablet sin productos seleccionados: pedir la cuenta (orden.estatus → 1 PAGANDO; la caja cobra)
              <button
                onClick={pedirLaCuenta}
                disabled={!puedeEditar || detalle.length === 0}
                className="neon-solido neon-fresco w-full h-14 shrink-0 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-lg font-bold tracking-wide flex items-center justify-center gap-2 cursor-pointer"
              >
                {pidiendoCuenta ? <Loader2 className="w-5 h-5 animate-spin" /> : <HandCoins className="w-5 h-5" />}
                {cuentaPedida ? 'CUENTA PEDIDA' : 'PEDIR CUENTA'}
              </button>
            ) : (
              <button
                onClick={enviar}
                disabled={!puedeEditar || nuevo.length === 0}
                className={`w-full h-14 shrink-0 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-lg font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                  pantallaCompleta ? 'neon-solido neon-fuego' : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                }`}
              >
                {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {pantallaCompleta ? 'Enviar' : 'Enviar a cocina'}
                {nuevo.length > 0 && ` · ${dinero(totalNuevo)}`}
              </button>
            )}
          </section>
        </aside>
      </div>
      )}
      </>
      )}

      {/* Historial de lo enviado (tablet) */}
      <AnimatePresence>
        {verHistorial && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVerHistorial(false)}
          >
            <motion.div
              role="dialog"
              aria-label="Historial de lo enviado"
              className="relative w-full max-w-xl max-h-full flex flex-col"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <PedidoEnviado orden={orden} detalle={detalle} className="min-h-0 shadow-xl" />
              <button
                onClick={() => setVerHistorial(false)}
                className="mt-3 shrink-0 w-full h-14 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200 text-lg font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <X className="w-5 h-5" /> Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aviso al enviar */}
      <AnimatePresence>
        {alerta && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAlerta(null)}
          >
            <motion.div
              role="alertdialog"
              className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 text-center space-y-4"
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
              <h2 className="text-xl font-bold">{alerta.titulo}</h2>
              <ul className="text-sm text-neutral-600 space-y-1">
                {alerta.detalle.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
              {alerta.impresion && (
                <div
                  className={`flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border ${
                    alerta.impresion.ok === true
                      ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                      : alerta.impresion.ok === false
                      ? 'text-amber-800 bg-amber-50 border-amber-200'
                      : 'text-neutral-600 bg-neutral-50 border-neutral-200'
                  }`}
                >
                  {alerta.impresion.ok === null ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                  {alerta.impresion.texto}
                </div>
              )}
              <button
                onClick={() => setAlerta(null)}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
              >
                Aceptar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
