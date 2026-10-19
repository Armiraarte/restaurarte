import React from 'react';
import { Trash2 } from 'lucide-react';
import { ExtraPedido } from '../services/pedidosService';

export function ListaExtras({ extras, onQuitar }: { extras: (ExtraPedido & { id: number })[]; onQuitar?: (id: number) => void }) {
  if (!extras.length) return null;
  return (
    <section aria-label="Extras" className="mt-3 border-t-2 border-dashed border-amber-200 pt-3 space-y-2">
      <h4 className="font-bold text-amber-900">Extras</h4>
      {extras.map((extra) => (
        <div key={extra.id} className="flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-2">
          <span className="flex-1 min-w-0 break-words text-sm">{extra.descripcion}</span>
          <span className="font-mono font-semibold shrink-0">${extra.importe.toFixed(2)}</span>
          {onQuitar && <button type="button" onClick={() => onQuitar(extra.id)} aria-label={`Quitar extra ${extra.descripcion}`} className="w-10 h-10 shrink-0 rounded-lg border border-rose-200 text-rose-700 flex items-center justify-center cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
        </div>
      ))}
    </section>
  );
}
