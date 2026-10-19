# Fórmula de Filtrado Anti-Duplicados — Inspecciones vs Movimientos TPR

> Cómo el sistema evita que un movimiento NBCW se inspeccione dos veces
> (o vuelva a aparecer como pendiente). Generado: 2026-10-02.

---

## 1. Concepto

El deduplicado **no bloquea el guardado** — es un mecanismo de **marcado/cruce**:
los movimientos TPR ya inspeccionados se siguen trayendo de la API pero llegan con
`already_inspected: true`, y el frontend los oculta o los muestra como completados.

La identidad de un movimiento es su **`sql_id`** = MD5 generado en el sync:

```
sql_id = MD5( wono | truckid | fecha | fromd | tod | timearrv )
```

(`scripts/sync-nbcw-to-neon.js` — función `generateSqlId`)

---

## 2. Al guardar — construcción de la clave

`createInspection` en `api/_lib/handlers.js` (líneas 72-78):

```js
const raw_work_order = (ui.workOrder || ui.wono || '').toString().trim() || null
const sql_id         = ui.sqlId ? ui.sqlId.toString().trim() : null

// Clave compuesta persistida en inspections.wono
const work_order = sql_id && raw_work_order
  ? `${raw_work_order}::${sql_id}`   // ej: "WO12345::a94a8fe5ccb1..."
  : raw_work_order                    // inspección manual, sin movimiento
```

Junto con la clave se persisten los campos de contexto del cruce:

| Columna | Origen | Uso en el cruce |
|---|---|---|
| `wono` | `"WO::sql_id"` | clave compuesta |
| `tractor_number` | `unitInfo.tractorNumber` | parte de clave larga |
| `location` | `unitInfo.location` (yarda) | parte de clave larga |
| `inspection_date` | `unitInfo.inspectionDate` | fecha del match |

---

## 3. Al filtrar — el cruce (`api/tpr.js`, líneas 144-215)

### 3.1 Lado inspecciones

Query (una sola, últimos 7 días):

```sql
SELECT DISTINCT
  UPPER(TRIM(wono))           AS wono,
  UPPER(TRIM(tractor_number)) AS truck_id,
  UPPER(TRIM(location))       AS location,
  inspection_date
FROM inspections
WHERE status NOT IN ('superseded')
  AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Tijuana')::date
      >= (NOW() AT TIME ZONE 'America/Tijuana')::date - INTERVAL '7 days'
```

En JS se construyen **dos sets de claves**:

```js
for (const row of inspected) {
  const fecha = new Date(row.inspection_date)
    .toLocaleDateString('en-US', { timeZone: 'America/Tijuana' })  // MM/DD/YYYY

  const [workOrder, tprId] = row.wono.split('::')

  // CLAVE LARGA (exacta, 5 componentes)
  inspectedKeys.add(`${workOrder}::${row.truck_id || ''}::${row.location || ''}::${fecha}::${tprId}`)

  // CLAVE CORTA (work order + movimiento)
  if (tprId) {
    inspectedByTprId.add(`${workOrder}::${tprId.toLowerCase()}`)
  }
}
```

### 3.2 Lado movimientos TPR

```js
for (const m of allMovements) {
  const wono  = m.work_order?.toString().trim().toUpperCase()
  const truck = m.truck_id?.toString().trim().toUpperCase()
  const fromd = m.from_code?.toString().trim().toUpperCase()
  const fecha = convertirFecha(m.fecha)          // YYYY-MM-DD → MM/DD/YYYY
  const sqlId = m.sql_id?.toString().trim() || ''

  const compositeKey = `${wono}::${truck}::${fromd}::${fecha}::${sqlId}`
  const sqlIdKey     = sqlId && wono ? `${wono}::${sqlId.toLowerCase()}` : null

  // ══════════════ LA FÓRMULA ══════════════
  const already_inspected =
       (wono     && inspectedKeys.has(compositeKey))   // match exacto completo
    || (sqlIdKey && inspectedByTprId.has(sqlIdKey))     // match wono + sql_id
}
```

---

## 4. La fórmula formal

> Un movimiento TPR `m` está **ya inspeccionado** si existe una inspección `i`
> con `status <> 'superseded'` tal que:
>
> ```
> ( UPPER(TRIM(i.wono[1])), LOWER(TRIM(i.wono[2])) )
>      = ( UPPER(TRIM(m.wono)), LOWER(TRIM(m.sql_id)) )
> ```
>
> *(clave corta: `wono::sql_id` — la que hace el trabajo real)*
>
> o bien coincide la tupla completa:
>
> ```
> ( i.wono, i.tractor, i.location, i.fecha, i.sql_id )
>      = ( m.wono, m.truckid, m.fromd, m.fecha, m.sql_id )
> ```
>
> *(clave larga — redundancia defensiva)*

