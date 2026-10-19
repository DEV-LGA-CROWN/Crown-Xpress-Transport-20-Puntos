# Análisis de Arquitectura — Crown Xpress Transport · Sistema de Inspección de 20 Puntos

> Documento de análisis técnico detallado. Generado: 2026-10-02.
> Complementa (no sustituye) a `docs/ARCHITECTURE.md`.

---

## 1. Resumen ejecutivo

Sistema híbrido **cloud + on-premise** para inspecciones vehiculares CTPAT/OEA (~19k líneas de código de aplicación). La pieza central es una **SPA React (PWA)** que corre en tablets de guardias en casetas, un **backend serverless en Vercel**, una **PostgreSQL 16 auto-hospedada en un VPS IONOS**, y un **script de sincronización** que copia movimientos desde un **SQL Server legado (NBCW)** hacia PostgreSQL cada minuto. Los PDFs viven en **Vercel Blob**.

```
Tablet guardia ──► Vercel (SPA + /api/*) ──► PostgreSQL IONOS (vía Caddy layer4 TLS :443)
                        │
                        └──► Vercel Blob (PDFs)

PC on-premise ──► sync-nbcw.js (Task Scheduler, cada 1 min)
   SQL Server NBCW :1433 ──► PostgreSQL IONOS (tabla tpr)
```

---

## 2. Stack tecnológico

| Capa | Tecnología | Archivo(s) clave |
|---|---|---|
| Frontend | React 18 + Vite 5 | `src/` |
| Estilos | TailwindCSS 3 + PostCSS | `tailwind.config.js` |
| Iconos | Lucide React | — |
| Routing | Router por estado propio (react-router-dom instalado pero sin usar para rutas) | `src/components/Router.jsx` |
| PDF | jsPDF + jspdf-autotable + html2canvas | `src/utils/pdfGenerator.js` |
| Firmas | react-signature-canvas | `src/components/SignatureCanvas.jsx` |
| PWA | vite-plugin-pwa + Workbox | `vite.config.js` |
| Offline | IndexedDB nativo + localStorage | `src/utils/offlineDB.js`, `src/utils/syncManager.js` |
| Backend | Vercel Serverless Functions (Node.js, ESM) | `api/` |
| Dev server | Express 5 (adaptador req/res estilo Vercel) | `server.js` |
| Driver DB | `pg` (node-postgres), Pool max 10 | `api/_lib/db.js` |
| PDFs | Vercel Blob Storage | `api/_lib/blob.js` |
| DB app | PostgreSQL 16-alpine (Docker en IONOS) | `db/schema.sql` |
| DB origen | SQL Server NBCW `GPSActivity` on-premise | `scripts/sync-nbcw-to-neon.js` |
| Proxy TLS | Caddy v2.11 + plugin layer4 (xcaddy) | `scripts/Caddyfile-ionos`, `docs/CADDY-LAYER4.md` |
| Sync | Node.js script vía Windows Task Scheduler | `scripts/sync-nbcw-to-neon.js` |

Dependencias instaladas pero con uso residual: `@neondatabase/serverless` (solo la usan 2 scripts de mantenimiento tras la migración a `pg`), `react-pdf`, `react-router-dom` (no enruta), `html2canvas`.

---

## 3. Infraestructura y despliegue

### 3.1 Vercel (zona cloud pública)

- **Estáticos**: `vite build` → `dist/`, servido como SPA con rewrite catch-all `/(.*) → /index.html` (`vercel.json`).
- **Functions**: `api/**/*.js`, `maxDuration: 30s`, `memory: 1024 MB`.
- **Blob Storage**: PDFs con `access: 'public'` y `addRandomSuffix: true` (`api/_lib/blob.js`).
- **Deploy**: automático al hacer push a `main`.

### 3.2 IONOS VPS (74.208.37.187)

- **Caddy v2.11 compilado con plugin `layer4`**: multiplexa HTTP y PostgreSQL/TLS en el **mismo puerto 443** vía SNI routing.
  - Rutas HTTP: `api.crown-xpress-transport.app`, `auth.crown-xpress-transport.app`, `db.crown-xpress-transport.app`, `evenchess.jmbj2457.com`.
  - Ruta TCP: `db.crown-xpress-transport.app:443` → `postgres_tls` → PostgreSQL.
  - Certificados Let's Encrypt automáticos.
