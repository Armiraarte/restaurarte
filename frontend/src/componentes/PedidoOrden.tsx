// Pedido de una orden conectado a la base de datos. Lo usan la tablet (pantalla completa) y la caja.
//   Menú           → GET /api/menu (categorias, producto, producto_has_complemento)
//   Ya enviado     → GET /api/ordenes/:idOrden (orden_has_detalle)
//   Enviar a cocina→ POST /api/ordenes/:idOrden/pedido (orden_has_detalle + orden.total)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  HandCoins,
  ClipboardList,
  History,
  Home,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Minus,
  Phone,
  PhoneOff,
  Plus,
  Printer,
  Send,
  ShoppingBag,
  Shuffle,
  Split,
  Trash2,
  UtensilsCrossed,
  User,
  X,
} from 'lucide-react';
import {
  CategoriaMenu,
  ComplementoMenu,
  DetalleOrdenBD,
  enviarPedido,
  pedirCuenta,
  nombreProducto,
  PRECIO_CARNE_EXTRA,
  PRECIO_COMPLEMENTO_EXTRA,
  textoComplementosExtra,
  textoCarneExtra,
  obtenerMenu,
  obtenerOrden,
  OrdenBD,
  ProductoMenu,
  TerminoMenu,
  PapasMenu,
  ExtraPedido,
  ExtraOrdenBD,
  CATEGORIAS_QUESO_OPCIONAL,
  CATEGORIA_PAPAS,
  nombrePapas,
  RepartoPedido,
  textoReparto,
} from '../services/pedidosService';
import { imprimirTicketCocina } from '../services/ticketCocinaService';
import { COLORES_CATEGORIA, fotoCategoria, iconoCategoria, logoBebida, NEON_CATEGORIA } from './iconosCategoria';
import { ExtrasLinea, OpcionesCategoria } from './OpcionesCategoria';
import { PedidoEnviado } from './PedidoEnviado';
import { useEnVivo } from '../services/enVivo';
import { useCadaTantoVisible } from '../services/sincronizacion';
import { BORRADOR_LLAMADA, guardarBorrador, leerBorrador, leerMixActivo, leerExtrasBorrador } from '../services/borradorPedido';
import { agruparMix } from '../services/pedidoMix';
import { registrarMesa } from '../services/mesasService';
import { registrarError } from '../services/errores';
import { TicketCocina } from '../types/ticketCocina';
import { DialogoAgregarExtra } from './DialogoAgregarExtra';
import { DividirCuenta } from './DividirCuenta';
import { DialogoComentario } from './DialogoComentario';
import { ListaExtras } from './ListaExtras';
import { complementosTicket, complementosTicketQuesoOpcional, esQueso } from '../services/complementos';

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
  /** Quesadillas y Hamburguesas: la pidieron sin queso. Puede faltar en borradores viejos. */
  sinQueso?: boolean;
  /** Solo Hamburguesas: 1 = DOBLE CARNE, 2 = TRIPLE CARNE (+$20 por carne extra). Puede faltar en borradores viejos. */
  carneExtra?: number;
  conQueso?: boolean;
  mixGrupo?: number | null;
  termino?: TerminoMenu | null;
  papas?: PapasMenu | null;
  /** Complementos que tenía el platillo. Puede faltar en borradores viejos (se usan los del producto). */
  ofrecidos?: ComplementoMenu[];
  /** MIXTAS: piezas de cada sabor en este mismo renglón, cada una a su precio; suman `cantidad` (no se cambia con +/−). */
  reparto?: RepartoPedido[];
  /** Complementos EXTRA (doble toque), +PRECIO_COMPLEMENTO_EXTRA c/u por pieza. */
  complementosExtra?: ComplementoMenu[];
  /** Comentario del platillo (botón junto a VOLVER): sale en la comanda como NOTA. */
  nota?: string;
}

/** Cobro extra por enviar; `mixGrupo`: el MIX abierto al agregarlo (en cocina sale debajo de ese MIX). */
type ExtraNuevo = ExtraPedido & { id: number; mixGrupo?: number | null };
/** Extra en la comanda de cocina, con el número definitivo de su MIX. */
type ExtraTicket = ExtraPedido & { mix_grupo?: number | null };

let siguienteLinea = 1;
let siguienteExtra = 1;
/** "4 BBQ + 6 Buffalo" si es MIXTAS, "Papa con Frijol" si es mezcla; si no, el nombre del producto con su tamaño. */
const nombreLinea = (l: LineaNueva) =>
  l.reparto?.length
    ? `${textoReparto(l.reparto)}${l.producto.tamano ? ` (${l.producto.tamano})` : ''}`
    : l.mezcla.length > 1 ? l.mezcla.join(' con ') : nombreProducto(l.producto);
/** Tacos: el queso no va de base (no se dice «sin queso»; solo CON QUESO si lo piden). */
const quesoOpcional = (l: LineaNueva) => CATEGORIAS_QUESO_OPCIONAL.includes(l.categoria);
const sinDescritos = (l: LineaNueva) => l.sin.filter((c) => !esQueso(c) || (!l.sinQueso && !quesoOpcional(l)));
const textoSin = (l: LineaNueva) =>
  `${l.mixGrupo ? ' · MIX' : ''}${l.termino ? ` · ${l.termino.nombre}` : ''}${l.conQueso && (l.sin.length > 0 || quesoOpcional(l)) ? ' · CON QUESO' : ''}${l.sinQueso ? ' · SIN QUESO' : ''}${l.carneExtra ? ` · ${textoCarneExtra(l.carneExtra)}` : ''}${
    sinDescritos(l).length ? ` · sin ${sinDescritos(l).map((c) => c.nombre.toLowerCase()).join(', ')}` : ''
  }${l.papas ? ' · CON PAPAS' : ''}${l.complementosExtra?.length ? ` · ${textoComplementosExtra(l.complementosExtra.map((c) => c.nombre))}` : ''}${l.nota ? ` · nota: ${l.nota}` : ''
  }`;
