import assert from 'node:assert/strict';
import test from 'node:test';
import { extrasValidos, guardarExtrasPedido, recalcularTotalOrden } from '../src/extrasPedido.ts';
import { lineasTicketCobro } from '../src/ticketCobro.ts';
import { lineasTicketCocina, validarTicketCocina } from '../src/ticketCocina.ts';

test('valida cobros libres y rechaza importes negativos, fracciones de centavo y descripciones vacías', () => {
  assert.equal(extrasValidos([{ descripcion: 'Servicio adicional', importe: 12.5 }, { descripcion: 'Otro', importe: 0.01 }]), true);
  for (const e of [null, { descripcion: '', importe: 10 }, { descripcion: ' ', importe: 10 }, { descripcion: 'Extra', importe: 0 }, { descripcion: 'Extra', importe: -10 }, { descripcion: 'Extra', importe: 1.001 }, { descripcion: 'Extra', importe: '10' }, { descripcion: 'Extra', importe: Infinity }]) {
    assert.equal(extrasValidos([e]), false);
  }
});

test('guarda extras sin crear productos y recalcula total con productos más cargos', async () => {
  const sql = [];
  const conexion = { async execute(consulta, valores) { sql.push({ consulta, valores }); return [{ insertId: sql.length }]; } };
  const fecha = new Date('2026-10-18T20:00:00Z');
  const guardados = await guardarExtrasPedido(conexion, 7, [{ descripcion: '  Cargo   adicional ', importe: 10.25 }, { descripcion: 'Empaque', importe: 0.1 }], fecha);
  await recalcularTotalOrden(conexion, 7, fecha);
  assert.ok(sql.slice(0,2).every(s => s.consulta.startsWith('INSERT INTO orden_extra')));
  assert.deepEqual(sql.slice(0,2).map(s => s.valores.slice(0,3)), [[7,'Cargo adicional','10.25'],[7,'Empaque','0.10']]);
  assert.equal(guardados[0].importe, 10.25);
  assert.match(sql[2].consulta, /SUM\(subtotal\).*orden_has_detalle/s);
  assert.match(sql[2].consulta, /SUM\(importe\).*orden_extra/s);
  assert.deepEqual(sql[2].valores, [7,7,fecha,7]);
});

test('extras aparecen después de productos y antes del total; también en tickets sin productos', () => {
  const extras = [{ descripcion: 'Cargo adicional', importe: 12.5 }];
  const datos = { idOrden:7, etiqueta:'Mesa 7', paraLlevar:false, abiertaPor:'Caja', cobro:'Caja', fecha:new Date(), productos:[{ cantidad:1,nombre:'Producto',importe:20 }], extras,total:32.5,recibido:null,cambio:null };
  const cobro = lineasTicketCobro(datos);
  assert.ok(cobro.findIndex(l => l.texto === '1  Producto') < cobro.findIndex(l => l.texto === 'EXTRAS'));
  const extra = cobro.findIndex(l => l.texto === 'Cargo adicional');
  assert.equal(cobro[extra].derecha, '$12.50');
  assert.ok(extra < cobro.findIndex(l => l.texto === 'TOTAL'));
  assert.ok(lineasTicketCobro({...datos,productos:[],total:12.5}).some(l => l.texto === 'Cargo adicional'));
  const ticket = {orden_cocina:'#7-1',mesa:'Mesa 7',enviada_en:new Date().toISOString(),productos:[],extras};
  assert.equal(validarTicketCocina(ticket), null);
  assert.ok(lineasTicketCocina(ticket).some(l => l.texto === 'Cargo adicional' && l.derecha === '$12.50'));
  assert.ok(validarTicketCocina({...ticket,extras:[{descripcion:'Extra',importe:-1}]}));
});
