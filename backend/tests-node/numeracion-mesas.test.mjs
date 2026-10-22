import assert from 'node:assert/strict';
import test from 'node:test';
import { asignarNombreMesa, validarNumeroMesa } from '../src/numeracionMesas.ts';

test('rechaza números fuera de rango, incluso cuando llegan como nombre', () => {
  for (const numero of ['0', '10', '17', '999999999999999999999']) {
    assert.throws(() => validarNumeroMesa(numero), { status: 400 });
  }
  for (const nombre of ['1', '9', 'Juan Pérez', 'Cliente llamada']) validarNumeroMesa(nombre);
});

/** Simula la fila del turno bloqueada entre BEGIN y COMMIT, sin tocar la base real. */
function baseSimulada() {
  let ultima = Promise.resolve();
  const orden = [];
  return {
    orden,
    conexion() {
      let desbloquear;
      return {
        async query(sql) {
          assert.ok(sql.includes('FROM turnos') && sql.endsWith('FOR UPDATE'), 'Solo se bloquea el turno');
          const anterior = ultima;
          ultima = new Promise((resolver) => { desbloquear = resolver; });
          await anterior;
          return [[{ idTurno: 1 }]];
        },
        async registrar(solicitado) {
          try {
            const nombre = await asignarNombreMesa(this, 1, solicitado);
            orden.push(`inicio ${nombre}`);
            await new Promise((resolver) => setImmediate(resolver));
            orden.push(`fin ${nombre}`);
            return nombre;
          } finally { desbloquear?.(); }
        },
      };
    },
  };
}

test('croquis: se abre la mesa que se toca, sin reasignar el número, y las altas no se cruzan', async () => {
  const db = baseSimulada();
  const resultados = await Promise.all([db.conexion().registrar('5'), db.conexion().registrar('5'), db.conexion().registrar('9')]);
  // Las dos tablets que tocan la 5 reciben la 5 (la segunda reutiliza la orden activa en mesas.ts).
  assert.deepEqual(resultados, ['5', '5', '9']);
  assert.deepEqual(db.orden, ['inicio 5', 'fin 5', 'inicio 5', 'fin 5', 'inicio 9', 'fin 9'], 'Una alta a la vez con el turno bloqueado');
  assert.equal(await db.conexion().registrar('Cliente llamada'), 'Cliente llamada');
  await assert.rejects(db.conexion().registrar('10'), { status: 400 });
});

test('un turno cerrado no permite crear una mesa', async () => {
  await assert.rejects(asignarNombreMesa({ query: async () => [[]] }, 1, '1'), { status: 409, sinTurno: true });
});
