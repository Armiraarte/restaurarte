import type { EstadoImpresion } from './impresionService';

/** Una caída de red conserva los nombres y asignaciones, sin mostrarlas como listas para imprimir. */
export function conservarEstadoImpresion(anterior: EstadoImpresion | null, nuevo: EstadoImpresion): EstadoImpresion {
  if (nuevo.agente) return nuevo;
  const base = nuevo.asignaciones ? nuevo : anterior && (!nuevo.equipo || !anterior.equipo || nuevo.equipo === anterior.equipo) ? anterior : null;
  if (!base) return nuevo;
  const impresoras = (base.impresoras ?? []).map((i) => ({ ...i, conectada: false }));
  const destinos = {
    cocina: impresoras.find((i) => i.nombre === base.asignaciones?.cocina) ?? null,
    caja: impresoras.find((i) => i.nombre === base.asignaciones?.caja) ?? null,
  };
  return { ...base, ...nuevo, equipo: nuevo.equipo ?? base.equipo, asignaciones: base.asignaciones,
    impresoras, destinos, ticket: destinos.caja, configuracionConservada: true };
}
