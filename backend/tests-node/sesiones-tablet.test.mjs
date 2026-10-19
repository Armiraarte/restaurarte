// Sesiones de tablet: una sola por cuenta y cierre de todas con el corte de turno (src/sesionesTablet.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'sesiones-tablet-'));
const { abrirSesionTablet, estadoSesionTablet, sesionEnUso, cerrarSesionesTablet, liberarSesionTablet } = await import(
  '../src/sesionesTablet.ts'
);

test('una tablet en uso no se puede tomar desde otro dispositivo', () => {
  const sid = abrirSesionTablet('t-01');
  assert.ok(sid);
  assert.equal(estadoSesionTablet('t-01', sid), 'vigente');
  assert.equal(sesionEnUso('t-01'), true);
  assert.equal(abrirSesionTablet('t-01'), null);
});

test('al cerrar sesión la tablet queda libre al momento', () => {
  const sid = abrirSesionTablet('t-02');
  liberarSesionTablet('t-02', sid);
  assert.equal(sesionEnUso('t-02'), false);
  assert.ok(abrirSesionTablet('t-02'));
});

test('el corte cierra la sesión de todas las tablets y quedan libres para el siguiente turno', () => {
  const sid3 = abrirSesionTablet('t-03');
  const sid4 = abrirSesionTablet('t-04');

  const cerradas = cerrarSesionesTablet();

  assert.ok(cerradas.includes('t-03') && cerradas.includes('t-04'));
  assert.equal(estadoSesionTablet('t-03', sid3), 'cerrada');
  assert.equal(estadoSesionTablet('t-04', sid4), 'cerrada');
  assert.equal(sesionEnUso('t-03'), false);
  assert.deepEqual(cerrarSesionesTablet(), []); // repetirlo no cambia nada

  // Siguiente turno: se vuelve a elegir la tablet; el token viejo ya no sirve.
  const nuevo = abrirSesionTablet('t-03');
  assert.ok(nuevo);
  assert.equal(estadoSesionTablet('t-03', nuevo), 'vigente');
  assert.equal(estadoSesionTablet('t-03', sid3), 'reemplazada');
});