- **PostgreSQL 16-alpine** en Docker (`crown-postgres`, `:5433` local).
- Un **CRM existente convive en el mismo VPS** (documentado como "no tocar").

### 3.3 On-premise

- **SQL Server NBCW** (`GPSActivity`, tabla `tpr`, `192.168.5.13:1433`) — sistema legado de despacho; no se migra, solo se lee.
- **PC con Windows Task Scheduler** ejecutando `scripts/sync-nbcw-to-neon.js` cada 1 minuto. Existe variante portable en `scripts/sync-standalone/`.

### 3.4 Desarrollo local

- `npm run dev` = `concurrently`: Vite `:5173` + Express `server.js` `:3001`, proxy `/api → :3001`.
- `server.js` es un **adaptador Express→Vercel**: `adaptHandler()` envuelve los handlers serverless para que el mismo código corra localmente.

---

## 4. Backend API (Vercel serverless)

### 4.1 Capa de acceso a datos (`api/_lib/db.js`)

Wrapper propio sobre `pg.Pool` que **imita la interfaz de `@neondatabase/serverless`**:

- `sql`SELECT ... WHERE id = ${x}`` — tagged template → parametriza a `$1..$n`.
- `sql.query(text, params)` — queries crudos.
- `sql.unsafe(fragment)` — interpolación raw para listas de columnas / expresiones de fecha.
- `queryOne` — tagged template que devuelve `rows[0] || null`.
- `logAudit` — inserta en `audit_log` (inspection_id, user, role, action, details JSONB, IP, UA).
- `getClientIp`, `readJsonBody` — normalizan diferencias Express vs Vercel.

