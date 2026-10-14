import {
  Account,
  Comanda,
  ComandaStatus,
  GrupoProducto,
  Mesa,
  Order,
  OrderItem,
  PaymentRecord,
  ProductCatalogItem,
  SeleccionProducto,
  SocketEventLog,
  TabletDevice,
  TabletStatus,
  Turno,
} from '../types/pos';

// Categorías reales del menú, en el orden en que se muestran.
export const CATEGORIAS_PRODUCTO: string[] = [
  'Tacos Dorados',
  'Tacos',
  'Quesadillas',
  'Sopes',
  'Enchiladas',
  'Tostadas',
  'Burritas',
  'Lonches',
  'Hamburguesas',
  'Ensaladas',
  'Papas a la Francesa',
  'Alitas',
  'Salchichas',
  'Bebidas',
];

// Para reacomodar productos guardados con las categorías anteriores, según su nombre.
const PALABRAS_CATEGORIA: [RegExp, string][] = [
  [/\btacos?\s+dorad/, 'Tacos Dorados'],
  [/\btacos?\b/, 'Tacos'],
  [/\bquesadillas?\b/, 'Quesadillas'],
  [/\bsopes?\b/, 'Sopes'],
  [/\benchiladas?\b/, 'Enchiladas'],
  [/\btostadas?\b/, 'Tostadas'],
  [/\bburrit/, 'Burritas'],
  [/\blonches?\b/, 'Lonches'],
  [/\bhamburguesas?\b/, 'Hamburguesas'],
  [/\bensaladas?\b/, 'Ensaladas'],
  [/\bpapas\b/, 'Papas a la Francesa'],
  [/\balitas?\b/, 'Alitas'],
  [/\bsalchichas?\b/, 'Salchichas'],
];

/** Sin vacíos ni repetidos (sin importar mayúsculas). */
const limpiarLista = (lista?: string[]) =>
  (lista ?? [])
    .map((o) => o.trim().replace(/\s+/g, ' '))
    .filter((o, i, arr) => o && arr.findIndex((x) => x.toLowerCase() === o.toLowerCase()) === i);

/** Opciones en el orden en que se muestran: alfabético, salvo presentaciones/tamaños con precio. */
export const opcionesOrdenadas = (g: GrupoProducto) => (g.precios ? [...g.opciones] : alfabeticoEs(g.opciones));

/** Lo que se marca de inicio al abrir el producto: ingredientes "todos seleccionados". */
export function seleccionInicial(product: ProductCatalogItem): SeleccionProducto {
  const sel: SeleccionProducto = {};
  for (const g of product.grupos ?? []) if (g.tipo === 'varias' && g.todasPorDefecto) sel[g.nombre] = [...g.opciones];
  return sel;
}

/** Grupo de "elige una" cuya opción va en el nombre: "Taco (Barbacoa)". */
export const grupoPrincipal = (p: ProductCatalogItem) => p.grupos?.find((g) => g.tipo === 'una' && !g.conSin);

/** Precio de una pieza: el base, o el de la presentación/tamaño elegido. */
export function precioDe(product: ProductCatalogItem, seleccion: SeleccionProducto = {}) {
  for (const g of product.grupos ?? []) {
    const elegida = seleccion[g.nombre]?.[0];
    if (g.precios && elegida && g.precios[elegida] !== undefined) return g.precios[elegida];
  }
  return product.price;
}

const minus = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** Detalle para cocina: opciones elegidas y, en ingredientes, primero lo que se quitó ("Sin cebolla") y luego "Con …". */
function detalleDe(product: ProductCatalogItem, seleccion: SeleccionProducto) {
  const principal = grupoPrincipal(product);
  const modifiers: string[] = [];
  for (const g of product.grupos ?? []) {
    if (g === principal || g.nombre === product.reparto) continue;
    const elegidas = seleccion[g.nombre] ?? [];
    if (g.tipo === 'una') {
      if (g.conSin) {
        modifiers.push(elegidas[0] ? `Con ${minus(elegidas[0])}` : `Sin ${g.opciones.map(minus).join(' ni ')}`);
      } else if (elegidas[0]) {
        modifiers.push(elegidas[0]);
      }
    } else {
      const orden = opcionesOrdenadas(g);
      modifiers.push(
        ...orden.filter((o) => !elegidas.includes(o)).map((o) => `Sin ${minus(o)}`),
        ...orden.filter((o) => elegidas.includes(o)).map((o) => `Con ${minus(o)}`)
      );
    }
  }
  return { principal: principal ? seleccion[principal.nombre]?.[0] : undefined, modifiers };
}

/** Lo que se pide de un producto (según el tipo de producto, se usa uno de estos campos). */
export interface ElegidoProducto {
  seleccion?: SeleccionProducto; // producto normal
  piezas?: SeleccionProducto[]; // paquete: una selección por pieza (Burritas)
  reparto?: Record<string, number>; // reparto: cantidad por opción (Alitas)
}

/**
 * Nombre, precio unitario y detalle de una línea, igual para tablet, cocina, caja y ticket.
 * - Normal: "Taco (Barbacoa)" · Dorado · Sin cebolla · Con queso…
 * - Paquete: "3 Burritas" $50 · "Burrita 1: Pierna · Sin chile…"
 * - Reparto: "Alitas" $13 c/u · "5 Mango Habanero", "5 BBQ" (la cantidad de la línea es el total de piezas)
 */
export function armarItem(product: ProductCatalogItem, elegido: ElegidoProducto = {}) {
  if (product.reparto) {
    const grupo = product.grupos?.find((g) => g.nombre === product.reparto);
    const cantidades = elegido.reparto ?? {};
    const modifiers = (grupo ? opcionesOrdenadas(grupo) : Object.keys(cantidades))
      .filter((o) => (cantidades[o] ?? 0) > 0)
      .map((o) => `${cantidades[o]} ${o}`);
    return { productName: product.name, unitPrice: product.price, modifiers };
  }

  if (product.paquete && elegido.piezas?.length) {
    const n = elegido.piezas.length;
    const { precios, nombrePieza, nombrePlural } = product.paquete;
    const modifiers = elegido.piezas.map((sel, i) => {
      const d = detalleDe(product, sel);
      return `${nombrePieza} ${i + 1}: ${[d.principal, ...d.modifiers].filter(Boolean).join(' · ')}`;
    });
    return {
      productName: n === 1 ? `1 ${nombrePieza}` : `${n} ${nombrePlural}`,
      unitPrice: precios[n] ?? product.price * n,
      modifiers,
    };
  }

  if (!product.grupos?.length) {
    return { productName: product.name, unitPrice: product.price, modifiers: product.defaultModifiers };
  }

  const seleccion = elegido.seleccion ?? {};
  const d = detalleDe(product, seleccion);
  return {
    productName: d.principal ? `${product.name} (${d.principal})` : product.name,
    unitPrice: precioDe(product, seleccion),
    modifiers: d.modifiers.length > 0 ? d.modifiers : undefined,
  };
}

const alfabeticoEs = (lista: string[]) => [...lista].sort((a, b) => a.localeCompare(b, 'es'));

