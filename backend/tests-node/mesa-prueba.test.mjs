import assert from 'node:assert/strict';
import test from 'node:test';

test('la mesa de prueba (MESA_PRUEBA, solo PC de desarrollo) se acepta además de la 1 a la 9', async () => {
  process.env.MESA_PRUEBA = '10';
  const { validarNumeroMesa } = await import('../src/numeracionMesas.ts');
  for (const nombre of ['1', '9', '10', 'Juan']) validarNumeroMesa(nombre);
  for (const nombre of ['0', '11', '100']) assert.throws(() => validarNumeroMesa(nombre), { status: 400 });
});
