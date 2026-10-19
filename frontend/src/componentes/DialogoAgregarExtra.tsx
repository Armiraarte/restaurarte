import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ExtraPedido } from '../services/pedidosService';

export function DialogoAgregarExtra({ onAgregar, onCancelar }: { onAgregar: (extra: ExtraPedido) => void; onCancelar: () => void }) {
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);
  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    const importe = Number(monto.replace(',', '.'));
    if (!descripcion.trim() || !/^\d{1,7}([.,]\d{1,2})?$/.test(monto) || importe <= 0 || importe > 9999999.99) {
      setError('Escribe la descripción y un importe mayor que cero, con hasta dos decimales.');
      return;
    }
    onAgregar({ descripcion: descripcion.trim().replace(/\s+/g, ' '), importe });
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={onCancelar}>
      <form role="dialog" aria-modal="true" aria-labelledby="titulo-extra" onSubmit={guardar} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between"><h2 id="titulo-extra" className="text-xl font-bold">Agregar extra</h2><button type="button" onClick={onCancelar} aria-label="Cerrar agregar extra" className="w-10 h-10 flex items-center justify-center cursor-pointer"><X /></button></div>
        <label className="block text-sm font-semibold space-y-1"><span>Descripción del extra</span><input autoFocus required maxLength={180} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full h-12 rounded-xl border border-neutral-300 px-3 text-base" /></label>
        <label className="block text-sm font-semibold space-y-1"><span>Importe ($)</span><input required inputMode="decimal" autoComplete="off" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" className="w-full h-12 rounded-xl border border-neutral-300 px-3 text-base font-mono" /></label>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <button type="submit" className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold flex items-center justify-center gap-2 cursor-pointer"><Plus className="w-5 h-5" />Agregar extra</button>
      </form>
    </div>
  );
}
