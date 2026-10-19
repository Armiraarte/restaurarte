// El selector de tablets todavía no tiene sesión. Recibe solo avisos para releer
// la lista pública de disponibilidad; nunca tokens ni datos de las órdenes.
import type { Request, Response } from 'express';

const selectores = new Set<Response>();

export function avisarDisponibilidadTablets() {
  for (const res of selectores) res.write('data: {"tipo":"disponibilidad"}\n\n');
}

export function eventosDisponibilidadTablets(_req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 1000\n\n');
  selectores.add(res);
  const latido = setInterval(() => res.write(': latido\n\n'), 25_000);
  res.on('close', () => {
    clearInterval(latido);
    selectores.delete(res);
  });
}
