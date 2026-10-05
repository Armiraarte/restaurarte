import express from 'express';
import { config } from './config.js';
import { authRouter } from './auth.js';
import { inicializarUsuarios } from './usuarios.js';

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);

await inicializarUsuarios();

app.listen(config.port, () => {
  console.log(`[backend] API escuchando en http://localhost:${config.port}`);
});
