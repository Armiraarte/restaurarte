import assert from 'node:assert/strict';
import test from 'node:test';
import { asignarNombreMesa, siguienteNumeroMesa, validarNumeroMesa } from '../src/numeracionMesas.ts';
import { siguienteNumeroMesa as sugerenciaTablet } from '../../frontend/src/services/numeracionMesas.ts';

test('continúa con 9 aunque se haya liberado 1, después vuelve a 1 y 2', () => {
  const activas = ['2', '3', '4', '5', '6', '7', '8'];
  assert.equal(siguienteNumeroMesa(activas), 9);
  activas.push('9');
  assert.equal(siguienteNumeroMesa(activas), 1);
  activas.push('1');
  assert.equal(siguienteNumeroMesa(activas), null);
  activas.splice(activas.indexOf('2'), 1);
  assert.equal(siguienteNumeroMesa(activas), 2);
});

test('tablet y servidor coinciden para las 512 combinaciones de mesas ocupadas', () => {
  for (let mascara = 0; mascara < 512; mascara++) {
    const activas = Array.from({ length: 9 }, (_, i) => String(i + 1)).filter((_, i) => mascara & (1 << i));
    const siguiente = siguienteNumeroMesa([...activas, 'Juan', '10', '17']);
    assert.equal(siguiente, sugerenciaTablet(activas));
    if (mascara === 511) assert.equal(siguiente, null);
    else {
      assert.ok(siguiente >= 1 && siguiente <= 9);
      assert.ok(!activas.includes(String(siguiente)));
      const mayor = Math.max(0, ...activas.map(Number));
      assert.equal(siguiente, mayor < 9 ? mayor + 1 : [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !activas.includes(String(n))));
    }
  }
});

test('rechaza números fuera de rango, incluso cuando llegan como nombre', () => {
  for (const numero of ['0', '10', '17', '999999999999999999999']) {
    assert.throws(() => validarNumeroMesa(numero), { status: 400 });
  }
  for (const nombre of ['1', '9', 'Juan Pérez', 'Cliente llamada']) validarNumeroMesa(nombre);
});

/** Simula la fila del turno bloqueada entre BEGIN y COMMIT, sin tocar la base real. */
function baseSimulada(nombres) {
  const activas = [...nombres];
  let ultima = Promise.resolve();
  return {
    activas,
    conexion() {
      let desbloquear;
      let bloqueo = false;
      return {
        async query(sql) {
          if (sql.includes('FROM turnos')) {
            assert.ok(sql.endsWith('FOR UPDATE'));
            const anterior = ultima;
            ultima = new Promise((resolver) => { desbloquear = resolver; });
            await anterior;
            bloqueo = true;
            return [[{ idTurno: 1 }]];
          }
          assert.ok(bloqueo, 'La consulta de ocupadas debe tener el turno bloqueado');
          assert.ok(sql.includes('estatus IN (0, 1) FOR UPDATE'));
          return [activas.map((nombre) => ({ nombre }))];
        },
        async registrar(solicitado) {
          try {
            const nombre = await asignarNombreMesa(this, 1, solicitado);
            await new Promise((resolver) => setImmediate(resolver));
            activas.push(nombre);
            return nombre;
          } finally { desbloquear?.(); }
        },
      };
    },
  };
}

test('dos tablets con la misma sugerencia obtienen 9 y 1, sin compartir una orden', async () => {
  const db = baseSimulada(['2', '3', '4', '5', '6', '7', '8']);
  const resultados = await Promise.all([db.conexion().registrar('9'), db.conexion().registrar('9')]);
  assert.deepEqual(resultados, ['9', '1']);
  assert.equal(new Set(db.activas).size, 9);
  await assert.rejects(db.conexion().registrar('9'), { status: 409 });
  assert.equal(db.activas.length, 9);
  assert.equal(await db.conexion().registrar('Cliente llamada'), 'Cliente llamada');
});

test('un turno cerrado no permite crear una mesa', async () => {
  await assert.rejects(asignarNombreMesa({ query: async () => [[]] }, 1, '1'), { status: 409, sinTurno: true });
});