/**
 * Importe del renglón (el servidor lo calcula igual al guardar): en MIXTAS cada pieza a su precio; a todas se les
 * suman sus carnes extra, papas y complementos EXTRA. Los borradores viejos de MIXTAS no traen precio por sabor.
 */
const importeLinea = (l: LineaNueva) =>
  (l.reparto?.length && l.reparto.every((r) => r.precio != null)
    ? l.reparto.reduce((acc, r) => acc + r.precio! * r.cantidad, 0)
    : l.producto.precio * l.cantidad) +
  ((l.carneExtra ?? 0) * PRECIO_CARNE_EXTRA + (l.papas?.precio ?? 0) + (l.complementosExtra?.length ?? 0) * PRECIO_COMPLEMENTO_EXTRA) * l.cantidad;

/** Categorías que se muestran como cuadrícula rápida (Bebidas): sin complementos y con muchos productos. */
const esCuadricula = (c: CategoriaMenu) =>
  c.productos.every((p) => p.complementos.length === 0) && new Set(c.productos.map((p) => p.nombre)).size > 6;
/** Grupo del producto dentro de su categoría (BD: producto.grupo); los que no tienen van en «Otras». */
const grupoDe = (p: ProductoMenu) => p.grupo ?? 'Otras';

/** Categorías que no van en el ticket de cocina: salen en su propio ticket en la impresora de caja. */
const FUERA_DEL_TICKET = new Set(['bebidas']);
const vaEnTicket = (l: LineaNueva) => !FUERA_DEL_TICKET.has(l.categoria.trim().toLowerCase());

interface Props {
  /**
   * null = LLAMADA: se toma el pedido sin registrar la orden (el cliente va pidiendo por teléfono);
   * al terminar se guarda con su nombre, se manda a cocina y se avisa con `onOrdenCreada`.
   */
  idOrden: number | null;
  /** Quién manda el pedido (aparece en el ticket de cocina): "Tablet 01", "CAJA". */
  origen: string;
  onVolver: () => void;
  /** Tablet: ocupa exactamente la pantalla, sin scroll de página. */
  pantallaCompleta?: boolean;
  /** LLAMADA: la orden ya quedó registrada con el nombre del cliente. */
  onOrdenCreada?: (idOrden: number) => void;
}


const dinero = (n: number) => `$${n.toFixed(2)}`;

/** JSON del ticket de cocina (types/ticketCocina.ts) a partir de lo que se acaba de enviar. */
function ticketDe(orden: OrdenBD, lineas: LineaNueva[], ronda: number, origen: string, extras: ExtraTicket[] = []): TicketCocina {
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
      partida_id: String(l.id),
      producto_id: String(l.producto.id),
      // MIXTAS: un solo registro («10 Alitas · MIXTAS», «3 Ensaladas · MIXTAS (Grande)») con las piezas de cada sabor debajo.
      nombre: l.reparto?.length
        ? `${l.categoria} · MIXTAS${l.producto.tamano ? ` (${l.producto.tamano})` : ''}`
        : l.categoria === CATEGORIA_PAPAS
          ? nombrePapas(l.producto.tamano) // «Orden de papas» / «Media orden de papas»
          : `${l.categoria} · ${nombreLinea(l)}`,
      categoria: l.categoria,
      cantidad: l.cantidad,
      mix_grupo: l.mixGrupo ?? null,
      opciones: [],
      ...(l.nota && { notas: l.nota }), // en la comanda: «NOTA: …» debajo del platillo
      ...(l.reparto?.length && { reparto: l.reparto.map((r) => ({ opcion: r.nombre, cantidad: r.cantidad })) }),
      // Complementos en los menos renglones posibles: CON TODO, SIN NADA, SOLO CON … o lo que no quiere (ver complementosTicket).
      descripcion: [
        ...(l.reparto ?? []).map((r) => `${r.cantidad} ${r.nombre}`),
        ...(l.termino ? [l.termino.nombre.toUpperCase()] : []), // solo el término: «DORADO»
        ...(l.carneExtra ? [textoCarneExtra(l.carneExtra)] : []),
        ...(l.papas ? ['CON PAPAS'] : []),
        ...(quesoOpcional(l)
          ? complementosTicketQuesoOpcional(l.ofrecidos ?? l.producto.complementos, l.sin, !!l.conQueso)
          : complementosTicket(l.ofrecidos ?? l.producto.complementos, l.sin, { sinQueso: l.sinQueso, conQueso: l.conQueso })),
        // Doble toque en un complemento: «EXTRA CREMA Y QUESO», después de lo que lleva.
        ...(l.complementosExtra?.length ? [textoComplementosExtra(l.complementosExtra.map((c) => c.nombre))] : []),
      ],
    })),
    total_piezas: lineas.reduce((acc, l) => acc + l.cantidad, 0),
    extras,
  };
}

