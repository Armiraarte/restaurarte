import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Calcula cuántos registros caben; los demás siguen accesibles con las flechas. */
export function ListaPaginada<T>({ items, etiqueta, altoFila, columnas = false, clave, renderizar, vacio = 'No hay registros.' }: {
  items: T[];
  etiqueta: string;
  altoFila: number;
  columnas?: boolean | number;
  clave: (item: T) => React.Key;
  renderizar: (item: T) => React.ReactNode;
  vacio?: string;
}) {
  const espacio = useRef<HTMLDivElement>(null);
  const [tamano, setTamano] = useState({ filas: 1, columnas: 1 });
  const [pagina, setPagina] = useState(0);
  useLayoutEffect(() => {
    const elemento = espacio.current;
    if (!elemento) return;
    const medir = () => {
      const cantidadColumnas = typeof columnas === 'number'
        ? Math.max(1, Math.min(3, Math.floor((elemento.clientWidth + 16) / (columnas + 16))))
        : columnas ? (elemento.clientWidth >= 960 ? 3 : elemento.clientWidth >= 560 ? 2 : 1) : 1;
      const filas = Math.max(1, Math.floor(elemento.clientHeight / altoFila));
      setTamano((anterior) => anterior.filas === filas && anterior.columnas === cantidadColumnas ? anterior : { filas, columnas: cantidadColumnas });
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [altoFila, columnas]);
  const capacidad = tamano.filas * tamano.columnas;
  const paginas = Math.max(1, Math.ceil(items.length / capacidad));
  const actual = Math.min(pagina, paginas - 1);
  useEffect(() => setPagina((anterior) => Math.min(anterior, paginas - 1)), [paginas]);
  const inicio = actual * capacidad;
  return (
    <div data-lista-paginada={etiqueta} className="flex-1 min-h-0 flex flex-col px-3 pb-2 pt-1">
      <div ref={espacio} data-registros className="flex-1 min-h-0 grid content-start gap-x-4 overflow-hidden" style={{ gridTemplateColumns: `repeat(${tamano.columnas}, minmax(0, 1fr))`, gridAutoRows: altoFila }}>
        {items.slice(inicio, inicio + capacidad).map((item) => <div key={clave(item)} className="min-w-0">{renderizar(item)}</div>)}
        {items.length === 0 && <p className="col-span-full text-xs py-2 text-neutral-500">{vacio}</p>}
      </div>
      <nav aria-label={`Páginas de ${etiqueta}`} className="shrink-0 h-9 border-t border-neutral-100 flex items-center justify-between gap-2 text-xs text-neutral-500">
        <span>{items.length ? `${inicio + 1}–${Math.min(inicio + capacidad, items.length)} de ${items.length}` : `0 ${etiqueta}`}</span>
        <span className="flex items-center gap-2">
          <button onClick={() => setPagina(actual - 1)} disabled={actual === 0} aria-label={`Anterior: ${etiqueta}`} className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center cursor-pointer disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-mono">{actual + 1}/{paginas}</span>
          <button onClick={() => setPagina(actual + 1)} disabled={actual + 1 >= paginas} aria-label={`Siguiente: ${etiqueta}`} className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center cursor-pointer disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </span>
      </nav>
    </div>
  );
}
