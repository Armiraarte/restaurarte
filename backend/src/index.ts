import express from 'express';
import { config } from './config.js';
import { authRouter } from './auth.js';
import { impresionRouter } from './impresion.js';
import { inicializarUsuarios } from './usuarios.js';
import { usuariosRouter } from './usuariosRouter.js';
import { tabletsRouter } from './tablets.js';

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/impresion', impresionRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/tablets', tabletsRouter);

await inicializarUsuarios();

app.listen(config.port, () => {
  console.log(`[backend] API escuchando en http://localhost:${config.port}`);
});
