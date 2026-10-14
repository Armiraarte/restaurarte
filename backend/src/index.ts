import express from 'express';
import { config } from './config.js';
import { authRouter } from './auth.js';
import { impresionRouter } from './impresion.js';
import { inicializarUsuarios } from './usuarios.js';
import { usuariosRouter } from './usuariosRouter.js';
import { tabletsRouter } from './tablets.js';
import { mesasRouter } from './mesas.js';
import { turnosRouter } from './turnos.js';
import { pedidosRouter } from './pedidos.js';
import { avisarCambios, eventosRouter } from './eventos.js';

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Avisos en vivo (antes de pedidosRouter, que pide el token en el header para todo /api).
app.use('/api/eventos', eventosRouter);
app.use('/api/auth', authRouter);
app.use('/api/impresion', impresionRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/tablets', tabletsRouter);
// Cada escritura que sale bien avisa a todas las pantallas para que se actualicen solas.
app.use('/api/mesas', avisarCambios('ordenes'), mesasRouter);
app.use('/api/turnos', avisarCambios('turno', 'ordenes'), turnosRouter);
app.use('/api', avisarCambios('ordenes'), pedidosRouter);

await inicializarUsuarios();

app.listen(config.port, () => {
  console.log(`[backend] API escuchando en http://localhost:${config.port}`);
});
