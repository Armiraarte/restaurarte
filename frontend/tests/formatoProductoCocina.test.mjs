import assert from 'node:assert/strict';
import test from 'node:test';
import { formatoProductoCocina } from '../src/services/formatoProductoCocina.ts';

test('las categorías usan las abreviaturas solicitadas, sin cambiar el catálogo', () => {
  const casos = [
    ['Tacos', 'T'], ['Tacos Dorados', 'T'], ['Quesadillas', 'Q'], ['Sopes', 'SOPE'],
    ['Enchiladas', 'Ench'], ['Tostadas', 'TOS'], ['Burritas', 'Burri'], ['Lonches', 'Lonch'],
    ['Hamburguesas', 'Ham'], ['Ensaladas', 'Ensa'], ['Salchichas', 'Salch'],
  ];
  for (const [categoria, abreviatura] of casos) {
    const producto = { categoria, nombre: `${categoria} · Pollo (Grande)`, cantidad: 2, descripcion: ['SIN CHILE, CEBOLLA'] };
    assert.deepEqual(formatoProductoCocina(producto).renglones, [{ cantidad: 2, nombre: `${abreviatura} Pollo (Grande)` }]);
    assert.equal(producto.nombre, `${categoria} · Pollo (Grande)`);
  }
});
test('papas muestran la orden; carnes y alitas muestran solo el producto o aderezo', () => {
  const producto = (categoria, nombre) => formatoProductoCocina({ categoria, nombre, cantidad: 1, descripcion: [] }).renglones[0].nombre;
  assert.equal(producto('Papas a la Francesa', 'Papas a la Francesa · Papas a la Francesa (Media orden)'), 'Media orden de papas');
  assert.equal(producto('Papas a la Francesa', 'Orden de papas'), 'Orden de papas');
  assert.equal(producto('Carnes', 'Carnes · Milanesa'), 'Milanesa');
  assert.equal(producto('Alitas', 'Alitas · Mango Habanero'), 'Mango Habanero');
});
test('alitas mixtas conservan las cantidades por aderezo sin repetir el total ni MIXTAS', () => {
  const formato = formatoProductoCocina({ categoria: 'Alitas', nombre: 'Alitas · MIXTAS', cantidad: 10,
    reparto: [{ opcion: 'BBQ', cantidad: 4 }, { opcion: 'Buffalo', cantidad: 6 }],
    descripcion: ['4 BBQ', '6 Buffalo', 'SIN CHILE', 'CON TODO'],
  });
  assert.deepEqual(formato.renglones, [{ cantidad: 4, nombre: 'BBQ' }, { cantidad: 6, nombre: 'Buffalo' }]);
  assert.deepEqual(formato.descripcion, ['SIN CHILE']);
});

test('la Q va después del producto incluso en papas y alitas mixtas, sin repetir CON QUESO', () => {
  const p = { categoria: 'Papas a la Francesa', nombre: 'Media orden de papas', cantidad: 1, con_queso: true, descripcion: ['CON QUESO', 'SIN CHILE'] };
  assert.deepEqual(formatoProductoCocina(p), { renglones: [{ cantidad: 1, nombre: 'Media orden de papas Q' }], descripcion: ['SIN CHILE'] });
  const alitas = { categoria: 'Alitas', nombre: 'Alitas · MIXTAS', cantidad: 10, con_queso: true,
    reparto: [{ cantidad: 4, opcion: 'BBQ' }, { cantidad: 6, opcion: 'Buffalo' }], descripcion: ['4 BBQ', '6 Buffalo', 'CON QUESO'] };
  assert.deepEqual(formatoProductoCocina(alitas), { renglones: [{ cantidad: 4, nombre: 'BBQ Q' }, { cantidad: 6, nombre: 'Buffalo Q' }], descripcion: [] });
  assert.equal(formatoProductoCocina({ categoria: 'Tacos', nombre: 'T Bistec Q', cantidad: 2, con_queso: true, descripcion: [] }).renglones[0].nombre, 'T Bistec Q');
  assert.equal(formatoProductoCocina({ categoria: 'Tacos', nombre: 'Tacos · Bistec', cantidad: 2, descripcion: ['CON QUESO'] }).renglones[0].nombre, 'T Bistec Q', 'Acepta comandas de dispositivos que aún no se han recargado');
});