/** Datos guardados con el formato anterior (opciones / acompañamientos) pasan a grupos. */
function migrarGrupos(p: ProductCatalogItem & { opciones?: string[]; acompanamientos?: string[] }): ProductCatalogItem {
  if (p.grupos || (!p.opciones && !p.acompanamientos)) return p;
  const { opciones, acompanamientos, ...resto } = p;
  const grupos: GrupoProducto[] = [];
  if (opciones?.length) grupos.push({ nombre: 'Opción', tipo: 'una', opciones });
  if (acompanamientos?.length) grupos.push({ nombre: 'Acompañamientos', tipo: 'varias', opciones: acompanamientos });
  return { ...resto, grupos };
}

const ordenCategoria = (c: string) => {
  const i = CATEGORIAS_PRODUCTO.indexOf(c);
  return i === -1 ? CATEGORIAS_PRODUCTO.length : i;
};

function migrarCategoria(p: ProductCatalogItem): ProductCatalogItem {
  if (CATEGORIAS_PRODUCTO.includes(p.category)) return p;
  const nombre = p.name.toLowerCase();
  const encontrada = PALABRAS_CATEGORIA.find(([patron]) => patron.test(nombre));
  // Sin coincidencia se conserva la categoría anterior; la tablet la muestra al final.
  return encontrada ? { ...p, category: encontrada[1] } : p;
}

// Menú real del restaurante (base fija mientras no hay base de datos).
// Al cargar datos guardados, estos productos se actualizan con la versión de aquí.
// PENDIENTES DE CONFIRMAR (ver lista en PENDIENTES_MENU): no inventar hasta confirmarlos.
const ingredientes = (nombre: string, opciones: string[]): GrupoProducto => ({
  nombre,
  tipo: 'varias',
  opciones,
  todasPorDefecto: true,
});

const PRODUCTOS_INICIALES: ProductCatalogItem[] = [
  // 1. Tacos Dorados — $10 por pieza; repollo O lechuga
  {
    id: 'p-taco-dorado',
    name: 'Taco Dorado',
    category: 'Tacos Dorados',
    price: 10,
    grupos: [
      { nombre: 'Relleno', tipo: 'una', opciones: ['Papa', 'Frijol', 'Jamón', 'Salchicha'] },
      { nombre: 'Repollo o lechuga', tipo: 'una', opciones: ['Repollo', 'Lechuga'], opcional: true, conSin: true },
      ingredientes('Complementos', ['Salsa', 'Crema']),
    ],
  },
  // 2. Tacos — $18 por pieza
  {
    id: 'p-taco',
    name: 'Taco',
    category: 'Tacos',
    price: 18,
    grupos: [
      { nombre: 'Carne', tipo: 'una', opciones: ['Barbacoa', 'Chicharrón', 'Pollo'] },
      { nombre: 'Preparación', tipo: 'una', opciones: ['Dorado', 'Sancochado', 'Blandito'] },
      ingredientes('Ingredientes', ['Queso', 'Cilantro', 'Cebolla', 'Salsa']),
    ],
  },
  // 3. Quesadillas — $15; "OPCIÓN CON QUESO" pendiente de confirmar cómo funciona
  {
    id: 'p-quesadilla',
    name: 'Quesadilla',
    category: 'Quesadillas',
    price: 15,
    grupos: [
      {
        nombre: 'Relleno',
        tipo: 'una',
        opciones: ['Papa', 'Frijol', 'Picadillo', 'Pollo', 'Queso', 'Jamón', 'Chicharrón', 'Jalapeño'],
      },
      { nombre: 'Opción de queso', tipo: 'una', opciones: ['Con queso', 'Sin queso'] },
      ingredientes('Complementos', ['Repollo', 'Lechuga', 'Salsa', 'Crema']),
    ],
  },
  // 4. Sopes — $15
  {
    id: 'p-sope',
    name: 'Sope',
    category: 'Sopes',
    price: 15,
    grupos: [
      { nombre: 'Relleno', tipo: 'una', opciones: ['Papa', 'Frijol', 'Picadillo', 'Pollo', 'Chicharrón'] },
      ingredientes('Complementos', ['Repollo', 'Lechuga', 'Salsa', 'Crema', 'Queso']),
    ],
  },
  // 5. Enchiladas — $15; "Queso/Cebolla" se deja literal hasta confirmar
  {
    id: 'p-enchilada',
    name: 'Enchilada',
    category: 'Enchiladas',
    price: 15,
    grupos: [
      { nombre: 'Relleno', tipo: 'una', opciones: ['Papa', 'Frijol', 'Picadillo', 'Pollo', 'Queso/Cebolla'] },
      ingredientes('Complementos', ['Repollo', 'Lechuga', 'Salsa', 'Crema', 'Queso']),
    ],
  },
  // 6. Tostadas — $15
  {
    id: 'p-tostada',
    name: 'Tostada',
    category: 'Tostadas',
    price: 15,
    grupos: [
      { nombre: 'Tipo', tipo: 'una', opciones: ['Frijol', 'Jamón', 'Pierna', 'Pollo', 'Mixta', 'Cuerito'] },
      ingredientes('Complementos', ['Repollo', 'Lechuga', 'Salsa', 'Crema', 'Queso']),
    ],
  },
  // 7. Burritas — 1=$20, 2=$35, 3=$50; relleno e ingredientes por burrita
  {
    id: 'p-burrita',
    name: 'Burrita',
    category: 'Burritas',
    price: 20,
    paquete: { precios: { 1: 20, 2: 35, 3: 50 }, nombrePieza: 'Burrita', nombrePlural: 'Burritas' },
    grupos: [
      { nombre: 'Relleno', tipo: 'una', opciones: ['Pierna', 'Chicharrón', 'Milanesa'] },
      ingredientes('Ingredientes', ['Lechuga', 'Jitomate', 'Cebolla', 'Chile', 'Aderezo']),
    ],
  },
  // 8. Lonches — sin papas $50, con papas $80
  {
    id: 'p-lonche',
    name: 'Lonche',
    category: 'Lonches',
    price: 50,
    grupos: [
      { nombre: 'Tipo', tipo: 'una', opciones: ['Pierna', 'Milanesa', 'Jamón', 'Barbacoa'] },
      { nombre: 'Presentación', tipo: 'una', opciones: ['Sin papas', 'Con papas'], precios: { 'Sin papas': 50, 'Con papas': 80 } },
      ingredientes('Ingredientes', ['Catsup', 'Aderezo', 'Lechuga', 'Jitomate', 'Cebolla', 'Chile']),
    ],
  },
  // 9. Hamburguesas — sola $50, con papas $80
  {
    id: 'p-hamburguesa',
    name: 'Hamburguesa',
    category: 'Hamburguesas',
    price: 50,
    grupos: [
      { nombre: 'Tipo', tipo: 'una', opciones: ['Pollo', 'Res', 'Milanesa'] },
      { nombre: 'Presentación', tipo: 'una', opciones: ['Sola', 'Con papas'], precios: { Sola: 50, 'Con papas': 80 } },
      ingredientes('Ingredientes', ['Lechuga', 'Jitomate', 'Cebolla', 'Chile', 'Catsup']),
    ],
  },
  // 10. Ensaladas — chica $40, grande $70
  {
    id: 'p-ensalada',
    name: 'Ensalada',
    category: 'Ensaladas',
    price: 40,
    grupos: [
      { nombre: 'Proteína', tipo: 'una', opciones: ['Milanesa', 'Pollo a la plancha'] },
      { nombre: 'Tamaño', tipo: 'una', opciones: ['Chica', 'Grande'], precios: { Chica: 40, Grande: 70 } },
      ingredientes('Ingredientes', ['Jitomate', 'Pepino', 'Chile', 'Cebolla']),
    ],
  },
  // 11. Papas a la Francesa — media $15, completa $30
  {
    id: 'p-papas',
    name: 'Papas a la Francesa',
    category: 'Papas a la Francesa',
    price: 15,
    grupos: [
      {
        nombre: 'Presentación',
        tipo: 'una',
        opciones: ['Media orden', 'Orden completa'],
        precios: { 'Media orden': 15, 'Orden completa': 30 },
      },
    ],
  },
  // 12. Alitas — $13 por pieza; sabores repartidos dentro de la orden ("Buffalo" pendiente de confirmar)
  {
    id: 'p-alitas',
    name: 'Alitas',
    category: 'Alitas',
    price: 13,
    reparto: 'Sabor',
    grupos: [{ nombre: 'Sabor', tipo: 'una', opciones: ['Mango Habanero', 'Buffalo', 'BBQ'] }],
  },
  // 13. Salchichas — $10
  {
    id: 'p-salchicha',
    name: 'Salchicha',
    category: 'Salchichas',
    price: 10,
    grupos: [
      { nombre: 'Presentación', tipo: 'una', opciones: ['Entera', 'Picada'] },
      ingredientes('Complementos', ['Repollo', 'Salsa', 'Crema']),
    ],
  },
  // 14. Bebidas
  {
    id: 'b-agua-lima',
    name: 'Agua de Lima',
    category: 'Bebidas',
    price: 15,
    grupos: [
      {
        nombre: 'Tamaño',
        tipo: 'una',
        opciones: ['Chica', 'Mediana', 'Grande'],
        precios: { Chica: 15, Mediana: 20, Grande: 40 },
      },
    ],
  },
  { id: 'b-pepsi', name: 'Pepsi', category: 'Bebidas', price: 20 },
  { id: 'b-coca', name: 'Coca-Cola', category: 'Bebidas', price: 30 }, // presentación pendiente de confirmar
  { id: 'b-coca-zero', name: 'Coca Zero', category: 'Bebidas', price: 30 },
  { id: 'b-coca-light', name: 'Coca Light', category: 'Bebidas', price: 30 },
  { id: 'b-coca-medio', name: 'Coca 1/2', category: 'Bebidas', price: 25 },
  { id: 'b-mirinda', name: 'Mirinda', category: 'Bebidas', price: 20 },
  { id: 'b-7up', name: '7UP', category: 'Bebidas', price: 20 },
  { id: 'b-jumex-manzana', name: 'Jumex Manzana', category: 'Bebidas', price: 30 },
  { id: 'b-jumex-durazno', name: 'Jumex Durazno', category: 'Bebidas', price: 30 },
  { id: 'b-manzanita', name: 'Manzanita', category: 'Bebidas', price: 20 },
  { id: 'b-limon-cereza', name: 'Limón / Cereza', category: 'Bebidas', price: 30 }, // nombre pendiente de confirmar
  { id: 'b-agua-mineral', name: 'Agua Mineral', category: 'Bebidas', price: 30 },
  { id: 'b-agua-natural', name: 'Agua Natural', category: 'Bebidas', price: 20 },
  { id: 'b-sangria', name: 'Sangría', category: 'Bebidas', price: 20 },
  // Coquita no se carga: su precio ($20 o $25) está pendiente de confirmar.
];

