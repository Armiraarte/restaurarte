// Pantalla de opciones de una categoría (como la de antes), armada con los datos de la base:
//   1. Elige una  → los productos de la categoría (BD: producto.nombre): Frijol, Jamón, Papa…
//                   En categorías sin tamaños se pueden tocar varias para mezclarlas ("Papa con Frijol").
//   2. Tamaño     → solo si el producto tiene tamaños (BD: producto.tamano), con su precio
//   3. Complementos → todos incluidos; se tocan los que no quieren (BD: producto_has_complemento)
//   4. Queso      → CON QUESO opcional, desactivado por defecto.
//                   (BD: orden_has_detalle.sin_queso)
//   4. Carne      → solo Hamburguesas: DOBLE CARNE / TRIPLE CARNE, +$20 por carne extra
//                   (BD: orden_has_detalle.carne_extra)
//   Cantidad y "Agregar a la orden".
//   MIXTAS (botón junto a VOLVER, en toda categoría con más de un producto): piezas de cada uno ("4 BBQ + 6 Buffalo",
//                   "3 Papa + 2 Frijol") en un solo renglón; cada pieza a su precio. Tamaño, complementos y opciones
//                   valen para todas las piezas.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react';
import {
  CATEGORIA_CARNE_EXTRA,
  PRECIO_COMPLEMENTO_EXTRA,
  textoComplementosExtra,
  CATEGORIAS_CON_QUESO,
  CATEGORIAS_QUESO_OPCIONAL,
  CATEGORIAS_REPARTO,
  CategoriaMenu,
  ComplementoMenu,
  MAX_CARNE_EXTRA,
  PRECIO_CARNE_EXTRA,
  ProductoMenu,
  TerminoMenu,
  PapasMenu,
  RepartoPedido,
  textoCarneExtra,
  textoReparto,
} from '../services/pedidosService';
import { esQueso, ordenarComplementos } from '../services/complementos';

/** Cómo se llama la elección principal en cada categoría (igual que el menú anterior). */
const NOMBRE_ELECCION: Record<string, string> = {
  'Tacos Dorados': 'Relleno',
  Tacos: 'Carne',
  Quesadillas: 'Relleno',
  Sopes: 'Relleno',
  Enchiladas: 'Relleno',
  Tostadas: 'Tipo',
  Burritas: 'Relleno',
  Lonches: 'Tipo',
  Hamburguesas: 'Tipo',
  Ensaladas: 'Proteína',
  Alitas: 'Sabor',
  Salchichas: 'Presentación',
  Carnes: 'Carne',
};

const dinero = (n: number) => `$${n.toFixed(2)}`;

const BOTON_UNA = {
  on: 'bg-orange-100 border-orange-500 text-orange-900 shadow-sm',
  off: 'bg-white border-orange-200 text-orange-800 hover:bg-orange-50',
};
const BOTON_COMPLEMENTO = {
  on: 'bg-emerald-100 border-emerald-500 text-emerald-900',
  off: 'bg-white border-emerald-200 text-neutral-500 line-through decoration-2 hover:bg-emerald-50',
  extra: 'bg-amber-200 border-amber-600 text-amber-950 shadow-sm',
};
/** Dos toques al mismo complemento dentro de este tiempo = EXTRA. */
const DOBLE_TOQUE_MS = 350;

interface Props {
  categoria: CategoriaMenu;
  pantallaCompleta: boolean;
  /** Botón Volver propio; sin él, quien la muestra pone el suyo (el pedido: VOLVER verde junto a MIX). */
  onVolver?: () => void;
  /**
   * mezcla: los demás productos elegidos junto con `producto` ("Papa con Frijol"); vacío si es uno solo.
   * extras.sinQueso: Quesadillas. extras.conQueso: Tacos. extras.carneExtra: Hamburguesas, 1 doble y 2 triple.
   */
  onAgregar: (producto: ProductoMenu, cantidad: number, sin: ComplementoMenu[], mezcla: string[], extras: ExtrasLinea) => void;
  /** MIXTAS activo: cada producto de la categoría suma piezas y todo va en un renglón. */
  mezclar?: boolean;
  /** Se agregó la mezcla: quien muestra el botón MIXTAS lo apaga. */
  onMezclaAgregada?: () => void;
}

