-- ============================================================
-- Crown Xpress Transport · 20 Point Inspection Database Schema
-- PostgreSQL (Neon) · v2.0 — Actualizado al esquema live
-- Fecha: 2026-09-10
-- ============================================================
-- Este script recrea la base de datos completa desde cero.
-- Para migrar a un nuevo servidor PostgreSQL, ejecutar:
--   psql $DATABASE_URL -f db/schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- LOCATIONS (Ubicaciones)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL UNIQUE,
    address         VARCHAR(255),
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMPLOYEES (Usuarios: guardias, supervisores, admins)
-- (Antes era "users" — renombrada para reflejar uso real)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(60) UNIQUE,
    password_hash   VARCHAR(255),
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(120),
    role            VARCHAR(20) NOT NULL DEFAULT 'operator'
                    CHECK (role IN ('operator','guard','inspector','auditor','admin','supervisor')),
    location_id     INT REFERENCES locations(id) ON DELETE SET NULL,
    location_name   VARCHAR(120),
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    profile_photo   TEXT,
    password        VARCHAR(255),
    -- bcrypt hash real (legacy: password_hash/password guardan plaintext;
    -- se eliminan cuando producción ya no las use)
    password_bcrypt VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);
CREATE INDEX IF NOT EXISTS idx_employees_role   ON employees(role);

-- ============================================================
-- SESSIONS (tokens Bearer para auth server-side)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    token           TEXT PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================
-- OPERATORS (Operadores de unidades)
-- ============================================================
CREATE TABLE IF NOT EXISTS operators (
    id              SERIAL PRIMARY KEY,
    employee_number VARCHAR(20) NOT NULL UNIQUE,
    full_name       VARCHAR(100) NOT NULL,
    license_number  VARCHAR(50),
    license_expiry  DATE,
    phone           VARCHAR(20),
    email           VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operators_employee_number ON operators(employee_number);
CREATE INDEX IF NOT EXISTS idx_operators_status          ON operators(status);

-- ============================================================
-- YARDS (Yardas de Crown)
-- ============================================================
CREATE TABLE IF NOT EXISTS yards (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    code            VARCHAR(20) NOT NULL UNIQUE,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('PHYSICAL','VIRTUAL')),
    description     TEXT,
    address         TEXT,
    max_trailers    INT DEFAULT 0,
    max_trucks      INT DEFAULT 0,
    max_boxes       INT DEFAULT 0,
    max_platforms   INT DEFAULT 0,
    max_machinery   INT DEFAULT 0,
    min_trailers    INT DEFAULT 0,
    min_trucks      INT DEFAULT 0,
    min_boxes       INT DEFAULT 0,
    min_platforms   INT DEFAULT 0,
    min_machinery   INT DEFAULT 0,
    current_trailers  INT DEFAULT 0,
    current_trucks    INT DEFAULT 0,
    current_boxes     INT DEFAULT 0,
    current_platforms INT DEFAULT 0,
    current_machinery INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yards_active ON yards(is_active);
CREATE INDEX IF NOT EXISTS idx_yards_type   ON yards(type);

-- ============================================================
-- YARD ASSIGNMENTS (Asignaciones de yardas a empleados)
-- ============================================================
CREATE TABLE IF NOT EXISTS yard_assignments (
    id              SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    yard_id         INT NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    assigned_by     INT REFERENCES employees(id),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, yard_id)
);

CREATE INDEX IF NOT EXISTS idx_yard_assignments_active   ON yard_assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_yard_assignments_employee ON yard_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_yard_assignments_yard     ON yard_assignments(yard_id);

