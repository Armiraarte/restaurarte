import assert from 'node:assert/strict';
import test from 'node:test';
import { formatoProductoCocina } from '../src/services/formatoProductoCocina.ts';

test('las categorías usan las abreviaturas solicitadas, sin cambiar el catálogo', () => {
  const casos = [
    ['Tacos', 'T POLLO'], ['Tacos Dorados', 'T POLLO'], ['Quesadillas', 'Q POLLO'], ['Sopes', 'SOP POLLO'],
    ['Enchiladas', 'ENCHI POLLO'], ['Tostadas', 'TOS POLLO'], ['Burritas', 'Burri Pollo'], ['Lonches', 'Lonch Pollo'],
    ['Hamburguesas', 'Ham Pollo'], ['Ensaladas', 'Ensa Pollo'], ['Salchichas', 'Salch Pollo'],
  ];
  for (const [categoria, esperado] of casos) {
    const producto = { categoria, nombre: `${categoria} · Pollo (Grande)`, cantidad: 2, descripcion: ['SIN CHILE, CEBOLLA'] };
    assert.deepEqual(formatoProductoCocina(producto).renglones, [{ cantidad: 2, nombre: `${esperado} (Grande)` }]);
    assert.equal(producto.nombre, `${categoria} · Pollo (Grande)`);
  }
});
test('papas muestran la orden; carnes y alitas muestran solo el producto o aderezo', () => {
  const producto = (categoria, nombre) => formatoProductoCocina({ categoria, nombre, cantidad: 1, descripcion: [] }).renglones[0].nombre;
  assert.equal(producto('Papas a la Francesa', 'Papas a la Francesa · Papas a la Francesa (Media orden)'), 'MEDIA PAPAS');
  assert.equal(producto('Papas a la Francesa', 'Orden de papas'), 'ORDEN PAPAS');
  assert.equal(producto('Carnes', 'Carnes · Milanesa'), 'Milanesa');
  assert.equal(producto('Alitas', 'Alitas · Mango Habanero'), 'Mango Habanero');
});
test('alitas mixtas conservan las cantidades por aderezo sin repetir el total ni MIXTAS', () => {
  const formato = formatoProductoCocina({ categoria: 'Alitas', nombre: 'Alitas · MIXTAS', cantidad: 10,
    reparto: [{ opcion: 'BBQ', cantidad: 4 }, { opcion: 'Buffalo', cantidad: 6 }],
    descripcion: ['4 BBQ', '6 Buffalo', 'SIN CHILE', 'CON TODO'],
  });
  assert.deepEqual(formato.renglones, [{ cantidad: 4, nombre: 'BBQ' }, { cantidad: 6, nombre: 'BFF' }]);
  assert.deepEqual(formato.descripcion, ['SIN CHILE']);
});

test('la Q va después del producto incluso en papas y alitas mixtas, sin repetir CON QUESO', () => {
  const p = { categoria: 'Papas a la Francesa', nombre: 'Media orden de papas', cantidad: 1, con_queso: true, descripcion: ['CON QUESO', 'SIN CHILE'] };
  assert.deepEqual(formatoProductoCocina(p), { renglones: [{ cantidad: 1, nombre: 'MEDIA PAPAS Q' }], descripcion: ['SIN CHILE'] });
  const alitas = { categoria: 'Alitas', nombre: 'Alitas · MIXTAS', cantidad: 10, con_queso: true,
    reparto: [{ cantidad: 4, opcion: 'BBQ' }, { cantidad: 6, opcion: 'Buffalo' }], descripcion: ['4 BBQ', '6 Buffalo', 'CON QUESO'] };
  assert.deepEqual(formatoProductoCocina(alitas), { renglones: [{ cantidad: 4, nombre: 'BBQ Q' }, { cantidad: 6, nombre: 'BFF Q' }], descripcion: [] });
  assert.equal(formatoProductoCocina({ categoria: 'Tacos', nombre: 'TB Q', cantidad: 2, con_queso: true, descripcion: [] }).renglones[0].nombre, 'TB Q');
  assert.equal(formatoProductoCocina({ categoria: 'Tacos', nombre: 'Tacos · Barbacoa', cantidad: 2, descripcion: ['CON QUESO'] }).renglones[0].nombre, 'TB Q', 'Acepta comandas de dispositivos que aún no se han recargado');
});

