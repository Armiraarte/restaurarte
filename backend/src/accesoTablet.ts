// Entrada a la app de las tablets: el dispositivo elige su tablet (Tablet 01…05) sin usuario ni PIN.
//
//   POST /api/acceso-tablet/autorizar   { usuario, password } de caja (admin o cajero) → { dispositivo }
//                                        una sola vez por dispositivo (ver dispositivos.ts)
//   GET  /api/acceso-tablet/tablets      header X-Dispositivo → { turnoAbierto, tablets: [{ numero, nombre, enUso }] }
//   POST /api/acceso-tablet/entrar       header X-Dispositivo, { numero } → { token, usuario }
//                                        solo con turno abierto y si nadie más está usando esa tablet
//
// Al hacer el corte de turno se cierran las sesiones de todas las tablets (sesionesTablet.cerrarSesionesTablet)
// y cada una vuelve a esta pantalla a esperar el siguiente turno.
import { Router, type Request } from 'express';
import bcrypt from 'bcryptjs';
import { emitirToken, HASH_FALSO } from './auth.js';
import { aPublico, buscarPorUsuario, listarUsuarios, mysqlDisponible, buscarPorId } from './usuarios.js';
import { abrirSesionTablet, sesionEnUso } from './sesionesTablet.js';
import { autorizarDispositivo, dispositivoAutorizado } from './dispositivos.js';
import { turnoAbierto } from './turnos.js';
import { pool } from './db.js';

export const accesoTabletRouter = Router();

const ROLES_QUE_AUTORIZAN = ['admin', 'cajero'];

/** Cuentas de tablet ordenadas por número (Tablet 01, 02…). */
const cuentasDeTablet = () =>
  listarUsuarios()
    .filter((u) => u.rol === 'tablet' && u.tablet)
    .sort((a, b) => Number(a.tablet!.numero) - Number(b.tablet!.numero));

const autorizado = (req: Request) => dispositivoAutorizado(req.headers['x-dispositivo']);

const hayTurno = async () => !!pool && mysqlDisponible() && !!(await turnoAbierto());

accesoTabletRouter.post('/autorizar', async (req, res) => {
  const { usuario, password } = req.body ?? {};
  if (typeof usuario !== 'string' || typeof password !== 'string' || !usuario.trim() || !password) {
    res.status(400).json({ error: 'Escribe el usuario y la contraseña de caja.' });
    return;
  }
  const encontrado = buscarPorUsuario(usuario);
  const valido = await bcrypt.compare(password, encontrado?.passwordHash ?? HASH_FALSO);
  if (!encontrado || !valido) {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    return;
  }
  if (!ROLES_QUE_AUTORIZAN.includes(encontrado.rol)) {
    res.status(403).json({ error: 'Solo administración o caja pueden autorizar una tablet.' });
    return;
  }
  console.log(`[acceso-tablet] ${encontrado.nombre} autorizó un dispositivo.`);
  res.status(201).json({ dispositivo: autorizarDispositivo(encontrado.id) });
});

accesoTabletRouter.get('/tablets', async (req, res) => {
  if (!autorizado(req)) {
    res.status(401).json({ error: 'Esta tablet aún no está autorizada.', sinAutorizar: true });
    return;
  }
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
  if (!autorizado(req)) {
    res.status(401).json({ error: 'Esta tablet aún no está autorizada.', sinAutorizar: true });
    return;
  }
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
