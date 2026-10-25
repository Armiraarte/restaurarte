import assert from 'node:assert/strict';
import test from 'node:test';
import { partesIguales, repartir, totalesPorPersona, unidadesDeCuenta } from '../src/services/dividirCuenta.ts';

test('partes iguales: los centavos que sobran van a las primeras personas y suman exacto', () => {
  assert.deepEqual(partesIguales(10, 3), [334, 333, 333]);
  assert.deepEqual(partesIguales(31, 2), [1550, 1550]);
  assert.equal(partesIguales(245.5, 7).reduce((a, b) => a + b, 0), 24550);
  assert.deepEqual(repartir(100, 0), [100], 'Nunca menos de una persona');
});

test('MIXTAS: cada pieza con su sabor y su precio; lo extra del renglón se reparte entre todas', () => {
  // 2 Mixto ($70) + 1 Jamón ($50) con papas ($30 c/u): 190 + 90 = 280.
  const unidades = unidadesDeCuenta([
    { clave: 'm', nombre: '2 Mixto + 1 Jamón', detalle: 'Lonches', cantidad: 3, subtotal: 280,
      reparto: [{ nombre: 'Mixto', cantidad: 2, precio: 70 }, { nombre: 'Jamón', cantidad: 1, precio: 50 }] },
    // Renglón viejo sin precio por sabor: partes iguales, pero con el nombre de cada sabor.
    { clave: 'a', nombre: '1 BBQ + 2 Buffalo', detalle: 'Alitas', cantidad: 3, subtotal: 39,
      reparto: [{ nombre: 'BBQ', cantidad: 1 }, { nombre: 'Buffalo', cantidad: 2 }] },
  ]);
  assert.deepEqual(unidades.map((u) => [u.nombre, u.centavos]), [
    ['Mixto', 10000], ['Mixto', 10000], ['Jamón', 8000],
    ['BBQ', 1300], ['Buffalo', 1300], ['Buffalo', 1300],
  ]);
});

test('por productos: cada pieza se puede dar a una persona y lo no asignado queda aparte', () => {
  const unidades = unidadesDeCuenta(
    [
      { clave: 'r1', nombre: 'Tacos · Pollo', cantidad: 3, subtotal: 54 },
      { clave: 'r2', nombre: 'Coca-Cola', cantidad: 1, subtotal: 30 },
      { clave: 'r3', nombre: 'Tostada', cantidad: 3, subtotal: 10 }, // 10 no se divide exacto entre 3
    ],
    [{ clave: 'e1', descripcion: 'Desechables', importe: 5 }],
  );
  assert.equal(unidades.length, 8);
  assert.equal(unidades.reduce((a, u) => a + u.centavos, 0), 9900, 'Las piezas suman el total de la cuenta');
  assert.deepEqual(unidades.filter((u) => u.clave.startsWith('r3')).map((u) => u.centavos), [334, 333, 333]);

  const asignadas = { 'r1-0': 0, 'r1-1': 1, 'r1-2': 1, 'r2-0': 0, 'extra-e1': 1 };
  assert.deepEqual(totalesPorPersona(unidades, asignadas, 2), { totales: [4800, 4100], sinAsignar: 1000 });
  // Si se quitan personas, lo de la que ya no está vuelve a «sin asignar».
  assert.deepEqual(totalesPorPersona(unidades, asignadas, 1), { totales: [4800], sinAsignar: 5100 });
});
