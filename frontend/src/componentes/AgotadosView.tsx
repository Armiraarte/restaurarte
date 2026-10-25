// Agotados (sección de la caja): se toca un producto cuando se termina y en las tablets sale en gris con AGOTADO,
// sin poder comandarse; se toca otra vez cuando vuelve a haber. Los cambios llegan en vivo a todas las pantallas.
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, PackageX, RotateCcw, Search, X } from 'lucide-react';
import { CategoriaMenu, nombreProducto, obtenerMenu } from '../services/pedidosService';
import { marcarAgotado, todoDisponible, useAgotados } from '../services/agotadosService';

const dinero = (n: number) => `$${n.toFixed(2)}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
/** Para buscar sin importar acentos ni mayúsculas. */
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const AgotadosView: React.FC = () => {
  const [menu, setMenu] = useState<CategoriaMenu[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState<Set<number>>(new Set());
  const [confirmandoTodo, setConfirmandoTodo] = useState(false);
  const { lista, setLista, ids } = useAgotados();

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

  const porId = useMemo(
    () => new Map((menu ?? []).flatMap((c) => c.productos.map((p) => [p.id, { producto: p, categoria: c.nombre }] as const))),
    [menu],
  );
  // Lo agotado arriba, del más reciente al más viejo (solo lo que sigue en el menú).
  const agotadosOrdenados = [...lista].filter((a) => porId.has(a.idProducto)).sort((a, b) => b.desde.localeCompare(a.desde));

  const filtro = normal(busqueda.trim());
  const categorias = (menu ?? [])
    .map((c) => ({
      ...c,
      productos: filtro ? c.productos.filter((p) => normal(`${c.nombre} ${p.nombre} ${p.tamano ?? ''}`).includes(filtro)) : c.productos,
    }))
    .filter((c) => c.productos.length > 0);

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
            Toca un producto cuando se termine: en las tablets sale en gris y ya no se puede comandar. Tócalo otra vez cuando vuelva a haber.
          </p>
        </div>
        {agotadosOrdenados.length > 0 && (
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

      {/* Lo que ya se terminó: un toque lo regresa */}
      <section className="shrink-0 bg-white border border-neutral-200 rounded-2xl px-4 py-3">
        <div className="text-sm font-bold text-neutral-700 mb-2">
          {agotadosOrdenados.length === 0 ? 'Hay de todo' : `Se terminaron (${agotadosOrdenados.length})`}
        </div>
        {agotadosOrdenados.length === 0 ? (
          <p className="text-sm text-neutral-500">Nada está agotado: en las tablets se puede comandar todo el menú.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {agotadosOrdenados.map((a) => {
              const { producto, categoria } = porId.get(a.idProducto)!;
              return (
                <button
                  key={a.idProducto}
                  type="button"
                  onClick={() => alternar(a.idProducto)}
                  disabled={guardando.has(a.idProducto)}
                  title={`Marcado por ${a.por} a las ${hora(a.desde)}. Toca para que vuelva a haber.`}
                  className="h-10 pl-3 pr-2 rounded-full border-2 border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold flex items-center gap-2 cursor-pointer hover:bg-rose-100 disabled:opacity-60"
                >
                  <span>
                    {categoria} · {nombreProducto(producto)}
                  </span>
                  <span className="text-[11px] font-normal text-rose-700">desde {hora(a.desde)}</span>
                  {guardando.has(a.idProducto) ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </button>
              );
            })}
          </div>
        )}
      </section>

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
            const cuantos = c.productos.filter((p) => ids.has(p.id)).length;
            return (
              <section key={c.id} className="bg-white border border-neutral-200 rounded-2xl p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-bold">{c.nombre}</h3>
                  {cuantos > 0 && <span className="text-xs font-bold text-rose-700">{cuantos} agotado{cuantos > 1 ? 's' : ''}</span>}
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
                          agotado ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-white border-neutral-200 text-neutral-800 hover:border-rose-300'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className={`block font-semibold leading-tight ${agotado ? 'line-through decoration-2' : ''}`}>{p.nombre}</span>
                          <span className="block text-xs text-neutral-500">
                            {p.tamano ? `${p.tamano} · ` : ''}
                            {dinero(p.precio)}
                          </span>
                        </span>
                        {ocupado ? (
                          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                        ) : agotado ? (
                          <span className="shrink-0 text-[11px] font-black tracking-wide text-rose-600">AGOTADO</span>
                        ) : (
                          <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <Check className="w-3.5 h-3.5" /> HAY
                          </span>
                        )}
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
