// Pantalla de opciones de una categoría (como la de antes), armada con los datos de la base:
//   1. Elige una  → los productos de la categoría (BD: producto.nombre): Frijol, Jamón, Papa…
//                   En categorías sin tamaños se pueden tocar varias para mezclarlas ("Papa con Frijol").
//   2. Tamaño     → solo si el producto tiene tamaños (BD: producto.tamano), con su precio
//   3. Complementos → todos incluidos; se tocan los que no quieren (BD: producto_has_complemento)
//   Cantidad y "Agregar a la orden".
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react';
import { CategoriaMenu, ComplementoMenu, ProductoMenu } from '../services/pedidosService';

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
};

const dinero = (n: number) => `$${n.toFixed(2)}`;

const BOTON_UNA = {
  on: 'bg-orange-100 border-orange-500 text-orange-900 shadow-sm',
  off: 'bg-white border-orange-200 text-orange-800 hover:bg-orange-50',
};
const BOTON_COMPLEMENTO = {
  on: 'bg-emerald-100 border-emerald-500 text-emerald-900',
  off: 'bg-white border-emerald-200 text-neutral-500 line-through decoration-2 hover:bg-emerald-50',
};

interface Props {
  categoria: CategoriaMenu;
  pantallaCompleta: boolean;
  onVolver: () => void;
  /** mezcla: los demás productos elegidos junto con `producto` ("Papa con Frijol"); vacío si es uno solo. */
  onAgregar: (producto: ProductoMenu, cantidad: number, sin: ComplementoMenu[], mezcla: string[]) => void;
}

