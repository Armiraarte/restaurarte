import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

/** Copia de consulta para todas las pantallas; las asignaciones reales siguen en la PC de las impresoras. */
export class EstadoImpresorasGuardado {
  private estado: Record<string, any> | null = null;
  private ultimaProgramada = '';
  private cola = Promise.resolve();
  constructor(private archivo: string) {
    try {
      const guardado = JSON.parse(readFileSync(archivo, 'utf8'));
      if (Array.isArray(guardado.impresoras) && guardado.asignaciones) {
        this.estado = guardado;
        this.ultimaProgramada = JSON.stringify(guardado);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.error('[impresoras] No se pudo leer la configuración guardada.');
    }
  }

  async registrar(equipo: string | null, datos: Record<string, any>) {
    if (!Array.isArray(datos.impresoras)) return;
    const impresoras = datos.impresoras.filter((i: any) => typeof i?.nombre === 'string').map((i: any) => ({
      nombre: i.nombre, driver: String(i.driver ?? ''), puerto: String(i.puerto ?? ''),
      usb: !!i.usb, conectada: !!i.conectada, predeterminada: !!i.predeterminada,
    }));
    const asignaciones = {
      cocina: typeof datos.asignaciones?.cocina === 'string' ? datos.asignaciones.cocina : null,
      caja: typeof datos.asignaciones?.caja === 'string' ? datos.asignaciones.caja : datos.asignaciones ? null : datos.ticket?.nombre ?? null,
    };
    const siguientes = { equipo, impresoras, asignaciones };
    this.estado = siguientes;
    const clave = JSON.stringify(siguientes);
    if (this.ultimaProgramada === clave) return;
    this.ultimaProgramada = clave;
    const contenido = JSON.stringify(siguientes, null, 2);
    const guardar = this.cola.then(async () => {
      await mkdir(path.dirname(this.archivo), { recursive: true });
      await writeFile(`${this.archivo}.tmp`, `${contenido}\n`, { mode: 0o600 });
      await rename(`${this.archivo}.tmp`, this.archivo);
    });
    this.cola = guardar.catch(() => {
      console.error('[impresoras] No se pudo guardar la copia de la configuración.');
      if (this.ultimaProgramada === clave) this.ultimaProgramada = '';
    });
    await this.cola;
  }

  sinConexion(error: string, equipo?: string | null) {
    const guardado = equipo && this.estado?.equipo && equipo !== this.estado.equipo ? null : this.estado;
    if (!guardado) return { agente: false, equipo: equipo ?? null, error };
    const impresoras = guardado.impresoras.map((i: any) => ({ ...i, conectada: false }));
    const destinos = Object.fromEntries(['cocina', 'caja'].map((d) => [d, impresoras.find((i: any) => i.nombre === guardado.asignaciones[d]) ?? null]));
    return { ...guardado, agente: false, configuracionConservada: true, impresoras, destinos, ticket: destinos.caja, error };
  }

  equipo(): string | null { return this.estado?.equipo ?? null; }
}

export const estadoImpresorasGuardado = new EstadoImpresorasGuardado(path.join(config.dataDir, 'estado-impresoras.json'));
