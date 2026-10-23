import assert from 'node:assert/strict';
import test from 'node:test';
import { agruparMix } from '../src/services/pedidoMix.ts';
import { terminosCategoria } from '../src/services/terminosPedido.ts';
import { guardarBorrador, leerBorrador, leerMixActivo, leerExtrasBorrador, piezasSinEnviar } from '../src/services/borradorPedido.ts';
import { complementosTicket, complementosTicketQuesoOpcional, ordenarComplementos } from '../src/services/complementos.ts';

test('MIX conserva orden de grupos, cantidades y productos sueltos', () => {
  const lineas = [{ id: 1, mix: 1 }, { id: 2, mix: null }, { id: 3, mix: 1 }, { id: 4, mix: 2 }, { id: 5 }];
  const grupos = agruparMix(lineas, (l) => l.mix);
  assert.deepEqual(grupos.map((g) => [g.grupo, g.lineas.map((l) => l.id)]), [[1, [1, 3]], [null, [2]], [2, [4]], [null, [5]]]);
  assert.equal(grupos.flatMap((g) => g.lineas).length, lineas.length);
});

test('solo Tacos ofrece los tres términos; Tacos Dorados excluye Dorado y otras categorías no ofrecen términos', () => {
  const terminos = ['Blando', 'Medio', 'Dorado'].map((nombre, i) => ({ id: i + 1, nombre }));
  assert.deepEqual(terminosCategoria('Tacos', terminos), terminos);
  assert.deepEqual(terminosCategoria('Tacos Dorados', terminos).map(t => t.nombre), ['Blando', 'Medio']);
  for (const categoria of ['Sopes', 'Hamburguesas', 'Carnes', 'Bebidas']) assert.deepEqual(terminosCategoria(categoria, terminos), []);
  assert.equal(terminos.length, 3, 'El catálogo original conserva Dorado');
});

test('el borrador recupera el MIX activo, incluso vacío, y respeta pedidos antiguos', () => {
  const almacen = new Map();
  globalThis.localStorage = {
    getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v),
    removeItem: (k) => almacen.delete(k), key: (i) => [...almacen.keys()][i], get length() { return almacen.size; },
  };
  guardarBorrador(1, [], 2);
  assert.equal(leerMixActivo(1), 2);
  const lineas = [{ cantidad: 2, mixGrupo: 2 }, { cantidad: 1, mixGrupo: null }];
  guardarBorrador(1, lineas, 2);
  assert.deepEqual(leerBorrador(1), lineas);
  assert.equal(piezasSinEnviar(1), 3);
  assert.equal(leerMixActivo(99), null, 'Otra orden conserva su estado independiente');
  guardarBorrador(1, [], null);
  assert.equal(leerMixActivo(1), null);
  assert.equal(almacen.size, 0);
  almacen.set('pedido_borrador_3', JSON.stringify({ lineas: [{ cantidad: 1 }], guardado: Date.now() }));
  assert.equal(leerMixActivo(3), null);
  assert.equal(piezasSinEnviar(3), 1);
  guardarBorrador(9, [], null, [{ id:1, descripcion:'Cargo libre', importe:12.5 }]);
  assert.equal(piezasSinEnviar(9), 1);
  assert.deepEqual(leerExtrasBorrador(9), [{ id:1, descripcion:'Cargo libre', importe:12.5 }]);
  guardarBorrador(9, []);
  assert.deepEqual(leerExtrasBorrador(9), []);
});

test('complementos se ordenan alfabéticamente en español sin modificar el catálogo', () => {
  const original = ['Salsa verde','Queso','Cebolla','Aderezo','Jitomate'].map(nombre=>({nombre}));
  assert.deepEqual(ordenarComplementos(original).map(c=>c.nombre), ['Aderezo','Cebolla','Jitomate','Queso','Salsa verde']);
  assert.equal(original[0].nombre, 'Salsa verde');
});

test('ticket de cocina: complementos en los menos renglones posibles', () => {
  const [crema, lechuga, queso, salsa] = ['Crema', 'Lechuga', 'Queso', 'Salsa'].map((nombre, i) => ({ id: i + 1, nombre }));
  const todos = [crema, lechuga, queso, salsa];
  assert.deepEqual(complementosTicket(todos, []), ['CON TODO']);
  // Sin nada: no se lista cada uno ni sale SIN QUESO aparte.
  assert.deepEqual(complementosTicket(todos, todos, { sinQueso: true }), ['SIN NADA']);
  // Solo uno (o menos de los que se quitaron): se dice lo que sí lleva.
  assert.deepEqual(complementosTicket(todos, [crema, lechuga, salsa], { conQueso: true }), ['SOLO CON QUESO']);
  assert.deepEqual(complementosTicket([...todos, { id: 5, nombre: 'Cebolla' }], [crema, lechuga, { id: 5, nombre: 'Cebolla' }]), ['SOLO CON QUESO Y SALSA']);
  // Quitan pocos: lo que no quiere, en un renglón; SIN QUESO y CON QUESO aparte.
  assert.deepEqual(complementosTicket(todos, [lechuga]), ['Sin lechuga']);
  assert.deepEqual(complementosTicket(todos, [crema, lechuga], { conQueso: true }), ['CON QUESO', 'Sin crema ni lechuga']);
  assert.deepEqual(complementosTicket(todos, [queso, salsa], { sinQueso: true }), ['SIN QUESO', 'Sin salsa']);
  // Sin complementos: nada; sin queso cuando el queso no se puede elegir: aparte, como antes.
  assert.deepEqual(complementosTicket([], []), []);
  assert.deepEqual(complementosTicket([crema, salsa], [], { sinQueso: true }), ['SIN QUESO', 'CON TODO']);
});

test('tacos: el queso no va de base; solo se imprime si lo piden', () => {
  const [cebolla, cilantro, queso, salsa] = ['Cebolla', 'Cilantro', 'Queso', 'Salsa'].map((nombre, i) => ({ id: i + 1, nombre }));
  const taco = [cebolla, cilantro, queso, salsa];
  // Como sale de la pantalla: sin queso de base (está entre los quitados) y sin decir SIN QUESO.
  assert.deepEqual(complementosTicketQuesoOpcional(taco, [queso], false), ['CON TODO']);
  assert.deepEqual(complementosTicketQuesoOpcional(taco, [queso, cilantro], false), ['Sin cilantro']);
  assert.deepEqual(complementosTicketQuesoOpcional(taco, [queso, cebolla, cilantro, salsa], false), ['SIN NADA']);
  // Con queso pedido.
  assert.deepEqual(complementosTicketQuesoOpcional(taco, [], true), ['CON TODO Y QUESO']);
  assert.deepEqual(complementosTicketQuesoOpcional(taco, [cilantro], true), ['CON QUESO', 'Sin cilantro']);
  assert.deepEqual(complementosTicketQuesoOpcional(taco, [cebolla, cilantro], true), ['SOLO CON SALSA Y QUESO']);
  assert.deepEqual(complementosTicketQuesoOpcional(taco, [cebolla, cilantro, salsa], true), ['SOLO CON QUESO']);
});