export interface ExtrasLinea {
  sinQueso: boolean;
  conQueso: boolean;
  carneExtra: number;
  termino?: TerminoMenu | null;
  papas?: PapasMenu | null;
  /** Complementos que tenía el platillo (de todos los de la mezcla), para resumirlos en el ticket de cocina. */
  ofrecidos?: ComplementoMenu[];
  /** MIXTAS: piezas de cada sabor; suman la cantidad del renglón. */
  reparto?: RepartoPedido[];
  /** Complementos EXTRA (doble toque), con costo por pieza. */
  complementosExtra?: ComplementoMenu[];
}

export const OpcionesCategoria: React.FC<Props> = ({ categoria, pantallaCompleta, onVolver, onAgregar, mezclar = false, onMezclaAgregada }) => {
  const esEnsalada = categoria.nombre === 'Ensaladas';
  const esHamburguesa = categoria.nombre === 'Hamburguesas';
  const nombresCatalogo = [...new Set(categoria.productos.map((p) => p.nombre))];
  const nombres = esEnsalada ? [...nombresCatalogo.filter((n) => n !== 'Sin carne'), ...nombresCatalogo.filter((n) => n === 'Sin carne')] : nombresCatalogo;
  // MIXTAS (botón junto a VOLVER, en toda categoría con más de un producto): las piezas de cada uno se cuentan ahí
  // y van en un solo renglón; fuera de MIXTAS se elige uno.
  const mezclando = mezclar && nombres.length > 1;
  // Tocar varios para juntarlos en una pieza ("Papa con Frijol"): solo sin tamaños, y ni en Alitas ni en Carnes.
  const permiteMezcla =
    !CATEGORIAS_REPARTO.includes(categoria.nombre) && categoria.nombre !== 'Carnes' && nombres.length > 1 && categoria.productos.every((p) => p.tamano === null);
  // Elegidos en orden de toque: el primero es el principal. Sin mezcla siempre hay a lo más uno.
  const [elegidos, setElegidos] = useState<string[]>(nombres.length === 1 ? [nombres[0]] : []);
  const [tamano, setTamano] = useState<string | null>(esEnsalada ? 'Chica' : null);
  // Todos los complementos empiezan marcados (en tacos, menos el queso); solo se desmarca lo que no quieren.
  const [quitados, setQuitados] = useState<number[]>([]);
  const [conPapas, setConPapas] = useState(false);
  const [termino, setTermino] = useState<TerminoMenu | null>(null);
  // Hamburguesas: cada toque suma una carne (DOBLE, luego TRIPLE) y el siguiente la quita.
  const [carneExtra, setCarneExtra] = useState(0);
  // Complementos marcados EXTRA con doble toque (cuestan PRECIO_COMPLEMENTO_EXTRA por pieza).
  const [extras, setExtras] = useState<number[]>([]);
  const ultimoToque = useRef<{ id: number; hora: number; eraExtra: boolean } | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState<string | null>(null);
  // MIXTAS: piezas por sabor. El tamaño es uno para todas (solo si todo se vende por tamaño, como Ensaladas).
  const [piezas, setPiezas] = useState<Record<string, number>>({});
  const tamanosMezcla = categoria.productos.every((p) => p.tamano !== null) ? [...new Set(categoria.productos.map((p) => p.tamano!))] : [];
  const productoDe = (n: string) => categoria.productos.find((p) => p.nombre === n && p.tamano === (tamanosMezcla.length ? tamano : null));
  // Cada sabor con su precio: en MIXTAS cada pieza se cobra a lo que cuesta (el servidor lo calcula igual).
  const reparto: RepartoPedido[] = nombres
    .filter((n) => (piezas[n] ?? 0) > 0)
    .map((n) => ({ nombre: n, cantidad: piezas[n], precio: productoDe(n)?.precio }));
  const totalPiezas = reparto.reduce((acc, r) => acc + r.cantidad, 0);
  const productosReparto = reparto.map((r) => productoDe(r.nombre)).filter((p): p is ProductoMenu => !!p);
  const repartoCompleto = productosReparto.length === reparto.length;
  const sumarPieza = (n: string, delta: number) =>
    setPiezas((actual) => ({ ...actual, [n]: Math.max(0, (actual[n] ?? 0) + delta) }));

  // Lo elegido: en MIXTAS, los que ya tienen piezas; si no, los tocados.
  const seleccion = mezclando ? reparto.map((r) => r.nombre) : elegidos;
  const nombre = seleccion[0] ?? null;
  const delNombre = categoria.productos.filter((p) => p.nombre === nombre);
  const tamanos = delNombre.filter((p) => p.tamano !== null);
  // Con varios se guarda el más caro de los elegidos (en una mezcla es lo que se cobra; en MIXTAS cada pieza va a su precio).
  const masCaro = (lista: ProductoMenu[]) => (lista.length ? lista.reduce((a, b) => (b.precio > a.precio ? b : a)) : undefined);
  const producto = mezclando
    ? repartoCompleto ? masCaro(productosReparto) : undefined
    : elegidos.length > 1
      ? masCaro(categoria.productos.filter((p) => elegidos.includes(p.nombre)))
      : tamanos.length > 0
        ? tamanos.find((p) => p.tamano === tamano)
        : delNombre[0];
  // Complementos: los de todos los elegidos, sin repetir (o del primero con ese nombre mientras se elige tamaño).
  const complementos = ordenarComplementos([
    ...new Map(
      (mezclando ? productosReparto : categoria.productos.filter((p) => elegidos.includes(p.nombre)))
        .flatMap((p) => p.complementos)
        .map((c) => [c.id, c])
    ).values(),
  ].filter((c) => !seleccion.includes('Queso') || !esQueso(c)));
  const textoElegidos = elegidos.join(' con ');
  // Tacos: el queso no va de base; inicia apagado y se agrega al tocarlo (en cocina sale CON QUESO).
  const quesoOpcional = CATEGORIAS_QUESO_OPCIONAL.includes(categoria.nombre);
  const quitadosBase = (lista: ComplementoMenu[]) => (quesoOpcional ? lista.filter(esQueso).map((c) => c.id) : []);
  // La de queso ya es queso: ahí no aplica.
  const puedeConQueso = CATEGORIAS_CON_QUESO.includes(categoria.nombre) && !!nombre && !seleccion.includes('Queso');
  const puedeCarneExtra = categoria.nombre === CATEGORIA_CARNE_EXTRA && !!nombre;
  const carnesExtra = puedeCarneExtra ? carneExtra : 0;
  const puedePapas = ['Hamburguesas', 'Lonches'].includes(categoria.nombre) && !!nombre;
  const papas = puedePapas && conPapas ? categoria.papas ?? null : null;
  // EXTRA solo cuenta si el complemento sigue en la lista y está incluido.
  const extrasElegidos = complementos.filter((c) => extras.includes(c.id) && !quitados.includes(c.id));
  // Lo que se suma a cada pieza (en MIXTAS, a todas): carnes extra, papas y complementos EXTRA.
  const extraPorPieza = carnesExtra * PRECIO_CARNE_EXTRA + (papas?.precio ?? 0) + extrasElegidos.length * PRECIO_COMPLEMENTO_EXTRA;
  const cantidadLinea = mezclando ? totalPiezas : cantidad;
  const importe =
    (mezclando ? reparto.reduce((acc, r) => acc + (r.precio ?? 0) * r.cantidad, 0) : (producto?.precio ?? 0) * cantidad) +
    extraPorPieza * cantidadLinea;

  const tocarNombre = (n: string) => {
    if (!permiteMezcla) return setElegidos([n]);
    setElegidos((lista) => (lista.includes(n) ? lista.filter((x) => x !== n) : [...lista, n]));
  };

  // Tamaño y complementos de nuevo (todos incluidos; en tacos, sin queso).
  const reiniciarOpciones = (lista: ComplementoMenu[]) => {
    setTamano(esEnsalada ? 'Chica' : null);
    setQuitados(quitadosBase(lista));
    setConPapas(false);
    setTermino(null);
    setCarneExtra(0);
    setExtras([]);
  };

  // Al entrar o salir de MIXTAS se empieza de cero.
  useEffect(() => {
    setPiezas({});
    setElegidos(nombres.length === 1 ? [nombres[0]] : []);
    setCantidad(1);
    reiniciarOpciones([]);
  }, [mezclando]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar de producto se reinicia todo.
  useEffect(() => {
    if (!mezclando) reiniciarOpciones(complementos);
  }, [elegidos.join('|'), mezclando]); // eslint-disable-line react-hooks/exhaustive-deps

  // En MIXTAS sumar piezas no borra lo elegido: los complementos se reinician solo si cambian los que se ofrecen.
  const claveComplementos = complementos.map((c) => c.id).join(',');
  useEffect(() => {
    if (!mezclando) return;
    setQuitados(quitadosBase(complementos));
    setExtras([]);
  }, [claveComplementos, mezclando]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!agregado) return;
    const t = setTimeout(() => setAgregado(null), 1800);
    return () => clearTimeout(t);
  }, [agregado]);

  const etiquetaEleccion = NOMBRE_ELECCION[categoria.nombre] ?? 'Producto';
  const sinTamano = reparto.find((r) => !productoDe(r.nombre));
  const faltante = mezclando
    ? totalPiezas === 0
      ? `Toca cada ${etiquetaEleccion.toLowerCase()} para sumar piezas`
      : tamanosMezcla.length && !tamano
        ? 'Elige tamaño'
        : sinTamano
          ? tamano ? `${sinTamano.nombre} no viene ${tamano.toLowerCase()}` : `${sinTamano.nombre} no se puede en MIXTAS`
          : null
    : !nombre ? `Elige ${etiquetaEleccion.toLowerCase()}` : !producto ? 'Elige tamaño' : null;
  const precioDesde = Math.min(...categoria.productos.map((p) => p.precio));
  const precioHasta = Math.max(...categoria.productos.map((p) => p.precio));
  // Botones de tamaño: los del producto elegido; en MIXTAS, los de la categoría (uno para todas las piezas).
  const opcionesTamano = mezclando
    ? tamanosMezcla.map((t) => ({ clave: t, tamano: t, precio: Math.min(...categoria.productos.filter((p) => p.tamano === t).map((p) => p.precio)) }))
    : tamanos.map((p) => ({ clave: String(p.id), tamano: p.tamano!, precio: p.precio }));

  const alternarComplemento = (id: number) =>
    setQuitados((q) => (q.includes(id) ? q.filter((x) => x !== id) : [...q, id]));
  // Un toque: incluir o quitar (si estaba EXTRA, vuelve a normal). Doble toque: EXTRA (otro doble toque lo quita).
  const tocarComplemento = (id: number) => {
    const ahora = Date.now();
    const previo = ultimoToque.current;
    if (previo && previo.id === id && ahora - previo.hora < DOBLE_TOQUE_MS) {
      ultimoToque.current = null;
      setQuitados((q) => q.filter((x) => x !== id));
      setExtras((lista) => (previo.eraExtra ? lista.filter((x) => x !== id) : lista.includes(id) ? lista : [...lista, id]));
      return;
    }
    const eraExtra = extras.includes(id) && !quitados.includes(id);
    ultimoToque.current = { id, hora: ahora, eraExtra };
    if (eraExtra) setExtras((lista) => lista.filter((x) => x !== id));
    else alternarComplemento(id);
  };
  // «Con todo» es lo de la casa: en tacos, todo menos el queso.
  const todosIncluidos = complementos.every((c) => !quitados.includes(c.id) || (quesoOpcional && esQueso(c)));

  const agregar = () => {
    if (!producto || faltante) return;
    const sin = complementos.filter((c) => quitados.includes(c.id));
    const quesoIncluido = complementos.some((c) => esQueso(c) && !quitados.includes(c.id));
    // En tacos no se dice SIN QUESO: no lleva de base.
    const quesoFuera = puedeConQueso && !quesoIncluido && !quesoOpcional;
    // En MIXTAS un solo sabor es un renglón normal; con varios, un renglón con las piezas de cada uno.
    const varios = seleccion.length > 1;
    onAgregar(producto, cantidadLinea, sin, varios ? seleccion : [], {
      sinQueso: quesoFuera,
      conQueso: puedeConQueso && quesoIncluido,
      carneExtra: carnesExtra,
      termino,
      papas,
      ofrecidos: complementos,
      ...(extrasElegidos.length && { complementosExtra: extrasElegidos }),
      ...(mezclando && varios && { reparto }),
    });
    setAgregado(
      `${cantidadLinea} ${mezclando && varios ? textoReparto(reparto) : varios ? textoElegidos : producto.nombre}${producto.tamano ? ` (${producto.tamano})` : ''}${
        quesoFuera ? ' · SIN QUESO' : quesoOpcional && quesoIncluido ? ' · CON QUESO' : ''
      }${carnesExtra ? ` · ${textoCarneExtra(carnesExtra)}` : ''}${papas ? ' · CON PAPAS' : ''}${termino ? ` · ${termino.nombre}` : ''}${
        extrasElegidos.length ? ` · ${textoComplementosExtra(extrasElegidos.map((c) => c.nombre))}` : ''
      }`
    );
    reiniciarOpciones(complementos);
    if (mezclando) {
      // Quien muestra el botón MIXTAS lo apaga.
      setPiezas({});
      onMezclaAgregada?.();
      return;
    }
    setElegidos(nombres.length === 1 ? [nombres[0]] : []);
    setCantidad(1);
  };

  // En la tablet los grupos se reparten el alto disponible y los botones crecen para llenarlo.
  const grupo = (peso: number) =>
    pantallaCompleta ? { className: 'min-h-0 flex flex-col gap-1.5', style: { flex: `${Math.max(peso, 2)} 1 0` } } : { className: 'space-y-2' };
  const rejilla = pantallaCompleta
    ? 'flex-1 min-h-0 grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2'
    : 'grid grid-cols-2 sm:grid-cols-3 gap-2';
  const boton = pantallaCompleta ? 'h-full min-h-11 py-1.5 text-lg rounded-xl' : 'min-h-16 text-lg rounded-2xl';
  const rejillaEleccion = esEnsalada
    ? (pantallaCompleta ? 'flex-1 min-h-0 grid auto-rows-fr grid-cols-4 gap-2' : 'grid grid-cols-2 sm:grid-cols-4 gap-2') : rejilla;
  const rejillaComplementos = esHamburguesa && pantallaCompleta
    ? 'flex-1 min-h-0 grid auto-rows-fr grid-cols-3 gap-2' : rejilla;

  let paso = 0;
  return (
    <div className={pantallaCompleta ? 'flex-1 min-h-0 flex flex-col gap-2' : 'space-y-5'}>
      <div className="flex items-center justify-between gap-3 shrink-0">
        {onVolver ? (
          <button
            onClick={onVolver}
            className="h-10 px-3 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 flex items-center gap-2 text-sm font-medium cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" /> Volver
          </button>
        ) : (
          <span />
        )}
        <div className="text-right">
          <div className="text-lg font-bold leading-tight">{categoria.nombre}</div>
          <div className="text-sm text-neutral-500 font-mono">
            {precioDesde === precioHasta ? dinero(precioDesde) : `${dinero(precioDesde)} – ${dinero(precioHasta)}`}
          </div>
        </div>
      </div>

      <div data-opciones-scroll={categoria.nombre} className={pantallaCompleta ? `flex-1 min-h-0 flex flex-col ${esHamburguesa ? 'gap-1' : 'gap-2'} overflow-y-auto overscroll-contain` : 'space-y-5'}>
        {/* MIXTAS: cada toque suma una pieza de ese sabor; «−» quita una */}
        {mezclando && (
          <div {...grupo(nombres.length)}>
            <div className="shrink-0 text-sm font-semibold text-neutral-700">
              {++paso}. {etiquetaEleccion}{' '}
              <span className="font-normal text-neutral-500">· toca para sumar piezas; lo demás va en todas</span>
              {reparto.length > 0 && <span className="ml-2 font-semibold text-orange-800">→ {textoReparto(reparto)}</span>}
            </div>
            <div className={rejillaEleccion}>
              {nombres.map((n) => {
                const cuantas = piezas[n] ?? 0;
                const precio = productoDe(n)?.precio ?? Math.min(...categoria.productos.filter((p) => p.nombre === n).map((p) => p.precio));
                return (
                  <div key={n} className="relative min-h-0">
                    <button
                      onClick={() => sumarPieza(n, 1)}
                      aria-label={`Sumar una pieza de ${n} (van ${cuantas})`}
                      className={`w-full ${boton} px-2 border-2 font-semibold flex flex-col items-center justify-center transition-colors cursor-pointer ${
                        cuantas > 0 ? BOTON_UNA.on : BOTON_UNA.off
                      }`}
                    >
                      {n}
                      <span className={`font-mono text-2xl font-black leading-none ${cuantas > 0 ? '' : 'text-neutral-300'}`}>{cuantas}</span>
                      {precioDesde !== precioHasta && <span className="text-xs font-mono font-normal">{dinero(precio)} c/u</span>}
                    </button>
                    {cuantas > 0 && (
                      <button
                        onClick={() => sumarPieza(n, -1)}
                        aria-label={`Quitar una pieza de ${n}`}
                        className="absolute top-1.5 left-1.5 w-9 h-9 rounded-lg border-2 border-orange-300 bg-white text-orange-800 flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 1. Elige una: productos de la categoría */}
        {nombres.length > 1 && !mezclando && (
          <div {...grupo(nombres.length)}>
            <div className="shrink-0 text-sm font-semibold text-neutral-700">
              {++paso}. {etiquetaEleccion}{' '}
              <span className="font-normal text-neutral-500">
                {permiteMezcla ? '· elige una, toca varias para mezclar o usa MIXTAS' : '· elige una o toca MIXTAS para varios'}
              </span>
              {elegidos.length > 1 && <span className="ml-2 font-semibold text-orange-800">→ {textoElegidos}</span>}
            </div>
            <div className={rejillaEleccion}>
              {nombres.map((n) => {
                const precios = categoria.productos.filter((p) => p.nombre === n).map((p) => p.precio);
                const activo = elegidos.includes(n);
                return (
                  <button
                    key={n}
                    onClick={() => tocarNombre(n)}
                    aria-pressed={activo}
                    className={`relative ${boton} px-2 border-2 font-semibold flex flex-col items-center justify-center transition-colors cursor-pointer ${
                      activo ? BOTON_UNA.on : BOTON_UNA.off
                    }`}
                  >
                    {activo && elegidos.length > 1 && (
                      <span className="absolute top-1 left-1.5 text-xs font-mono font-bold text-orange-700">{elegidos.indexOf(n) + 1}</span>
                    )}
                    {n}
                    {precioDesde !== precioHasta && <span className="text-sm font-mono font-normal">{dinero(Math.min(...precios))}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Tamaño (solo si el producto tiene tamaños; en MIXTAS, uno para todas las piezas) */}
        {opcionesTamano.length > 0 && (
          <div {...grupo(opcionesTamano.length)}>
            <div className="shrink-0 text-sm font-semibold text-neutral-700">
              {++paso}. Tamaño <span className="font-normal text-neutral-500">· elige uno</span>
            </div>
            <div className={rejilla}>
              {opcionesTamano.map((p) => (
                <button
                  key={p.clave}
                  onClick={() => setTamano(p.tamano)}
                  aria-pressed={tamano === p.tamano}
                  className={`${boton} px-2 border-2 font-semibold flex flex-col items-center justify-center transition-colors cursor-pointer ${
                    tamano === p.tamano ? BOTON_UNA.on : BOTON_UNA.off
                  }`}
                >
                  {p.tamano}
                  <span className="text-sm font-mono font-normal">{dinero(p.precio)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {nombre && (categoria.terminos?.length ?? 0) > 0 && (
          <div {...grupo(categoria.terminos!.length)}>
            <div className="shrink-0 text-sm font-semibold text-neutral-700">
              {++paso}. Término <span className="font-normal text-neutral-500">· opcional, elige uno</span>
            </div>
            <div className={rejilla}>
              {categoria.terminos!.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTermino((actual) => actual?.id === t.id ? null : t)}
                  aria-pressed={termino?.id === t.id}
                  className={`${boton} px-2 border-2 font-semibold flex items-center justify-center gap-2 cursor-pointer ${termino?.id === t.id ? BOTON_UNA.on : BOTON_UNA.off}`}
                >
                  {termino?.id === t.id && <Check className="w-5 h-5" />}{t.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Complementos: todos incluidos, se quitan los que no quieren */}
        {nombre && complementos.length > 0 && (
          <div {...grupo(complementos.length)}>
            <div className="shrink-0 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-neutral-700">
                {++paso}. Complementos{' '}
                <span className="font-normal text-neutral-500">
                  · toca para incluir o quitar · <b className="font-semibold text-amber-700">doble toque: EXTRA +{dinero(PRECIO_COMPLEMENTO_EXTRA)}</b>
                </span>
              </div>
              <button
                onClick={() => {
                  setQuitados(todosIncluidos ? complementos.map((c) => c.id) : quitadosBase(complementos));
                  setExtras([]);
                }}
                className="h-8 px-3 text-xs shrink-0 whitespace-nowrap rounded-full border-2 border-emerald-200 bg-white font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
              >
                {todosIncluidos ? 'Quitar todo' : 'Con todo'}
              </button>
            </div>
            <div data-complementos className={rejillaComplementos}>
              {complementos.map((c) => {
                const incluido = !quitados.includes(c.id);
                const extra = incluido && extras.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => tocarComplemento(c.id)}
                    aria-pressed={incluido}
                    aria-label={`${c.nombre}: ${extra ? 'extra' : incluido ? 'incluido' : 'sin'}`}
                    className={`${boton} px-2 border-2 font-semibold flex flex-col items-center justify-center transition-colors cursor-pointer touch-manipulation select-none ${
                      extra ? BOTON_COMPLEMENTO.extra : incluido ? BOTON_COMPLEMENTO.on : BOTON_COMPLEMENTO.off
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {incluido && <Check className="w-4 h-4" />}
                      {c.nombre}
                    </span>
                    {extra && <span className="text-[11px] font-black tracking-wide leading-none">EXTRA +{dinero(PRECIO_COMPLEMENTO_EXTRA)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(puedeCarneExtra || puedePapas) && (
          <div {...grupo(esHamburguesa ? 3 : 1)}>
            <div className="shrink-0 text-sm font-semibold text-neutral-700">
              {++paso}. Opciones
            </div>
            <div data-fila-opciones className="flex-1 min-h-0 grid auto-rows-fr gap-2" style={{ gridTemplateColumns: `repeat(${Number(puedeCarneExtra) + Number(puedePapas)}, minmax(0, 1fr))` }}>
              {puedeCarneExtra && <button
                onClick={() => setCarneExtra((n) => (n + 1) % (MAX_CARNE_EXTRA + 1))}
                aria-pressed={carneExtra > 0}
                className={`${boton} px-2 border-2 font-black tracking-wide flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  carneExtra > 0 ? 'bg-red-700 border-red-800 text-white shadow-sm' : 'bg-white border-red-200 text-red-800 hover:bg-red-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  {carneExtra > 0 && <Check className="w-5 h-5" />}
                  {carneExtra === 2 ? 'TRIPLE CARNE' : 'DOBLE CARNE'}
                </span>
                <span className="text-sm font-mono font-semibold">
                  {carneExtra === 0
                    ? `+${dinero(PRECIO_CARNE_EXTRA)}`
                    : `${carneExtra + 1} carnes · +${dinero(carneExtra * PRECIO_CARNE_EXTRA)}`}
                </span>
              </button>}
              {puedePapas && <button
                onClick={() => setConPapas((v) => !v)}
                disabled={!categoria.papas}
                aria-pressed={conPapas}
                className={`${boton} px-2 border-2 font-black flex flex-col items-center justify-center cursor-pointer disabled:opacity-40 ${
                  conPapas ? 'bg-amber-500 border-amber-600 text-neutral-950' : 'bg-white border-amber-300 text-amber-800 hover:bg-amber-50'
                }`}
              >
                <span className="flex items-center gap-1">{conPapas && <Check className="w-4 h-4" />} CON PAPAS</span>
                <span className="text-sm font-semibold">{categoria.papas ? `+${dinero(categoria.papas.precio)}` : 'No disponibles'}</span>
              </button>}
            </div>
          </div>
        )}

      </div>

      {/* Cantidad (en MIXTAS, el total de piezas de todos los sabores) */}
      {mezclando ? (
        <div className="shrink-0 flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 px-3 py-2 min-h-[4.5rem]">
          <div className="text-base font-semibold text-neutral-700">Total de piezas</div>
          <span className="font-mono text-3xl font-bold">{totalPiezas}</span>
        </div>
      ) : (
      <div className="shrink-0 flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 px-3 py-2">
        <div className="text-base font-semibold text-neutral-700">Cantidad</div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCantidad((n) => Math.max(1, n - 1))}
            aria-label="Menos"
            className="w-14 h-14 rounded-xl border-2 border-neutral-200 bg-white flex items-center justify-center cursor-pointer"
          >
            <Minus className="w-5 h-5" />
          </button>
          <span className="w-12 text-center font-mono text-3xl font-bold">{cantidad}</span>
          <button
            onClick={() => setCantidad((n) => n + 1)}
            aria-label="Más"
            className="w-14 h-14 rounded-xl border-2 border-neutral-200 bg-white flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      )}

      <button
        onClick={agregar}
        disabled={!!faltante}
        className="w-full h-14 shrink-0 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed text-neutral-950 text-lg font-bold flex items-center justify-center gap-2 cursor-pointer"
      >
        <Plus className="w-5 h-5" />
        {faltante ??
          (mezclando
            ? `Agregar mixtas · ${totalPiezas} pzas · ${dinero(importe)}`
            : `Agregar a la orden · ${dinero(importe)}`)}
      </button>

      {agregado && (
        <div className="shrink-0 text-center text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl py-2">
          ✓ Agregado: {agregado}
        </div>
      )}
    </div>
  );
};
