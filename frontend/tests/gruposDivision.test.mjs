import assert from 'node:assert/strict';
import test from 'node:test';
import { unidadesDeCuenta } from '../src/services/dividirCuenta.ts';
import { agruparPiezas, alternarGrupo, estadoGrupo } from '../src/services/gruposDivision.ts';

// Orden: un MIX (Sopes Papa + Sopes Frijol con extra queso), 3 tacos, unas alitas MIXTAS y un extra suelto.
const renglones = [
  { clave: '10', nombre: 'Papa', detalle: 'Sopes', cantidad: 1, subtotal: 15, mixGrupo: 1, titulo: 'Sopes · Papa' },
  { clave: '11', nombre: 'Pierna', detalle: 'Tacos', cantidad: 3, subtotal: 54, mixGrupo: null, titulo: 'Tacos · Pierna' },
  { clave: '12', nombre: 'Frijol', detalle: 'Sopes', cantidad: 1, subtotal: 15, mixGrupo: 1, titulo: 'Sopes · Frijol' },
  { clave: '13', nombre: '4 BBQ + 6 Buffalo', detalle: 'Alitas', cantidad: 10, subtotal: 130, mixGrupo: null, titulo: 'Alitas · 4 BBQ + 6 Buffalo',
    reparto: [{ nombre: 'BBQ', cantidad: 4, precio: 13 }, { nombre: 'Buffalo', cantidad: 6, precio: 13 }] },
];
const extras = [
  { clave: '5', descripcion: 'Desechables', importe: 5, mixGrupo: null, titulo: 'Desechables' },
  { clave: '4', descripcion: 'Extra queso', importe: 10, mixGrupo: 1, titulo: 'Extra queso' },
];
const piezas = unidadesDeCuenta(renglones, extras);
const grupos = agruparPiezas(piezas, renglones, extras);

test('los platillos salen como se pidieron: el MIX junto con su extra, las MIXTAS y los tacos juntos', () => {
  assert.deepEqual(grupos.map((g) => [g.clave, g.titulo, g.piezas.length, g.centavos]), [
    ['mix-1', 'Sopes · Papa + Sopes · Frijol', 3, 4000],
    ['renglon-11', 'Tacos · Pierna', 3, 5400],
    ['renglon-13', 'Alitas · 4 BBQ + 6 Buffalo', 10, 13000],
    ['extra-5', 'Desechables', 1, 500],
  ]);
  assert.equal(grupos[0].mix, true);
  assert.deepEqual(grupos[0].piezas.map((p) => p.clave), ['10-0', '12-0', 'extra-4']);
  assert.deepEqual(grupos[2].piezas.map((p) => p.nombre), [...Array(4).fill('BBQ'), ...Array(6).fill('Buffalo')]);
  assert.equal(grupos.reduce((acc, g) => acc + g.piezas.length, 0), piezas.length, 'No se pierde ni se repite ninguna pieza');
});

test('un toque da el platillo completo; si lo comparten, cada quien toma sus piezas', () => {
  const claves = grupos[0].piezas.map((p) => p.clave);
  const persona1 = alternarGrupo({}, claves, 0);
  assert.deepEqual(persona1, { '10-0': 0, '12-0': 0, 'extra-4': 0 });
  assert.deepEqual(estadoGrupo(persona1, claves), { dueno: 0, personas: 1, libres: 0 });
  assert.deepEqual(alternarGrupo(persona1, claves, 1), persona1, 'Otra persona no se lo quita');
  assert.deepEqual(alternarGrupo(persona1, claves, 0), {}, 'Tocarlo otra vez lo libera');

  // Compartido: la Persona 2 ya tomó un sope; el toque de la Persona 1 se lleva solo lo que sigue libre.
  const compartido = alternarGrupo({ '12-0': 1 }, claves, 0);
  assert.deepEqual(compartido, { '12-0': 1, '10-0': 0, 'extra-4': 0 });
  assert.deepEqual(estadoGrupo(compartido, claves), { dueno: null, personas: 2, libres: 0 });
  assert.deepEqual(alternarGrupo(compartido, claves, 0), { '12-0': 1 }, 'Sin libres, la Persona 1 suelta solo las suyas');
});
