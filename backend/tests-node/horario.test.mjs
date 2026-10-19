// Medianoches del restaurante para el cierre automático del turno (src/horario.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { inicioDelDia, siguienteMedianoche } from '../src/horario.ts';

const MX = 'America/Mexico_City'; // UTC-6 todo el año

test('la medianoche es la del restaurante, no la del servidor', () => {
  // 18 oct, 11:30 p.m. en Ciudad de México = 19 oct 05:30 UTC: sigue siendo el día 18.
  const nochePlena = new Date('2026-10-19T05:30:00Z');
  assert.equal(inicioDelDia(nochePlena, MX).toISOString(), '2026-10-18T06:00:00.000Z');
  assert.equal(siguienteMedianoche(nochePlena, MX).toISOString(), '2026-10-19T06:00:00.000Z');
});

test('un turno que abrió en la tarde se cierra a la medianoche de ese mismo día', () => {
  const abrio = new Date('2026-10-18T19:15:00Z'); // 1:15 p.m. del 18
  assert.equal(siguienteMedianoche(abrio, MX).toISOString(), '2026-10-19T06:00:00.000Z');
});

test('justo a la medianoche empieza el día siguiente', () => {
  const medianoche = new Date('2026-10-19T06:00:00Z');
  assert.equal(inicioDelDia(medianoche, MX).toISOString(), '2026-10-19T06:00:00.000Z');
  assert.equal(inicioDelDia(new Date(medianoche.getTime() - 1000), MX).toISOString(), '2026-10-18T06:00:00.000Z');
});

test('con horario de verano la medianoche se ajusta (Tijuana)', () => {
  // Tijuana sí cambia de horario: en julio es UTC-7, en diciembre UTC-8.
  assert.equal(inicioDelDia(new Date('2026-07-10T20:00:00Z'), 'America/Tijuana').toISOString(), '2026-07-10T07:00:00.000Z');
  assert.equal(inicioDelDia(new Date('2026-12-10T20:00:00Z'), 'America/Tijuana').toISOString(), '2026-12-10T08:00:00.000Z');
});