-- ============================================================
-- INSPECTIONS · Registro principal de inspección
-- ============================================================
CREATE TABLE IF NOT EXISTS inspections (
    id                      SERIAL PRIMARY KEY,
    uuid                    UUID DEFAULT gen_random_uuid() UNIQUE,
    -- Unit info
    trailer_number          VARCHAR(50),
    seal_number             VARCHAR(50),
    lock_number             VARCHAR(50),
    driver_name             VARCHAR(120),
    odometer                VARCHAR(20),
    location                VARCHAR(120),
    location_id             INT REFERENCES locations(id) ON DELETE SET NULL,
    inspection_date         TIMESTAMPTZ,
    -- Reconfirmation link
    original_inspection_id  INT REFERENCES inspections(id) ON DELETE SET NULL,
    reconfirmation_reason   TEXT,
    is_reconfirmation       BOOLEAN DEFAULT FALSE,
    high_security_seal      BOOLEAN,
    seal_affixed            BOOLEAN,
    language                VARCHAR(2) DEFAULT 'es',
    -- Operator (entered data)
    operator_id             INT REFERENCES employees(id) ON DELETE SET NULL,
    operator_name           VARCHAR(120),
    operator_signature      TEXT,
    operator_signed_at      TIMESTAMPTZ,
    -- Guard (mandatory signature)
    guard_id                INT REFERENCES employees(id) ON DELETE SET NULL,
    guard_name              VARCHAR(120),
    guard_signature         TEXT,
    guard_signed_at         TIMESTAMPTZ,
    -- Supervisor (optional, can sign later)
    supervisor_name         VARCHAR(120),
    supervisor_signature    TEXT,
    supervisor_signed_at    TIMESTAMPTZ,
    -- Auditor (optional)
    auditor_id              INT REFERENCES employees(id) ON DELETE SET NULL,
    auditor_name            VARCHAR(120),
    auditor_signed_at       TIMESTAMPTZ,
    -- Status & counters
    status                  VARCHAR(20) DEFAULT 'completed'
                            CHECK (status IN ('draft','pending','completed','audited','rejected','reconfirmed','superseded')),
    total_good              INT DEFAULT 0,
    total_bad               INT DEFAULT 0,
    total_pending           INT DEFAULT 0,
    -- PDF storage
    pdf_filename            VARCHAR(200),
    pdf_data                BYTEA,          -- Legacy: PDFs binarios (deprecado, usar pdf_url)
    pdf_url                 TEXT,          -- URL de Vercel Blob Storage
    pdf_size_bytes          INT,
    -- Forensics
    created_ip              VARCHAR(64),
    created_user_agent      TEXT,
    -- Equipment metadata
    equipment_nomenclature  VARCHAR(100),
    tractor_number          VARCHAR(50),
    container_number        VARCHAR(50),
    customer_prefix         VARCHAR(20),
    crown_fleet             VARCHAR(50),
    inspection_type         VARCHAR(20) DEFAULT 'LOADED',
    trailer_type            VARCHAR(50),
    wono                    VARCHAR(100),  -- Work order + sql_id (formato: WO::sql_id)
    -- Timestamps
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspections_created_at  ON inspections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_trailer     ON inspections(trailer_number);
CREATE INDEX IF NOT EXISTS idx_inspections_tractor     ON inspections(tractor_number);
CREATE INDEX IF NOT EXISTS idx_inspections_status      ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_uuid         ON inspections(uuid);
CREATE INDEX IF NOT EXISTS idx_inspections_guard       ON inspections(guard_id);
CREATE INDEX IF NOT EXISTS idx_inspections_location    ON inspections(location_id);
CREATE INDEX IF NOT EXISTS idx_inspections_original    ON inspections(original_inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspections_wono        ON inspections(wono);

-- ============================================================
-- INSPECTION POINTS · 20 puntos por inspección
-- ============================================================
CREATE TABLE IF NOT EXISTS inspection_points (
    id              SERIAL PRIMARY KEY,
    inspection_id   INT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    point_id        INT NOT NULL CHECK (point_id BETWEEN 1 AND 20),
    status          VARCHAR(10) CHECK (status IN ('good','bad','pending')),
    issue_id        INT,
    issue_text      VARCHAR(500),
    has_photo       BOOLEAN DEFAULT FALSE,
    photo           TEXT,
    UNIQUE(inspection_id, point_id)
);

CREATE INDEX IF NOT EXISTS idx_points_inspection ON inspection_points(inspection_id);

-- ============================================================
-- AUDIT LOG · Registro de auditoría
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id              SERIAL PRIMARY KEY,
    inspection_id   INT REFERENCES inspections(id) ON DELETE CASCADE,
    user_id         INT REFERENCES employees(id) ON DELETE SET NULL,
    user_name       VARCHAR(120),
    role            VARCHAR(20),
    action          VARCHAR(50) NOT NULL,
    details         JSONB,
    ip_address      VARCHAR(64),
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_inspection ON audit_log(inspection_id);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created    ON audit_log(created_at DESC);

-- ============================================================
-- TPR · Cache de movimientos (sincronizada desde SQL Server NBCW)
-- ============================================================
CREATE TABLE IF NOT EXISTS tpr (
    id              SERIAL PRIMARY KEY,
    sql_id          VARCHAR(50),
    drvcode         VARCHAR(50),
    wono            VARCHAR(50),
    blno            VARCHAR(50),
    fecha           VARCHAR(12),
    fromd           VARCHAR(50),
    fromcity        VARCHAR(100),
    fromedo         VARCHAR(50),
    tod             VARCHAR(50),
    tocity          VARCHAR(100),
    toedo           VARCHAR(50),
    tipmov          VARCHAR(50),
    status          VARCHAR(50),
    el              VARCHAR(50),
    eqpcode         VARCHAR(100),
    deldate         VARCHAR(12),
    cstmer          VARCHAR(100),
    timearrv        VARCHAR(20),
    timedepar       VARCHAR(20),
    oper            VARCHAR(50),
    truckid         VARCHAR(50),
    seal            VARCHAR(50),
    instruc1        TEXT,
    instruc2        TEXT,
    amount          VARCHAR(10),
    tablecode       VARCHAR(50),
    trxcode         VARCHAR(50),
    synced_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tpr_blno       ON tpr(blno);
CREATE INDEX IF NOT EXISTS idx_tpr_el         ON tpr(el);
CREATE INDEX IF NOT EXISTS idx_tpr_fecha      ON tpr(fecha);
CREATE INDEX IF NOT EXISTS idx_tpr_fromd       ON tpr(fromd);
CREATE INDEX IF NOT EXISTS idx_tpr_status     ON tpr(status);
CREATE INDEX IF NOT EXISTS idx_tpr_synced_at  ON tpr(synced_at);
CREATE INDEX IF NOT EXISTS idx_tpr_truckid    ON tpr(truckid);
CREATE INDEX IF NOT EXISTS idx_tpr_wono        ON tpr(wono);

-- ============================================================
-- VIEWS
-- ============================================================

-- Vista: listado sin campos pesados
CREATE OR REPLACE VIEW v_inspections_list AS
SELECT
    id, uuid, trailer_number, seal_number, lock_number, driver_name,
    location, location_id, inspection_date, language, status,
    operator_name, guard_id, guard_name, guard_signed_at,
    auditor_name, auditor_signed_at,
    total_good, total_bad, total_pending,
    pdf_filename, pdf_size_bytes,
    original_inspection_id, is_reconfirmation, reconfirmation_reason,
    created_ip, created_at, updated_at
FROM inspections;

-- Vista: cadenas de inspección (original + reconfirmaciones)
CREATE OR REPLACE VIEW v_inspection_chains AS
SELECT
    COALESCE(original_inspection_id, id) AS chain_root_id,
    id, trailer_number, seal_number, guard_name, location,
    status, is_reconfirmation, reconfirmation_reason,
    total_good, total_bad, created_at
FROM inspections
ORDER BY COALESCE(original_inspection_id, id), created_at ASC;

-- ============================================================
-- FIN DEL SCHEMA
-- ============================================================