export const OpcionesCategoria: React.FC<Props> = ({ categoria, pantallaCompleta, onVolver, onAgregar }) => {
  const nombres = [...new Set(categoria.productos.map((p) => p.nombre))];
  // Mezclar solo tiene sentido si ningún producto se vende por tamaño (Ensaladas, Papas…).
  const permiteMezcla = nombres.length > 1 && categoria.productos.every((p) => p.tamano === null);
  // Elegidos en orden de toque: el primero es el principal. Sin mezcla siempre hay a lo más uno.
  const [elegidos, setElegidos] = useState<string[]>(nombres.length === 1 ? [nombres[0]] : []);
  const nombre = elegidos[0] ?? null;
  const [tamano, setTamano] = useState<string | null>(null);
  const [quitados, setQuitados] = useState<number[]>([]);
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState<string | null>(null);

  const delNombre = categoria.productos.filter((p) => p.nombre === nombre);
  const tamanos = delNombre.filter((p) => p.tamano !== null);
  // En una mezcla se cobra el más caro de los elegidos (y es el que se guarda en la orden).
  const producto =
    elegidos.length > 1
      ? categoria.productos.filter((p) => elegidos.includes(p.nombre)).reduce((a, b) => (b.precio > a.precio ? b : a))
      : tamanos.length > 0
        ? tamanos.find((p) => p.tamano === tamano)
        : delNombre[0];
  // Complementos: los de todos los elegidos, sin repetir (o del primero con ese nombre mientras se elige tamaño).
  const complementos = [
    ...new Map(
      categoria.productos.filter((p) => elegidos.includes(p.nombre)).flatMap((p) => p.complementos).map((c) => [c.id, c])
    ).values(),
  ];
  const textoElegidos = elegidos.join(' con ');

  const tocarNombre = (n: string) => {
    if (!permiteMezcla) return setElegidos([n]);
    setElegidos((lista) => (lista.includes(n) ? lista.filter((x) => x !== n) : [...lista, n]));
  };

  // Al cambiar de producto se reinician tamaño y complementos (todos incluidos).
  useEffect(() => {
    setTamano(null);
    setQuitados([]);
  }, [elegidos.join('|')]);

  useEffect(() => {
    if (!agregado) return;
    const t = setTimeout(() => setAgregado(null), 1800);
    return () => clearTimeout(t);
  }, [agregado]);

  const etiquetaEleccion = NOMBRE_ELECCION[categoria.nombre] ?? 'Producto';
  const faltante = !nombre ? `Elige ${etiquetaEleccion.toLowerCase()}` : !producto ? 'Elige tamaño' : null;
  const precioDesde = Math.min(...categoria.productos.map((p) => p.precio));
  const precioHasta = Math.max(...categoria.productos.map((p) => p.precio));

  const alternarComplemento = (id: number) =>
    setQuitados((q) => (q.includes(id) ? q.filter((x) => x !== id) : [...q, id]));
  const todosIncluidos = quitados.length === 0;

  const agregar = () => {
    if (!producto) return;
    const sin = complementos.filter((c) => quitados.includes(c.id));
    onAgregar(producto, cantidad, sin, elegidos.length > 1 ? elegidos : []);
    setAgregado(`${cantidad} × ${elegidos.length > 1 ? textoElegidos : producto.nombre}${producto.tamano ? ` (${producto.tamano})` : ''}`);
    setElegidos(nombres.length === 1 ? [nombres[0]] : []);
    setTamano(null);
    setQuitados([]);
    setCantidad(1);
  };

  // En la tablet los grupos se reparten el alto disponible y los botones crecen para llenarlo.
  const grupo = (peso: number) =>
    pantallaCompleta ? { className: 'min-h-0 flex flex-col gap-1.5', style: { flex: `${Math.max(peso, 2)} 1 0` } } : { className: 'space-y-2' };
  const rejilla = pantallaCompleta
    ? 'flex-1 min-h-0 grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2'
    : 'grid grid-cols-2 sm:grid-cols-3 gap-2';
  const boton = pantallaCompleta ? 'h-full min-h-11 py-1.5 text-lg rounded-xl' : 'min-h-16 text-lg rounded-2xl';

  let paso = 0;
  return (
    <div className={pantallaCompleta ? 'flex-1 min-h-0 flex flex-col gap-2' : 'space-y-5'}>
      <div className="flex items-center justify-between gap-3 shrink-0">
        <button
          onClick={onVolver}
          className="h-10 px-3 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 flex items-center gap-2 text-sm font-medium cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" /> Volver
        </button>
        <div className="text-right">
          <div className="text-lg font-bold leading-tight">{categoria.nombre}</div>
          <div className="text-sm text-neutral-500 font-mono">
            {precioDesde === precioHasta ? dinero(precioDesde) : `${dinero(precioDesde)} – ${dinero(precioHasta)}`}
          </div>
        </div>
      </div>

      <div className={pantallaCompleta ? 'flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto overscroll-contain' : 'space-y-5'}>
        {/* 1. Elige una: productos de la categoría */}
        {nombres.length > 1 && (
          <div {...grupo(nombres.length)}>
            <div className="shrink-0 text-sm font-semibold text-neutral-700">
              {++paso}. {etiquetaEleccion}{' '}
              <span className="font-normal text-neutral-500">
                {permiteMezcla ? '· elige una o toca varias para mezclar' : '· elige una'}
              </span>
              {elegidos.length > 1 && <span className="ml-2 font-semibold text-orange-800">→ {textoElegidos}</span>}
            </div>
            <div className={rejilla}>
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

        {/* 2. Tamaño (solo si el producto tiene tamaños) */}
        {tamanos.length > 0 && (
          <div {...grupo(tamanos.length)}>
            <div className="shrink-0 text-sm font-semibold text-neutral-700">
              {++paso}. Tamaño <span className="font-normal text-neutral-500">· elige uno</span>
            </div>
            <div className={rejilla}>
              {tamanos.map((p) => (
                <button
                  key={p.id}
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

        {/* 3. Complementos: todos incluidos, se quitan los que no quieren */}
        {nombre && complementos.length > 0 && (
          <div {...grupo(complementos.length)}>
            <div className="shrink-0 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-neutral-700">
                {++paso}. Complementos <span className="font-normal text-neutral-500">· todos incluidos, quita los que no quieran</span>
              </div>
              <button
                onClick={() => setQuitados(todosIncluidos ? complementos.map((c) => c.id) : [])}
                className="h-8 px-3 text-xs shrink-0 whitespace-nowrap rounded-full border-2 border-emerald-200 bg-white font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
              >
                {todosIncluidos ? 'Quitar todo' : 'Con todo'}
              </button>
            </div>
            <div className={rejilla}>
              {complementos.map((c) => {
                const incluido = !quitados.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => alternarComplemento(c.id)}
                    aria-pressed={incluido}
                    className={`${boton} px-2 border-2 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      incluido ? BOTON_COMPLEMENTO.on : BOTON_COMPLEMENTO.off
                    }`}
                  >
                    {incluido && <Check className="w-4 h-4" />}
                    {c.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cantidad */}
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

      <button
        onClick={agregar}
        disabled={!!faltante}
        className="w-full h-14 shrink-0 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed text-neutral-950 text-lg font-bold flex items-center justify-center gap-2 cursor-pointer"
      >
        <Plus className="w-5 h-5" />
        {faltante ?? `Agregar a la orden · ${dinero((producto?.precio ?? 0) * cantidad)}`}
      </button>

      {agregado && (
        <div className="shrink-0 text-center text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl py-2">
          ✓ Agregado: {agregado}
        </div>
      )}
    </div>
  );
};
