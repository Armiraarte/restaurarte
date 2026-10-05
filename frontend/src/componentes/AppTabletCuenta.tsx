// Pantalla para tomar el pedido de una cuenta. La usa la app de tablet y también la caja (Mesas).
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Check,
  CheckCircle2,
  ClipboardList,
  Cookie,
  Croissant,
  CupSoda,
  Cylinder,
  Disc,
  Drumstick,
  Flame,
  Ham,
  Hamburger,
  Home,
  LucideIcon,
  Minus,
  Pizza,
  Plus,
  Popcorn,
  Salad,
  ShoppingBag,
  Sandwich,
  Send,
  Soup,
  StickyNote,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { Account, Comanda, ComandaStatus, GrupoProducto, ProductCatalogItem, SeleccionProducto, TabletDevice } from '../types/pos';
import {
  CATEGORIAS_PRODUCTO,
  ElegidoProducto,
  armarItem,
  grupoPrincipal,
  opcionesOrdenadas,
  posDataService,
  seleccionInicial,
} from '../services/dataService';

interface AppTabletCuentaProps {
  cuenta: Account;
  /** Quién envía las comandas: la tablet del mesero o la caja. */
  origen: Pick<TabletDevice, 'name' | 'assignedWaiter'>;
  productos: ProductCatalogItem[];
  onVolver: () => void;
  /** Solo en caja: permite dar de alta un producto que no está en el menú. */
  permitirNuevoProducto?: boolean;
}

interface LineaPedido {
  itemId: string;
  elegido: ElegidoProducto; // selección normal, piezas (Burritas) o reparto (Alitas)
  quantity: number;
  /** Las líneas con reparto no se juntan ni cambian de cantidad (la cantidad es la suma del reparto). */
  unica?: string;
  notes: string;
}

// Ícono de cada categoría (no hay íconos exactos de comida mexicana: se usa el más parecido).
const ICONO_CATEGORIA: Record<string, LucideIcon> = {
  Tacos: Croissant,
  'Tacos Dorados': Flame,
  Quesadillas: Pizza,
  Sopes: Disc,
  Enchiladas: Soup,
  Tostadas: Cookie,
  Burritas: Cylinder,
  Lonches: Sandwich,
  Hamburguesas: Hamburger,
  Ensaladas: Salad,
  'Papas a la Francesa': Popcorn,
  Alitas: Drumstick,
  Salchichas: Ham,
  Bebidas: CupSoda,
};

// Colores pastel que se reparten en orden entre las categorías.
const COLORES_CATEGORIA = [
  { normal: 'bg-orange-50 border-orange-200 text-orange-800', activo: 'bg-orange-100 border-orange-400 text-orange-900' },
  { normal: 'bg-amber-50 border-amber-200 text-amber-800', activo: 'bg-amber-100 border-amber-400 text-amber-900' },
  { normal: 'bg-lime-50 border-lime-200 text-lime-800', activo: 'bg-lime-100 border-lime-400 text-lime-900' },
  { normal: 'bg-emerald-50 border-emerald-200 text-emerald-800', activo: 'bg-emerald-100 border-emerald-400 text-emerald-900' },
  { normal: 'bg-sky-50 border-sky-200 text-sky-800', activo: 'bg-sky-100 border-sky-400 text-sky-900' },
  { normal: 'bg-violet-50 border-violet-200 text-violet-800', activo: 'bg-violet-100 border-violet-400 text-violet-900' },
  { normal: 'bg-pink-50 border-pink-200 text-pink-800', activo: 'bg-pink-100 border-pink-400 text-pink-900' },
];

