// Borrador del «Nuevo pedido» de cada orden, guardado en el dispositivo (caché en localStorage).
// Lo que se va agregando y aún no se envía a cocina no se pierde si se sale a ÓRDENES, se abre otra orden
// o la app se cierra: al volver a abrir la orden sigue ahí. Se borra al enviarlo a cocina o cuando la
// orden pasa a cobro. Los borradores que nadie retomó se limpian solos después de 12 horas.
const PREFIJO = 'pedido_borrador_'; // sin prefijo pos_ para no disparar la sincronización entre pestañas
const VIGENCIA_MS = 12 * 60 * 60 * 1000;

interface Borrador<T> {
  lineas: T[];
  guardado: number;
}

function leer<T>(clave: string): Borrador<T> | null {
  try {
    const borrador = JSON.parse(localStorage.getItem(clave) ?? 'null') as Borrador<T> | null;
    return borrador && Array.isArray(borrador.lineas) ? borrador : null;
  } catch {
    return null;
  }
}

/** Renglones guardados de la orden (vacío si no hay o ya caducaron). */
export function leerBorrador<T>(idOrden: number): T[] {
  const borrador = leer<T>(PREFIJO + idOrden);
  return borrador && Date.now() - borrador.guardado < VIGENCIA_MS ? borrador.lineas : [];
}

/** Guarda los renglones de la orden; sin renglones, borra su borrador. */
export function guardarBorrador<T>(idOrden: number, lineas: T[]) {
  try {
    if (lineas.length === 0) localStorage.removeItem(PREFIJO + idOrden);
    else localStorage.setItem(PREFIJO + idOrden, JSON.stringify({ lineas, guardado: Date.now() } satisfies Borrador<T>));
  } catch {
    // sin espacio o sin almacenamiento: el pedido sigue en pantalla, solo no se guarda
  }
  limpiarViejos();
}

/** Piezas agregadas a la orden que todavía no se envían a cocina. */
export function piezasSinEnviar(idOrden: number): number {
  return leerBorrador<{ cantidad: number }>(idOrden).reduce((acc, l) => acc + l.cantidad, 0);
}

function limpiarViejos() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const clave = localStorage.key(i);
      if (!clave?.startsWith(PREFIJO)) continue;
      const borrador = leer(clave);
      if (!borrador || Date.now() - borrador.guardado >= VIGENCIA_MS) localStorage.removeItem(clave);
    }
  } catch {
    // sin almacenamiento
  }
}
