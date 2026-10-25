// Agotados (sección de la caja): se toca un producto cuando se termina y en las tablets sale en rojo,
// sin poder comandarse; se toca otra vez cuando vuelve a haber. Los cambios llegan en vivo a todas las pantallas.
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, PackageX, RotateCcw, Search } from 'lucide-react';
import { CategoriaMenu, nombreProducto, obtenerMenu } from '../services/pedidosService';
import { marcarAgotado, todoDisponible, useAgotados } from '../services/agotadosService';

/** Para buscar sin importar acentos ni mayúsculas. */
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const AgotadosView: React.FC = () => {
  const [menu, setMenu] = useState<CategoriaMenu[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState<Set<number>>(new Set());
  const [confirmandoTodo, setConfirmandoTodo] = useState(false);
  const { setLista, ids } = useAgotados();

  useEffect(() => {
    obtenerMenu()
      .then(setMenu)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el menú.'));
  }, []);

  // «Todo disponible» pide un segundo toque; si no llega en 4 s, se cancela.
  useEffect(() => {
    if (!confirmandoTodo) return;
    const t = setTimeout(() => setConfirmandoTodo(false), 4000);
    return () => clearTimeout(t);
  }, [confirmandoTodo]);

  const filtro = normal(busqueda.trim());
  const categorias = (menu ?? [])
    .map((c) => ({
      ...c,
      productos: c.productos.filter((p) => !filtro || normal(`${c.nombre} ${p.nombre} ${p.tamano ?? ''}`).includes(filtro))
        .sort((a, b) => nombreProducto(a).localeCompare(nombreProducto(b), 'es', { sensitivity: 'base', numeric: true })),
    }))
    .filter((c) => c.productos.length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

  const alternar = async (idProducto: number) => {
    if (guardando.has(idProducto)) return;
    const agotar = !ids.has(idProducto);
    setError(null);
    setGuardando((s) => new Set(s).add(idProducto));
    try {
      setLista(await marcarAgotado(idProducto, agotar));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando((s) => {
        const otro = new Set(s);
        otro.delete(idProducto);
        return otro;
      });
    }
  };

  const reactivarTodo = async () => {
    if (!confirmandoTodo) return setConfirmandoTodo(true);
    setConfirmandoTodo(false);
    setError(null);
    try {
      setLista(await todoDisponible());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      <div className="shrink-0 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <PackageX className="w-5 h-5 text-rose-600" />
            <span>Agotados</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Toca un producto para marcarlo en rojo. Tócalo otra vez cuando vuelva a haber.
          </p>
        </div>
        {ids.size > 0 && (
          <button
            type="button"
            onClick={reactivarTodo}
            className={`h-10 px-4 rounded-xl border-2 text-sm font-bold flex items-center gap-2 cursor-pointer ${
              confirmandoTodo ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            {confirmandoTodo ? 'Toca otra vez para confirmar' : 'Todo disponible'}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="shrink-0 flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <label className="shrink-0 relative block">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto o categoría"
          className="w-full h-11 pl-9 pr-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
        />
      </label>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pr-1">
        {menu === null ? (
          !error && (
            <div className="py-12 flex justify-center text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )
        ) : categorias.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center">No hay productos con «{busqueda}».</p>
        ) : (
          categorias.map((c) => {
            return (
              <section key={c.id} className="bg-white border border-neutral-200 rounded-2xl p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-bold">{c.nombre}</h3>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
                  {c.productos.map((p) => {
                    const agotado = ids.has(p.id);
                    const ocupado = guardando.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => alternar(p.id)}
                        disabled={ocupado}
                        aria-pressed={agotado}
                        aria-label={`${c.nombre} ${nombreProducto(p)}: ${agotado ? 'agotado' : 'disponible'}`}
                        className={`min-h-16 px-3 py-2 rounded-xl border-2 text-left flex items-center justify-between gap-2 cursor-pointer transition-colors disabled:opacity-60 ${
                          agotado ? 'bg-red-100 border-red-500 text-red-900' : 'bg-white border-neutral-200 text-neutral-800 hover:border-rose-300'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold leading-tight">{p.nombre}</span>
                          {p.tamano && <span className="block text-xs">{p.tamano}</span>}
                        </span>
                        {ocupado && <Loader2 className="w-4 h-4 shrink-0 animate-spin" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};
