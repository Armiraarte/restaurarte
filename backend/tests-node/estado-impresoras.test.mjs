import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EstadoImpresorasGuardado } from '../src/estadoImpresoras.ts';

const estado = {
  impresoras: [{ nombre: 'Star Cocina', conectada: true, usb: true }, { nombre: 'Axiohm Caja', conectada: true, usb: true }],
  asignaciones: { cocina: 'Star Cocina', caja: 'Axiohm Caja' },
};
test('otra computadora recupera las asignaciones aun después de reiniciar el servidor y perder al agente', async () => {
  const archivo = path.join(await mkdtemp(path.join(os.tmpdir(), 'impresoras-estado-')), 'estado.json');
  await new EstadoImpresorasGuardado(archivo).registrar('Isidro', estado);
  const otraPantalla = new EstadoImpresorasGuardado(archivo).sinConexion('Sin comunicación');
  assert.equal(otraPantalla.agente, false);
  assert.equal(otraPantalla.equipo, 'Isidro');
  assert.equal(otraPantalla.configuracionConservada, true);
  assert.deepEqual(otraPantalla.asignaciones, estado.asignaciones);
  assert.equal(otraPantalla.destinos.cocina.nombre, 'Star Cocina');
  assert.ok(otraPantalla.impresoras.every((i) => !i.conectada));
  assert.ok(JSON.parse(await readFile(archivo, 'utf8')).impresoras.every((i) => i.conectada), 'La lectura sin conexión no modifica el archivo');
});
test('una computadora diferente no hereda las asignaciones guardadas de Isidro', async () => {
  const archivo = path.join(await mkdtemp(path.join(os.tmpdir(), 'impresoras-estado-')), 'estado.json');
  const copia = new EstadoImpresorasGuardado(archivo);
  await copia.registrar('Isidro', estado);
  assert.equal(copia.sinConexion('Sin comunicación', 'Otra PC').asignaciones, undefined);
  await copia.registrar('Otra PC', { impresoras: [], asignaciones: { cocina: null, caja: null } });
  const reiniciado = new EstadoImpresorasGuardado(archivo);
  assert.deepEqual(reiniciado.sinConexion('Sin comunicación').asignaciones, { cocina: null, caja: null });
});

test('cambios simultáneos conservan en disco la última configuración recibida', async () => {
  const archivo = path.join(await mkdtemp(path.join(os.tmpdir(), 'impresoras-estado-')), 'estado.json');
  const copia = new EstadoImpresorasGuardado(archivo);
  const otro = { ...estado, asignaciones: { cocina: null, caja: 'Star Cocina' } };
  await Promise.all([copia.registrar('Isidro', estado), copia.registrar('Isidro', otro), copia.registrar('Isidro', estado)]);
  assert.deepEqual(new EstadoImpresorasGuardado(archivo).sinConexion('Sin comunicación').asignaciones, estado.asignaciones);
});
