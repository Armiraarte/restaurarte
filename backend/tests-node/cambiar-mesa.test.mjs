import assert from 'node:assert/strict';
import test from 'node:test';
import { cambiarMesaOrden } from '../src/numeracionMesas.ts';

/** Base simulada: un turno abierto (1) y sus órdenes; registra los UPDATE. */
function base(ordenes, { turnoAbierto = true } = {}) {
  const cambios = [];
  return {
    cambios,
    async query(sql, valores) {
      if (sql.includes('FROM turnos')) return [turnoAbierto ? [{ idTurno: 1 }] : []];
      if (sql.includes('WHERE idOrden = ?')) return [ordenes.filter((o) => o.idOrden === valores[0])];
      if (sql.includes('AND nombre = ?')) return [ordenes.filter((o) => o.idTurno === valores[0] && o.nombre === valores[1] && [0, 1].includes(o.estatus))];
      throw new Error(`consulta inesperada: ${sql}`);
    },
    async execute(sql, valores) {
      assert.match(sql, /^UPDATE orden SET nombre = \?/);
      cambios.push({ nombre: valores[0], idOrden: valores[2] });
      const orden = ordenes.find((o) => o.idOrden === valores[2]);
      orden.nombre = valores[0];
      return [{ affectedRows: 1 }];
    },
  };
}

const ordenes = () => [
  { idOrden: 11, nombre: '3', estatus: 0, idTurno: 1 },
  { idOrden: 12, nombre: '5', estatus: 1, idTurno: 1 }, // pidió la cuenta
  { idOrden: 13, nombre: '7', estatus: 2, idTurno: 1 }, // ya cobrada: la 7 está libre
  { idOrden: 14, nombre: '10', estatus: 0, idTurno: null }, // mesa de prueba (fuera del turno)
];

test('cambiar de mesa: la orden abierta pasa a una mesa libre con todo lo que tiene', async () => {
  const db = base(ordenes());
  assert.equal(await cambiarMesaOrden(db, 1, 11, '7'), '3');
  assert.deepEqual(db.cambios, [{ nombre: '7', idOrden: 11 }]);
  // También la que ya pidió la cuenta.
  assert.equal(await cambiarMesaOrden(db, 1, 12, '9'), '5');
});

test('cambiar de mesa: no a una ocupada, ni una cobrada, de otro turno, la misma o sin turno', async () => {
  const casos = [
    [11, '5', 409, /ocupada/],
    [13, '9', 409, /ya se cobró/],
    [14, '9', 409, /no es del turno/],
    [11, '3', 409, /ya está en la mesa 3/],
    [99, '9', 404, /no existe/],
  ];
  for (const [id, destino, status, mensaje] of casos) {
    const db = base(ordenes());
    await assert.rejects(cambiarMesaOrden(db, 1, id, destino), { status, message: mensaje });
    assert.equal(db.cambios.length, 0, 'No se cambia nada');
  }
  await assert.rejects(cambiarMesaOrden(base(ordenes(), { turnoAbierto: false }), 1, 11, '9'), { status: 409 });
});
