import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AsignacionesImpresoras } from '../asignaciones.mjs';

const axiohm = { nombre: 'Axiohm APOS2101', driver: 'Generic / Text Only', conectada: true };
const star = { nombre: 'Star TSP100 Cutter (TSP143)', driver: 'Star', conectada: true };
const impresoras = [axiohm, star];

async function archivoTemporal(t) {
  const directorio = await mkdtemp(path.join(tmpdir(), 'restaurarte-impresoras-'));
  const archivo = path.join(directorio, 'asignaciones.json');
  t.after(async () => {
    await rm(archivo, { force: true });
    await rm(`${archivo}.tmp`, { force: true });
    await rmdir(directorio);
  });
  return archivo;
}

test('cocina y caja conservan sus impresoras al reiniciar, aunque cambie la predeterminada', async (t) => {
  const archivo = await archivoTemporal(t);
  const gestor = new AsignacionesImpresoras(archivo, axiohm.nombre);
  await gestor.asignar('cocina', axiohm.nombre, impresoras);
  await gestor.asignar('caja', star.nombre, impresoras);
  const reiniciado = new AsignacionesImpresoras(archivo, 'Otra impresora');
  assert.equal(reiniciado.elegir('cocina', impresoras).nombre, axiohm.nombre);
  assert.equal(reiniciado.elegir('caja', impresoras).nombre, star.nombre);
  assert.equal(reiniciado.estado(impresoras).ticket.nombre, star.nombre);
});

test('dos asignaciones simultáneas conservan ambos destinos', async (t) => {
  const archivo = await archivoTemporal(t);
  const gestor = new AsignacionesImpresoras(archivo);
  await Promise.all([
    gestor.asignar('cocina', axiohm.nombre, impresoras),
    gestor.asignar('caja', star.nombre, impresoras),
  ]);
  assert.deepEqual(JSON.parse(await readFile(archivo, 'utf8')), { cocina: axiohm.nombre, caja: star.nombre });
});

test('una impresora desconectada o eliminada no redirige el ticket a la otra', async (t) => {
  const gestor = new AsignacionesImpresoras(await archivoTemporal(t));
  await gestor.asignar('cocina', axiohm.nombre, impresoras);
  await gestor.asignar('caja', star.nombre, impresoras);
  assert.throws(() => gestor.elegir('cocina', [{ ...axiohm, conectada: false }, star]), { status: 409 });
  assert.throws(() => gestor.elegir('cocina', [star]), { status: 404 });
  assert.equal(gestor.elegir('caja', [star]).nombre, star.nombre);
  assert.equal(gestor.estado([star]).asignaciones.cocina, axiohm.nombre);
});

test('rechaza asignaciones inválidas sin sobrescribir la configuración', async (t) => {
  const archivo = await archivoTemporal(t);
  const gestor = new AsignacionesImpresoras(archivo);
  await gestor.asignar('caja', star.nombre, impresoras);
  const antes = await readFile(archivo, 'utf8');
  await assert.rejects(gestor.asignar('otro', axiohm.nombre, impresoras), { status: 400 });
  await assert.rejects(gestor.asignar('cocina', 'No existe', impresoras), { status: 404 });
  await assert.rejects(gestor.asignar('cocina', '', impresoras), { status: 400 });
  assert.equal(await readFile(archivo, 'utf8'), antes);
});

test('la impresora predeterminada solo se asigna a caja', async (t) => {
  const gestor = new AsignacionesImpresoras(await archivoTemporal(t), axiohm.nombre);
  assert.equal(gestor.estado(impresoras).asignaciones.cocina, null);
  assert.throws(() => gestor.elegir('cocina', impresoras), { status: 404 });
  assert.equal(gestor.elegir('caja', impresoras).nombre, axiohm.nombre);
});

test('cambiar una impresora de destino desmarca el anterior y lo conserva al reiniciar', async (t) => {
  const archivo = await archivoTemporal(t);
  const gestor = new AsignacionesImpresoras(archivo, axiohm.nombre);
  await gestor.asignar('cocina', axiohm.nombre, impresoras);
  assert.deepEqual(gestor.estado(impresoras).asignaciones, { cocina: axiohm.nombre, caja: null });
  assert.throws(() => gestor.elegir('caja', impresoras), { status: 404 });
  const reiniciado = new AsignacionesImpresoras(archivo, axiohm.nombre);
  assert.deepEqual(reiniciado.estado(impresoras).asignaciones, { cocina: axiohm.nombre, caja: null });
  await reiniciado.asignar('caja', axiohm.nombre, impresoras);
  assert.deepEqual(reiniciado.estado(impresoras).asignaciones, { cocina: null, caja: axiohm.nombre });
  assert.deepEqual(JSON.parse(await readFile(archivo, 'utf8')), { cocina: null, caja: axiohm.nombre });
});

test('asignar una impresora ocupada conserva la exclusividad de ambas impresoras', async (t) => {
  const gestor = new AsignacionesImpresoras(await archivoTemporal(t));
  await gestor.asignar('cocina', axiohm.nombre, impresoras);
  await gestor.asignar('caja', star.nombre, impresoras);
  const estado = await gestor.asignar('cocina', star.nombre, impresoras);
  assert.deepEqual(estado.asignaciones, { cocina: star.nombre, caja: null });
  assert.equal(estado.ticket, null);
  assert.equal(estado.destinos.caja, null);
});

test('dos asignaciones simultáneas de la misma impresora solo conservan la última', async (t) => {
  const archivo = await archivoTemporal(t);
  const gestor = new AsignacionesImpresoras(archivo);
  await Promise.all([
    gestor.asignar('cocina', star.nombre, impresoras),
    gestor.asignar('caja', star.nombre, impresoras),
  ]);
  assert.deepEqual(gestor.estado(impresoras).asignaciones, { cocina: null, caja: star.nombre });
  assert.deepEqual(JSON.parse(await readFile(archivo, 'utf8')), { cocina: null, caja: star.nombre });
});

test('una configuración anterior duplicada solo selecciona caja y se corrige al guardar', async (t) => {
  const archivo = await archivoTemporal(t);
  await writeFile(archivo, JSON.stringify({ cocina: star.nombre, caja: star.nombre }), 'utf8');
  const gestor = new AsignacionesImpresoras(archivo, axiohm.nombre);
  assert.deepEqual(gestor.estado(impresoras).asignaciones, { cocina: null, caja: star.nombre });
  await gestor.asignar('caja', star.nombre, impresoras);
  assert.deepEqual(JSON.parse(await readFile(archivo, 'utf8')), { cocina: null, caja: star.nombre });
});

test('la predeterminada no vuelve a ocupar una impresora que ya está en cocina', async (t) => {
  const archivo = await archivoTemporal(t);
  await writeFile(archivo, JSON.stringify({ cocina: axiohm.nombre }), 'utf8');
  const gestor = new AsignacionesImpresoras(archivo, axiohm.nombre);
  assert.deepEqual(gestor.estado(impresoras).asignaciones, { cocina: axiohm.nombre, caja: null });
});

test('una configuración dañada informa el error y no elige otra impresora', async (t) => {
  const archivo = await archivoTemporal(t);
  await writeFile(archivo, '{incompleto', 'utf8');
  assert.throws(() => new AsignacionesImpresoras(archivo), SyntaxError);
});