/** Datos del menú que el restaurante debe confirmar antes de producción. */
export const PENDIENTES_MENU = [
  'Alitas: confirmar el segundo sabor (se cargó como "Buffalo").',
  'Quesadillas: confirmar cómo funciona "OPCIÓN CON QUESO" (se cargó como Con queso / Sin queso).',
  'Enchiladas: confirmar si "Queso/Cebolla" es queso con cebolla o dos opciones (se dejó literal).',
  'Coca-Cola: confirmar la presentación de la de $30 junto a Coca Zero y Coca Light.',
  'Coquita: confirmar si cuesta $20 o $25 (no se cargó).',
  'Limón / Cereza: confirmar el nombre exacto.',
  'Bebidas: confirmar a qué producto corresponde la anotación de $50.',
];

export const WAITERS_LIST = ['Sebastián Martínez'];

const STORAGE_KEYS = {
  ACCOUNTS: 'pos_accounts_v3',
  ORDERS: 'pos_orders_v3',
  COMANDAS: 'pos_comandas_v3',
  TABLETS: 'pos_tablets_v3',
  TURNO: 'pos_current_turno_v3',
  TURNO_HISTORY: 'pos_turno_history_v3',
  PAYMENTS: 'pos_payments_v3',
  EVENTS: 'pos_events_v3',
  TICKET_SEQ: 'pos_ticket_counter_v3',
  ORDER_SEQ: 'pos_order_counter_v3',
  MESAS: 'pos_mesas_v3',
  PRODUCTOS: 'pos_productos_v3',
  PRODUCTOS_SEMILLA: 'pos_productos_semilla_v3',
  // Marca de la limpieza única de registros de prueba (cuentas, ventas, turnos y mesas).
  // Cambiar la versión vuelve a limpiar una vez cada dispositivo (caja y tablets) al abrir la app.
  REGISTROS_LIMPIOS: 'pos_registros_limpios_v2',
};

/** "5" se muestra como "Mesa 5"; un nombre ("Terraza") se muestra tal cual. */
export const etiquetaMesa = (mesa: Mesa) => (/^\d+$/.test(mesa.nombre) ? `Mesa ${mesa.nombre}` : mesa.nombre);

/** Cuenta abierta (no pagada) de la mesa: se relacionan por la etiqueta de la mesa. */
export const cuentaDeMesa = (mesa: Mesa, cuentas: Account[]) => {
  const etiqueta = etiquetaMesa(mesa).toLowerCase();
  return cuentas.find(
    (a) => a.identifierType === 'mesa' && a.status !== 'pagada' && a.identifier.trim().toLowerCase() === etiqueta
  );
};

const formatOrderNumber = (seq: number) => `#${seq.toString().padStart(5, '0')}`;
const formatTicketNumber = (seq: number) => `T-${seq.toString().padStart(4, '0')}`;

