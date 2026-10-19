import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { eventosDisponibilidadTablets } from '../src/disponibilidadTablets.ts';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'disponibilidad-tablets-'));
const { abrirSesionTablet, liberarSesionTablet, cerrarSesionesTablet, sesionEnUso } = await import('../src/sesionesTablet.ts');

test('los cinco selectores reciben al momento qué tablet se tomó o quedó libre, sin sesión ni sondeo', async (t) => {
  const servidor = http.createServer(eventosDisponibilidadTablets);
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const peticiones = [];
  t.after(() => {
    peticiones.forEach((p) => p.destroy());
    servidor.closeAllConnections();
    servidor.close();
  });
  const conectar = () => new Promise((resolve, reject) => {
    const peticion = http.get(`http://127.0.0.1:${servidor.address().port}`, (res) => {
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['x-accel-buffering'], 'no');
      let pendiente = '', abierto = false;
      const oyentes = [];
      res.setEncoding('utf8');
      res.on('data', (parte) => {
        pendiente += parte;
        let fin;
        while ((fin = pendiente.indexOf('\n\n')) >= 0) {
          const mensaje = pendiente.slice(0, fin);
          pendiente = pendiente.slice(fin + 2);
          if (!abierto && mensaje.startsWith('retry:')) {
            abierto = true;
            resolve({ siguiente: () => new Promise((resolver, rechazar) => {
              const limite = setTimeout(() => rechazar(new Error('El selector no recibió el cambio en un segundo.')), 1000);
              oyentes.push((valor) => { clearTimeout(limite); resolver(valor); });
            }) });
          }
          if (mensaje.startsWith('data:')) oyentes.shift()?.(JSON.parse(mensaje.slice(5)));
        }
      });
    });
    peticion.on('error', reject);
    peticiones.push(peticion);
  });
  const selectores = await Promise.all(Array.from({ length: 5 }, conectar));
  const avisos = () => Promise.all(selectores.map((s) => s.siguiente()));
  for (let numero = 1; numero <= 5; numero++) {
    const cambios = avisos();
    const sid = abrirSesionTablet(`tablet-${numero}`);
    assert.ok(sid);
    assert.equal(sesionEnUso(`tablet-${numero}`), true);
    assert.equal(abrirSesionTablet(`tablet-${numero}`), null, 'Otra tablet no puede tomar la misma sesión.');
    assert.deepEqual(await cambios, Array.from({ length: 5 }, () => ({ tipo: 'disponibilidad' })));
    const liberacion = avisos();
    liberarSesionTablet(`tablet-${numero}`, sid);
    assert.equal(sesionEnUso(`tablet-${numero}`), false);
    await liberacion;
  }
  const nueva = avisos();
  abrirSesionTablet('tablet-1');
  await nueva;
  const corte = avisos();
  assert.deepEqual(cerrarSesionesTablet(), ['tablet-1']);
  await corte;
});
