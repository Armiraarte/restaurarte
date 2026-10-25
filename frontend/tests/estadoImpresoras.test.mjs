import assert from 'node:assert/strict';
import test from 'node:test';
import { conservarEstadoImpresion } from '../src/services/estadoImpresoras.ts';

test('una falla conserva las asignaciones visibles y deshabilita la impresión hasta reconectar', () => {
  const previo = { agente: true, equipo: 'Isidro', impresoras: [{ nombre: 'Star', conectada: true }], asignaciones: { cocina: 'Star', caja: null } };
  const caido = conservarEstadoImpresion(previo, { agente: false, error: 'Sin conexión' });
  assert.equal(caido.agente, false);
  assert.deepEqual(caido.asignaciones, previo.asignaciones);
  assert.equal(caido.destinos.cocina.nombre, 'Star');
  assert.equal(caido.destinos.cocina.conectada, false);
  assert.equal(previo.impresoras[0].conectada, true);
  const conectado = { agente: true, equipo: 'Isidro', impresoras: [{ nombre: 'Star', conectada: true }], asignaciones: { cocina: 'Star', caja: null } };
  assert.equal(conservarEstadoImpresion(caido, conectado), conectado);
});
test('una pantalla nueva muestra la configuración del servidor y no mezcla computadoras diferentes', () => {
  const copia = { agente: false, equipo: 'Isidro', impresoras: [{ nombre: 'Star', conectada: false }], asignaciones: { cocina: 'Star', caja: null } };
  assert.equal(conservarEstadoImpresion(null, copia).asignaciones.cocina, 'Star');
  assert.equal(conservarEstadoImpresion(copia, { agente: false, equipo: 'Otra PC' }).asignaciones, undefined);
});