// JSON con llaves ordenadas: dos elecciones iguales dan la misma clave.
const estable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(estable).join(',')}]`
    : v && typeof v === 'object'
    ? `{${Object.keys(v as object)
        .sort()
        .map((k) => `${k}:${estable((v as Record<string, unknown>)[k])}`)
        .join(',')}}`
    : JSON.stringify(v);

/** Normaliza: las opciones de "varias" no dependen del orden en que se tocaron. */
const normalizar = (sel: SeleccionProducto): SeleccionProducto =>
  Object.fromEntries(Object.entries(sel).map(([g, ops]) => [g, [...ops].sort()]));

// Piezas iguales (mismo producto y mismas elecciones) se juntan en una línea.
const claveDe = (l: { itemId: string; elegido: ElegidoProducto; unica?: string }) =>
  `${l.itemId}|${l.unica ?? ''}|${estable(l.elegido)}`;

/** Grupo "elige una" obligatorio que aún no se eligió. */
const faltanteEn = (p: ProductCatalogItem, sel: SeleccionProducto) =>
  p.grupos?.find((g) => g.tipo === 'una' && !g.opcional && g.nombre !== p.reparto && !sel[g.nombre]?.length);

/** Precio que se muestra en el mosaico del producto. */
const etiquetaPrecio = (p: ProductCatalogItem) => {
  if (p.paquete) return Object.entries(p.paquete.precios).map(([n, precio]) => `${n} × $${precio}`).join(' · ');
  if (p.reparto) return `$${p.price} c/u`;
  const conPrecios = p.grupos?.find((g) => g.precios);
  if (conPrecios) return `desde $${Math.min(...Object.values(conPrecios.precios!))}`;
  return `$${p.price.toFixed(2)}`;
};

interface Alerta {
  titulo: string;
  detalle: string[];
}

export const AppTabletCuenta: React.FC<AppTabletCuentaProps> = ({
  cuenta,
  origen,
  productos: catalogo,
  onVolver,
  permitirNuevoProducto = false,
}) => {
  // Si la categoría tiene un solo producto y ese producto tiene opciones, se muestran de inmediato.
  const unicoConOpciones = (c: string) => {
    const deCategoria = catalogo.filter((p) => p.category === c);
    return deCategoria.length === 1 && deCategoria[0].grupos?.length ? deCategoria[0].id : null;
  };

  // Abre en la primera categoría que tenga productos.
  const [categoria, setCategoria] = useState<string>(
    () => CATEGORIAS_PRODUCTO.find((c) => catalogo.some((p) => p.category === c)) ?? CATEGORIAS_PRODUCTO[0]
  );
  const [conOpcionesId, setConOpcionesId] = useState<string | null>(null);
  // Pantalla de opciones: lo elegido y cuántas piezas agregar.
  const [seleccion, setSeleccion] = useState<SeleccionProducto>({});
  const [piezasSel, setPiezasSel] = useState<SeleccionProducto[]>([]); // Burritas: una selección por pieza
  const [repartoSel, setRepartoSel] = useState<Record<string, number>>({}); // Alitas: cantidad por sabor
  const [cantidadSel, setCantidadSel] = useState(1);
  const [cambiarTipoOrden, setCambiarTipoOrden] = useState(false);
  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const [verPedido, setVerPedido] = useState(false);
  const [agregadoFlash, setAgregadoFlash] = useState<string | null>(null);

  const abrirOpciones = (id: string | null) => {
    const p = id ? catalogo.find((x) => x.id === id) : undefined;
    setConOpcionesId(id);
    setSeleccion(p ? seleccionInicial(p) : {});
    setPiezasSel(p?.paquete ? [seleccionInicial(p)] : []);
    setRepartoSel({});
    setCantidadSel(1);
    setAgregadoFlash(null);
  };

  // La alerta se cierra sola a los 4 segundos (o al tocar Aceptar).
  useEffect(() => {
    if (!alerta) return;
    const t = setTimeout(() => setAlerta(null), 4000);
    return () => clearTimeout(t);
  }, [alerta]);

  const elegirCategoria = (c: string) => {
    setCategoria(c);
    abrirOpciones(unicoConOpciones(c));
  };
  const [pedido, setPedido] = useState<LineaPedido[]>([]);
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nuevoProducto, setNuevoProducto] = useState<{
    name: string;
    category: string;
    price: string;
    opciones: string;
    acompanamientos: string;
  } | null>(null);

  // Todas las categorías del menú, más alguna antigua que aún tenga productos guardados.
  const categorias = [
    ...CATEGORIAS_PRODUCTO,
    ...Array.from(new Set(catalogo.map((p) => p.category))).filter((c) => !CATEGORIAS_PRODUCTO.includes(c)),
  ];
  const productos = catalogo.filter((p) => p.category === categoria);
  const productoOpciones = catalogo.find((p) => p.id === conOpcionesId && p.grupos?.length);
  const totalReparto = Object.values(repartoSel).reduce((a, n) => a + n, 0);
  // Lo que falta elegir antes de poder agregar (el botón lo pide).
  const faltante = (() => {
    const p = productoOpciones;
    if (!p) return null;
    if (p.reparto) return totalReparto === 0 ? `Elige cuántas ${p.name.toLowerCase()}` : null;
    if (p.paquete) {
      const i = piezasSel.findIndex((sel) => faltanteEn(p, sel));
      return i === -1 ? null : `Elige ${faltanteEn(p, piezasSel[i])!.nombre.toLowerCase()} de la ${p.paquete.nombrePieza.toLowerCase()} ${i + 1}`;
    }
    const g = faltanteEn(p, seleccion);
    return g ? `Elige ${g.nombre.toLowerCase()}` : null;
  })();
  // Lo que se agregaría con lo elegido ahora (para el botón y el aviso).
  const elegidoActual: ElegidoProducto | null = productoOpciones
    ? productoOpciones.reparto
      ? { reparto: Object.fromEntries(Object.entries(repartoSel).filter(([, n]) => n > 0)) }
      : productoOpciones.paquete
      ? { piezas: piezasSel.map(normalizar) }
      : { seleccion: normalizar(seleccion) }
    : null;
  const cantidadesPaquete = productoOpciones?.paquete
    ? Object.keys(productoOpciones.paquete.precios).map(Number).sort((a, b) => a - b)
    : [];
  const indiceCantidadPaquete = cantidadesPaquete.indexOf(piezasSel.length);
  const cambiarCantidadPaquete = (paso: number) => {
    const cantidad = cantidadesPaquete[indiceCantidadPaquete + paso];
    if (cantidad === undefined || !productoOpciones) return;
    setPiezasSel((prev) =>
      Array.from({ length: cantidad }, (_, i) => prev[i] ?? seleccionInicial(productoOpciones))
    );
  };
  const cantidadActual = productoOpciones?.reparto ? totalReparto : cantidadSel;
  const producto = (id: string) => catalogo.find((p) => p.id === id);
  // Si un producto se elimina del menú mientras está en el pedido, se descarta.
  const lineas = pedido.filter((l) => producto(l.itemId));
  const totalPedido = lineas.reduce((acc, l) => acc + armarItem(producto(l.itemId)!, l.elegido).unitPrice * l.quantity, 0);
  // Cada envío a cocina es una ronda, en el orden en que se pidió.
  const rondas = posDataService.getComandasByAccountId(cuenta.id).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const pidioCuenta = cuenta.status === 'cuenta_solicitada';
  const pagada = cuenta.status === 'pagada';

  const mostrarAviso = (msg: string) => {
    setAviso(msg);
    setTimeout(() => setAviso(null), 3000);
  };

  const agregar = (itemId: string, elegido: ElegidoProducto = {}, cantidad = 1, unica?: string) => {
    const nueva: LineaPedido = { itemId, elegido, quantity: cantidad, notes: '', unica };
    const clave = claveDe(nueva);
    setPedido((prev) => {
      const existe = prev.find((l) => claveDe(l) === clave);
      return existe
        ? prev.map((l) => (claveDe(l) === clave ? { ...l, quantity: l.quantity + cantidad } : l))
        : [...prev, nueva];
    });
  };

  // Solo aquí se suma al pedido; "Volver" descarta lo elegido.
  const agregarSeleccion = (p: ProductCatalogItem) => {
    if (faltante || !elegidoActual) return;
    agregar(p.id, elegidoActual, cantidadActual, p.reparto ? String(Date.now()) : undefined);
    const { productName } = armarItem(p, elegidoActual);
    setAgregadoFlash(`${cantidadActual} × ${productName}`);
    setTimeout(() => setAgregadoFlash(null), 1800);
    setSeleccion(seleccionInicial(p));
    setPiezasSel(p.paquete ? [seleccionInicial(p)] : []);
    setRepartoSel({});
    setCantidadSel(1);
  };

  const cambiarCantidad = (clave: string, delta: number) => {
    setPedido((prev) =>
      prev.map((l) => (claveDe(l) === clave ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0)
    );
  };

  const cambiarNota = (clave: string, notes: string) => {
    setPedido((prev) => prev.map((l) => (claveDe(l) === clave ? { ...l, notes } : l)));
  };

  /** Piezas del producto en el pedido; con `opcion`, solo las de esa opción del grupo principal. */
  const cantidadEnPedido = (itemId: string, opcion?: string) => {
    const p = producto(itemId);
    const principal = p && grupoPrincipal(p);
    return pedido
      .filter(
        (l) =>
          l.itemId === itemId &&
          (opcion === undefined || (principal && l.elegido.seleccion?.[principal.nombre]?.[0] === opcion))
      )
      .reduce((acc, l) => acc + l.quantity, 0);
  };

  const enviarACocina = () => {
    try {
      const comanda = posDataService.simulateNewComanda(
        cuenta.id,
        lineas.map((l) => ({
          itemId: l.itemId,
          ...l.elegido,
          quantity: l.quantity,
          notes: l.notes.trim() || undefined,
        })),
        origen.name,
        origen.assignedWaiter
      );
      setPedido([]);
      setError(null);
      setAlerta({
        titulo: `Orden ${comanda.orderNumber} enviada a cocina${comanda.paraLlevar ? ' · PARA LLEVAR' : ''}`,
        detalle: comanda.items.map(
          (it) =>
            `${it.quantity} × ${it.productName}${
              it.modifiers?.length ? ` — ${it.modifiers.join(', ').toLowerCase()}` : ''
            }`
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el pedido.');
    }
  };

  const crearProducto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoProducto) return;
    try {
      const p = posDataService.addProducto({
        ...nuevoProducto,
        price: Number(nuevoProducto.price),
        grupos: [
          { nombre: 'Opción', tipo: 'una', opciones: nuevoProducto.opciones.split(',') },
          { nombre: 'Acompañamientos', tipo: 'varias', opciones: nuevoProducto.acompanamientos.split(',') },
        ],
      });
      if (p.grupos) abrirOpciones(p.id);
      else agregar(p.id);
      setCategoria(p.category);
      setNuevoProducto(null);
      setError(null);
      mostrarAviso(p.grupos ? `"${p.name}" se agregó al menú: elige sus opciones.` : `"${p.name}" se agregó al menú y al pedido.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el producto.');
    }
  };

  const pedirCuenta = () => {
    try {
      const c = posDataService.simulateRequestBill(cuenta.id);
      setError(null);
      setAlerta({ titulo: 'Cuenta pedida a caja', detalle: [`${c.identifier} · Total $${c.total.toFixed(2)}`] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pedir la cuenta.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra superior de la cuenta */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onVolver}
          className="h-12 px-4 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 flex items-center gap-2 font-medium cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" /> Mesas
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVerPedido(true)}
            className="relative h-12 px-4 rounded-xl bg-sky-50 border-2 border-sky-200 hover:bg-sky-100 text-sky-800 flex items-center gap-2 font-semibold cursor-pointer"
          >
            <ClipboardList className="w-5 h-5" /> Ver pedido
            {rondas.length > 0 && (
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-sky-600 text-white text-xs font-bold flex items-center justify-center">
                {rondas.length}
              </span>
            )}
          </button>
          <div className="text-right">
            <div className="text-2xl font-bold flex items-center justify-end gap-2">
              {cuenta.identifier}
              <button
                onClick={() => setCambiarTipoOrden(true)}
                disabled={pagada}
                title="Cambiar tipo de orden"
                className={`h-8 px-2.5 rounded-lg border-2 text-xs font-black tracking-wider cursor-pointer ${
                  cuenta.paraLlevar
                    ? 'bg-violet-100 border-violet-400 text-violet-900'
                    : 'bg-sky-50 border-sky-300 text-sky-800'
                }`}
              >
                {cuenta.paraLlevar ? 'PARA LLEVAR' : 'COMER AQUÍ'}
              </button>
            </div>
            <div className="text-sm text-neutral-500">
              Total cuenta <span className="font-mono font-semibold text-neutral-900">${cuenta.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {aviso && (
        <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">{aviso}</div>
      )}

      {pagada ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center text-neutral-600">
          Esta cuenta ya fue cobrada en caja.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_360px]">
          {/* Menú */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-4">
            {productoOpciones && !pidioCuenta ? (
              /* Pantalla de opciones: se elige todo y solo "Agregar a la orden" lo suma al pedido de la derecha */
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => abrirOpciones(null)}
                    className="h-12 px-4 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" /> Volver
                  </button>
                  <div className="text-right">
                    <div className="text-xl font-bold">{productoOpciones.name}</div>
                    <div className="text-sm text-neutral-500 font-mono">{etiquetaPrecio(productoOpciones)}</div>
                  </div>
                </div>

                {productoOpciones.paquete ? (
                  <>
                    {/* Paquete: cuántas piezas y cada una por separado */}
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-neutral-700">
                        1. ¿Cuántas {productoOpciones.paquete.nombrePlural.toLowerCase()}?
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => cambiarCantidadPaquete(-1)}
                            disabled={indiceCantidadPaquete <= 0}
                            aria-label="Una burrita menos"
                            className="w-14 h-14 rounded-xl border-2 border-neutral-200 bg-white flex items-center justify-center hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <span
                            role="spinbutton"
                            aria-label="Cantidad de burritas"
                            aria-valuemin={cantidadesPaquete[0]}
                            aria-valuemax={cantidadesPaquete[cantidadesPaquete.length - 1]}
                            aria-valuenow={piezasSel.length}
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                event.preventDefault();
                                cambiarCantidadPaquete(event.key === 'ArrowUp' ? 1 : -1);
                              }
                            }}
                            className="w-12 text-center font-mono text-3xl font-bold rounded-lg focus-visible:outline-2 focus-visible:outline-orange-500"
                          >
                            {piezasSel.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => cambiarCantidadPaquete(1)}
                            disabled={indiceCantidadPaquete >= cantidadesPaquete.length - 1}
                            aria-label="Una burrita más"
                            className="w-14 h-14 rounded-xl bg-orange-100 border-2 border-orange-200 text-orange-900 flex items-center justify-center hover:bg-orange-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        <span className="font-mono text-lg font-bold text-orange-900">
                          ${productoOpciones.paquete.precios[piezasSel.length]}
                        </span>
                      </div>
                    </div>
                    {piezasSel.map((sel, i) => (
                      <div key={i} className="border-2 border-neutral-200 rounded-2xl p-3 space-y-4">
                        <div className="font-bold">
                          {productoOpciones.paquete!.nombrePieza} {i + 1}
                        </div>
                        <GruposEditor
                          producto={productoOpciones}
                          seleccion={sel}
                          onChange={(nueva) => setPiezasSel((prev) => prev.map((x, k) => (k === i ? nueva : x)))}
                        />
                      </div>
                    ))}
                  </>
                ) : productoOpciones.reparto ? (
                  /* Reparto: cuántas piezas de cada opción dentro de la misma orden */
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-neutral-700">1. {productoOpciones.reparto} y cantidad</div>
                    <div className="space-y-2">
                      {opcionesOrdenadas(productoOpciones.grupos!.find((g) => g.nombre === productoOpciones.reparto)!).map(
                        (op) => {
                          const n = repartoSel[op] ?? 0;
                          return (
                            <div
                              key={op}
                              className={`flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-2 ${
                                n > 0 ? 'bg-orange-50 border-orange-400' : 'bg-white border-orange-200'
                              }`}
                            >
                              <span className="text-lg font-semibold">{op}</span>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setRepartoSel((prev) => ({ ...prev, [op]: Math.max(0, n - 1) }))}
                                  className="w-14 h-14 rounded-xl border-2 border-neutral-200 bg-white flex items-center justify-center cursor-pointer"
                                  aria-label={`Una menos de ${op}`}
                                >
                                  <Minus className="w-5 h-5" />
                                </button>
                                <span className="w-10 text-center font-mono text-2xl font-bold">{n}</span>
                                <button
                                  onClick={() => setRepartoSel((prev) => ({ ...prev, [op]: n + 1 }))}
                                  className="w-14 h-14 rounded-xl border-2 border-neutral-200 bg-white flex items-center justify-center cursor-pointer"
                                  aria-label={`Una más de ${op}`}
                                >
                                  <Plus className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                    <div className="text-right text-sm text-neutral-600">
                      Total: <strong>{totalReparto}</strong> {productoOpciones.name.toLowerCase()}
                    </div>
                  </div>
                ) : (
                  <>
                    <GruposEditor
                      producto={productoOpciones}
                      seleccion={seleccion}
                      onChange={setSeleccion}
                      contarEnPedido={(op) => cantidadEnPedido(productoOpciones.id, op)}
                    />
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-neutral-700">Cantidad</div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setCantidadSel((n) => Math.max(1, n - 1))}
                          className="w-14 h-14 rounded-xl border-2 border-neutral-200 bg-white flex items-center justify-center cursor-pointer"
                          aria-label="Menos"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <span className="w-12 text-center font-mono text-3xl font-bold">{cantidadSel}</span>
                        <button
                          onClick={() => setCantidadSel((n) => n + 1)}
                          className="w-14 h-14 rounded-xl border-2 border-neutral-200 bg-white flex items-center justify-center cursor-pointer"
                          aria-label="Más"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}


                <button
                  onClick={() => agregarSeleccion(productoOpciones)}
                  disabled={!!faltante}
                  className="w-full h-16 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed text-neutral-950 text-lg font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  {faltante ??
                    `Agregar a la orden · $${(armarItem(productoOpciones, elegidoActual!).unitPrice * cantidadActual).toFixed(2)}`}
                </button>

                {agregadoFlash && (
                  <div className="text-center text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl py-2">
                    ✓ Agregado: {agregadoFlash}
                  </div>
                )}
              </div>
            ) : (
              <>
            {permitirNuevoProducto && !pidioCuenta && (
              nuevoProducto ? (
                <form onSubmit={crearProducto} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                  <input
                    value={nuevoProducto.name}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, name: e.target.value })}
                    autoFocus
                    placeholder="Nombre del producto"
                    aria-label="Nombre del producto"
                    className="h-11 px-3 rounded-lg border border-neutral-300 bg-white text-sm focus:outline-none focus:border-amber-500 select-text"
                  />
                  <select
                    value={nuevoProducto.category}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, category: e.target.value })}
                    aria-label="Categoría"
                    className="h-11 px-2 rounded-lg border border-neutral-300 bg-white text-sm"
                  >
                    {CATEGORIAS_PRODUCTO.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={nuevoProducto.price}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, price: e.target.value })}
                    placeholder="Precio"
                    aria-label="Precio"
                    className="h-11 px-3 rounded-lg border border-neutral-300 bg-white text-sm focus:outline-none focus:border-amber-500 select-text"
                  />
                  <input
                    value={nuevoProducto.opciones}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, opciones: e.target.value })}
                    placeholder="Opciones, separadas por coma (opcional). Ej. Papa, Frijol"
                    aria-label="Opciones"
                    className="h-11 px-3 rounded-lg border border-neutral-300 bg-white text-sm focus:outline-none focus:border-amber-500 select-text sm:col-span-3"
                  />
                  <input
                    value={nuevoProducto.acompanamientos}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, acompanamientos: e.target.value })}
                    placeholder="Acompañamientos, separados por coma (opcional). Ej. Crema, Queso"
                    aria-label="Acompañamientos"
                    className="h-11 px-3 rounded-lg border border-neutral-300 bg-white text-sm focus:outline-none focus:border-amber-500 select-text sm:col-span-3"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="h-11 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-semibold cursor-pointer">
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => setNuevoProducto(null)}
                      className="h-11 px-3 rounded-lg text-sm text-neutral-600 hover:bg-neutral-200 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() =>
                    setNuevoProducto({
                      name: '',
                      category: CATEGORIAS_PRODUCTO.includes(categoria) ? categoria : CATEGORIAS_PRODUCTO[0],
                      price: '',
                      opciones: '',
                      acompanamientos: '',
                    })
                  }
                  className="h-10 px-4 rounded-full border border-dashed border-neutral-300 text-sm font-medium text-neutral-600 hover:border-amber-400 hover:text-neutral-900 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Producto nuevo
                </button>
              )
            )}
            {/* Categorías en cuadros */}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {categorias.map((c, i) => {
                const Icon = ICONO_CATEGORIA[c] ?? UtensilsCrossed;
                const color = COLORES_CATEGORIA[i % COLORES_CATEGORIA.length];
                const cantidad = catalogo.filter((p) => p.category === c).length;
                const activa = categoria === c;
                return (
                  <button
                    key={c}
                    onClick={() => elegirCategoria(c)}
                    aria-pressed={activa}
                    className={`relative aspect-square rounded-2xl border-2 p-2 flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer ${
                      activa ? `${color.activo} shadow-sm` : color.normal
                    } ${cantidad === 0 && !activa ? 'opacity-60' : ''}`}
                  >
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
                    <span className={`text-xs sm:text-sm leading-tight ${activa ? 'font-bold' : 'font-semibold'}`}>{c}</span>
                    <span className="absolute top-1.5 right-2 font-mono text-[11px] opacity-70">{cantidad}</span>
                  </button>
                );
              })}
            </div>

            <h3 className="font-bold pt-1">{categoria}</h3>
            {productos.length === 0 && (
              <p className="text-sm text-neutral-500">
                Aún no hay productos en {categoria}.
                {permitirNuevoProducto && ' Usa "Producto nuevo" para agregar uno.'}
              </p>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {productos.map((p) => {
                const enPedido = cantidadEnPedido(p.id) || undefined;
                const tieneOpciones = !!p.grupos?.length;
                const principal = grupoPrincipal(p) ?? p.grupos?.[0];
                return (
                  <button
                    key={p.id}
                    onClick={() => (tieneOpciones ? abrirOpciones(p.id) : agregar(p.id))}
                    disabled={pidioCuenta}
                    className="relative min-h-24 rounded-xl border-2 p-3 text-left flex flex-col justify-between disabled:opacity-50 cursor-pointer border-neutral-200 hover:border-orange-300 bg-neutral-50"
                  >
                    <span className="font-semibold leading-tight">{p.name}</span>
                    {principal && (
                      <span className="text-xs text-neutral-500">{opcionesOrdenadas(principal).join(' · ')}</span>
                    )}
                    <span className="font-mono text-sm text-neutral-600">{etiquetaPrecio(p)}</span>
                    {enPedido && (
                      <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                        {enPedido}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
              </>
            )}
          </section>

          {/* Pedido y estado */}
          <aside className="space-y-4 md:sticky md:top-20 md:self-start md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
            <section className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold">Nuevo pedido</h3>
              {lineas.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  {pidioCuenta ? 'La cuenta ya fue pedida.' : 'Toca productos del menú para agregarlos.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {lineas.map((l) => {
                    const p = producto(l.itemId)!;
                    const clave = claveDe(l);
                    const item = armarItem(p, l.elegido);
                    return (
                      <li key={clave} className="space-y-2 border-b border-neutral-100 pb-3 last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium leading-tight">
                            {item.productName}
                            {!!item.modifiers?.length && p.grupos && (
                              <span className="block text-xs font-normal text-emerald-700">{item.modifiers.join(' · ')}</span>
                            )}
                          </span>
                          <span className="font-mono text-sm">${(item.unitPrice * l.quantity).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {l.unica ? (
                            /* Reparto (Alitas): la cantidad es la suma de sabores; solo se puede quitar la línea */
                            <>
                              <button
                                onClick={() => cambiarCantidad(clave, -l.quantity)}
                                className="w-11 h-11 rounded-lg border border-neutral-200 flex items-center justify-center cursor-pointer"
                                aria-label="Quitar"
                              >
                                <Trash2 className="w-4 h-4 text-rose-600" />
                              </button>
                              <span className="font-mono font-bold text-lg">{l.quantity} pzas</span>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => cambiarCantidad(clave, -1)}
                                className="w-11 h-11 rounded-lg border border-neutral-200 flex items-center justify-center cursor-pointer"
                                aria-label="Quitar uno"
                              >
                                {l.quantity === 1 ? <Trash2 className="w-4 h-4 text-rose-600" /> : <Minus className="w-4 h-4" />}
                              </button>
                              <span className="w-8 text-center font-mono font-bold text-lg">{l.quantity}</span>
                              <button
                                onClick={() => cambiarCantidad(clave, 1)}
                                className="w-11 h-11 rounded-lg border border-neutral-200 flex items-center justify-center cursor-pointer"
                                aria-label="Agregar uno"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setNotaAbierta(notaAbierta === clave ? null : clave)}
                            className={`ml-auto h-11 px-2.5 rounded-lg border flex items-center gap-1.5 text-sm cursor-pointer ${
                              l.notes ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-neutral-200 text-neutral-600'
                            }`}
                          >
                            <StickyNote className="w-4 h-4" /> Nota
                          </button>
                        </div>
                        {notaAbierta === clave && (
                          <input
                            value={l.notes}
                            onChange={(e) => cambiarNota(clave, e.target.value)}
                            autoFocus
                            placeholder="Ej. sin cebolla"
                            className="w-full h-11 px-3 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:border-amber-500 select-text"
                          />
                        )}
                        {notaAbierta !== clave && l.notes && (
                          <p className="text-xs text-amber-800">Nota: {l.notes}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <button
                onClick={enviarACocina}
                disabled={lineas.length === 0}
                className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 text-lg font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-5 h-5" />
                Enviar a cocina{lineas.length > 0 && ` · $${totalPedido.toFixed(2)}`}
              </button>
            </section>

            {pidioCuenta ? (
              <div className="h-14 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-800 font-semibold flex items-center justify-center gap-2">
                <BellRing className="w-5 h-5" /> Cuenta pedida a caja
              </div>
            ) : (
              <button
                onClick={pedirCuenta}
                disabled={cuenta.total === 0 || lineas.length > 0}
                title={lineas.length > 0 ? 'Envía o borra el pedido nuevo antes de pedir la cuenta' : undefined}
                className="w-full h-14 rounded-xl bg-white border-2 border-emerald-300 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-800 text-lg font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <BellRing className="w-5 h-5" /> Pedir la cuenta
              </button>
            )}
          </aside>
        </div>
      )}

      {/* Corregir el tipo de orden de la cuenta */}
      <AnimatePresence>
        {cambiarTipoOrden && (
          <DialogoTipoOrden
            titulo={`${cuenta.identifier}: tipo de orden`}
            detalle="Aplica a lo que se envíe a cocina desde ahora."
            actual={!!cuenta.paraLlevar}
            onElegir={(v) => {
              posDataService.setTipoOrden(cuenta.id, v);
              setCambiarTipoOrden(false);
            }}
            onCancelar={() => setCambiarTipoOrden(false)}
          />
        )}
      </AnimatePresence>

      {/* Pedido por rondas y concentrado */}
      <AnimatePresence>
        {verPedido && (
          <PedidoRondas
            cuenta={cuenta}
            rondas={rondas}
            piezasSinEnviar={lineas.reduce((acc, l) => acc + l.quantity, 0)}
            onCerrar={() => setVerPedido(false)}
          />
        )}
      </AnimatePresence>

      {/* Alerta al enviar a cocina o pedir la cuenta */}
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
              aria-labelledby="alerta-titulo"
              className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 text-center space-y-4"
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
              <h2 id="alerta-titulo" className="text-xl font-bold">
                {alerta.titulo}
              </h2>
              <ul className="text-sm text-neutral-600 space-y-1">
                {alerta.detalle.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
              <button
                onClick={() => setAlerta(null)}
                autoFocus
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

/* ---------- Pedido por rondas ---------- */

const ESTADO_RONDA: Record<ComandaStatus, { label: string; clase: string }> = {
  nueva: { label: 'Enviada', clase: 'bg-neutral-100 text-neutral-700 border-neutral-200' },
  preparando: { label: 'Preparando', clase: 'bg-orange-50 text-orange-800 border-orange-200' },
  lista: { label: 'Lista', clase: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  entregada: { label: 'Entregada', clase: 'bg-sky-50 text-sky-800 border-sky-200' },
};

interface LineaConcentrado {
  productName: string;
  detalle: string[];
  notes?: string;
  cantidad: number;
  total: number;
  porRonda: { ronda: number; hora: string; cantidad: number }[];
}

/** Junta piezas iguales (mismo nombre, detalle y nota) de todas las rondas, recordando de qué ronda vino cada una. */
function concentrar(rondas: Comanda[]): LineaConcentrado[] {
  const mapa = new Map<string, LineaConcentrado>();
  rondas.forEach((c, i) => {
    for (const it of c.items) {
      const clave = `${it.productName}|${(it.modifiers ?? []).join(',')}|${it.notes ?? ''}`;
      const linea = mapa.get(clave) ?? {
        productName: it.productName,
        detalle: it.modifiers ?? [],
        notes: it.notes,
        cantidad: 0,
        total: 0,
        porRonda: [],
      };
      linea.cantidad += it.quantity;
      linea.total += it.totalPrice;
      const enRonda = linea.porRonda.find((r) => r.ronda === i + 1);
      if (enRonda) enRonda.cantidad += it.quantity;
      else linea.porRonda.push({ ronda: i + 1, hora: c.sentAt, cantidad: it.quantity });
      mapa.set(clave, linea);
    }
  });
  return [...mapa.values()];
}

function PedidoRondas({
  cuenta,
  rondas,
  piezasSinEnviar,
  onCerrar,
}: {
  cuenta: Account;
  rondas: Comanda[];
  piezasSinEnviar: number;
  onCerrar: () => void;
}) {
  const concentrado = concentrar(rondas);
  const totalEnviado = rondas.reduce((acc, c) => acc + c.items.reduce((a, it) => a + it.totalPrice, 0), 0);

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-black/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCerrar}
    >
      <motion.div
        role="dialog"
        aria-labelledby="pedido-titulo"
        className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-neutral-200">
          <div>
            <h2 id="pedido-titulo" className="text-xl font-bold">
              Pedido de {cuenta.identifier}
              {cuenta.paraLlevar && <MarcaParaLlevar />}
            </h2>
            <p className="text-sm text-neutral-500">
              {rondas.length} {rondas.length === 1 ? 'ronda' : 'rondas'} enviadas a cocina
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="w-12 h-12 rounded-xl border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {rondas.length === 0 ? (
            <p className="text-center text-neutral-500 py-8">Todavía no se ha enviado nada a cocina.</p>
          ) : (
            <>
              {/* Rondas en el orden en que se pidieron */}
              <section className="space-y-3">
                {rondas.map((c, i) => (
                  <div key={c.id} className="border border-neutral-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
                      <div className="font-semibold">
                        Ronda {i + 1} <span className="font-normal text-neutral-500">· {c.sentAt} · {c.orderNumber}</span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ESTADO_RONDA[c.status].clase}`}>
                        {ESTADO_RONDA[c.status].label}
                      </span>
                    </div>
                    <ul className="divide-y divide-neutral-100">
                      {c.items.map((it) => (
                        <li key={it.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">
                              {it.quantity} × {it.productName}
                            </div>
                            {!!it.modifiers?.length && (
                              <div className="text-xs text-emerald-700">{it.modifiers.join(' · ')}</div>
                            )}
                            {it.notes && <div className="text-xs text-amber-800">Nota: {it.notes}</div>}
                          </div>
                          <span className="font-mono text-sm shrink-0">${it.totalPrice.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>

              {/* Concentrado: piezas iguales juntas, indicando en qué ronda se pidieron */}
              <section className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Concentrado</h3>
                <ul className="border-2 border-sky-200 rounded-xl divide-y divide-sky-100">
                  {concentrado.map((l, i) => (
                    <li key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {l.cantidad} × {l.productName}
                        </div>
                        {l.detalle.length > 0 && <div className="text-xs text-emerald-700">{l.detalle.join(' · ')}</div>}
                        {l.notes && <div className="text-xs text-amber-800">Nota: {l.notes}</div>}
                        <div className="text-xs text-sky-800 mt-0.5">
                          {l.porRonda.map((r) => `Ronda ${r.ronda} (${r.hora}): ${r.cantidad}`).join(' · ')}
                        </div>
                      </div>
                      <span className="font-mono text-sm font-semibold shrink-0">${l.total.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between px-1 pt-1 font-bold">
                  <span>Total enviado</span>
                  <span className="font-mono">${totalEnviado.toFixed(2)}</span>
                </div>
              </section>
            </>
          )}

          {piezasSinEnviar > 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Hay {piezasSinEnviar} {piezasSinEnviar === 1 ? 'pieza' : 'piezas'} en el pedido nuevo sin enviar a cocina.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- Grupos de opciones de un producto ---------- */

/** Pasos de un producto: "elige una" (naranja) e ingredientes "todos marcados, quita los que no" (verde). */
function GruposEditor({
  producto,
  seleccion,
  onChange,
  contarEnPedido,
}: {
  producto: ProductCatalogItem;
  seleccion: SeleccionProducto;
  onChange: (sel: SeleccionProducto) => void;
  contarEnPedido?: (opcion: string) => number;
}) {
  const principal = grupoPrincipal(producto);
  const grupos = (producto.grupos ?? []).filter((g) => g.nombre !== producto.reparto);

  const tocar = (g: GrupoProducto, op: string) => {
    const actuales = seleccion[g.nombre] ?? [];
    if (g.tipo === 'una') {
      // En "elige una" opcional, tocar la marcada la quita.
      onChange({ ...seleccion, [g.nombre]: actuales[0] === op && g.opcional ? [] : [op] });
    } else {
      onChange({ ...seleccion, [g.nombre]: actuales.includes(op) ? actuales.filter((x) => x !== op) : [...actuales, op] });
    }
  };

  return (
    <div className="space-y-5">
      {grupos.map((g, gi) => {
        const elegidas = seleccion[g.nombre] ?? [];
        const todas = g.tipo === 'varias' && elegidas.length === g.opciones.length;
        const color =
          g.tipo === 'una' && !g.conSin
            ? { on: 'bg-orange-100 border-orange-500 text-orange-900 shadow-sm', off: 'bg-white border-orange-200 text-orange-800 hover:bg-orange-50' }
            : { on: 'bg-emerald-100 border-emerald-500 text-emerald-900', off: 'bg-white border-emerald-200 text-neutral-500 line-through decoration-2 hover:bg-emerald-50' };
        const ayuda =
          g.tipo === 'varias'
            ? g.todasPorDefecto
              ? ' · todos incluidos, quita los que no quieran'
              : ' · opcional, elige varias'
            : g.opcional
            ? ' · uno u otro (opcional)'
            : ' · elige una';
        return (
          <div key={g.nombre} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-neutral-700">
                {gi + 1}. {g.nombre}
                <span className="font-normal text-neutral-500">{ayuda}</span>
              </div>
              {g.tipo === 'varias' && (
                <button
                  onClick={() => onChange({ ...seleccion, [g.nombre]: todas ? [] : [...g.opciones] })}
                  className="h-10 px-4 rounded-full border-2 border-emerald-200 bg-white text-sm font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                >
                  {todas ? 'Quitar todo' : 'Con todo'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {opcionesOrdenadas(g).map((op) => {
                const marcada = elegidas.includes(op);
                const enPedidoOp = g === principal && contarEnPedido ? contarEnPedido(op) : 0;
                const precio = g.precios?.[op];
                return (
                  <button
                    key={op}
                    onClick={() => tocar(g, op)}
                    aria-pressed={marcada}
                    className={`relative min-h-20 px-2 rounded-2xl border-2 text-lg font-semibold flex flex-col items-center justify-center transition-colors cursor-pointer ${
                      marcada ? color.on : color.off
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {marcada && (g.tipo === 'varias' || g.conSin) && <Check className="w-4 h-4" />}
                      {op}
                    </span>
                    {precio !== undefined && <span className="text-sm font-mono font-normal">${precio}</span>}
                    {enPedidoOp > 0 && (
                      <span className="absolute bottom-1 inset-x-0 text-xs font-medium text-orange-700">{enPedidoOp} en el pedido</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Tipo de orden ---------- */

export function SelectorTipoOrden({
  paraLlevar,
  onChange,
  compacto = false,
}: {
  paraLlevar: boolean;
  onChange: (v: boolean) => void;
  compacto?: boolean;
}) {
  const opciones = [
    { valor: false, label: 'Comer aquí', icon: Home },
    { valor: true, label: 'Para llevar', icon: ShoppingBag },
  ];
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de orden">
      {opciones.map(({ valor, label, icon: Icon }) => {
        const activo = paraLlevar === valor;
        return (
          <button
            key={label}
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(valor)}
            className={`${compacto ? 'h-11 text-sm' : 'h-16 text-lg'} rounded-xl border-2 font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activo
                ? valor
                  ? 'bg-violet-100 border-violet-500 text-violet-900'
                  : 'bg-sky-100 border-sky-500 text-sky-900'
                : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <Icon className={compacto ? 'w-4 h-4' : 'w-5 h-5'} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

const MarcaParaLlevar = () => (
  <span className="ml-2 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
    PARA LLEVAR
  </span>
);

/** Ventana para elegir el tipo de orden al registrar (o corregir) una mesa/cuenta. */
export function DialogoTipoOrden({
  titulo,
  detalle,
  actual,
  onElegir,
  onCancelar,
}: {
  titulo: string;
  detalle?: string;
  actual?: boolean;
  onElegir: (paraLlevar: boolean) => void;
  onCancelar: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancelar}
    >
      <motion.div
        role="dialog"
        aria-labelledby="tipo-orden-titulo"
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2 id="tipo-orden-titulo" className="text-xl font-bold">
            {titulo}
          </h2>
          <p className="text-sm text-neutral-500 mt-1">{detalle ?? '¿La orden es para comer aquí o para llevar?'}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onElegir(false)}
            className={`h-28 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 text-lg font-bold cursor-pointer ${
              actual === false ? 'bg-sky-100 border-sky-500 text-sky-900' : 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
            }`}
          >
            <Home className="w-8 h-8" /> Comer aquí
          </button>
          <button
            onClick={() => onElegir(true)}
            className={`h-28 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 text-lg font-bold cursor-pointer ${
              actual === true
                ? 'bg-violet-100 border-violet-500 text-violet-900'
                : 'bg-violet-50 border-violet-200 text-violet-800 hover:bg-violet-100'
            }`}
          >
            <ShoppingBag className="w-8 h-8" /> Para llevar
          </button>
        </div>
        <button onClick={onCancelar} className="w-full h-12 rounded-xl text-neutral-600 hover:bg-neutral-100 font-medium cursor-pointer">
          Cancelar
        </button>
      </motion.div>
    </motion.div>
  );
}
