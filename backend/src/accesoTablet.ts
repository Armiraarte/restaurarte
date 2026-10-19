// Entrada a la app de las tablets: la tablet elige cuál es (Tablet 01…05), sin usuario ni contraseña.
//
//   GET  /api/acceso-tablet/tablets   → { turnoAbierto, tablets: [{ numero, nombre, enUso }] }
//   POST /api/acceso-tablet/entrar    { numero } → { token, usuario }
//                                       solo con turno abierto y si nadie más está usando esa tablet
//
// Sin turno abierto la tablet se queda esperando. Al hacer el corte de turno se cierran las sesiones de todas
// las tablets (sesionesTablet.cerrarSesionesTablet) y cada una vuelve a esta pantalla a esperar el siguiente turno.
import { Router } from 'express';
import { emitirToken } from './auth.js';
import { aPublico, listarUsuarios, mysqlDisponible, buscarPorId } from './usuarios.js';
import { abrirSesionTablet, sesionEnUso } from './sesionesTablet.js';
import { turnoAbierto } from './turnos.js';
import { pool } from './db.js';
import { eventosDisponibilidadTablets } from './disponibilidadTablets.js';

export const accesoTabletRouter = Router();

accesoTabletRouter.get('/eventos', eventosDisponibilidadTablets);

/** Cuentas de tablet ordenadas por número (Tablet 01, 02…). */
const cuentasDeTablet = () =>
  listarUsuarios()
    .filter((u) => u.rol === 'tablet' && u.tablet)
    .sort((a, b) => Number(a.tablet!.numero) - Number(b.tablet!.numero));

const hayTurno = async () => !!pool && mysqlDisponible() && !!(await turnoAbierto());

accesoTabletRouter.get('/tablets', async (_req, res) => {
  try {
    res.json({
      turnoAbierto: await hayTurno(),
      tablets: cuentasDeTablet().map((u) => ({ numero: u.tablet!.numero, nombre: u.nombre, enUso: sesionEnUso(u.id) })),
    });
  } catch (err) {
    console.error('[acceso-tablet] No se pudo revisar el turno:', err);
    res.status(503).json({ error: 'No se pudo revisar el turno. Se vuelve a intentar.' });
  }
});

accesoTabletRouter.post('/entrar', async (req, res) => {
  const numero = String(req.body?.numero ?? '');
  const cuenta = cuentasDeTablet().find((u) => Number(u.tablet!.numero) === Number(numero));
  if (!cuenta) {
    res.status(404).json({ error: 'Esa tablet no está registrada.' });
    return;
  }
  if (!(await hayTurno())) {
    res.status(409).json({ error: 'Caja todavía no inicia el turno. Espera a que lo abra.', sinTurno: true });
    return;
  }
  const sid = abrirSesionTablet(cuenta.id);
  if (!sid) {
    res.status(409).json({ error: `${cuenta.nombre} ya se está usando en otra tablet. Elige otra.`, enUso: true });
    return;
  }
  const usuario = buscarPorId(cuenta.id)!;
  res.json({ token: emitirToken(usuario, sid), usuario: aPublico(usuario) });
});
