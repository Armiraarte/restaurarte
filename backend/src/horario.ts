// Horario del restaurante: las medianoches se cuentan en su zona horaria, no en la del servidor (UTC).

/** Zona horaria del restaurante. */
export const ZONA_HORARIA = process.env.ZONA_HORARIA || 'America/Mexico_City';

/** Medianoche (inicio del día) del restaurante en la que cae `fecha`. */
export function inicioDelDia(fecha: Date, zona = ZONA_HORARIA): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(fecha)
      .map((x) => [x.type, Number(x.value)]),
  );
  // Diferencia entre la hora del restaurante y UTC en ese momento (p. ej. -6 h en Ciudad de México).
  const desfase = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(fecha.getTime() / 1000) * 1000;
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - desfase);
}

/** Medianoche siguiente a `fecha` (fin del día del restaurante). */
export const siguienteMedianoche = (fecha: Date, zona = ZONA_HORARIA) =>
  inicioDelDia(new Date(inicioDelDia(fecha, zona).getTime() + 36 * 3_600_000), zona);