export const PedidoOrden: React.FC<Props> = ({ idOrden, origen, onVolver, pantallaCompleta = false, onOrdenCreada }) => {
  const esLlamada = idOrden === null;
  const claveBorrador = idOrden ?? BORRADOR_LLAMADA;
  const [menu, setMenu] = useState<CategoriaMenu[] | null>(null);
  const [orden, setOrden] = useState<OrdenBD | null>(null);
  const ultimaOrden = useRef<OrdenBD | null>(null);
  const [detalle, setDetalle] = useState<DetalleOrdenBD[]>([]);
  const [extrasEnviados, setExtrasEnviados] = useState<ExtraOrdenBD[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [categoriaAbierta, setCategoriaAbierta] = useState<CategoriaMenu | null>(null);
  // Pestaña de la cuadrícula rápida (Bebidas: Refrescos, Aguas, Jugos); si no hay una elegida, la primera.
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);
  const gruposAbiertos = categoriaAbierta ? [...new Set(categoriaAbierta.productos.map(grupoDe))] : [];
  const grupoVisible = grupoAbierto && gruposAbiertos.includes(grupoAbierto) ? grupoAbierto : gruposAbiertos[0];
  // Pantalla de opciones de una categoría (como la de antes): elige uno, tamaño, complementos y cantidad.
  const [opcionesDe, setOpcionesDe] = useState<CategoriaMenu | null>(null);
  // MIXTAS: botón junto a VOLVER en toda categoría con más de un producto; se apaga al cambiar de categoría.
  const [mezclar, setMezclar] = useState(false);
  const puedeMezclar = !!opcionesDe && new Set(opcionesDe.productos.map((p) => p.nombre)).size > 1;
  useEffect(() => setMezclar(false), [opcionesDe?.id]);
  // Comentario del platillo que se está armando (botón junto a VOLVER); se pega al agregarlo y se borra.
  const [comentario, setComentario] = useState('');
  const [editandoComentario, setEditandoComentario] = useState(false);
  useEffect(() => setComentario(''), [opcionesDe?.id]);
  // Lo agregado y aún no enviado se guarda en el dispositivo: si se sale a ÓRDENES, al volver sigue aquí.
  const [nuevo, setNuevo] = useState<LineaNueva[]>(() => {
    const guardado = leerBorrador<LineaNueva>(claveBorrador);
    // Los renglones recuperados conservan su id: los que se agreguen siguen después.
    siguienteLinea = Math.max(siguienteLinea, ...guardado.map((l) => l.id + 1));
    return guardado;
  });
  const [mixActivo, setMixActivo] = useState<number | null>(() => leerMixActivo(claveBorrador));
  // Cobros extra por enviar; `mixGrupo`: el MIX que estaba abierto al agregarlo (en cocina sale debajo de ese MIX).
  const [extrasNuevos, setExtrasNuevos] = useState<ExtraNuevo[]>(() => {
    const guardados = leerExtrasBorrador<ExtraNuevo>(claveBorrador);
    siguienteExtra = Math.max(siguienteExtra, ...guardados.map((e) => e.id + 1));
    return guardados;
  });
  const [agregandoExtra, setAgregandoExtra] = useState(false);
  useEffect(() => guardarBorrador(claveBorrador, nuevo, mixActivo, extrasNuevos), [claveBorrador, nuevo, mixActivo, extrasNuevos]);
  // Pestañas: PEDIDO (lo ya enviado) y AGREGAR (menú + nuevo pedido).
  const [pestana, setPestana] = useState<'pedido' | 'agregar'>('pedido');
  // Tablet: lo ya enviado se ve en una ventana desde el botón de historial.
  const [verHistorial, setVerHistorial] = useState(false);
  const [dividiendo, setDividiendo] = useState(false);
  const piezasEnviadas = detalle.reduce((acc, d) => acc + d.cantidad, 0);
  const [enviando, setEnviando] = useState(false);
  const [pidiendoCuenta, setPidiendoCuenta] = useState(false);
  const [alerta, setAlerta] = useState<{ titulo: string; detalle: string[]; impresion?: { ok: boolean | null; texto: string } } | null>(null);
  const bloqueada = orden !== null && orden.estatus !== 0;
  const puedeEditar = (esLlamada || orden?.estatus === 0) && !enviando && !pidiendoCuenta;
  // LLAMADA: ventana del nombre al terminar; y la orden ya registrada, para pasar a ella al cerrar el aviso.
  const [nombrando, setNombrando] = useState(false);
  const [ordenCreada, setOrdenCreada] = useState<number | null>(null);
  const [descartando, setDescartando] = useState(false);

  const textoOrden = useRef('');
  const actualizarOrden = useCallback((datos: { orden: OrdenBD; detalle: DetalleOrdenBD[]; extras?: ExtraOrdenBD[] }) => {
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
    setExtrasEnviados(datos.extras ?? []);
  }, []);

  useEffect(() => {
    if (!bloqueada) return;
    setOpcionesDe(null);
    setCategoriaAbierta(null);
    setNuevo([]);
    setExtrasNuevos([]);
    setAgregandoExtra(false);
    setMixActivo(null);
    setPestana('pedido');
  }, [bloqueada]);

  // En la tablet el menú usa la escala reducida para que todo quepa (ver index.css).
  useEffect(() => {
    if (!pantallaCompleta) return;
    document.documentElement.classList.add('app-tablet-menu');
    return () => document.documentElement.classList.remove('app-tablet-menu');
  }, [pantallaCompleta]);

  const cargarOrden = useCallback(async () => {
    if (idOrden === null) return; // LLAMADA: todavía no hay orden
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
    if (idOrden === null) return;
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

  // LLAMADA registrada: al cerrar el aviso de enviado se pasa a la orden ya con su nombre.
  useEffect(() => {
    if (ordenCreada !== null && !alerta) onOrdenCreada?.(ordenCreada);
  }, [ordenCreada, alerta]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Desde la pantalla de opciones: siempre un renglón nuevo, aunque sea el mismo producto. */
  const agregar = (
    producto: ProductoMenu,
    categoria: string,
    cantidad: number,
    sin: ComplementoMenu[],
    mezcla: string[],
    { sinQueso, conQueso, carneExtra, termino, papas, ofrecidos, reparto, complementosExtra }: ExtrasLinea
  ) => {
    if (!puedeEditar) return;
    setNuevo((lista) => [
      ...lista,
      { id: siguienteLinea++, rapida: false, producto, categoria, cantidad, sin, mezcla, sinQueso, conQueso, carneExtra, termino, papas, ofrecidos, reparto, complementosExtra, mixGrupo: mixActivo, ...(comentario && { nota: comentario }) },
    ]);
    setComentario('');
  };
  /** Toque en la cuadrícula rápida (Bebidas): suma 1 al renglón rápido de ese producto. */
  const agregarRapido = (producto: ProductoMenu, categoria: string) => {
    if (!puedeEditar) return;
    setNuevo((lista) =>
      lista.some((l) => l.rapida && l.producto.id === producto.id && (l.mixGrupo ?? null) === mixActivo)
        ? lista.map((l) => (l.rapida && l.producto.id === producto.id && (l.mixGrupo ?? null) === mixActivo ? { ...l, cantidad: l.cantidad + 1 } : l))
        : [...lista, { id: siguienteLinea++, rapida: true, producto, categoria, cantidad: 1, sin: [], mezcla: [], mixGrupo: mixActivo }]
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

  const hayNuevo = nuevo.length > 0 || extrasNuevos.length > 0;
  const hayEnviado = detalle.length > 0 || extrasEnviados.length > 0;
  const totalNuevo = Math.round((nuevo.reduce((acc, l) => acc + importeLinea(l), 0) +extrasNuevos.reduce((acc, e) => acc + e.importe, 0)) * 100) / 100;
  const gruposNuevos = agruparMix(nuevo, (l) => l.mixGrupo);
  // Extras que no se ven dentro de un MIX de la lista (sin MIX, o su MIX aún no tiene productos): van al final.
  const mixEnLista = new Set(gruposNuevos.map((g) => g.grupo).filter((g) => g !== null));
  const extrasSueltos = extrasNuevos.filter((e) => e.mixGrupo == null || !mixEnLista.has(e.mixGrupo));
  const quitarExtra = (id: number) => setExtrasNuevos((lista) => lista.filter((e) => e.id !== id));
  const alternarMix = () => {
    if (!puedeEditar) return;
    setMixActivo((actual) => actual === null
      ? Math.max(0, ...nuevo.map((l) => l.mixGrupo ?? 0), ...detalle.map((d) => d.mix_grupo ?? 0)) + 1
      : null);
  };
  const rondasPrevias = new Set([...detalle.map((d) => d.creado_en), ...extrasEnviados.map((e) => e.creado_en)]).size;

  /** Manda lo nuevo a cocina. `destino`: la orden recién registrada al terminar una LLAMADA. */
  const enviar = async (destino?: number): Promise<boolean> => {
    const id = destino ?? idOrden;
    if (id === null || (destino === undefined && !orden) || !puedeEditar || !hayNuevo) return false;
    setEnviando(true);
    setError(null);
    const enviado = nuevo;
    const extrasDelBorrador = extrasNuevos;
    try {
      const datos = await enviarPedido(
        id,
        enviado.map((l) => ({
          idProducto: l.producto.id,
          cantidad: l.cantidad,
          sin: l.sin.map((c) => c.id),
          mezcla: l.mezcla,
          // El precio de cada sabor lo pone el servidor.
          ...(l.reparto?.length && { reparto: l.reparto.map(({ nombre, cantidad }) => ({ nombre, cantidad })) }),
          ...(l.complementosExtra?.length && { complementosExtra: l.complementosExtra.map((c) => c.id) }),
          ...(l.nota && { nota: l.nota }),
          mixGrupo: l.mixGrupo ?? null,
          terminoId: l.termino?.id ?? null,
          conPapas: !!l.papas,
          ...(l.conQueso && { conQueso: true }),
          ...(l.sinQueso && { sinQueso: true }),
          ...(l.carneExtra && { carneExtra: l.carneExtra }),
        })),
        extrasDelBorrador.map(({ descripcion, importe }) => ({ descripcion, importe })),
      );
      actualizarOrden(datos);
      setNuevo([]);
      setExtrasNuevos([]);
      setMixActivo(null);
      setCategoriaAbierta(null);
      setOpcionesDe(null);
      setPestana('pedido');
      // El servidor asigna los números definitivos, incluso si otra tablet envía al mismo tiempo.
      const confirmado = enviado.map((l, i) => ({
        ...l, id: datos.guardados[i].idDetalle_Orden, mixGrupo: datos.guardados[i].mix_grupo,
      }));
      // Dos tickets: lo de cocina (y los cobros extra) a la impresora de cocina, y las bebidas a la de caja,
      // donde se preparan. Salen al mismo tiempo, cada uno en su impresora.
      const paraTicket = confirmado.filter(vaEnTicket);
      const bebidas = confirmado.filter((l) => !vaEnTicket(l));
      // Cada extra agregado dentro de un MIX lleva el número definitivo de ese MIX (sale debajo de él en cocina).
      const mixDefinitivo = new Map(enviado.map((l, i) => [l.mixGrupo ?? null, datos.guardados[i].mix_grupo]));
      const extrasTicket = (datos.extrasGuardados ?? extrasDelBorrador).map((e, i) => ({
        descripcion: e.descripcion,
        importe: e.importe,
        mix_grupo: extrasDelBorrador[i]?.mixGrupo != null ? mixDefinitivo.get(extrasDelBorrador[i].mixGrupo!) ?? null : null,
      }));
      const ronda = rondasPrevias + 1;
      const tickets = [
        ...(paraTicket.length > 0 || extrasTicket.length > 0
          ? [{ nombre: 'cocina', ticket: ticketDe(datos.orden, paraTicket, ronda, origen, extrasTicket) }]
          : []),
        ...(bebidas.length > 0 ? [{ nombre: 'bebidas (caja)', ticket: { ...ticketDe(datos.orden, bebidas, ronda, origen), area: 'bebidas' as const } }] : []),
      ];
      setAlerta({
        titulo: `Pedido enviado a cocina · ${datos.orden.etiqueta}`,
        detalle: [...confirmado.map((l) => `${l.cantidad} ${l.categoria} · ${nombreLinea(l)}${textoSin(l)}`), ...extrasTicket.map((e) => `Extra: ${e.descripcion} · ${dinero(e.importe)}`)],
        impresion: { ok: null, texto: `Imprimiendo ticket de ${tickets.map((t) => t.nombre).join(' y ')}…` },
      });
      // Si una impresora no responde, el pedido ya quedó guardado; solo se avisa cuál ticket no salió.
      Promise.allSettled(tickets.map((t) => imprimirTicketCocina(t.ticket))).then((resultados) => {
        const fallas = resultados.flatMap((r, i) =>
          r.status === 'rejected' ? [`${tickets[i].nombre}: ${r.reason instanceof Error ? r.reason.message : 'error'}`] : []
        );
        const impresion = fallas.length
          ? { ok: false, texto: `No se imprimió el ticket de ${fallas.join(' · ')}` }
          : { ok: true, texto: tickets.length > 1 ? 'Tickets de cocina y de bebidas impresos.' : `Ticket de ${tickets[0]?.nombre ?? 'cocina'} impreso.` };
        setAlerta((a) => (a ? { ...a, impresion } : a));
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el pedido.');
      if (destino === undefined) await refrescar();
      return false;
    } finally {
      setEnviando(false);
    }
  };

  /**
   * LLAMADA terminada: registra la orden con el nombre del cliente y le manda lo pedido a cocina.
   * Si el envío falla, el pedido queda guardado en la orden nueva para volver a tocar Enviar ahí.
   */
  const terminarLlamada = async (nombre: string, paraLlevar: boolean) => {
    const { mesa } = await registrarMesa(nombre.trim(), paraLlevar);
    guardarBorrador(mesa.id, nuevo, mixActivo, extrasNuevos);
    guardarBorrador(BORRADOR_LLAMADA, []);
    setNombrando(false);
    if (await enviar(mesa.id)) guardarBorrador(mesa.id, []);
    else registrarError(`La orden de ${nombre.trim()} se guardó, pero el pedido no llegó a cocina. Ábrela y toca Enviar otra vez.`, 'app');
    setOrdenCreada(mesa.id);
  };

  const cuentaPedida = (orden?.estatus ?? 0) >= 1;
  const pedirLaCuenta = async () => {
    if (idOrden === null || !orden || !puedeEditar || !hayEnviado) return;
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
          {esLlamada ? (
            // LLAMADA: aún no hay orden; se puede descartar si el cliente colgó.
            <>
              <span className="h-14 px-4 rounded-xl border-2 border-sky-400 bg-sky-100 text-sky-900 flex items-center gap-2 text-lg font-black tracking-wide">
                <Phone className="w-6 h-6" /> LLAMADA
              </span>
              {descartando ? (
                <span className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setNuevo([]);
                      setExtrasNuevos([]);
                      setMixActivo(null);
                      guardarBorrador(claveBorrador, []);
                      onVolver();
                    }}
                    className="h-14 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                  >
                    Sí, descartar
                  </button>
                  <button
                    onClick={() => setDescartando(false)}
                    className="h-14 px-4 rounded-xl bg-white border-2 border-neutral-200 font-semibold cursor-pointer"
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setDescartando(true)}
                  className="h-14 px-4 rounded-xl bg-white border-2 border-neutral-200 hover:border-rose-300 text-rose-700 font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-5 h-5" /> Descartar
                </button>
              )}
            </>
          ) : (
          <span
            title={paraLlevar ? 'Para llevar' : 'Comer aquí'}
            className={`${pantallaCompleta ? 'w-14 h-14' : 'w-12 h-12'} rounded-xl border-2 flex items-center justify-center ${
              paraLlevar ? 'bg-violet-100 border-violet-400 text-violet-900' : 'bg-sky-50 border-sky-300 text-sky-800'
            }`}
          >
            {paraLlevar ? <ShoppingBag className="w-6 h-6" /> : <Home className="w-6 h-6" />}
          </span>
          )}
          {pantallaCompleta && !esLlamada && (
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
          {/* Dividir la cuenta entre varias personas (con lo ya enviado) */}
          {pantallaCompleta && !esLlamada && (
            <button
              onClick={() => setDividiendo(true)}
              disabled={!hayEnviado}
              title={hayEnviado ? 'Dividir cuenta' : 'Dividir cuenta: primero envía algo'}
              aria-label="Dividir cuenta"
              className="w-14 h-14 rounded-xl bg-white border-2 border-violet-200 hover:border-violet-400 text-violet-700 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Split className="w-6 h-6" />
            </button>
          )}
        </div>
        <div className="text-right">
          <div className={`${pantallaCompleta ? 'text-3xl' : 'text-2xl'} font-bold`}>{esLlamada ? 'Pedido por teléfono' : (orden?.etiqueta ?? '…')}</div>
          <div className={`${pantallaCompleta ? 'text-base' : 'text-sm'} text-neutral-500`}>
            {esLlamada ? (
              'Al terminar se guarda con el nombre del cliente'
            ) : (
              <>
                Total orden <span className="font-mono font-semibold text-neutral-900">{dinero(orden?.total ?? 0)}</span>
              </>
            )}
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
          <PedidoEnviado orden={orden} detalle={detalle} extras={extrasEnviados} />
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
          extras={extrasEnviados}
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
          {/* Dentro de una categoría (opciones o cuadrícula de Bebidas): regresar a las categorías */}
          {(opcionesDe || categoriaAbierta) && (
            <div className="shrink-0 flex items-center gap-3 pb-2">
              <button
                onClick={() => {
                  setOpcionesDe(null);
                  setCategoriaAbierta(null);
                }}
                className="min-h-12 px-6 rounded-xl border-2 border-emerald-700 bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 shrink-0" /> VOLVER
              </button>
              {/* Mientras se elige un producto: comentario para cocina (lo que no está en el menú ni en las opciones) */}
              {opcionesDe && (
                <button
                  type="button"
                  onClick={() => setEditandoComentario(true)}
                  disabled={!puedeEditar}
                  title={comentario ? `Comentario: ${comentario}` : 'Agregar un comentario para cocina'}
                  className={`min-h-12 min-w-0 px-4 rounded-xl border-2 font-black flex items-center gap-2 cursor-pointer disabled:opacity-40 ${
                    comentario ? 'bg-sky-600 border-sky-700 text-white' : 'bg-white border-sky-300 text-sky-800 hover:bg-sky-50'
                  }`}
                >
                  <MessageSquareText className="w-5 h-5 shrink-0" />
                  {comentario ? <span className="truncate max-w-[14rem] font-semibold">{comentario}</span> : 'COMENTARIO'}
                </button>
              )}
              {/* Del lado opuesto: MIXTAS (piezas de cada sabor en un solo renglón) */}
              {opcionesDe && puedeMezclar && (
                <button
                  type="button"
                  onClick={() => setMezclar((v) => !v)}
                  disabled={!puedeEditar}
                  aria-pressed={mezclar}
                  className={`ml-auto min-h-12 px-6 rounded-xl border-2 font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 ${
                    mezclar ? 'bg-orange-500 border-orange-600 text-white' : 'bg-white border-orange-300 text-orange-800 hover:bg-orange-50'
                  }`}
                >
                  <Shuffle className="w-5 h-5 shrink-0" /> MIXTAS
                </button>
              )}
            </div>
          )}
          {menu === null ? (
            <div className="flex-1 flex items-center justify-center text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : opcionesDe ? (
            <OpcionesCategoria
              key={opcionesDe.id}
              categoria={opcionesDe}
              pantallaCompleta={pantallaCompleta}
              onAgregar={(producto, cantidad, sin, mezcla, extras) => agregar(producto, opcionesDe.nombre, cantidad, sin, mezcla, extras)}
              mezclar={mezclar}
              onMezclaAgregada={() => setMezclar(false)}
            />
          ) : categoriaAbierta ? (
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              {/* Para regresar a las categorías: VOLVER, junto a MIX */}
              <div className="shrink-0 text-lg font-bold text-right">{categoriaAbierta.nombre}</div>
              {/* Grupos de la categoría (Bebidas: Refrescos, Aguas, Jugos), como pestañas */}
              {gruposAbiertos.length > 1 && (
                <div
                  className="shrink-0 grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${gruposAbiertos.length}, minmax(0, 1fr))` }}
                >
                  {gruposAbiertos.map((g) => {
                    const activo = g === grupoVisible;
                    const piezas = nuevo.filter((l) => l.categoria === categoriaAbierta.nombre && grupoDe(l.producto) === g).reduce((a, l) => a + l.cantidad, 0);
                    return (
                      <button
                        key={g}
                        onClick={() => setGrupoAbierto(g)}
                        aria-pressed={activo}
                        className={`relative h-12 rounded-xl border-2 text-lg font-bold flex items-center justify-center gap-2 cursor-pointer ${
                          pantallaCompleta
                            ? activo
                              ? 'neon-solido neon-cian'
                              : 'neon neon-cian'
                            : activo
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'bg-white border-orange-200 text-orange-800 hover:bg-orange-50'
                        }`}
                      >
                        {g}
                        {piezas > 0 && (
                          <span className="min-w-6 h-6 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                            {piezas}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] auto-rows-[minmax(4.5rem,1fr)] gap-2">
                {categoriaAbierta.productos.filter((p) => gruposAbiertos.length < 2 || grupoDe(p) === grupoVisible).map((p) => {
                  const enPedido = nuevo.filter((l) => l.producto.id === p.id).reduce((acc, l) => acc + l.cantidad, 0) || undefined;
                  const logo = categoriaAbierta.nombre === 'Bebidas' ? logoBebida(p.nombre) : null;
                  return (
                    <button
                      key={p.id}
                      onClick={() => agregarRapido(p, categoriaAbierta.nombre)}
                      disabled={!puedeEditar}
                      className={`relative rounded-2xl border-2 p-3 flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                        pantallaCompleta ? 'neon neon-cian' : 'border-orange-200 bg-orange-50/40 hover:bg-orange-50'
                      }`}
                    >
                      {logo && <img src={logo} alt="" width={40} height={40} decoding="async" draggable={false} className="w-10 h-10 shrink-0 object-contain" />}
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
                  const foto = fotoCategoria(c.nombre);
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
                      {foto ? (
                        <img src={foto} alt="" width={96} height={64} decoding="async" draggable={false} className="w-24 h-16 shrink-0 object-contain" />
                      ) : (
                        <Icono className="w-12 h-12 shrink-0" />
                      )}
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
            <div className="shrink-0 flex items-center justify-between gap-2">
              <h3 className="font-bold">Nuevo pedido</h3>
              <div className="flex items-center gap-2">
                {/* MIX: los siguientes productos van en un solo plato; junto al botón de extra */}
                <button
                  type="button"
                  onClick={alternarMix}
                  disabled={!puedeEditar}
                  aria-pressed={mixActivo !== null}
                  title={mixActivo === null ? 'Agrupar los siguientes productos en un plato' : 'Cerrar el MIX'}
                  className={`h-10 px-3 rounded-xl border-2 text-sm font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                    mixActivo !== null ? 'bg-violet-600 border-violet-700 text-white' : 'bg-white border-violet-300 text-violet-800 hover:bg-violet-50'
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4 shrink-0" /> MIX
                </button>
                <button type="button" disabled={!puedeEditar} onClick={() => setAgregandoExtra(true)} aria-label="Agregar extra" title="Agregar extra" className="w-10 h-10 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900 flex items-center justify-center cursor-pointer disabled:opacity-40"><Plus className="w-5 h-5" /></button>
              </div>
            </div>
            {mixActivo !== null && (
              <p role="status" className="shrink-0 text-sm text-violet-800 font-semibold">
                MIX · lo que agregues va en un solo plato
              </p>
            )}
            <div className={pantallaCompleta ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-1' : 'space-y-2'}>
              {!hayNuevo ? (
                <p className="text-sm text-neutral-500">Toca productos del menú para agregarlos.</p>
              ) : (
                gruposNuevos.map((grupo, indice) => (
                  <div key={grupo.grupo === null ? `suelto-${indice}` : `mix-${grupo.grupo}`} className={grupo.grupo !== null ? 'rounded-xl border-2 border-violet-200 bg-violet-50/50 p-2 space-y-2' : ''}>
                    {grupo.grupo !== null && <div className="text-xs font-black tracking-wide text-violet-800">MIX</div>}
                    {grupo.lineas.map((l) => (
                  <div key={l.id} className="border-b border-neutral-100 pb-2 last:border-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium leading-tight">
                        {nombreLinea(l)}
                        <span className="block text-xs font-normal text-neutral-500">{l.categoria}</span>
                        {l.termino && <span className="block text-xs font-semibold text-orange-800">Término: {l.termino.nombre}</span>}
                        {l.sinQueso && <span className="block text-xs font-black tracking-wide text-violet-700">SIN QUESO</span>}
                        {l.conQueso && <span className="block text-xs font-black tracking-wide text-amber-700">CON QUESO</span>}
                        {l.papas && <span className="block text-xs font-semibold text-amber-800">CON PAPAS (+{dinero(l.papas.precio)} c/u)</span>}
                        {!!l.complementosExtra?.length && (
                          <span className="block text-xs font-black tracking-wide text-amber-800">
                            {textoComplementosExtra(l.complementosExtra.map((c) => c.nombre))} (+{dinero(l.complementosExtra.length * PRECIO_COMPLEMENTO_EXTRA)} c/u)
                          </span>
                        )}
                        {!!l.carneExtra && (
                          <span className="block text-xs font-black tracking-wide text-red-700">{textoCarneExtra(l.carneExtra)}</span>
                        )}
                        {l.nota && <span className="block text-xs font-semibold text-sky-800">Nota: {l.nota}</span>}
                        {sinDescritos(l).length > 0 && (
                          <span className="block text-xs font-normal text-rose-700">Sin {sinDescritos(l).map((c) => c.nombre.toLowerCase()).join(', ')}</span>
                        )}
                      </span>
                      <span className="font-mono text-sm">{dinero(importeLinea(l))}</span>
                    </div>
                    {l.reparto?.length ? (
                      // MIXTAS: las piezas de cada sabor ya están contadas; se quita el renglón completo y se vuelve a armar.
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => cambiar(l.id, -l.cantidad)}
                          disabled={!puedeEditar}
                          aria-label="Quitar mixtas"
                          className="w-10 h-10 rounded-lg border border-neutral-200 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </button>
                        <span className="font-mono font-bold text-lg">{l.cantidad} pzas</span>
                      </div>
                    ) : (
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
                    )}
                  </div>
                    ))}
                    {/* Extras agregados con este MIX abierto: van dentro del plato (y en cocina salen debajo de él) */}
                    {grupo.grupo !== null && (
                      <ListaExtras
                        enMix
                        extras={extrasNuevos.filter((e) => e.mixGrupo === grupo.grupo)}
                        onQuitar={puedeEditar ? quitarExtra : undefined}
                      />
                    )}
                  </div>
                ))
              )}
              <ListaExtras extras={extrasSueltos} onQuitar={puedeEditar ? quitarExtra : undefined} />
            </div>
            {esLlamada ? (
              // LLAMADA: al colgar se pide el nombre del cliente; ahí se registra la orden y se manda a cocina.
              <button
                onClick={() => setNombrando(true)}
                disabled={!puedeEditar || !hayNuevo}
                className="neon-solido neon-azul w-full h-14 shrink-0 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-lg font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <PhoneOff className="w-5 h-5" />}
                Terminar llamada
                {hayNuevo && ` · ${dinero(totalNuevo)}`}
              </button>
            ) : pantallaCompleta && !hayNuevo ? (
              // Tablet sin productos seleccionados: pedir la cuenta (orden.estatus → 1 PAGANDO; la caja cobra)
              <button
                onClick={pedirLaCuenta}
                disabled={!puedeEditar || !hayEnviado}
                className="neon-solido neon-fresco w-full h-14 shrink-0 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-lg font-bold tracking-wide flex items-center justify-center gap-2 cursor-pointer"
              >
                {pidiendoCuenta ? <Loader2 className="w-5 h-5 animate-spin" /> : <HandCoins className="w-5 h-5" />}
                {cuentaPedida ? 'CUENTA PEDIDA' : 'PEDIR CUENTA'}
              </button>
            ) : (
              <button
                onClick={() => enviar()}
                disabled={!puedeEditar || !hayNuevo}
                className={`w-full h-14 shrink-0 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-lg font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                  pantallaCompleta ? 'neon-solido neon-fuego' : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                }`}
              >
                {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {pantallaCompleta ? 'Enviar' : 'Enviar a cocina'}
                {hayNuevo && ` · ${dinero(totalNuevo)}`}
              </button>
            )}
          </section>
        </aside>
      </div>
      )}
      </>
      )}

      {/* LLAMADA terminada: nombre del cliente */}
      {editandoComentario && puedeEditar && (
        <DialogoComentario
          inicial={comentario}
          onGuardar={(texto) => {
            setComentario(texto);
            setEditandoComentario(false);
          }}
          onCancelar={() => setEditandoComentario(false)}
        />
      )}
      {agregandoExtra && puedeEditar && <DialogoAgregarExtra onCancelar={() => setAgregandoExtra(false)} onAgregar={(extra) => {
        if (!puedeEditar) return;
        // Con un MIX abierto, el extra queda dentro de ese MIX (en cocina sale justo debajo de él).
        setExtrasNuevos((lista) => [...lista, { ...extra, id: siguienteExtra++, mixGrupo: mixActivo }]);
        setAgregandoExtra(false);
      }} />}
      <AnimatePresence>
        {nombrando && (
          <DialogoTerminarLlamada
            piezas={nuevo.reduce((acc, l) => acc + l.cantidad, 0)}
            total={totalNuevo}
            onGuardar={terminarLlamada}
            onCancelar={() => setNombrando(false)}
          />
        )}
      </AnimatePresence>

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
              <PedidoEnviado orden={orden} detalle={detalle} extras={extrasEnviados} className="min-h-0 shadow-xl" />
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

      {/* Dividir la cuenta (solo calcula cuánto le toca a cada persona) */}
      <AnimatePresence>
        {dividiendo && orden && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDividiendo(false)}
          >
            <motion.div
              role="dialog"
              aria-label="Dividir cuenta"
              className="w-full max-w-3xl max-h-full flex"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <DividirCuenta etiqueta={orden.etiqueta} total={orden.total} detalle={detalle} extras={extrasEnviados} onCerrar={() => setDividiendo(false)} />
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

/** LLAMADA: al colgar se escribe a nombre de quién va el pedido; ahí se registra la orden y se manda a cocina. */
function DialogoTerminarLlamada({
  piezas,
  total,
  onGuardar,
  onCancelar,
}: {
  piezas: number;
  total: number;
  onGuardar: (nombre: string, paraLlevar: boolean) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  // Por teléfono casi siempre es para llevar.
  const [paraLlevar, setParaLlevar] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(nombre, paraLlevar);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la orden.');
      setGuardando(false);
    }
  };

  const claseTipo = (activo: boolean) =>
    `h-12 rounded-xl border-2 font-bold flex items-center justify-center gap-2 cursor-pointer ${
      activo ? 'bg-sky-600 border-sky-700 text-white' : 'bg-white border-neutral-200 text-neutral-700'
    }`;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh] bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !guardando && onCancelar()}
    >
      <motion.form
        role="dialog"
        aria-labelledby="terminar-llamada-titulo"
        onSubmit={guardar}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="terminar-llamada-titulo" className="text-xl font-bold flex items-center gap-2">
            <PhoneOff className="w-6 h-6 text-sky-700" /> Terminar llamada
          </h2>
          <p className="text-sm text-neutral-600">
            {piezas} {piezas === 1 ? 'producto' : 'productos'} · {dinero(total)}. Escribe a nombre de quién va el pedido.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-neutral-800">Nombre del cliente</span>
          <span className="relative block">
            <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              maxLength={100}
              enterKeyHint="send"
              placeholder="Ej. Juan Pérez"
              className="w-full h-14 pl-11 pr-3 rounded-xl border-2 border-neutral-300 bg-white text-lg focus:outline-none focus:border-sky-500 select-text"
            />
          </span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setParaLlevar(true)} aria-pressed={paraLlevar} className={claseTipo(paraLlevar)}>
            <ShoppingBag className="w-5 h-5" /> Para llevar
          </button>
          <button type="button" onClick={() => setParaLlevar(false)} aria-pressed={!paraLlevar} className={claseTipo(!paraLlevar)}>
            <Home className="w-5 h-5" /> Comer aquí
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="h-14 px-4 rounded-xl text-base font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
          >
            Seguir pidiendo
          </button>
          <button
            type="submit"
            disabled={!nombre.trim() || guardando}
            className="h-14 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed text-white text-lg font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            {guardando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {guardando ? 'Guardando…' : 'Guardar y enviar a cocina'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
