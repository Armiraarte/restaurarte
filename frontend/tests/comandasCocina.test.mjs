import assert from 'node:assert/strict';
import test from 'node:test';
import { agruparMesasCocina, construirComandasCocina, seccionOrdenCocina } from '../src/services/comandasCocina.ts';
import { formatoProductoCocina } from '../src/services/formatoProductoCocina.ts';

const orden = { idOrden: 25, nombre: '3', etiqueta: 'Mesa 3', tipo_orden: 2, abierta_por: 'Tablet 01' };
const fila = (id, fecha, datos = {}) => ({ idDetalle_Orden: id, idProducto: 1, nombre: 'Frijol', categoria: 'Quesadillas', tamano: null,
  cantidad: 2, sin_queso: false, con_queso: false, carne_extra: 0, mix_grupo: null, termino: null,
  opciones: { sin: [], mezcla: [] }, creado_en: fecha, ...datos });
const a = '2026-10-24T18:00:00.000Z', b = '2026-10-24T18:01:00.000Z', c = '2026-10-24T18:02:00.000Z';

test('cocina: agrupa cuentas de la misma mesa y ordena números y nombres naturalmente', () => {
  const grupos = agruparMesasCocina([
    { id: 1, nombre: '10' }, { id: 2, nombre: 'Zoe' }, { id: 3, nombre: '2' },
    { id: 4, nombre: 'Ángel' }, { id: 5, nombre: '2' },
  ]);
  assert.deepEqual(grupos.map((g) => g.etiqueta), ['Mesa 2', 'Mesa 10', 'Ángel', 'Zoe']);
  assert.deepEqual(grupos[0].ordenes.map((o) => o.id), [3, 5]);
});

test('cocina: separa envíos, conserva su consecutivo y excluye bebidas del papel de cocina', () => {
  const detalles = [fila(3, c), fila(1, a, { categoria: 'Bebidas', nombre: 'Pepsi' }), fila(2, b)];
  const extras = [{ id: 1, creado_en: c, descripcion: 'Servicio extra', importe: 10 }];
  const tickets = construirComandasCocina(orden, detalles, extras, []);
  assert.deepEqual(tickets.map((t) => [t.ronda, t.orden_cocina, t.productos.map((p) => p.partida_id)]), [
    [2, '#00025-2', ['2']], [3, '#00025-3', ['3']],
  ]);
  assert.equal(tickets[0].mesa, 'Mesa 3');
  assert.equal(tickets[0].para_llevar, true);
  assert.equal(tickets[1].extras[0].importe, 10);
  assert.equal(detalles.length, 3);
});

test('mesas, llamadas y nombres quedan separados aunque tengan el mismo nombre o sean para llevar', () => {
  const grupos = agruparMesasCocina([
    { id: 1, nombre: 'Ana', origen: 'nombre', tipo_orden: 2 },
    { id: 2, nombre: 'Ana', origen: 'llamada', tipo_orden: 1 },
    { id: 3, nombre: '2', origen: 'llamada', tipo_orden: 2 },
  ]);
  assert.equal(grupos.length, 3);
  assert.equal(grupos.find((g) => g.seccion === 'llamadas').ordenes[0].id, 2);
  assert.equal(grupos.find((g) => g.seccion === 'nombres').ordenes[0].id, 1);
  assert.equal(grupos.find((g) => g.seccion === 'mesas').ordenes[0].id, 3);
  assert.equal(seccionOrdenCocina({ nombre: 'Cliente anterior', tipo_orden: 2 }), 'nombres');
});

test('cocina: al reimprimir desglosa las mixtas y conserva MIX, notas, término, papas y complementos del envío', () => {
  const ofrecidos = [{ id: 1, nombre: 'Crema' }, { id: 2, nombre: 'Salsa' }, { id: 3, nombre: 'Cebolla' }];
  const ticket = construirComandasCocina(orden, [fila(1, a, {
    nombre: 'Nombre editado después', mix_grupo: 7, termino: 'Medio', carne_extra: 1,
    opciones: { sin: [ofrecidos[2]], mezcla: [], reparto: [{ nombre: 'Papa', cantidad: 1 }, { nombre: 'Frijol', cantidad: 1 }],
      papas: { idProducto: 47 }, nota: 'Partida a la mitad', complementosExtra: [ofrecidos[0]],
      comanda: { origen: 'Tablet 02', producto: { nombre: 'Frijol', tamano: null, categoria: 'Quesadillas' }, ofrecidos } },
  })], [], [])[0];
  assert.equal(ticket.tablet, 'Tablet 02');
  assert.equal(ticket.productos[0].nombre, 'Quesadillas · MIXTAS');
  assert.deepEqual(formatoProductoCocina(ticket.productos[0]).renglones, [{ cantidad: 1, nombre: 'Q PAPA' }, { cantidad: 1, nombre: 'Q FRIJ' }]);
  assert.equal(ticket.productos[0].mix_grupo, 7);
  assert.deepEqual(ticket.productos[0].descripcion, ['1 Papa', '1 Frijol', 'MEDIO', 'DOBLE CARNE', 'CON PAPAS', 'SIN CEBOLLA', 'EXTRA CREMA']);
  assert.equal(ticket.productos[0].notas, 'Partida a la mitad');
  assert.equal(ticket.total_piezas, 2);
});

