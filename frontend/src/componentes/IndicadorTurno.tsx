// Estado del turno de caja; se muestra en la caja y en la tablet.
import React from 'react';
import { CircleCheck, Clock } from 'lucide-react';
import { useTurnoActual } from '../services/sincronizacion';

/** fijo: medidas en px (tablet), para que no cambie de tamaño cuando la pantalla de pedido escala el texto. */
export const IndicadorTurno: React.FC<{ className?: string; fijo?: boolean }> = ({ className = '', fijo = false }) => {
  const turno = useTurnoActual();
  if (turno === undefined) return null;
  const tam = fijo ? 'gap-[6px] text-[12px] px-[10px] py-[4px]' : 'gap-1.5 text-xs px-2.5 py-1';
  const icono = fijo ? 'w-[14px] h-[14px]' : 'w-3.5 h-3.5';

  if (!turno) {
    return (
      <span className={`inline-flex items-center ${tam} font-semibold rounded-full border bg-rose-50 text-rose-700 border-rose-200 ${className}`}>
        <Clock className={icono} /> Sin turno
      </span>
    );
  }

  return (
    <span
      title={`Turno #${turno.idTurno} activo`}
      className={`inline-flex items-center ${tam} font-semibold rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200 ${className}`}
    >
      <CircleCheck className={icono} /> TURNO ACTIVO
    </span>
  );
};
