export type AccountStatus = 'abierta' | 'cuenta_solicitada' | 'en_proceso_cobro' | 'pagada';

export type ComandaStatus = 'nueva' | 'preparando' | 'lista' | 'entregada';

export type TabletStatus = 'conectada' | 'desconectada';

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';

export interface OrderItem {
  id: string;
  orderId?: string;
  comandaId?: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers?: string[];
  notes?: string;
  addedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "#00124"
  accountId: string;
  accountIdentifier: string;
  tabletId: string;
  tabletName: string;
  waiterName: string;
  createdAt: string;
  status: 'enviada' | 'en_cocina' | 'lista' | 'entregada';
  items: OrderItem[];
  total: number;
}

export interface Account {
  /** Tipo de orden, elegido al registrar la mesa/cuenta: true = para llevar, si no = comer aquí. */
  paraLlevar?: boolean;
  id: string;
  identifierType: 'mesa' | 'nombre';
  identifier: string; // e.g. "Mesa 4" or "Carlos Ruiz"
  tableNumber?: number;
  customerName?: string;
  openedAt: string;
  openedByTablet: string; // e.g. "Tableta 1 (Terraza)"
  waiterName: string;
  status: AccountStatus;
  requestedAt?: string;
  items: OrderItem[];
  ordersCount: number;
  subtotal: number;
  tax: number;
  total: number;
  isLocked?: boolean;
}

export interface Comanda {
  paraLlevar?: boolean; // copiado de la cuenta al enviar a cocina
  id: string;
  orderId: string;
  orderNumber: string; // e.g. "#00124"
  accountId: string;
  accountIdentifier: string;
  isAddition: boolean; // True if it's an extra comanda sent later
  sequenceNumber: number; // 1, 2, 3...
  sentAt: string;
  elapsedMinutes: number;
  sentByTablet: string;
  waiterName: string;
  status: ComandaStatus;
  items: OrderItem[];
  generalNotes?: string;
  preparedAt?: string;
  readyAt?: string;
  deliveredAt?: string;
}

export interface TabletDevice {
  id: string;
  number: string; // e.g. "01"
  name: string; // e.g. "TABLET 01"
  location: string; // e.g. "Salón Principal", "Terraza"
  assignedWaiter: string; // e.g. "Sebastián Martínez"
  status: TabletStatus;
  batteryLevel: number; // 0 - 100
  isCharging: boolean;
  ipAddress: string; // e.g. "192.168.1.101"
  lastConnection: string; // e.g. "Ahora", "Hace 8 minutos"
  sessionStartedAt?: string; // hora (HH:MM) en que la tablet inició sesión
  lastActivity: string; // e.g. "Envió Comanda #00124"
  activeTablesCount: number;
  activeOrdersCount: number;
  appVersion: string;
}

export interface SocketEventLog {
  id: string;
  eventType:
    | 'tablet.connected'
    | 'tablet.disconnected'
    | 'table.created'
    | 'account.created'
    | 'order.created'
    | 'order.updated'
    | 'order.sent_to_kitchen'
    | 'kitchen.preparing'
    | 'kitchen.ready'
    | 'order.delivered'
    | 'account.requested'
    | 'account.paid';
  timestamp: string;
  message: string;
  source: string; // e.g. "Tablet 01", "Cocina", "Caja"
  relatedId?: string;
}

export interface PaymentBreakdown {
  efectivo?: number;
  tarjeta?: number;
  transferencia?: number;
}

export interface PaymentRecord {
  paraLlevar?: boolean; // copiado de la cuenta al cobrar (para el ticket)
  id: string;
  ticketNumber: string;
  accountId: string;
  accountIdentifier: string;
  turnoId: string;
  cashierName: string;
  paidAt: string;
  total: number;
  method: PaymentMethod;
  breakdown: PaymentBreakdown;
  cashReceived?: number;
  changeGiven?: number;
  cardReference?: string;
  transferReference?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
}

export interface Turno {
  id: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  initialCash: number;
  status: 'abierto' | 'cerrado';
  salesCount: number;
  totalCashCollected: number;
  totalCardCollected: number;
  totalTransferCollected: number;
  totalSales: number;
  expectedCash: number;
  countedCash?: number;
  difference?: number;
  closingObservation?: string;
  payments: PaymentRecord[];
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  category: string; // una de CATEGORIAS_PRODUCTO
  price: number;
  defaultModifiers?: string[];
  grupos?: GrupoProducto[]; // lo que se elige por pieza (carne, ingredientes, preparación…)
  /** Precio por cantidad de piezas, cada pieza configurada aparte (p. ej. Burritas 1=$20, 2=$35, 3=$50). */
  paquete?: { precios: Record<number, number>; nombrePieza: string; nombrePlural: string };
  /** Nombre del grupo cuyas opciones se reparten por cantidad (p. ej. Alitas: 5 Mango Habanero + 5 BBQ). */
  reparto?: string;
}

/** Un grupo de opciones de un producto. "una": se elige una; "varias": cero o más. */
export interface GrupoProducto {
  nombre: string; // p. ej. "Carne", "Ingredientes", "Preparación", "Tamaño"
  tipo: 'una' | 'varias';
  opciones: string[];
  /** Precio del producto según la opción elegida (presentación o tamaño). Conserva el orden dado. */
  precios?: Record<string, number>;
  /** "varias": todas inician seleccionadas y el mesero quita las que no quieren (ingredientes). */
  todasPorDefecto?: boolean;
  /** "una": se puede dejar sin elegir. */
  opcional?: boolean;
  /** Se describe como ingrediente: "Con lechuga" / "Sin repollo ni lechuga". */
  conSin?: boolean;
}

/** Lo elegido en cada grupo, por nombre de grupo. */
export type SeleccionProducto = Record<string, string[]>;

export interface Mesa {
  id: string;
  nombre: string; // número ("5") o nombre ("Terraza")
}
