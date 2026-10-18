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

## App de la tableta

Abre `/tablet` desde la dirección de esta PC en la red local. En el acceso de
**Meseros**, el botón **Instalar app de meseros** usa el manifiesto de la tableta
y arranca en `/tablet`. Elegir Meseros o Caja cambia de pantalla sin recargar
el documento, para conservar la ventana de la app y la pantalla completa.
En dispositivos táctiles abiertos como acceso directo del navegador, el primer
toque activa la pantalla completa cuando el navegador lo permite. La instalación
PWA requiere un origen seguro (HTTPS o localhost); una IP local con HTTP puede
abrirse como acceso directo.

## Impresión de tickets en Windows

El agente corre en la PC donde está conectada la impresora. Lee el `.env` de la
raíz y recibe los tickets del backend:

```powershell
node print-agent/agente.mjs
```

Para una **Axiohm APOS2101 / APOS Premium por USB**, ejecuta desde PowerShell
como administrador, en la raíz del proyecto:

```powershell
.\print-agent\instalar-axiohm.ps1
```

El instalador identifica su puerto USB y registra la cola `Axiohm APOS2101`
con el controlador `Generic / Text Only` de Microsoft incluido en Windows x64.
Puedes configurar una selección inicial en el `.env` y reiniciar el agente:

```dotenv
IMPRESORA_TICKETS=Axiohm APOS2101
```

Para esta impresora, el agente convierte el mismo diseño de tickets, incluido
el logo y los acentos, a gráficos ESC/POS de 576 puntos (72 mm imprimibles)
y envía el trabajo RAW con corte parcial.

En **Tablet → Impresoras de tickets**, cada impresora tiene los botones
**Asignar a cocina** y **Asignar a caja**. Los pedidos se envían a cocina;
los cobros, reimpresiones de cobro y cortes se envían a caja. Las asignaciones
se guardan en `print-agent/data/asignaciones.json` en la PC de las impresoras,
se comparten con todos los dispositivos y se conservan al reiniciar el agente.
Cada impresora puede asignarse a un solo destino. Al cambiarla de cocina a caja
o de caja a cocina, se desmarca su destino anterior y este queda sin asignar
hasta elegir otra impresora. Si una impresora asignada se desconecta,
se informa el error y se conserva su asignación.

Los botones **Probar cocina** y **Probar caja** envían un ticket al destino
correspondiente. Para verificar los destinos y su persistencia:

```powershell
node --test print-agent/test/asignaciones.test.mjs
npm --prefix backend run test:impresion
```

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
