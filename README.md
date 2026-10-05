# POS Caja Central — Sistema de Restaurante

Sistema de caja para restaurante: cuentas abiertas, comandas, cocina (KDS), tablets y turnos de caja.

## Estructura

```
.
├── backend/              API (Node + Express + TypeScript)
│   ├── src/
│   │   ├── index.ts      Arranque del servidor
│   │   ├── config.ts     Variables de entorno
│   │   ├── auth.ts       Login (JWT) y middleware requireAuth
│   │   └── usuarios.ts   Usuarios (en memoria por ahora)
│   └── Dockerfile
├── frontend/             App web (React + Vite + Tailwind)
│   ├── src/
│   │   ├── componentes/  Todos los componentes de la interfaz
│   │   ├── services/     authService (login) y dataService (datos del POS)
│   │   └── types/
│   ├── nginx.conf        Sirve la app y reenvía /api al backend
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Instalación con Docker (recomendado)

Requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env
# Edita .env: cambia JWT_SECRET (openssl rand -hex 32) y ADMIN_PASSWORD
docker compose up -d --build
```

Abre http://localhost:8080 e ingresa con `ADMIN_USUARIO` / `ADMIN_PASSWORD`.

Comandos útiles:

```bash
docker compose logs -f        # ver logs
docker compose down           # detener
docker compose up -d --build  # reconstruir tras cambios
```

## Desarrollo local (sin Docker)

Requisitos: Node.js 24+.

```bash
# Terminal 1 — backend (http://localhost:4000)
cd backend
npm install
npm run dev

# Terminal 2 — frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```

En desarrollo, Vite reenvía `/api` a `http://localhost:4000`. El backend lee el `.env` de la raíz; si no existe, el usuario es `admin` / `admin123`.

## API

| Método | Ruta              | Descripción                                   |
| ------ | ----------------- | --------------------------------------------- |
| GET    | `/api/health`     | Estado del servidor                           |
| POST   | `/api/auth/login` | `{ usuario, password }` → `{ token, usuario }` |
| GET    | `/api/auth/me`    | Usuario de la sesión (header `Authorization: Bearer <token>`) |

## Estado actual

- El login ya pasa por el backend.
- Los datos del POS (cuentas, comandas, turnos…) siguen en el navegador (`localStorage`) mediante `frontend/src/services/dataService.ts`. El siguiente paso es moverlos al backend con una base de datos.
