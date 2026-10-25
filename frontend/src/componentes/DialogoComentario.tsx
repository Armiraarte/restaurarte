// Comentario del platillo que se está armando (botón junto a VOLVER): lo que no está en el menú ni en las
// opciones. Sale en la comanda de cocina como «NOTA: …» debajo del platillo.
import React, { useEffect, useState } from 'react';
import { MessageSquareText, Trash2, X } from 'lucide-react';

export const MAX_COMENTARIO = 200;
// Atajos de lo que más se pide; se agregan al texto al tocarlos.
const SUGERENCIAS = ['Bien dorado', 'Poco dorado', 'Partido a la mitad', 'Sin sal', 'Salsa aparte', 'Para llevar', 'Para niño'];

export function DialogoComentario({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial: string;
  /** Texto limpio; vacío = sin comentario. */
  onGuardar: (comentario: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  const agregarSugerencia = (s: string) =>
    setTexto((actual) => {
      const limpio = actual.trim();
      if (limpio.toLowerCase().includes(s.toLowerCase())) return actual;
      return (limpio ? `${limpio.replace(/[,.]$/, '')}, ${s.toLowerCase()}` : s).slice(0, MAX_COMENTARIO);
    });
  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    onGuardar(texto.trim().replace(/\s+/g, ' '));
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={onCancelar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-comentario"
        onSubmit={guardar}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-comentario" className="text-xl font-bold flex items-center gap-2">
            <MessageSquareText className="w-6 h-6 text-sky-700" /> Comentario del platillo
          </h2>
          <button type="button" onClick={onCancelar} aria-label="Cerrar comentario" className="w-10 h-10 flex items-center justify-center cursor-pointer">
            <X />
          </button>
        </div>
        <p className="text-sm text-neutral-500">Lo que no está en el menú ni en las opciones. Sale en la comanda de cocina como NOTA.</p>
        <textarea
          autoFocus
          rows={3}
          maxLength={MAX_COMENTARIO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej. bien dorado, partido a la mitad…"
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-base resize-none focus:outline-none focus:border-sky-500 select-text"
        />
        <div className="flex flex-wrap gap-2">
          {SUGERENCIAS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => agregarSugerencia(s)}
              className="h-9 px-3 rounded-full border border-sky-200 bg-sky-50 text-sky-900 text-sm font-semibold cursor-pointer hover:bg-sky-100"
            >
              + {s}
            </button>
          ))}
        </div>
        <div className="text-right text-[11px] text-neutral-400">
          {texto.length}/{MAX_COMENTARIO}
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={() => onGuardar('')}
            disabled={!inicial && !texto.trim()}
            className="h-12 px-4 rounded-xl border-2 border-rose-200 text-rose-700 font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" /> Quitar
          </button>
          <button type="submit" className="h-12 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer">
            Guardar comentario
          </button>
        </div>
      </form>
    </div>
  );
}