// Datos de ejemplo: uno de cada entidad.
/** Turno abierto sin ventas, para poder cobrar desde el inicio. */
function turnoVacio(cashierName: string): Turno {
  const now = new Date();
  const hora = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} hrs`;
  return {
    id: `TURNO-${Date.now().toString().slice(-4)}`,
    cashierName,
    openedAt: `${now.toLocaleDateString('es-MX')} ${hora}`,
    initialCash: 0,
    status: 'abierto',
    salesCount: 0,
    totalCashCollected: 0,
    totalCardCollected: 0,
    totalTransferCollected: 0,
    totalSales: 0,
    expectedCash: 0,
    payments: [],
  };
}

function getInitialSeed() {
  const now = new Date();
  const formatTime = (minutesAgo: number) => {
    const d = new Date(now.getTime() - minutesAgo * 60000);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const tablet: TabletDevice = {
    id: 'tablet-01',
    number: '01',
    name: 'TABLET 01',
    location: 'Salón Principal',
    assignedWaiter: 'Sebastián Martínez',
    status: 'conectada',
    batteryLevel: 88,
    isCharging: false,
    ipAddress: '192.168.1.101',
    lastConnection: 'Ahora (Activa)',
    sessionStartedAt: formatTime(120),
    lastActivity: 'Sin actividad',
    activeTablesCount: 0,
    activeOrdersCount: 0,
    appVersion: 'v2.4.1 (APK)',
  };

  return {
    productos: PRODUCTOS_INICIALES.map((p) => ({ ...p })),
    // Sin mesas de ejemplo: se abren por número desde la tablet o se registran en caja.
    mesas: [] as Mesa[],
    accounts: [] as Account[],
    orders: [] as Order[],
    comandas: [] as Comanda[],
    tablets: [tablet],
    currentTurno: turnoVacio(tablet.assignedWaiter),
    turnosHistory: [] as Turno[],
    payments: [] as PaymentRecord[],
    events: [] as SocketEventLog[],
    ticketSeq: 1,
    orderSeq: 1,
  };
}

class POSDataService {
  private accounts: Account[] = [];
  private orders: Order[] = [];
  private comandas: Comanda[] = [];
  private tablets: TabletDevice[] = [];
  private mesas: Mesa[] = [];
  private productos: ProductCatalogItem[] = [];
  // Ids de productos de ejemplo ya cargados (para no revivir los que se eliminen).
  private productosSemilla: string[] = [];
  private currentTurno: Turno | null = null;
  private turnosHistory: Turno[] = [];
  private payments: PaymentRecord[] = [];
  private events: SocketEventLog[] = [];
  private ticketSeq: number = 1;
  private orderSeq: number = 1;
  private listeners: Set<() => void> = new Set();
  private eventListeners: Set<(event: SocketEventLog) => void> = new Set();

  constructor() {
    this.loadState();
    if (!localStorage.getItem(STORAGE_KEYS.REGISTROS_LIMPIOS)) {
      this.limpiarRegistros({ mesas: true });
      localStorage.setItem(STORAGE_KEYS.REGISTROS_LIMPIOS, '1');
    }
    this.syncBetweenTabs();
  }

  /**
   * Mientras no haya backend para estos datos, la caja y la app de tablet comparten el
   * localStorage del navegador: si otra pestaña guarda cambios, se recargan aquí.
   */
  private syncBetweenTabs() {
    if (typeof window === 'undefined') return;
    let pendiente: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener('storage', (e) => {
      if (!e.key?.startsWith('pos_')) return;
      if (pendiente) clearTimeout(pendiente);
      pendiente = setTimeout(() => {
        pendiente = null;
        this.loadState();
        this.notify();
      }, 50);
    });
  }

  private loadState() {
    try {
      const savedAccounts = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      const savedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const savedComandas = localStorage.getItem(STORAGE_KEYS.COMANDAS);
      const savedTablets = localStorage.getItem(STORAGE_KEYS.TABLETS);
      const savedTurno = localStorage.getItem(STORAGE_KEYS.TURNO);
      const savedTurnoHistory = localStorage.getItem(STORAGE_KEYS.TURNO_HISTORY);
      const savedPayments = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const savedTicketSeq = localStorage.getItem(STORAGE_KEYS.TICKET_SEQ);
      const savedOrderSeq = localStorage.getItem(STORAGE_KEYS.ORDER_SEQ);
      const savedMesas = localStorage.getItem(STORAGE_KEYS.MESAS);
      const savedProductos = localStorage.getItem(STORAGE_KEYS.PRODUCTOS);
      const savedSemilla = localStorage.getItem(STORAGE_KEYS.PRODUCTOS_SEMILLA);

      if (savedAccounts && savedTurno && savedTablets) {
        this.accounts = JSON.parse(savedAccounts);
        this.orders = savedOrders ? JSON.parse(savedOrders) : [];
        this.comandas = savedComandas ? JSON.parse(savedComandas) : [];
        // Normaliza datos guardados con el estado antiguo 'inactiva'
        this.tablets = (JSON.parse(savedTablets) as TabletDevice[]).map((t) => ({
          ...t,
          status: t.status === 'desconectada' ? 'desconectada' : 'conectada',
        }));
        this.currentTurno = JSON.parse(savedTurno);
        this.turnosHistory = savedTurnoHistory ? JSON.parse(savedTurnoHistory) : [];
        this.payments = savedPayments ? JSON.parse(savedPayments) : [];
        this.events = savedEvents ? JSON.parse(savedEvents) : [];
        this.ticketSeq = savedTicketSeq ? Number(savedTicketSeq) : 1;
        this.orderSeq = savedOrderSeq ? Number(savedOrderSeq) : 1;
        // Mesas guardadas con el formato anterior ({ numero, capacidad }) pasan a { nombre }.
        this.mesas = savedMesas
          ? (JSON.parse(savedMesas) as (Mesa & { numero?: number })[]).map((m) => ({
              id: m.id,
              nombre: m.nombre ?? String(m.numero),
            }))
          : getInitialSeed().mesas;
        this.productos = savedProductos
          ? (JSON.parse(savedProductos) as ProductCatalogItem[]).map(migrarCategoria).map(migrarGrupos)
          : getInitialSeed().productos;
        // Productos de ejemplo agregados después de que se guardaron los datos.
        this.productosSemilla = savedSemilla ? JSON.parse(savedSemilla) : [];
        const faltantes = PRODUCTOS_INICIALES.filter(
          (p) => !this.productosSemilla.includes(p.id) && !this.productos.some((x) => x.id === p.id)
        );
        this.productos.push(...faltantes.map((p) => ({ ...p })));
        // Ids del menú base anterior: incluye 'p1' (hamburguesa de ejemplo) aunque no se haya registrado.
        if (!this.productosSemilla.includes('p1')) this.productosSemilla.push('p1');
        // Los productos del menú base siempre toman su versión actual (precio, grupos…),
        // y los que ya no están en el menú base se quitan.
        this.productos = this.productos
          .filter((p) => PRODUCTOS_INICIALES.some((x) => x.id === p.id) || !this.productosSemilla.includes(p.id))
          .map((p) => {
            const semilla = PRODUCTOS_INICIALES.find((x) => x.id === p.id);
            return semilla ? { ...semilla } : p;
          });
        this.productosSemilla = PRODUCTOS_INICIALES.map((p) => p.id);
      } else {
        this.seedDefaults();
      }
    } catch (e) {
      console.warn('Error loading state from localStorage:', e);
      this.seedDefaults();
    }
  }

  private seedDefaults() {
    const seed = getInitialSeed();
    this.accounts = seed.accounts;
    this.orders = seed.orders;
    this.comandas = seed.comandas;
    this.tablets = seed.tablets;
    this.currentTurno = seed.currentTurno;
    this.turnosHistory = seed.turnosHistory;
    this.payments = seed.payments;
    this.events = seed.events;
    this.ticketSeq = seed.ticketSeq;
    this.orderSeq = seed.orderSeq;
    this.mesas = seed.mesas;
    this.productos = seed.productos;
    this.productosSemilla = PRODUCTOS_INICIALES.map((p) => p.id);
    this.saveState();
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(this.accounts));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(this.orders));
      localStorage.setItem(STORAGE_KEYS.COMANDAS, JSON.stringify(this.comandas));
      localStorage.setItem(STORAGE_KEYS.TABLETS, JSON.stringify(this.tablets));
      localStorage.setItem(STORAGE_KEYS.TURNO, JSON.stringify(this.currentTurno));
      localStorage.setItem(STORAGE_KEYS.TURNO_HISTORY, JSON.stringify(this.turnosHistory));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(this.payments));
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(this.events));
      localStorage.setItem(STORAGE_KEYS.TICKET_SEQ, this.ticketSeq.toString());
      localStorage.setItem(STORAGE_KEYS.ORDER_SEQ, this.orderSeq.toString());
      localStorage.setItem(STORAGE_KEYS.MESAS, JSON.stringify(this.mesas));
      localStorage.setItem(STORAGE_KEYS.PRODUCTOS, JSON.stringify(this.productos));
      localStorage.setItem(STORAGE_KEYS.PRODUCTOS_SEMILLA, JSON.stringify(this.productosSemilla));
    } catch (e) {
      console.error('Error saving state:', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeEvents(listener: (event: SocketEventLog) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error notifying POS listener:', err);
      }
    });
  }

  private emitSocketEvent(
    eventType: SocketEventLog['eventType'],
    message: string,
    source: string,
    relatedId?: string
  ) {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newEvent: SocketEventLog = {
      id: `evt-${Date.now().toString().slice(-6)}`,
      eventType,
      timestamp: timeStr,
      message,
      source,
      relatedId,
    };

    this.events.unshift(newEvent);
    if (this.events.length > 50) {
      this.events = this.events.slice(0, 50);
    }

    this.eventListeners.forEach((listener) => {
      try {
        listener(newEvent);
      } catch (err) {
        console.error('Error notifying event listener:', err);
      }
    });
  }

  // --- GETTERS ---
  public getAccounts(): Account[] {
    return [...this.accounts];
  }

  public getOpenAccounts(): Account[] {
    const open = this.accounts.filter((a) => a.status !== 'pagada');
    return open.sort((a, b) => {
      if (a.status === 'cuenta_solicitada' && b.status !== 'cuenta_solicitada') return -1;
      if (a.status !== 'cuenta_solicitada' && b.status === 'cuenta_solicitada') return 1;
      return b.openedAt.localeCompare(a.openedAt);
    });
  }

  public getAccountById(id: string): Account | undefined {
    return this.accounts.find((a) => a.id === id);
  }

  public getOrders(): Order[] {
    return [...this.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getOrdersByAccountId(accountId: string): Order[] {
    return this.orders.filter((o) => o.accountId === accountId);
  }

  public getComandas(): Comanda[] {
    return [...this.comandas].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }

  public getComandasByAccountId(accountId: string): Comanda[] {
    return this.comandas.filter((c) => c.accountId === accountId);
  }

  public getTablets(): TabletDevice[] {
    return [...this.tablets].sort((a, b) => a.number.localeCompare(b.number));
  }

  public getCurrentTurno(): Turno | null {
    return this.currentTurno;
  }

  public getTurnosHistory(): Turno[] {
    return [...this.turnosHistory].sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || ''));
  }

  public getPayments(): PaymentRecord[] {
    return [...this.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }

  public getRecentEvents(): SocketEventLog[] {
    return [...this.events];
  }

  // --- COCINA / KDS ACTIONS ---
  public kitchenStartPreparing(comandaId: string): Comanda {
    const index = this.comandas.findIndex((c) => c.id === comandaId);
    if (index === -1) throw new Error('Comanda no encontrada.');

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    this.comandas[index] = {
      ...this.comandas[index],
      status: 'preparando',
      preparedAt: timeStr,
    };

    // Update order status if exists
    const orderIndex = this.orders.findIndex((o) => o.id === this.comandas[index].orderId);
    if (orderIndex !== -1) {
      this.orders[orderIndex] = {
        ...this.orders[orderIndex],
        status: 'en_cocina',
      };
    }

    const cmd = this.comandas[index];
    this.emitSocketEvent(
      'kitchen.preparing',
      `Cocina inició preparación de Orden ${cmd.orderNumber} (${cmd.accountIdentifier}).`,
      'Cocina',
      cmd.id
    );

    this.saveState();
    return this.comandas[index];
  }

  public kitchenMarkReady(comandaId: string): Comanda {
    const index = this.comandas.findIndex((c) => c.id === comandaId);
    if (index === -1) throw new Error('Comanda no encontrada.');

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    this.comandas[index] = {
      ...this.comandas[index],
      status: 'lista',
      readyAt: timeStr,
    };

    // Update order status
    const orderIndex = this.orders.findIndex((o) => o.id === this.comandas[index].orderId);
    if (orderIndex !== -1) {
      this.orders[orderIndex] = {
        ...this.orders[orderIndex],
        status: 'lista',
      };
    }

    const cmd = this.comandas[index];
    this.emitSocketEvent(
      'kitchen.ready',
      `¡Orden ${cmd.orderNumber} de ${cmd.accountIdentifier} lista para entregar! Notificado a ${cmd.sentByTablet} (${cmd.waiterName}).`,
      'Cocina',
      cmd.id
    );

    this.saveState();
    return this.comandas[index];
  }

  public kitchenMarkDelivered(comandaId: string): Comanda {
    const index = this.comandas.findIndex((c) => c.id === comandaId);
    if (index === -1) throw new Error('Comanda no encontrada.');

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    this.comandas[index] = {
      ...this.comandas[index],
      status: 'entregada',
      deliveredAt: timeStr,
    };

    const orderIndex = this.orders.findIndex((o) => o.id === this.comandas[index].orderId);
    if (orderIndex !== -1) {
      this.orders[orderIndex] = {
        ...this.orders[orderIndex],
        status: 'entregada',
      };
    }

    const cmd = this.comandas[index];
    this.emitSocketEvent(
      'order.delivered',
      `Orden ${cmd.orderNumber} entregada a los comensales en ${cmd.accountIdentifier}.`,
      cmd.sentByTablet,
      cmd.id
    );

    this.saveState();
    return this.comandas[index];
  }

  // --- PRODUCTOS ---
  public getProductos(): ProductCatalogItem[] {
    return [...this.productos].sort(
      (a, b) =>
        ordenCategoria(a.category) - ordenCategoria(b.category) ||
        a.name.localeCompare(b.name, 'es')
    );
  }

  private validarProducto(
    datos: { name: string; category: string; price: number; grupos?: GrupoProducto[] },
    idActual?: string
  ) {
    const name = datos.name.trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('Escribe el nombre del producto.');
    if (!CATEGORIAS_PRODUCTO.includes(datos.category)) {
      throw new Error('Elige una categoría.');
    }
    if (!Number.isFinite(datos.price) || datos.price <= 0) throw new Error('El precio debe ser mayor a 0.');
    const repetido = this.productos.find((p) => p.id !== idActual && p.name.toLowerCase() === name.toLowerCase());
    if (repetido) throw new Error(`"${repetido.name}" ya existe.`);
    const grupos = (datos.grupos ?? [])
      .map((g) => ({ ...g, nombre: g.nombre.trim(), opciones: limpiarLista(g.opciones) }))
      .filter((g) => g.nombre && g.opciones.length > 0);
    return {
      name,
      category: datos.category,
      price: Math.round(datos.price * 100) / 100,
      grupos: grupos.length > 0 ? grupos : undefined,
    };
  }

  public addProducto(datos: {
    name: string;
    category: string;
    price: number;
    grupos?: GrupoProducto[];
  }): ProductCatalogItem {
    const producto: ProductCatalogItem = { id: `p-${Date.now().toString(36)}`, ...this.validarProducto(datos) };
    this.productos.push(producto);
    this.saveState();
    return producto;
  }

  public updateProducto(
    id: string,
    datos: { name: string; category: string; price: number; grupos?: GrupoProducto[] }
  ): ProductCatalogItem {
    const index = this.productos.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Producto no encontrado.');
    this.productos[index] = { ...this.productos[index], ...this.validarProducto(datos, id) };
    this.saveState();
    return this.productos[index];
  }

  /** Las cuentas y comandas ya enviadas conservan su copia del producto. */
  public removeProducto(id: string) {
    if (!this.productos.some((p) => p.id === id)) throw new Error('Producto no encontrado.');
    this.productos = this.productos.filter((p) => p.id !== id);
    this.saveState();
  }

  // --- MESAS ---
  public getMesas(): Mesa[] {
    // Primero las numeradas en orden, luego las que tienen nombre en orden alfabético.
    return [...this.mesas].sort((a, b) => {
      const na = /^\d+$/.test(a.nombre) ? Number(a.nombre) : Infinity;
      const nb = /^\d+$/.test(b.nombre) ? Number(b.nombre) : Infinity;
      return na !== nb ? na - nb : a.nombre.localeCompare(b.nombre, 'es');
    });
  }

  public getCuentaDeMesa(mesa: Mesa): Account | undefined {
    return cuentaDeMesa(mesa, this.accounts);
  }

  /** Agrega una mesa por número ("5") o nombre ("Terraza"). */
  public addMesa(numeroONombre: string): Mesa {
    // "Mesa 5" se guarda como "5" para que no se duplique con la mesa numerada.
    const nombre = numeroONombre.trim().replace(/^mesa\s+(\d+)$/i, '$1').replace(/\s+/g, ' ');
    if (!nombre) throw new Error('Escribe el número o el nombre de la mesa.');
    if (/^\d+$/.test(nombre) && Number(nombre) === 0) throw new Error('El número de mesa debe ser mayor a 0.');

    const mesa: Mesa = { id: `mesa-${Date.now().toString(36)}`, nombre: /^\d+$/.test(nombre) ? String(Number(nombre)) : nombre };
    const etiqueta = etiquetaMesa(mesa).toLowerCase();
    const existente = this.mesas.find((m) => etiquetaMesa(m).toLowerCase() === etiqueta);
    if (existente) throw new Error(`${etiquetaMesa(existente)} ya existe.`);
    this.mesas.push(mesa);
    this.saveState();
    return mesa;
  }

  public removeMesa(id: string) {
    const mesa = this.mesas.find((m) => m.id === id);
    if (!mesa) throw new Error('Mesa no encontrada.');
    if (this.getCuentaDeMesa(mesa)) {
      throw new Error(`${etiquetaMesa(mesa)} tiene una cuenta abierta. Cóbrala antes de eliminarla.`);
    }
    this.mesas = this.mesas.filter((m) => m.id !== id);
    this.saveState();
  }

  // --- TABLETS MANAGEMENT ---
  public updateTabletStatus(tabletId: string, status: TabletStatus): TabletDevice {
    const index = this.tablets.findIndex((t) => t.id === tabletId);
    if (index === -1) throw new Error('Tablet no encontrada.');

    const tablet = this.tablets[index];
    const prevStatus = tablet.status;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    this.tablets[index] = {
      ...tablet,
      status,
      lastConnection: status === 'conectada' ? 'Ahora' : timeStr,
      // Al reconectarse inicia una nueva sesión; al desconectarse se conserva la hora de la última.
      sessionStartedAt: status === 'conectada' && prevStatus !== 'conectada' ? timeStr : tablet.sessionStartedAt,
    };

    if (status === 'desconectada' && prevStatus !== 'desconectada') {
      this.emitSocketEvent(
        'tablet.disconnected',
        `${tablet.name} (${tablet.assignedWaiter}) perdió conexión con el servidor.`,
        'Servidor Red',
        tablet.id
      );
    } else if (status === 'conectada' && prevStatus !== 'conectada') {
      this.emitSocketEvent(
        'tablet.connected',
        `${tablet.name} (${tablet.assignedWaiter}) se conectó exitosamente a la red local.`,
        'Servidor Red',
        tablet.id
      );
    }

    this.saveState();
    return this.tablets[index];
  }

  /** El mesero inicia sesión en una tablet: queda conectada y se registra la hora. */
  /**
   * Devuelve la tablet "tablet-NN" de este dispositivo; si no existe (cuenta nueva), la agrega.
   * El número viene de la cuenta con la que inició sesión la tablet (BD: tablets.numero).
   */
  public asegurarTablet(numero: string): TabletDevice {
    const nn = String(Number(numero) || 1).padStart(2, '0');
    const id = `tablet-${nn}`;
    const existente = this.tablets.find((t) => t.id === id);
    if (existente) return existente;
    const nueva: TabletDevice = {
      id,
      number: nn,
      name: `TABLET ${nn}`,
      location: '',
      assignedWaiter: '',
      status: 'desconectada',
      batteryLevel: 100,
      isCharging: false,
      ipAddress: '',
      lastConnection: '—',
      lastActivity: 'Sin actividad',
      activeTablesCount: 0,
      activeOrdersCount: 0,
      appVersion: 'PWA',
    };
    this.tablets.push(nueva);
    this.saveState();
    return nueva;
  }

  public tabletLogin(tabletId: string, waiterName: string): TabletDevice {
    const index = this.tablets.findIndex((t) => t.id === tabletId);
    if (index === -1) throw new Error('Tablet no encontrada.');
    if (!waiterName.trim()) throw new Error('Selecciona un mesero.');

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const tablet = this.tablets[index];

    this.tablets[index] = {
      ...tablet,
      assignedWaiter: waiterName,
      status: 'conectada',
      lastConnection: 'Ahora',
      sessionStartedAt: timeStr,
      lastActivity: `Inició sesión ${waiterName}`,
    };

    this.emitSocketEvent(
      'tablet.connected',
      `${tablet.name} inició sesión (${waiterName}).`,
      tablet.name,
      tablet.id
    );
    this.saveState();
    return this.tablets[index];
  }

  public tabletLogout(tabletId: string): TabletDevice {
    const index = this.tablets.findIndex((t) => t.id === tabletId);
    if (index === -1) throw new Error('Tablet no encontrada.');

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const tablet = this.tablets[index];

    this.tablets[index] = { ...tablet, status: 'desconectada', lastConnection: timeStr, lastActivity: 'Cerró sesión' };

    this.emitSocketEvent(
      'tablet.disconnected',
      `${tablet.name} cerró sesión (${tablet.assignedWaiter}).`,
      tablet.name,
      tablet.id
    );
    this.saveState();
    return this.tablets[index];
  }

  public reassignTabletWaiter(tabletId: string, newWaiter: string): TabletDevice {
    const index = this.tablets.findIndex((t) => t.id === tabletId);
    if (index === -1) throw new Error('Tablet no encontrada.');

    this.tablets[index] = {
      ...this.tablets[index],
      assignedWaiter: newWaiter,
      lastActivity: `Reasignado a ${newWaiter}`,
    };

    this.saveState();
    return this.tablets[index];
  }

  // --- CAJA: GESTION DE TURNOS ---
  public openTurno(cashierName: string, initialCash: number): Turno {
    if (this.currentTurno && this.currentTurno.status === 'abierto') {
      throw new Error('Ya existe un turno abierto. Debe cerrarlo antes de iniciar otro.');
    }

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} hrs`;

    const newTurno: Turno = {
      id: `TURNO-${Date.now().toString().slice(-4)}`,
      cashierName: cashierName.trim(),
      openedAt: `${now.toLocaleDateString('es-MX')} ${timeStr}`,
      initialCash: Math.max(0, initialCash),
      status: 'abierto',
      salesCount: 0,
      totalCashCollected: 0,
      totalCardCollected: 0,
      totalTransferCollected: 0,
      totalSales: 0,
      expectedCash: Math.max(0, initialCash),
      payments: [],
    };

    this.currentTurno = newTurno;
    this.saveState();
    return newTurno;
  }

  public closeTurno(countedCash: number, observation?: string): Turno {
    if (!this.currentTurno || this.currentTurno.status !== 'abierto') {
      throw new Error('No hay un turno abierto para cerrar.');
    }

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} hrs`;

    const expectedCash = this.currentTurno.expectedCash;
    const difference = countedCash - expectedCash;

    const closedTurno: Turno = {
      ...this.currentTurno,
      status: 'cerrado',
      closedAt: `${now.toLocaleDateString('es-MX')} ${timeStr}`,
      countedCash,
      difference,
      closingObservation: observation?.trim() || undefined,
    };

    this.turnosHistory.unshift(closedTurno);
    this.currentTurno = closedTurno;
    this.saveState();
    return closedTurno;
  }

  // --- CAJA: COBRO TRANSACCIONAL ---
  public processPayment(
    accountId: string,
    method: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto',
    breakdown: { efectivo?: number; tarjeta?: number; transferencia?: number },
    cashReceived?: number,
    cardReference?: string,
    transferReference?: string
  ): PaymentRecord {
    const accountIndex = this.accounts.findIndex((a) => a.id === accountId);
    if (accountIndex === -1) {
      throw new Error('La cuenta no existe en el sistema.');
    }

    const account = this.accounts[accountIndex];

    if (account.status === 'pagada') {
      throw new Error('Esta cuenta ya fue cobrada y liquidada.');
    }

    if (!this.currentTurno || this.currentTurno.status !== 'abierto') {
      throw new Error('No se puede cobrar sin un turno de caja abierto.');
    }

    const accountTotal = Math.round(account.total * 100) / 100;
    let efectivoPortion = 0;
    let tarjetaPortion = 0;
    let transferenciaPortion = 0;

    if (method === 'efectivo') {
      efectivoPortion = accountTotal;
    } else if (method === 'tarjeta') {
      tarjetaPortion = accountTotal;
    } else if (method === 'transferencia') {
      transferenciaPortion = accountTotal;
    } else if (method === 'mixto') {
      efectivoPortion = Number(breakdown.efectivo) || 0;
      tarjetaPortion = Number(breakdown.tarjeta) || 0;
      transferenciaPortion = Number(breakdown.transferencia) || 0;
      const sum = Math.round((efectivoPortion + tarjetaPortion + transferenciaPortion) * 100) / 100;
      if (Math.abs(sum - accountTotal) > 0.01) {
        throw new Error(`La suma de los métodos ($${sum.toFixed(2)}) no coincide exactamente con el total ($${accountTotal.toFixed(2)}).`);
      }
    }

    let changeGiven = 0;
    if (method === 'efectivo' || (method === 'mixto' && efectivoPortion > 0)) {
      const received = cashReceived !== undefined ? cashReceived : efectivoPortion;
      if (received < efectivoPortion) {
        throw new Error(`El efectivo recibido ($${received}) es menor a la cantidad a cobrar ($${efectivoPortion}).`);
      }
      changeGiven = Math.round((received - efectivoPortion) * 100) / 100;
    }

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const ticketNumber = formatTicketNumber(this.ticketSeq);
    this.ticketSeq += 1;

    const payment: PaymentRecord = {
      id: `PAY-${Date.now().toString().slice(-6)}`,
      ticketNumber,
      accountId: account.id,
      accountIdentifier: account.identifier,
      paraLlevar: account.paraLlevar || undefined,
      turnoId: this.currentTurno.id,
      cashierName: this.currentTurno.cashierName,
      paidAt: `${dateStr} ${timeStr} hrs`,
      total: accountTotal,
      method,
      breakdown: {
        efectivo: efectivoPortion,
        tarjeta: tarjetaPortion,
        transferencia: transferenciaPortion,
      },
      cashReceived: cashReceived,
      changeGiven,
      cardReference,
      transferReference,
      items: [...account.items],
      subtotal: account.subtotal,
      tax: account.tax,
    };

    // 1. Mark account as paid and release table
    this.accounts[accountIndex] = {
      ...account,
      status: 'pagada',
    };

    // 2. Link payment to current turno
    const updatedTurno: Turno = {
      ...this.currentTurno,
      salesCount: this.currentTurno.salesCount + 1,
      totalCashCollected: Math.round((this.currentTurno.totalCashCollected + efectivoPortion) * 100) / 100,
      totalCardCollected: Math.round((this.currentTurno.totalCardCollected + tarjetaPortion) * 100) / 100,
      totalTransferCollected: Math.round((this.currentTurno.totalTransferCollected + transferenciaPortion) * 100) / 100,
      totalSales: Math.round((this.currentTurno.totalSales + accountTotal) * 100) / 100,
      expectedCash: Math.round((this.currentTurno.initialCash + this.currentTurno.totalCashCollected + efectivoPortion) * 100) / 100,
      payments: [payment, ...this.currentTurno.payments],
    };

    this.currentTurno = updatedTurno;
    this.payments.unshift(payment);

    this.emitSocketEvent(
      'account.paid',
      `Cuenta de ${account.identifier} pagada ($${accountTotal.toFixed(2)}) con ${method.toUpperCase()} en Ticket ${ticketNumber}. Mesa liberada.`,
      'Caja Central',
      account.id
    );

    this.saveState();
    return payment;
  }

  // --- SIMULATION HELPERS FOR MULTI-DEVICE ARCHITECTURE ---
  // 1. Tablet opens a new account
  public simulateIncomingAccount(
    identifierType: 'mesa' | 'nombre',
    identifierValue: string,
    tabletName: string = 'TABLET 01',
    waiterName: string = 'Sebastián Martínez',
    paraLlevar = false
  ): Account {
    const cleanId = identifierValue.trim();
    if (!cleanId) throw new Error('El identificador de mesa o cliente es obligatorio.');

    const exists = this.accounts.find(
      (a) => a.identifier.toLowerCase() === cleanId.toLowerCase() && a.status !== 'pagada'
    );
    if (exists) {
      throw new Error(`La ${cleanId} ya tiene una cuenta activa en proceso.`);
    }

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newId = `acc-${Date.now().toString().slice(-4)}`;

    const newAccount: Account = {
      id: newId,
      identifierType,
      identifier: cleanId,
      tableNumber: identifierType === 'mesa' ? parseInt(cleanId.replace(/\D/g, '') || '0', 10) : undefined,
      customerName: identifierType === 'nombre' ? cleanId : undefined,
      openedAt: timeStr,
      openedByTablet: `${tabletName} (${waiterName})`,
      waiterName,
      paraLlevar: paraLlevar || undefined,
      status: 'abierta',
      items: [],
      ordersCount: 0,
      subtotal: 0,
      tax: 0,
      total: 0,
    };

    this.accounts.unshift(newAccount);

    this.emitSocketEvent(
      'account.created',
      `Cuenta abierta para ${cleanId}${paraLlevar ? ' (PARA LLEVAR)' : ''} desde ${tabletName} por mesero ${waiterName}.`,
      tabletName,
      newAccount.id
    );

    this.saveState();
    return newAccount;
  }

  // 2. Tablet sends comanda (initial or addition)
  public simulateNewComanda(
    accountId: string,
    catalogItemIds: {
      itemId: string;
      quantity: number;
      notes?: string;
      modifiers?: string[];
      seleccion?: SeleccionProducto;
      piezas?: SeleccionProducto[];
      reparto?: Record<string, number>;
    }[],
    tabletName: string = 'TABLET 01',
    waiterName: string = 'Sebastián Martínez',
    generalNotes?: string
  ): Comanda {
    const accountIndex = this.accounts.findIndex((a) => a.id === accountId);
    if (accountIndex === -1) throw new Error('Cuenta no encontrada.');

    const account = this.accounts[accountIndex];
    if (account.status === 'pagada') throw new Error('No se pueden enviar comandas a una cuenta pagada.');

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const existingOrders = this.orders.filter((o) => o.accountId === accountId);
    const isAddition = existingOrders.length > 0;
    const sequenceNumber = existingOrders.length + 1;
    const orderNumber = formatOrderNumber(this.orderSeq);
    this.orderSeq += 1;

    const orderId = `ord-${this.orderSeq}`;
    const comandaId = `cmd-${this.orderSeq}`;

    const newItems: OrderItem[] = [];
    catalogItemIds.forEach((entry, idx) => {
      const product = this.productos.find((p) => p.id === entry.itemId);
      if (!product) return;
      const qty = Math.max(1, entry.quantity);
      const { productName, unitPrice, modifiers } = armarItem(product, entry);
      newItems.push({
        id: `item-${Date.now().toString().slice(-5)}-${idx}`,
        orderId,
        comandaId,
        productName,
        category: product.category,
        quantity: qty,
        unitPrice,
        totalPrice: unitPrice * qty,
        modifiers: entry.modifiers || modifiers,
        notes: entry.notes,
        addedAt: timeStr,
        // Elección estructurada para el ticket de cocina / base de datos (partida_opciones)
        detalle: { productoId: product.id, seleccion: entry.seleccion, piezas: entry.piezas, reparto: entry.reparto },
      });
    });

    if (newItems.length === 0) throw new Error('Debe agregar al menos un producto a la orden.');

    const orderTotal = newItems.reduce((acc, it) => acc + it.totalPrice, 0);

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      accountId,
      accountIdentifier: account.identifier,
      tabletId: tabletName.toLowerCase().replace(/\s+/g, '-'),
      tabletName,
      waiterName,
      createdAt: timeStr,
      status: 'enviada',
      items: newItems,
      total: orderTotal,
    };

    const newComanda: Comanda = {
      id: comandaId,
      orderId,
      orderNumber,
      accountId,
      accountIdentifier: account.identifier,
      isAddition,
      sequenceNumber,
      sentAt: timeStr,
      enviadaEn: now.toISOString(),
      elapsedMinutes: 0,
      sentByTablet: tabletName,
      waiterName,
      status: 'nueva',
      items: newItems,
      generalNotes,
      paraLlevar: account.paraLlevar || undefined,
    };

    // Accumulate items in account
    const allItems = [...account.items, ...newItems];
    const total = allItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const subtotal = Math.round((total / 1.16) * 100) / 100;
    const tax = Math.round((total - subtotal) * 100) / 100;

    this.accounts[accountIndex] = {
      ...account,
      items: allItems,
      ordersCount: account.ordersCount + 1,
      total,
      subtotal,
      tax,
    };

    this.orders.unshift(newOrder);
    this.comandas.unshift(newComanda);

    this.emitSocketEvent(
      'order.sent_to_kitchen',
      `Orden ${orderNumber} (${isAddition ? 'Adición' : 'Inicial'}) enviada a Cocina para ${account.identifier} (${newItems.length} productos).`,
      tabletName,
      orderId
    );

    this.saveState();
    return newComanda;
  }

  /** Corrige el tipo de orden de una cuenta abierta; aplica a lo que se envíe a cocina después. */
  public setTipoOrden(accountId: string, paraLlevar: boolean): Account {
    const index = this.accounts.findIndex((a) => a.id === accountId);
    if (index === -1) throw new Error('Cuenta no encontrada.');
    this.accounts[index] = { ...this.accounts[index], paraLlevar: paraLlevar || undefined };
    this.saveState();
    return this.accounts[index];
  }

  // 3. Waiter clicks "Solicitar cuenta"
  public simulateRequestBill(accountId: string): Account {
    const index = this.accounts.findIndex((a) => a.id === accountId);
    if (index === -1) throw new Error('Cuenta no encontrada.');

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    this.accounts[index] = {
      ...this.accounts[index],
      status: 'cuenta_solicitada',
      requestedAt: timeStr,
    };

    const acc = this.accounts[index];
    this.emitSocketEvent(
      'account.requested',
      `${acc.identifier} solicita cuenta desde tablet (${acc.waiterName}). Total a cobrar: $${acc.total.toFixed(2)}.`,
      acc.openedByTablet.split('(')[0].trim() || 'Tablet',
      acc.id
    );

    this.saveState();
    return this.accounts[index];
  }

  /** Borra cuentas, órdenes, comandas, pagos, turnos y eventos; conserva menú, mesas y tablets. */
  /** Borra cuentas, comandas, ventas y turnos de este dispositivo; con `mesas`, también las mesas registradas. */
  public limpiarRegistros({ mesas = false }: { mesas?: boolean } = {}) {
    if (mesas) this.mesas = [];
    this.accounts = [];
    this.orders = [];
    this.comandas = [];
    this.payments = [];
    this.events = [];
    this.turnosHistory = [];
    this.currentTurno = turnoVacio(this.currentTurno?.cashierName ?? WAITERS_LIST[0]);
    this.ticketSeq = 1;
    this.orderSeq = 1;
    this.tablets = this.tablets.map((t) => ({
      ...t,
      lastActivity: 'Sin actividad',
      activeTablesCount: 0,
      activeOrdersCount: 0,
    }));
    this.saveState();
    this.notify();
  }

  // Reset demo
  public resetToInitialState() {
    localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.COMANDAS);
    localStorage.removeItem(STORAGE_KEYS.TABLETS);
    localStorage.removeItem(STORAGE_KEYS.TURNO);
    localStorage.removeItem(STORAGE_KEYS.TURNO_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.TICKET_SEQ);
    localStorage.removeItem(STORAGE_KEYS.ORDER_SEQ);
    localStorage.removeItem(STORAGE_KEYS.MESAS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTOS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTOS_SEMILLA);
    this.seedDefaults();
  }
}

export const posDataService = new POSDataService();