Donde `i.wono[1]` e `i.wono[2]` son las partes de `inspections.wono.split('::')`,
y `i.fecha` se normaliza a `MM/DD/YYYY` en timezone `America/Tijuana`.

Como `sql_id` ya es un hash del movimiento completo
(`wono|truckid|fecha|fromd|tod|timearrv`), la clave corta `wono::sql_id`
es suficiente para identidad única. **No se usan fallbacks difusos** en `tpr.js`:
un movimiento con `sql_id` nuevo siempre reaparece como pendiente.

---

## 5. Capas donde aplica la misma fórmula

| Capa | Clave usada | Archivo |
|---|---|---|
| Guardar | `wono = "WO::sql_id"` | `api/_lib/handlers.js:76` |
| Cruce servidor | `wono::sql_id` + tupla de 5 | `api/tpr.js:207-212` |
| Métricas | `wono::sql_id` + **fallbacks legados** `wono::fecha` y `tractor_number` | `api/metrics.js:390-394` |
| Offline/local | `sql_id` en localStorage `crown-inspected-sql-ids` | `src/utils/offlineDB.js:83` |
| Cliente al crear | `markTprInspected([sqlId])` antes de POST | `src/utils/api.js:47-50` |

### Fallbacks de métricas (solo `metrics.js`, NO en `tpr.js`)

```js
alreadyByWonoOnly = inspectedByWonoWithDate.has(`${wono}::${fecha}`)   // inspecciones viejas sin sql_id
alreadyByTractor  = fallbackTractors.has(truck)                       // inspecciones sin work order
```

> **Por qué solo en métricas**: un tractor puede tener varios movimientos en el
> mismo día; usar tractor como filtro en la lista de pendientes marcaría falsos
> positivos y ocultaría movimientos legítimos. En métricas se tolera porque
> solo infla el contador de "inspeccionados", no oculta trabajo.

---

## 6. Diagrama de flujo

```
SQL Server tpr ──sync──► PG tpr (sql_id = MD5(...))
                              │
                              ▼
                    GET /api/tpr ──► SELECT inspections (7d, ≠superseded)
                              │
                              ▼
              ┌─ compositeKey match ─┐
   ¿ya está? ─┤                      ├─► already_inspected = true
              └─ wono::sql_id match ─┘
                              │
                              ▼
              Frontend filtra/marca pendientes
                              │
        Guardia inspecciona ──► POST /api/inspections
                              │   wono = "WO::sql_id"
                              ▼
              Próximo GET /api/tpr → match → ya no es pendiente
```

---

## 7. Limitaciones conocidas

1. **No hay garantía a nivel DB**: ningún constraint impide un `POST /inspections`
   duplicado con el mismo `sql_id` — el dedup es solo visual. Para endurecerlo:
   columna `sql_id` separada + `UNIQUE` parcial, o check en `createInspection`.
2. **Ventana de 7 días**: inspecciones más viejas que 7 días no participan en el
   cruce (los movimientos TPR solo retienen ~3 días de vista, así que en la
   práctica no se nota).
3. **`superseded` es el único status excluido**: una inspección `rejected` sigue
   contando como "hecha" para el cruce.
4. **Sensibilidad a whitespace/case**: mitigada con `UPPER(TRIM())` en ambos lados,
   pero el match de `fecha` depende del formato `MM/DD/YYYY` vs `YYYY-MM-DD` —
   normalización obligatoria o el cruce falla silenciosamente.
5. **La columna `wono` hace doble función** (work order + clave compuesta). Cualquier
   consumidor que lea `wono` directo debe hacer `split('::')[0]`.

---

## 8. Referencia de archivos

| Archivo | Rol |
|---|---|
| `scripts/sync-nbcw-to-neon.js` | Genera `sql_id` (MD5) y puebla `tpr` |
| `api/_lib/handlers.js` | Escribe `wono = WO::sql_id` al crear |
| `api/tpr.js` | Cruce principal de pendientes |
| `api/metrics.js` | Cruce para contadores + fallbacks legados |
| `src/utils/api.js` | `markTprInspected` local + `buildPayload` |
| `src/utils/offlineDB.js` | Set local de `sql_id`s inspeccionados |
| `db/schema.sql` | Columna `inspections.wono`, índice `idx_inspections_wono` |
