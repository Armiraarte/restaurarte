// Cuentas para quitar de la cuenta lo que se mandó por error (DialogoQuitarDelPedido). El servidor hace lo mismo
// renglón por renglón (backend/src/quitarDelPedido.ts).

/** Lo que se necesita de un renglón ya enviado (DetalleOrdenBD). */
export interface RenglonEnviado {
  idDetalle_Orden: number;
  cantidad: number;
  subtotal: number;
  opciones: { reparto?: unknown[] } | null;
}

export interface PasoQuitar<R extends RenglonEnviado> {
  linea: R;
  /** undefined = el renglón completo. */
  piezas: number | undefined;
}

/**
 * Piezas por quitar de cada renglón del mismo producto, del envío más reciente al más antiguo. MIXTAS solo se quita
 * completo, así que si hay alguno, se quitan todos los renglones.
 */
export function repartoAQuitar<R extends RenglonEnviado>(lineas: R[], piezas: number): PasoQuitar<R>[] {
  const recientes = [...lineas].sort((a, b) => b.idDetalle_Orden - a.idDetalle_Orden);
  let faltan = lineas.some((l) => l.opciones?.reparto?.length) ? Infinity : piezas;
  const pasos: PasoQuitar<R>[] = [];
  for (const linea of recientes) {
    if (faltan <= 0) break;
    const aqui = Math.min(faltan, linea.cantidad);
    pasos.push({ linea, piezas: aqui === linea.cantidad ? undefined : aqui });
    faltan -= aqui;
  }
  return pasos;
}

/** Importe de lo que se quita: en cada renglón, a su precio por pieza (lo que queda se redondea igual que el servidor). */
export const importeAQuitar = (pasos: PasoQuitar<RenglonEnviado>[]) =>
  pasos.reduce((acc, { linea, piezas }) => {
    const centavos = Math.round(linea.subtotal * 100);
    if (piezas === undefined) return acc + centavos;
    return acc + centavos - Math.round((centavos * (linea.cantidad - piezas)) / linea.cantidad);
  }, 0) / 100;
