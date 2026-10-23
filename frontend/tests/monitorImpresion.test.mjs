import assert from 'node:assert/strict';
import test from 'node:test';
import { duracion, duracionesConexion, estadoActual, resumen, tramos } from '../src/services/monitorCalculos.ts';

const h = (hora) => new Date(`2026-10-22T${hora}:00Z`).toISOString();
const ms = (hora) => Date.parse(h(hora));
const eventos = [
  { tipo: 'conectado', hora: h('14:00'), equipo: 'Isidro' },
  { tipo: 'impresion', hora: h('15:00'), equipo: 'Isidro', destino: 'cocina', ms: 800 },
  { tipo: 'desconectado', hora: h('16:00'), equipo: 'Isidro' },
  { tipo: 'falla', hora: h('16:30'), destino: 'caja', detalle: 'Sin laptop' },
  { tipo: 'conectado', hora: h('18:00'), equipo: 'Isidro' },
];

test('estado actual: la última conexión manda; sin datos es null', () => {
  assert.deepEqual(estadoActual(eventos), { conectado: true, equipo: 'Isidro', desde: h('18:00') });
  assert.equal(estadoActual([...eventos, { tipo: 'servidor', hora: h('19:00') }]).conectado, false);
  assert.equal(estadoActual([]).conectado, null);
});

test('tramos del día: sin datos antes del primer evento, luego conectada y desconectada', () => {
  assert.deepEqual(tramos(eventos, ms('12:00'), ms('20:00')).map((t) => [t.estado, (t.hasta - t.desde) / 3_600_000]), [
    ['sin-datos', 2], ['conectado', 2], ['desconectado', 2], ['conectado', 2],
  ]);
  // Si el periodo empieza ya conectada, el primer tramo es conectado.
  assert.equal(tramos(eventos, ms('15:00'), ms('17:00'))[0].estado, 'conectado');
});

test('resumen: porcentaje del tiempo vigilado, desconexiones, tickets y fallas', () => {
  assert.deepEqual(resumen(eventos, ms('12:00'), ms('20:00')), { porcentajeConectado: 67, desconexiones: 1, impresiones: 1, fallas: 1 });
  assert.equal(resumen([], ms('12:00'), ms('20:00')).porcentajeConectado, null);
});

test('duraciones legibles y cuánto estuvo conectada antes de cada desconexión', () => {
  assert.equal(duracion(45_000), '45 s');
  assert.equal(duracion(13 * 60_000), '13 min');
  assert.equal(duracion((2 * 60 + 13) * 60_000), '2 h 13 min');
  assert.equal(duracionesConexion(eventos).get(2), 2 * 3_600_000);
});
