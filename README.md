# POS Caja Central — Sistema de Restaurante

Sistema de caja para restaurante: cuentas abiertas, comandas, cocina (KDS), tablets y turnos de caja.

## Estructura

```
.
├── backend/              API Node y Laravel para la base MySQL
│   ├── app/              Modelos Eloquent y comandos Laravel
│   ├── database/         Migraciones y seeders como clases PHP
│   ├── artisan           CLI de Laravel (artisan.ps1 en Windows)
│   ├── src/
│   │   ├── index.ts      Arranque del servidor
│   │   ├── config.ts     Variables de entorno
│   │   ├── auth.ts       Login (JWT) y middleware requireAuth
│   │   └── usuarios.ts   Usuarios guardados en JSON
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

## Construcción de la base de datos

Laravel está instalado en `backend/` para crear la base MySQL, definir tablas con
migraciones, representarlas con modelos Eloquent y cargar seeders como clases PHP.
Consulta [backend/database/README.md](backend/database/README.md) para configurar
la conexión y trabajar desde Windows:

```powershell
cd backend
.\artisan.ps1 db:create
# Después de definir las tablas:
.\artisan.ps1 migrate
.\artisan.ps1 db:seed
```

El servidor MySQL está en `2.25.84.101:3306`; la base del proyecto es
`restaurante_diablillos` y phpMyAdmin está disponible en
http://2.25.84.101:8080/. La tabla `usuarios` está creada mediante una migración
de Laravel, con el modelo `Usuario` y un seeder para el administrador inicial.
`db:create` conserva la base si ya existe.
