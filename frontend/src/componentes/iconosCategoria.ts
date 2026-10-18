// Ícono y color de cada categoría del menú (lo más parecido a cada platillo dentro de lucide-react).
// Lo usan la pantalla de pedido conectada a la base (PedidoOrden) y la anterior (AppTabletCuenta).
import {
  CircleDot,
  Croissant,
  CupSoda,
  Cylinder,
  Cookie,
  Drumstick,
  Flame,
  Ham,
  Hamburger,
  LucideIcon,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
} from 'lucide-react';

export const ICONO_CATEGORIA: Record<string, LucideIcon> = {
  'Tacos Dorados': Flame, // dorados (fritos)
  Tacos: Croissant, // media luna, como tortilla doblada
  Quesadillas: Pizza, // triángulo con queso
  Sopes: CircleDot, // tortilla gruesa con el relleno al centro
  Enchiladas: Soup, // bañadas en salsa
  Tostadas: Cookie, // redonda y crujiente
  Burritas: Cylinder, // enrolladas
  Lonches: Sandwich,
  Hamburguesas: Hamburger,
  Ensaladas: Salad,
  'Papas a la Francesa': Popcorn, // caja de papas
  Alitas: Drumstick,
  Salchichas: Ham, // carne (no hay ícono de salchicha)
  Bebidas: CupSoda,
  Carnes: Ham,
};

/** Ícono de la categoría; si no está en la lista, cubiertos. */
export const iconoCategoria = (nombre: string): LucideIcon => ICONO_CATEGORIA[nombre] ?? UtensilsCrossed;

// Colores pastel que se reparten en orden entre las categorías.
export const COLORES_CATEGORIA = [
  { normal: 'bg-orange-50 border-orange-200 text-orange-800', activo: 'bg-orange-100 border-orange-400 text-orange-900' },
  { normal: 'bg-amber-50 border-amber-200 text-amber-800', activo: 'bg-amber-100 border-amber-400 text-amber-900' },
  { normal: 'bg-lime-50 border-lime-200 text-lime-800', activo: 'bg-lime-100 border-lime-400 text-lime-900' },
  { normal: 'bg-emerald-50 border-emerald-200 text-emerald-800', activo: 'bg-emerald-100 border-emerald-400 text-emerald-900' },
  { normal: 'bg-sky-50 border-sky-200 text-sky-800', activo: 'bg-sky-100 border-sky-400 text-sky-900' },
  { normal: 'bg-violet-50 border-violet-200 text-violet-800', activo: 'bg-violet-100 border-violet-400 text-violet-900' },
  { normal: 'bg-pink-50 border-pink-200 text-pink-800', activo: 'bg-pink-100 border-pink-400 text-pink-900' },
];

/** Tablet: categorías con contorno neón (ver .neon en index.css), un color distinto por categoría. */
export const NEON_CATEGORIA = [
  'neon neon-fuego',
  'neon neon-diablito',
  'neon neon-queso',
  'neon neon-fresco',
  'neon neon-cian',
  'neon neon-magenta',
  'neon neon-violeta',
  'neon neon-lima',
];
