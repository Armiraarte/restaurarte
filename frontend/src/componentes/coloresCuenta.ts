// Un color por persona de una cuenta dividida (se repiten después de 8): la Persona 1 de «Dividir cuenta» es la
// Cuenta 1 de Cajas, con el mismo color. Clases completas para que Tailwind las genere.
const COLORES = [
  { suave: 'bg-sky-100 border-sky-400 text-sky-900', fuerte: 'bg-sky-700 text-white' },
  { suave: 'bg-amber-100 border-amber-400 text-amber-900', fuerte: 'bg-amber-700 text-white' },
  { suave: 'bg-emerald-100 border-emerald-400 text-emerald-900', fuerte: 'bg-emerald-700 text-white' },
  { suave: 'bg-rose-100 border-rose-400 text-rose-900', fuerte: 'bg-rose-700 text-white' },
  { suave: 'bg-violet-100 border-violet-400 text-violet-900', fuerte: 'bg-violet-700 text-white' },
  { suave: 'bg-lime-100 border-lime-500 text-lime-900', fuerte: 'bg-lime-700 text-white' },
  { suave: 'bg-orange-100 border-orange-400 text-orange-900', fuerte: 'bg-orange-700 text-white' },
  { suave: 'bg-cyan-100 border-cyan-400 text-cyan-900', fuerte: 'bg-cyan-700 text-white' },
];

/** Persona 0 = Cuenta 1. `suave`: botones de Dividir cuenta; `fuerte`: franja de la tarjeta en Cajas. */
export const colorCuenta = (persona: number) => COLORES[persona % COLORES.length];