test('cada producto usa la abreviatura solicitada y conserva la Q cuando lleva queso', () => {
  const casos = [
    ['Tacos Dorados', 'Papa', 'T PAPA'], ['Tacos Dorados', 'Frijol', 'T FRIJOL'], ['Tacos Dorados', 'Jamón', 'T JAM'],
    ['Tacos', 'Barbacoa', 'TB'], ['Tacos', 'Chicharrón', 'T H'], ['Tacos', 'Pollo', 'T POLLO'],
    ['Quesadillas', 'Papa', 'Q PAPA'], ['Quesadillas', 'Frijol', 'Q FRIJ'], ['Quesadillas', 'Picadillo', 'Q PICA'],
    ['Quesadillas', 'Pollo', 'Q POLLO'], ['Quesadillas', 'Jamón', 'Q JAM'], ['Quesadillas', 'Chicharrón', 'Q H'], ['Quesadillas', 'Jalapeño', 'Q JALAP'],
    ['Sopes', 'Papa', 'SOP PAPA'], ['Sopes', 'Frijol', 'SOP FRI'], ['Sopes', 'Picadillo', 'SOP PICA'],
    ['Sopes', 'Pollo', 'SOP POLLO'], ['Sopes', 'Chicharrón', 'SOP H'], ['Sopes', 'Pierna', 'SOP PIERNA'],
    ['Enchiladas', 'Papa', 'ENCHI PAPA'], ['Enchiladas', 'Frijol', 'ENCHI FRIJOL'], ['Enchiladas', 'Picadillo', 'ENCHI PICA'],
    ['Enchiladas', 'Pollo', 'ENCHI POLLO'], ['Enchiladas', 'Queso', 'ENCHI QUESO'], ['Enchiladas', 'Queso/Cebolla', 'ENCHI QUESO CEBOLLA'],
    ['Tostadas', 'Frijol', 'TOS FRIJO'], ['Tostadas', 'Jamón', 'TOS JAM'], ['Tostadas', 'Pollo', 'TOS POLLO'],
    ['Tostadas', 'Mixta', 'TOS MIX'], ['Tostadas', 'Cuerito', 'TOS CUERI'],
  ];
  for (const [categoria, nombre, esperado] of casos) {
    for (const con_queso of [false, true]) {
      const producto = { categoria, nombre: `${categoria} · ${nombre}`, cantidad: 3, con_queso, descripcion: ['SIN CHILE, CEBOLLA'] };
      const formato = formatoProductoCocina(producto);
      assert.deepEqual(formato, { renglones: [{ cantidad: 3, nombre: `${esperado}${con_queso ? ' Q' : ''}` }], descripcion: ['SIN CHILE, CEBOLLA'] });
      assert.deepEqual(formatoProductoCocina({ ...producto, nombre: formato.renglones[0].nombre }), formato, 'No duplica prefijos al recibir una comanda ya abreviada');
    }
  }
});

test('las mezclas abrevian sabores y mantienen tamaños, cantidades e indicaciones', () => {
  const p = { categoria: 'Quesadillas', nombre: 'Quesadillas · Papa con Frijol (Grande)', cantidad: 2, con_queso: true, descripcion: ['SIN CHILE'] };
  assert.deepEqual(formatoProductoCocina(p), { renglones: [{ cantidad: 2, nombre: 'Q PAPA CON FRIJ (Grande) Q' }], descripcion: ['SIN CHILE'] });
  const mixtas = { ...p, nombre: 'Quesadillas · MIXTAS (Grande)', reparto: [{ opcion: 'Frijol', cantidad: 1 }, { opcion: 'Jamón', cantidad: 1 }], descripcion: ['1 Frijol', '1 Jamón', 'CON PAPAS', 'SIN CHILE'] };
  assert.deepEqual(formatoProductoCocina(mixtas), { renglones: [{ cantidad: 1, nombre: 'Q FRIJ (Grande) Q' }, { cantidad: 1, nombre: 'Q JAM (Grande) Q' }], descripcion: ['CON PAPAS', 'SIN CHILE'] });
});

test('sopes mixtos muestran solo las piezas de cada sabor con su queso, sin total ni MIXTAS', () => {
  const p = { categoria: 'Sopes', nombre: 'Sopes · MIXTAS', cantidad: 5, con_queso: true,
    reparto: [{ opcion: 'Papa', cantidad: 2, con_queso: true }, { opcion: 'Frijol', cantidad: 1, con_queso: false }, { opcion: 'Picadillo', cantidad: 2, con_queso: true }],
    descripcion: ['2 Papa', '1 Frijol', '2 Picadillo', 'CON QUESO', 'EXTRA CREMA', 'SIN CEBOLLA'],
  };
  assert.deepEqual(formatoProductoCocina(p), {
    renglones: [{ cantidad: 2, nombre: 'SOP PAPA Q' }, { cantidad: 1, nombre: 'SOP FRI' }, { cantidad: 2, nombre: 'SOP PICA Q' }],
    descripcion: ['EXTRA CREMA', 'SIN CEBOLLA'],
  });
});
