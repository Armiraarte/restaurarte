-- PostgreSQL: ejecutar una sola vez en una base vacía.
BEGIN;

CREATE TABLE usuarios (
  id text PRIMARY KEY,
  usuario text NOT NULL CHECK (btrim(usuario) <> ''),
  nombre text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin', 'cajero', 'mesero', 'cocina', 'tablet')),
  password_hash text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_nombre_unico ON usuarios (lower(btrim(usuario)));

CREATE TABLE mesas (
  id text PRIMARY KEY,
  nombre text NOT NULL CHECK (btrim(nombre) <> ''),
  activa boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX mesas_nombre_unico ON mesas (lower(btrim(nombre)));

CREATE TABLE tablets (
  id text PRIMARY KEY,
  numero text NOT NULL UNIQUE,
  nombre text NOT NULL,
  ubicacion text NOT NULL DEFAULT '',
  mesero_id text REFERENCES usuarios(id),
  ultima_conexion timestamptz,
  activa boolean NOT NULL DEFAULT true
);

CREATE TABLE categorias (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  posicion integer NOT NULL DEFAULT 0
);

CREATE TABLE productos (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  categoria_id bigint NOT NULL REFERENCES categorias(id),
  precio numeric(12,2) NOT NULL CHECK (precio >= 0),
  -- Conserva grupos, precios por presentación, paquetes y reparto del menú actual.
  configuracion jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(configuracion) = 'object'),
  activo boolean NOT NULL DEFAULT true
);
CREATE INDEX productos_categoria ON productos(categoria_id);

CREATE TABLE turnos (
  id text PRIMARY KEY,
  cajero_id text NOT NULL REFERENCES usuarios(id),
  abierto_en timestamptz NOT NULL DEFAULT now(),
  cerrado_en timestamptz,
  efectivo_inicial numeric(12,2) NOT NULL CHECK (efectivo_inicial >= 0),
  efectivo_contado numeric(12,2) CHECK (efectivo_contado >= 0),
  observacion_cierre text,
  CHECK (cerrado_en IS NULL OR cerrado_en >= abierto_en),
  CHECK (cerrado_en IS NULL OR efectivo_contado IS NOT NULL)
);
-- El POS actual tiene una sola caja central.
CREATE UNIQUE INDEX un_turno_abierto ON turnos ((true)) WHERE cerrado_en IS NULL;

CREATE TABLE cuentas (
  id text PRIMARY KEY,
  tipo_identificador text NOT NULL CHECK (tipo_identificador IN ('mesa', 'nombre')),
  identificador text NOT NULL CHECK (btrim(identificador) <> ''),
  mesa_id text REFERENCES mesas(id),
  mesero_id text NOT NULL REFERENCES usuarios(id),
  tablet_id text REFERENCES tablets(id),
  para_llevar boolean NOT NULL DEFAULT false,
  estado text NOT NULL DEFAULT 'abierta'
    CHECK (estado IN ('abierta', 'cuenta_solicitada', 'en_proceso_cobro', 'pagada')),
  abierta_en timestamptz NOT NULL DEFAULT now(),
  solicitada_en timestamptz,
  CHECK ((tipo_identificador = 'mesa' AND mesa_id IS NOT NULL)
    OR (tipo_identificador = 'nombre' AND mesa_id IS NULL))
);
CREATE UNIQUE INDEX mesa_cuenta_activa ON cuentas(mesa_id) WHERE estado <> 'pagada';
CREATE UNIQUE INDEX identificador_cuenta_activa ON cuentas(lower(btrim(identificador))) WHERE estado <> 'pagada';

CREATE TABLE pedidos (
  id text PRIMARY KEY,
  numero bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  cuenta_id text NOT NULL REFERENCES cuentas(id),
  tablet_id text REFERENCES tablets(id),
  mesero_id text NOT NULL REFERENCES usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  estado text NOT NULL DEFAULT 'enviada' CHECK (estado IN ('enviada', 'en_cocina', 'lista', 'entregada'))
);
CREATE INDEX pedidos_cuenta ON pedidos(cuenta_id);

CREATE TABLE comandas (
  id text PRIMARY KEY,
  pedido_id text NOT NULL UNIQUE REFERENCES pedidos(id),
  para_llevar boolean NOT NULL DEFAULT false,
  estado text NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'preparando', 'lista', 'entregada')),
  notas text,
  enviada_en timestamptz NOT NULL DEFAULT now(),
  preparada_en timestamptz,
  lista_en timestamptz,
  entregada_en timestamptz
);
CREATE INDEX comandas_estado ON comandas(estado);

CREATE TABLE partidas (
  id text PRIMARY KEY,
  pedido_id text NOT NULL REFERENCES pedidos(id),
  producto_id text REFERENCES productos(id),
  -- Copias históricas: cambiar el menú no modifica pedidos anteriores.
  nombre_producto text NOT NULL,
  categoria text NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(12,2) NOT NULL CHECK (precio_unitario >= 0),
  total numeric(14,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  modificadores jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(modificadores) = 'array'),
  seleccion jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(seleccion) = 'object'),
  notas text,
  creada_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partidas_pedido ON partidas(pedido_id);

CREATE TABLE pagos (
  id text PRIMARY KEY,
  numero_ticket bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  cuenta_id text NOT NULL UNIQUE REFERENCES cuentas(id),
  turno_id text NOT NULL REFERENCES turnos(id),
  cajero_id text NOT NULL REFERENCES usuarios(id),
  pagado_en timestamptz NOT NULL DEFAULT now(),
  metodo text NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta', 'transferencia', 'mixto')),
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  impuesto numeric(12,2) NOT NULL CHECK (impuesto >= 0),
  total numeric(12,2) NOT NULL CHECK (total > 0),
  efectivo numeric(12,2) NOT NULL DEFAULT 0 CHECK (efectivo >= 0),
  tarjeta numeric(12,2) NOT NULL DEFAULT 0 CHECK (tarjeta >= 0),
  transferencia numeric(12,2) NOT NULL DEFAULT 0 CHECK (transferencia >= 0),
  efectivo_recibido numeric(12,2),
  cambio numeric(12,2),
  referencia_tarjeta text,
  referencia_transferencia text,
  ticket jsonb NOT NULL CHECK (jsonb_typeof(ticket) = 'object'),
  CHECK (subtotal + impuesto = total),
  CHECK (efectivo + tarjeta + transferencia = total),
  CHECK ((metodo = 'efectivo' AND efectivo = total)
    OR (metodo = 'tarjeta' AND tarjeta = total)
    OR (metodo = 'transferencia' AND transferencia = total)
    OR (metodo = 'mixto' AND
      (CASE WHEN efectivo > 0 THEN 1 ELSE 0 END +
       CASE WHEN tarjeta > 0 THEN 1 ELSE 0 END +
       CASE WHEN transferencia > 0 THEN 1 ELSE 0 END) >= 2)),
  CHECK ((efectivo > 0 AND efectivo_recibido IS NOT NULL AND cambio IS NOT NULL
      AND efectivo_recibido >= efectivo AND cambio = efectivo_recibido - efectivo)
    OR (efectivo = 0 AND efectivo_recibido IS NULL AND cambio IS NULL))
);
CREATE INDEX pagos_turno ON pagos(turno_id);
CREATE INDEX pagos_fecha ON pagos(pagado_en);

COMMIT;