test('cocina: reimprime envíos de solo extras y reconstruye pedidos anteriores sin copia del menú', () => {
  const tickets = construirComandasCocina(orden, [fila(1, a, { con_queso: true,
    categoria: 'Tacos', opciones: { sin: [{ id: 1, nombre: 'Cebolla' }], mezcla: [] },
  })], [{ id: 1, creado_en: b, descripcion: 'Extra manual', importe: 7 }], []);
  assert.equal(formatoProductoCocina(tickets[0].productos[0]).renglones[0].nombre, 'T FRIJOL Q');
  assert.deepEqual(formatoProductoCocina(tickets[0].productos[0]).descripcion, ['SIN CEBOLLA']);
  assert.equal(tickets[1].productos.length, 0);
  assert.deepEqual(tickets[1].extras, [{ descripcion: 'Extra manual', importe: 7 }]);
  assert.equal(tickets[1].ronda, 2);
});

test('la Q identifica el queso incluido, agregado o extra, excepto en hamburguesas', () => {
  const queso = { id: 1, nombre: 'Queso' }, cebolla = { id: 2, nombre: 'Cebolla' };
  for (const categoria of ['Tacos Dorados', 'Quesadillas', 'Sopes', 'Enchiladas', 'Tostadas', 'Burritas', 'Lonches', 'Hamburguesas', 'Ensaladas', 'Salchichas', 'Carnes']) {
    const p = construirComandasCocina(orden, [fila(1, a, { categoria,
      opciones: { sin: [cebolla], mezcla: [], comanda: { producto: { nombre: 'Pollo', tamano: null, categoria }, ofrecidos: [queso, cebolla] } },
    })], [], [])[0].productos[0];
    const esperado = categoria === 'Hamburguesas' ? 'POLLO' : 'POLLO Q';
    assert.ok(formatoProductoCocina(p).renglones[0].nombre.toUpperCase().endsWith(esperado), categoria);
    assert.deepEqual(p.descripcion, ['SIN CEBOLLA']);
    assert.equal(p.nombre, `${categoria} · Pollo`, 'Conserva el nombre original del producto');
  }
  const extra = construirComandasCocina(orden, [fila(1, a, { categoria: 'Tacos',
    opciones: { sin: [], mezcla: [], complementosExtra: [queso] },
  })], [], [])[0].productos[0];
  assert.equal(formatoProductoCocina(extra).renglones[0].nombre, 'T FRIJOL Q');
  assert.deepEqual(formatoProductoCocina(extra).descripcion, ['EXTRA QUESO']);
});

test('sin queso y tacos con todo no agregan Q; el producto de queso sí la lleva', () => {
  const queso = { id: 1, nombre: 'Queso' };
  const menu = [{ nombre: 'Tacos', productos: [{ id: 1, nombre: 'Frijol', tamano: null, complementos: [queso] }] }];
  for (const cambios of [{ categoria: 'Tacos' }, { sin_queso: true }, { opciones: { sin: [queso], mezcla: [] } }]) {
    const p = construirComandasCocina(orden, [fila(1, a, cambios)], [], menu)[0].productos[0];
    assert.ok(!formatoProductoCocina(p).renglones[0].nombre.endsWith(' Q'));
  }
  const p = construirComandasCocina(orden, [fila(1, a, { nombre: 'Queso' })], [], [])[0].productos[0];
  assert.equal(formatoProductoCocina(p).renglones[0].nombre, 'Q Q');
  const mixta = construirComandasCocina(orden, [fila(1, a, {
    opciones: { sin: [], mezcla: ['Queso', 'Frijol'], reparto: [{ nombre: 'Queso', cantidad: 1 }, { nombre: 'Frijol', cantidad: 1 }] },
  })], [], [])[0].productos[0];
  assert.deepEqual(formatoProductoCocina(mixta).renglones, [{ cantidad: 1, nombre: 'Q Q' }, { cantidad: 1, nombre: 'Q FRIJ' }]);
});
