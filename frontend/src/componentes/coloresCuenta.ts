// Un color por persona en «Dividir cuenta» (se repiten después de 8). Clases completas para que Tailwind las genere.
const COLORES = [
  'bg-sky-100 border-sky-400 text-sky-900',
  'bg-amber-100 border-amber-400 text-amber-900',
  'bg-emerald-100 border-emerald-400 text-emerald-900',
  'bg-rose-100 border-rose-400 text-rose-900',
  'bg-violet-100 border-violet-400 text-violet-900',
  'bg-lime-100 border-lime-500 text-lime-900',
  'bg-orange-100 border-orange-400 text-orange-900',
  'bg-cyan-100 border-cyan-400 text-cyan-900',
];

/** Persona 0 = Persona 1. */
export const colorPersona = (persona: number) => COLORES[persona % COLORES.length];