Pool singleton por invocación: `max: 10`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 10000`, `ssl: { rejectUnauthorized: false }`.

### 4.2 Mapa de endpoints

| Endpoint | Archivo | Función |
|---|---|---|
| `GET /api/health` | `_lib/handlers.js` | Health check DB |
| `POST /api/auth` | `api/auth.js` | Login → usuario + `yard_assignments` |
| `GET/POST/PUT/DELETE /api/employees` | `api/employees.js` | CRUD empleados, búsqueda de operadores, asignaciones |
| `GET/POST/PUT/DELETE /api/yard-management?type=yards\|assignments\|setup` | `api/yard-management.js` | CRUD yardas, asignaciones, setup inicial |
| `GET /api/tpr` | `api/tpr.js` | Movimientos NBCW con flag `already_inspected` |
| `GET /api/metrics` | `api/metrics.js` | Métricas por período/yarda/guardia + pendientes NBCW |
| `GET/POST /api/inspections` | `api/inspections/index.js` → `_lib/handlers.js` | Listar (paginado) / crear inspección |
| `GET/POST/PUT /api/inspections/:id` | `api/inspections/[id].js` | Detalle (+puntos+audits) / firma supervisor / subir PDF |
| `GET /api/inspections/:id/pdf` | `api/inspections/[id]/pdf.js` | Descarga PDF (Blob → fallback `pdf_data`) |
| `POST /api/inspections/:id/reconfirm` | `api/inspections/[id]/reconfirm.js` | Reconfirmación (append-only) |

### 4.3 Lógica de negocio en backend

**`createInspection`** (`api/_lib/handlers.js`):
- Valida firma de guardia obligatoria y `location` (yarda) obligatoria.
- Acepta PDF base64 del frontend; lo sube a Blob si `BLOB_READ_WRITE_TOKEN` está configurado; si no, guarda la inspección sin PDF (el cliente lo sube después vía `PUT /pdf`).
- **Clave compuesta NBCW**: cuando viene `unitInfo.sqlId`, persiste `wono = "work_order::sql_id"` para cruce exacto posterior.
- Inserta `inspections` + hasta 20 filas en `inspection_points` + hasta 5 entradas de auditoría (created, signed_guard, signed_operator, signed_supervisor, signed_auditor).
- Deriva `status`: `audited` | `completed` | `pending` según firmas presentes.

**`listInspections`** (`api/inspections/index.js`):
- Paginación `limit/offset` (o `limit=all`), filtro por `yardCode` (multi-valor CSV, normalizado con `UPPER(TRIM())`) o `guardName`.
- Excluye `pdf_data` del SELECT para no reventar respuestas.

**`reconfirmInspection`** (`api/_lib/handlers.js`):
- Modelo **append-only de versionado**: inserta inspección nueva con `original_inspection_id`, mergea puntos originales + modificaciones en JS, marca la original como `superseded`, audita `reconfirmed` (en nueva) y `superseded_by` (en original).

**`tpr.js`** — cruce TPR ↔ inspecciones:
- Trae movimientos TPR de los últimos 3 días (filtro con timezone `America/Tijuana`) + filtro por yarda (resuelve código o nombre; por defecto solo yardas activas de Crown).
- El cruce se hace **en JavaScript** (no SQL join): inspecciones de últimos 7 días → dos claves exactas:
  - `wono::truckid::fromd::fecha::sql_id` (match completo)
  - `wono::sql_id` (match por work order + movimiento)
- Filosofía explícita en comentarios: **sin fallbacks difusos** — un `sql_id` nuevo siempre reaparece como pendiente.

**`metrics.js`**:
- Períodos `day|week|month` con `anchorDate` y `offset` de minutos enviados por el frontend para resolver la fecha local del usuario (evita desfase UTC).
- 5 bloques: métricas generales, por día (7 días), por guardia, por yarda, y **pendientes NBCW reales** (TPR vs inspecciones, mismo cruce que `tpr.js` + fallbacks legados por wono+fecha y por tractor).
- Solo `superseded` se excluye del conteo; `pending` = firmado por guardia, esperando supervisor → **cuenta como inspección hecha**.

---

## 5. Frontend (React 18 + Vite)

### 5.1 Estado global — 3 Context providers (`src/main.jsx`)

- **`AuthContext`** (`src/context/AuthContext.jsx`):
  - Sesión en `localStorage` (`crown_user`), sin tokens JWT — el objeto usuario es la sesión.
  - Timeout de inactividad de **10 minutos** con listeners de `mousedown/mousemove/keydown/scroll/touchstart/click`.
  - Sincronización multi-tab vía evento `storage` (logout en una pestaña cierra todas).
  - Refresh en background de `yard_assignments` al montar (consulta `/api/employees?id=`).
  - Helpers de rol: `canEdit()` (guard|supervisor|admin), `canViewAll()` (supervisor|admin), `canReconfirm()`.

- **`InspectionContext`** (`src/context/InspectionContext.jsx`):
  - Máquina de estado de la inspección activa: `unitInfo`, mapa de 20 `points`, `sealPhoto`, 4 firmas (guardia/operador/supervisor/auditor).
  - `applicablePoints` computado por tipo de inspección/trailer.
  - Validación `canSubmit`: todos los puntos evaluados + fallas con issue y foto obligatorias + sello según tipo + firma de guardia.

- **`LanguageContext`**: i18n ES/EN, `t(key)`, persistido en `localStorage`.

### 5.2 Routing (`src/components/Router.jsx`)

Router por estado con `useState` (no usa react-router). Tabs filtrados por rol:

| Tab | Rol | Contenido |
|---|---|---|
| `form` (v1 clásica) | canEdit | UnitInfo → TruckDiagram → InspectionList → SealPhoto → Signatures → SubmitBar |
| `guided` (v2 guiada) | canEdit | `GuidedInspection` (wizard paso a paso) |
| `my-history` | canEdit | `GuardHistory` |
| `supervisor` | canViewAll | `SupervisorView` |
| `metrics` | admin | `MetricsView` |
| `users` | admin | `UserManagement` |
| `yards` | admin | `YardManagement` |

Regla de negocio en UI: **sin yarda asignada no se puede inspeccionar** (bloqueo visual + validación también en backend).

### 5.3 Dominio: tipos de inspección (`src/data/inspectionPoints.js`)

| Tipo | Puntos | Sello/candado |
|---|---|---|
| LOADED | 1-20 (todos) | Requiere sello O candado |
| EMPTY | 1-20 | No |
| BOBTAIL | 1-10 (solo tractor) | No |
| FLATBED | 1-12,14,17,18 | No |
| RABON | 1-12,14,17 | No |

Cada punto tiene catálogo bilingüe de issues con IDs `pointId*100+n` y opción `isOther` (texto libre).

### 5.4 Offline / PWA

- **Workbox** (`vite.config.js`): precache del app shell (hasta 8 MB), `navigateFallbackDenylist: /api/`, CacheFirst para fuentes Google (1 año), StaleWhileRevalidate para `*.public.blob.vercel-storage.com` (30 días).
- **IndexedDB** (`src/utils/offlineDB.js`), DB `crown-xpress-offline` v1:
  - `tpr_movements` — movimientos precargados (keyPath `sql_id`).
  - `pending_inspections` — cola de sync (estados `pending|syncing|synced|failed`, `attempts`).
  - `inspection_cache` — historial local.
  - `localStorage['crown-inspected-sql-ids']` — set de `sql_id` inspeccionados localmente.
- **SyncManager** (`src/utils/syncManager.js`): al evento `online` (y a los 3s de cargar) drena la cola — `POST /inspections` + `PUT /pdf` por item; tolera fallo de PDF sin fallar la inspección.
- **Feature flag**: todo el modo offline está gateado por `VITE_OFFLINE_MODE === 'true'`; en producción se limpia el cache y se desactiva (`src/App.jsx`).

### 5.5 PDF y compresión de payload

- `src/utils/pdfGenerator.js` (888 líneas): jsPDF + autotable, logos Crown/CTPAT, diagrama de unidad por tipo de equipo, bilingüe.
- `buildPayload` (`src/utils/api.js`): compresión agresiva pre-upload — fotos de puntos a JPEG 150px @0.15, foto de sello igual, firmas a PNG 300px (JPEG convertiría transparencia a negro). Esto explica por qué las fotos almacenadas son thumbnails.
- Estrategia anti-413: la inspección se crea primero sin PDF (`POST /inspections`) y el PDF se sube aparte (`PUT /inspections/:id/pdf`).

---

## 6. Modelo de datos (PostgreSQL — `db/schema.sql`)

### Tablas

| Tabla | Propósito | Notas |
|---|---|---|
| `locations` | Ubicaciones legacy | Poco usada vs `yards` |
| `employees` | Usuarios del sistema | roles: `operator, guard, inspector, auditor, admin, supervisor`; contiene `password_hash` y también columna `password` |
| `operators` | Conductores | `employee_number` único, licencia, status |
| `yards` | Yardas Crown | `PHYSICAL\|VIRTUAL`, capacidades min/max por tipo de equipo, contadores `current_*` |
| `yard_assignments` | Empleado ↔ yarda (M:N) | `UNIQUE(employee_id, yard_id)`, soft-delete con `is_active` |
| `inspections` | **Tabla central** (~40 cols) | ver abajo |
| `inspection_points` | Detalle 1:20 | `UNIQUE(inspection_id, point_id)`, `CHECK point_id 1-20`, `photo TEXT` (base64) |
| `audit_log` | Auditoría forense | `details JSONB`, IP, user-agent |
| `tpr` | Réplica de SQL Server | Todo VARCHAR, `sql_id` MD5, `synced_at` |

### `inspections` — campos destacados

- Unidad: `trailer_number, tractor_number, container_number, seal_number, lock_number, driver_name, odometer`.
- `wono VARCHAR(100)` — **formato compuesto `work_order::sql_id`** cuando viene de NBCW.
- 4 firmas: `operator|guard|supervisor|auditor` × (`_name`, `_signature` TEXT base64, `_signed_at`).
- `status` CHECK: `draft, pending, completed, audited, rejected, reconfirmed, superseded`.
- Reconfirmación: `original_inspection_id` (self-FK), `reconfirmation_reason`, `is_reconfirmation`.
- PDF: `pdf_filename`, `pdf_url` (Blob), `pdf_size_bytes`, `pdf_data BYTEA` (**legacy/deprecado**).
- Forense: `created_ip`, `created_user_agent`.

### Vistas

- `v_inspections_list` — listado sin campos pesados (firmas, pdf_data).
- `v_inspection_chains` — cadena completa: `COALESCE(original_inspection_id, id)` como raíz.

---

## 7. Integración NBCW → TPR (`scripts/sync-nbcw-to-neon.js`)

- Lee **toda** la tabla `tpr` de SQL Server (26 columnas con `RTRIM`).
- Normaliza `fecha` a `YYYY-MM-DD` — parser que soporta `MDY`, `DMY` (env `SQLSERVER_DATE_FORMAT`), compacto `MMDDYYYY`, con heurística mes>12 para invertir.
- Genera `sql_id` = `MD5(wono|truckid|fecha|fromd|tod|timearrv)` — ID estable por movimiento.
- Filtra últimos `TPR_SYNC_DAYS` (default 30).
- **Estrategia destructiva de snapshot**: `BEGIN → DELETE FROM tpr → bulk INSERT lotes de 1000 → COMMIT`. No hay upserts ni delta — la tabla es un espejo rolling.
- Auto-crea tabla e índices; si detecta UNIQUE constraint en `sql_id` (de versiones viejas) hace DROP+recreate.
- Logging a `logs/sync.log` (sobreescrito cada corrida) redirigiendo `console.log/error`.

### Reglas de negocio del cruce

- Un movimiento se identifica por `sql_id` único; completarlo solo suprime **ese** movimiento exacto.
- Mismo `wono` puede tener varios movimientos (ida/vuelta); work orders pueden reutilizarse.
- En TPR, `status` puede ser `OPEN`, `''`, `NULL` o `CLOSED` aunque la inspección física no se haya hecho — por eso el pendiente real se calcula cruzando con `inspections`, no por status de TPR.

---

## 8. Flujos de datos end-to-end

### Inspección

```
Guardia → UnitInfo (tipo, equipo, operador, TPR opcional) → 20 puntos (good/bad+issue+foto)
→ SealPhoto (si LOADED) → Firmas → SubmitBar
→ buildPayload (compresión) → POST /api/inspections
→ INSERT inspections + inspection_points + audit_log
→ Frontend genera PDF (jsPDF) → PUT /api/inspections/:id/pdf → Vercel Blob → pdf_url
```

### Pendientes TPR

```
SQL Server tpr → sync (1 min) → PostgreSQL tpr → GET /api/tpr
→ cruce JS con inspections (wono::sql_id) → already_inspected
→ EmptyLoads/UnitInfo muestran pendientes por yarda
```

### Reconfirmación

```
Supervisor/guardia → POST /:id/reconfirm {reason≥10 chars, modifications[]}
→ INSERT inspección hija (merge puntos) → UPDATE original → 'superseded' → audit ambos lados
→ cadena visible vía GET /:id/chain o v_inspection_chains
```

### Offline (preproducción solamente)

```
Con internet: GET /tpr → IndexedDB → inspección → POST → borra local
Sin internet: IndexedDB (TPR) → inspección → IndexedDB (cola pending)
Reconexión: evento 'online' → syncPendingInspections → POST + PUT/pdf → synced → limpia
```

---

## 9. Hallazgos y riesgos

### 9.1 Seguridad (prioridad alta)

1. **Contraseñas en texto plano** — `api/auth.js` compara `password_hash = ${password}` directamente; no hay bcrypt/argon2. Además existe columna `password` duplicada en `employees`.
2. **La API no tiene autenticación ni autorización server-side** — ningún endpoint valida sesión/token. `GET /api/employees` expone `password_hash` a cualquier cliente; `GET /api/inspections` lista todo. La autorización por rol es solo cosmética en el frontend.
3. **CORS `Access-Control-Allow-Origin: *`** en todos los handlers.
4. **`yard-management.js` PUT ~línea 70**: construye `SET key = value` interpolando campos arbitrarios del body dentro de un template literal — riesgo de inyección SQL y probablemente roto (la cláusula entera se parametriza como `$1`, sintaxis inválida).
5. `ssl: { rejectUnauthorized: false }` en pg (Vercel→IONOS) — sin verificación de certificado.
6. Sesión = objeto usuario completo en `localStorage` sin firma ni expiración server-side.

### 9.2 Bugs / inconsistencias

7. **`server.js` dev**: `adaptHandler` no propaga `req.params.id` a `downloadPdf`, `signAuditor`, `reconfirmInspection` → esas rutas reciben `id = undefined` y están rotas en desarrollo local (solo `/chain` usa `req.params.id` bien).
8. **`vercel.json` apunta a archivos inexistentes**: rewrites a `api/health.js`, `api/init-db.js`, `[id]/sign-auditor.js`, `[id]/chain.js`; los archivos reales son `index.js`, `[id].js`, `[id]/pdf.js`, `[id]/reconfirm.js`. Esas rutas están rotas o dependen de resolución implícita.
9. **`getInspectionChain`** usa `WITH RECURSIVE` pero el query no es recursivo (`id = X OR original_inspection_id = X`) — solo trae raíz + un nivel; cadenas de 3+ inspecciones quedan cortadas.
10. **Duplicación de lógica**: `handlers.js` (`listInspections`, `downloadPdf`, `signAuditor`) vs `inspections/index.js` y `[id].js` son implementaciones paralelas con divergencias (columnas distintas; la lista de `index.js` no excluye firmas base64 → payload pesado).
11. `getInspection`/`getInspectionChain` hacen `SELECT *` incluyendo `pdf_data` BYTEA legacy.
12. Frontend `downloadPdf` usa `GET /inspections/:id?pdf=true` mientras `vercel.json` define `/pdf` — coexisten dos convenciones.

### 9.3 Deuda técnica

13. `@neondatabase/serverless` aún en `dependencies` post-migración a `pg`.
14. Archivos monolíticos: `UnitInfoEnhanced.jsx` (2309 líneas), `pdfGenerator.js` (888), `UserManagement.jsx` (953).
15. `api/_lib/pdfGenerator.js` tiene catálogo de puntos **diferente y simplificado** respecto a `src/data/inspectionPoints.js` — un PDF regenerado en backend no coincide con el del frontend.
16. CORS + parseo de body + manejo de errores duplicados en cada handler — falta middleware compartido.
17. Sin tests, sin TypeScript, sin lint estricto evidenciado.
18. Comentarios/nombres legacy mencionan "Neon" aunque la DB es IONOS (migración en `docs/MIGRATION-IONOS.md`).
19. Sync TPR hace `DELETE+INSERT` completo cada minuto — funciona para volúmenes actuales pero es O(tabla completa) y puede crecer; hay ventana breve donde la tabla está vacía si falla a mitad (mitigado por transacción).
20. Componentes aparentemente duplicados/no usados: `UnitInfo.jsx` vs `UnitInfoEnhanced.jsx`, `SignatureSection.jsx` vs `SignaturesSection.jsx`, `TruckDiagram.jsx` vs `TruckDiagramVisual.jsx`, `StepByStepInspection.jsx`, `EmptyLoads.jsx`.

### 9.4 Fortalezas

- Separación de capas clara: `_lib` reusable, contexts, utils, data.
- La clave compuesta `wono::sql_id` es una solución pragmática y correcta al problema de identidad de movimientos entre sistemas sin FK real.
- Auditoría forense completa (IP, UA, acciones firmadas) y modelo de reconfirmación append-only — adecuado para cumplimiento CTPAT.
- Manejo explícito de timezone `America/Tijuana` en todos los cruces de fecha — evita el bug clásico de desfase de día UTC.
- PWA bien configurada con estrategias de caché diferenciadas.
- Misma codebase corre en Vercel y en Express local vía adaptador — buen patrón de paridad dev/prod.

---

## 10. Recomendaciones (orden sugerido)

| # | Acción | Esfuerzo |
|---|---|---|
| 1 | Hashing real de passwords (bcrypt) + migración de existentes | Medio |
| 2 | Middleware de auth (token firmado o sesión server-side) + quitar `password_hash` de SELECTs | Alto |
| 3 | Reparar `vercel.json` rewrites y `server.js` adaptHandler | Bajo |
| 4 | Reemplazar interpolación de SQL en `yard-management` PUT | Bajo |
| 5 | Unificar listado/detalle de inspecciones en `_lib/handlers.js` (una sola fuente) | Medio |
| 6 | Recursión real en `getInspectionChain` o usar `v_inspection_chains` | Bajo |
| 7 | Eliminar `@neondatabase/serverless`, `react-router-dom` si no se usa, y componentes muertos | Bajo |
| 8 | Rate limiting básico en `/api/auth` | Bajo |
| 9 | Documentar/alertar sobre snapshots de `tpr` (retención ~30 días afecta métricas semanales/mensuales) | Doc |
