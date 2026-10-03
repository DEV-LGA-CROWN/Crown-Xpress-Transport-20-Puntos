import { getSql } from './_lib/db.js'

function isValidISODate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime())
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = getSql()

  try {
    const { period = 'day', yardCode = 'all' } = req.query
    // Fecha y offset enviados desde el frontend en zona horaria local.
    // created_at se almacena en UTC; convirtiéndolo a la zona del usuario
    // antes de extraer la fecha evitamos desfaces de un día (problema en UTC-7).
    const anchorDate = isValidISODate(req.query.date) ? req.query.date : null
    const rawOffset = parseInt(req.query.offset, 10)
    const offset = !isNaN(rawOffset) ? rawOffset : 0
    const dateLiteral = anchorDate ? `'${anchorDate}'::date` : 'CURRENT_DATE'
    const localDateExpr = `(created_at AT TIME ZONE 'UTC' - INTERVAL '${offset} minutes')::date`

    // ============================================================
    // CALCULAR RANGO DE FECHAS SEGÚN PERIODO
    // ============================================================
    let dateCondition = ''
    let dateLabel = ''

    if (period === 'day') {
      dateCondition = `${localDateExpr} = ${dateLiteral}`
      dateLabel = 'hoy'
    } else if (period === 'week') {
      dateCondition = `${localDateExpr} >= DATE_TRUNC('week', ${dateLiteral})::date AND ${localDateExpr} < (DATE_TRUNC('week', ${dateLiteral}) + INTERVAL '7 days')::date`
      dateLabel = 'esta semana'
    } else if (period === 'month') {
      dateCondition = `${localDateExpr} >= DATE_TRUNC('month', ${dateLiteral})::date AND ${localDateExpr} < (DATE_TRUNC('month', ${dateLiteral}) + INTERVAL '1 month')::date`
      dateLabel = 'este mes'
    } else {
      return res.status(400).json({ error: 'Invalid period. Use: day, week, or month' })
    }

    const isAllYards = !yardCode || yardCode === 'all'

    // ============================================================
    // NBCW: Usar zona horaria de Tijuana para TPR (MM/DD/YYYY)
    // ============================================================
    const tprDateLiteral = anchorDate ? `'${anchorDate}'::date` : '(NOW() AT TIME ZONE \'America/Tijuana\')::date'
    const tprLocalDateExpr = `(NOW() AT TIME ZONE 'America/Tijuana')::date`

    // ============================================================
    // 0. LISTA DE YARDAS (existentes y recién creadas)
    // ============================================================
    const yards = await sql`
      SELECT id, name, code, type FROM yards
      WHERE is_active = true
      ORDER BY type, name
    `

    // ============================================================
    // 1. MÉTRICAS GENERALES
    // ============================================================
    // NOTA: Una inspección con status = 'pending' significa que el guard YA
    // la realizó y firmó, solo está esperando la firma/aprobación del
    // supervisor. Por lo tanto CUENTA como "hecha/registrada", igual que
    // ya lo trata tpr.js (status NOT IN ('superseded')). Solo 'superseded'
    // (reemplazada por una reconfirmación) se excluye del total.
    const generalMetrics = isAllYards
      ? await sql`
          SELECT
            COUNT(CASE WHEN status <> 'superseded' THEN 1 END) as total_inspections,
            COUNT(CASE WHEN status IN ('completed', 'audited') THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'audited' THEN 1 END) as audited
          FROM inspections
          WHERE ${sql.unsafe(dateCondition)}
        `
      : await sql`
          SELECT
            COUNT(CASE WHEN status <> 'superseded' THEN 1 END) as total_inspections,
            COUNT(CASE WHEN status IN ('completed', 'audited') THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'audited' THEN 1 END) as audited
          FROM inspections
          WHERE ${sql.unsafe(dateCondition)}
            AND UPPER(TRIM(location)) = UPPER(TRIM(${yardCode}))
        `

    // ============================================================
    // 2. MÉTRICAS POR DÍA (ÚLTIMOS 7 DÍAS DESDE LA FECHA ANCLA)
    // ============================================================
    const dailyMetrics = isAllYards
      ? await sql`
          SELECT
            ${sql.unsafe(localDateExpr)} as date,
            COUNT(CASE WHEN status <> 'superseded' THEN 1 END) as total_inspections,
            COUNT(CASE WHEN status IN ('completed', 'audited') THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
          FROM inspections
          WHERE ${sql.unsafe(`${localDateExpr} >= ${dateLiteral} - INTERVAL '7 days'`)}
          GROUP BY ${sql.unsafe(localDateExpr)}
          ORDER BY date DESC
        `
      : await sql`
          SELECT
            ${sql.unsafe(localDateExpr)} as date,
            COUNT(CASE WHEN status <> 'superseded' THEN 1 END) as total_inspections,
            COUNT(CASE WHEN status IN ('completed', 'audited') THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
          FROM inspections
          WHERE ${sql.unsafe(`${localDateExpr} >= ${dateLiteral} - INTERVAL '7 days'`)}
            AND UPPER(TRIM(location)) = UPPER(TRIM(${yardCode}))
          GROUP BY ${sql.unsafe(localDateExpr)}
          ORDER BY date DESC
        `

    // ============================================================
    // 3. MÉTRICAS POR GUARD
    // ============================================================
    const guardMetrics = isAllYards
      ? await sql`
          SELECT
            guard_name,
            COUNT(CASE WHEN status <> 'superseded' THEN 1 END) as total_inspections,
            COUNT(CASE WHEN status IN ('completed', 'audited') THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
          FROM inspections
          WHERE ${sql.unsafe(dateCondition)}
            AND guard_name IS NOT NULL
          GROUP BY guard_name
          ORDER BY total_inspections DESC
        `
      : await sql`
          SELECT
            guard_name,
            COUNT(CASE WHEN status <> 'superseded' THEN 1 END) as total_inspections,
            COUNT(CASE WHEN status IN ('completed', 'audited') THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
          FROM inspections
          WHERE ${sql.unsafe(dateCondition)}
            AND guard_name IS NOT NULL
            AND UPPER(TRIM(location)) = UPPER(TRIM(${yardCode}))
          GROUP BY guard_name
          ORDER BY total_inspections DESC
        `

    // ============================================================
    // 4. MÉTRICAS POR YARDA (SOLO REPORTE GENERAL)
    // ============================================================
    let byYard = []
    if (isAllYards) {
      const yardMetrics = await sql`
        SELECT
          location,
          COUNT(CASE WHEN status <> 'superseded' THEN 1 END) as total_inspections,
          COUNT(CASE WHEN status IN ('completed', 'audited') THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
        FROM inspections
        WHERE ${sql.unsafe(dateCondition)}
          AND location IS NOT NULL
        GROUP BY location
        ORDER BY total_inspections DESC
      `

      // Combinar con el catálogo de yardas para mostrar nombre completo
      // (incluye yardas sin inspecciones aún, y las recién creadas)
      // Normalizar con UPPER(TRIM()) para tolerar diferencias de case/whitespace
      const yardMap = new Map(yardMetrics.map(y => [String(y.location || '').trim().toUpperCase(), y]))
      byYard = yards.map(y => {
        const stats = yardMap.get(String(y.code || '').trim().toUpperCase()) || { total_inspections: 0, completed: 0, pending: 0 }
        return {
          yard_id: y.id,
          yard_name: y.name,
          yard_code: y.code,
          yard_type: y.type,
          total_inspections: Number(stats.total_inspections) || 0,
          completed: Number(stats.completed) || 0,
          pending: Number(stats.pending) || 0,
        }
      })

      // Inspecciones cuya location no coincide con una yarda activa (o es NULL)
      // no deben desaparecer del reporte: se agrupan en filas visibles para que
      // el total "por yarda" cuadre con "por guardia".
      const catalogCodes = new Set(yards.map(y => String(y.code || '').trim().toUpperCase()))
      const orphanMap = new Map()
      for (const row of yardMetrics) {
        const loc = String(row.location || '').trim().toUpperCase()
        if (!catalogCodes.has(loc)) {
          const key = loc || '(SIN YARDA)'
          const prev = orphanMap.get(key) || { total_inspections: 0, completed: 0, pending: 0 }
          orphanMap.set(key, {
            total_inspections: prev.total_inspections + Number(row.total_inspections) || 0,
            completed: prev.completed + Number(row.completed) || 0,
            pending: prev.pending + Number(row.pending) || 0,
          })
        }
      }
      // Las filas sin location fueron excluidas por el WHERE; las contamos aparte
      const nullLocationRows = await sql`
        SELECT
          COUNT(CASE WHEN status <> 'superseded' THEN 1 END) as total_inspections,
          COUNT(CASE WHEN status IN ('completed', 'audited') THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
        FROM inspections
        WHERE ${sql.unsafe(dateCondition)}
          AND (location IS NULL OR TRIM(location) = '')
      `
      const nullStats = nullLocationRows[0] || {}
      if (Number(nullStats.total_inspections) > 0) {
        const prev = orphanMap.get('(SIN YARDA)') || { total_inspections: 0, completed: 0, pending: 0 }
        orphanMap.set('(SIN YARDA)', {
          total_inspections: prev.total_inspections + Number(nullStats.total_inspections),
          completed: prev.completed + Number(nullStats.completed),
          pending: prev.pending + Number(nullStats.pending),
        })
      }
      for (const [key, stats] of orphanMap) {
        byYard.push({
          yard_id: null,
          yard_name: key === '(SIN YARDA)' ? 'Sin yarda asignada' : key,
          yard_code: key,
          yard_type: 'other',
          total_inspections: stats.total_inspections,
          completed: stats.completed,
          pending: stats.pending,
        })
      }
      byYard.sort((a, b) => b.total_inspections - a.total_inspections)
    }

    // ============================================================
    // 5. NBCW: PENDIENTES REALES (movimientos TPR vs inspecciones hechas)
    // ============================================================
    // Esto es distinto de "pending" de arriba (que es aprobación de
    // supervisor). Aquí comparamos contra el total de movimientos NBCW
    // (tabla tpr) del periodo para saber cuántos AÚN NO se han inspeccionado
    // en absoluto. NOTA: la sincronización de tpr solo retiene ~2-7 días,
    // por lo que esta comparación es más precisa para period=day.
    let tprDateCondition = ''
    if (period === 'day') {
      tprDateCondition = `TO_DATE(fecha, 'YYYY-MM-DD') = ${tprDateLiteral}`
    } else if (period === 'week') {
      tprDateCondition = `TO_DATE(fecha, 'YYYY-MM-DD') >= DATE_TRUNC('week', ${tprDateLiteral})`
    } else {
      tprDateCondition = `TO_DATE(fecha, 'YYYY-MM-DD') >= DATE_TRUNC('month', ${tprDateLiteral})`
    }

    // Solo contar movimientos no cerrados/cancelados (pendientes reales).
    // En TPR, los pendientes pueden venir con status 'OPEN', '' o NULL.
    // Solo 'CLOSED' o 'CANCEL' se excluyen como ya finalizados.
    const tprStatusCondition = `(status IS NULL OR TRIM(status) = '' OR UPPER(TRIM(status)) NOT IN ('CLOSED', 'CANCEL'))`

    let nbcw = { total: 0, inspected: 0, pending: 0, inspectedToday: 0 }
    let nbcwByYard = []
    console.log('Metrics date params:', { anchorDate, offset, period, yardCode, isAllYards, dateCondition, tprDateCondition })

    // 1. TPR rows (movimientos NBCW del periodo). Usamos sql.query como en tpr.js
    // porque el driver de Neon lo soporta bien ahí.
    let tprRows = []
    try {
      const tprQuery = isAllYards
        ? `SELECT id, sql_id, wono, truckid, fromd, fecha FROM tpr WHERE ${tprDateCondition}`
        : `SELECT id, sql_id, wono, truckid, fromd, fecha FROM tpr WHERE ${tprDateCondition} AND UPPER(TRIM(fromd)) = UPPER(TRIM($1))`
      const tprParams = isAllYards ? [] : [yardCode]
      tprRows = await sql.query(tprQuery, tprParams)
      console.log('NBCW tprRows count:', tprRows.length, isAllYards ? '(all yards)' : `(yard ${yardCode})`)
    } catch (tprErr) {
      console.error('NBCW tprRows query failed:', tprErr.message, tprErr.stack)
    }

    // Fallback: si el filtro exacto no devuelve filas para el día, consultamos
    // los últimos 3 días igual que tpr.js y filtramos en JS para evitar falsos 0.
    function parseMdyToIso(mdy) {
      if (!mdy) return null
      const str = String(mdy).trim()
      // Ya está en formato YYYY-MM-DD (nuevo sync script)
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
      // Formato MM/DD/YYYY (legacy)
      const parts = str.split('/').map(Number)
      if (parts.length !== 3 || parts.some(Number.isNaN)) return null
      const [m, d, y] = parts
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }

    if (period === 'day' && tprRows.length === 0) {
      try {
        const fallbackQuery = isAllYards
          ? `SELECT id, sql_id, wono, truckid, fromd, fecha FROM tpr WHERE TO_DATE(fecha, 'YYYY-MM-DD') >= (NOW() AT TIME ZONE 'America/Tijuana')::date - INTERVAL '3 days'`
          : `SELECT id, sql_id, wono, truckid, fromd, fecha FROM tpr WHERE TO_DATE(fecha, 'YYYY-MM-DD') >= (NOW() AT TIME ZONE 'America/Tijuana')::date - INTERVAL '3 days' AND UPPER(TRIM(fromd)) = UPPER(TRIM($1))`
        const fallbackParams = isAllYards ? [] : [yardCode]
        const fallbackRows = await sql.query(fallbackQuery, fallbackParams)
        const targetDate = anchorDate || parseMdyToIso(new Date().toLocaleDateString('en-US'))
        tprRows = fallbackRows.filter(r => parseMdyToIso(r.fecha) === targetDate)
        console.log('NBCW tprRows fallback count:', tprRows.length, 'from', fallbackRows.length, 'rows')
      } catch (fallbackErr) {
        console.error('NBCW tprRows fallback query failed:', fallbackErr.message, fallbackErr.stack)
      }
    }

    // 2. Inspecciones del periodo con work order (cruce primario).
    // Usamos CLAVE COMPUESTA: wono + tractor_number + location + fecha + sql_id, porque un
    // mismo wono puede tener varios movimientos (ida y vuelta) e incluso la
    // misma fromd y fecha, así que wono + truck_id + fromd + fecha no es suficiente.
    // El campo wono de inspections almacena work_order::sql_id cuando viene de NBCW.
    let inspectedSet = new Set()
    let inspectedBySqlId = new Set()
    let inspectedByWonoWithDate = new Set()
    let inspectedWonosList = []
    try {
      const inspectedQuery = `
        SELECT DISTINCT
          UPPER(TRIM(wono)) AS wono,
          UPPER(TRIM(tractor_number)) AS truck_id,
          UPPER(TRIM(location)) AS location,
          inspection_date
        FROM inspections
        WHERE status <> 'superseded'
          AND wono IS NOT NULL
          AND TRIM(wono) <> ''
          AND ${dateCondition}
      `
      const inspectedRows = await sql.query(inspectedQuery, [])
      for (const row of inspectedRows) {
        if (row.wono) {
          // El campo wono puede ser una clave compuesta work_order::sql_id
          const wonoParts = row.wono.split('::')
          const workOrder = wonoParts[0] || row.wono
          const sqlId = wonoParts[1] || ''
          // Convertir inspection_date (TIMESTAMPTZ) a formato ISO (YYYY-MM-DD) para
          // comparar con TPR.fecha de forma consistente. Se fuerza la zona horaria
          // America/Tijuana para evitar desplazamientos UTC.
          const d = row.inspection_date ? new Date(row.inspection_date) : null
          const fecha = d && !isNaN(d.getTime())
            ? d.toLocaleDateString('en-CA', { timeZone: 'America/Tijuana' })
            : ''
          const key = `${workOrder}::${row.truck_id || ''}::${row.location || ''}::${fecha}::${sqlId}`
          inspectedSet.add(key)
          // Si tenemos sqlId, cruzamos también solo por work_order::sql_id
          if (sqlId) {
            inspectedBySqlId.add(`${workOrder}::${sqlId.toLowerCase()}`)
          }
          // Fallback por work_order + fecha (sin truck ni sql_id)
          if (workOrder && fecha) {
            inspectedByWonoWithDate.add(`${workOrder}::${fecha}`)
          }
          inspectedWonosList.push(row.wono)
        }
      }
      console.log('NBCW inspectedRows count:', inspectedRows.length, 'unique keys:', inspectedSet.size, 'inspectedBySqlId:', inspectedBySqlId.size)
    } catch (inspErr) {
      console.error('NBCW inspectedRows query failed:', inspErr.message, inspErr.stack)
    }

    // 2a. Debug: inspecciones sin work order (para entender por qué no cruzan)
    let nullWonoCount = 0
    try {
      const nullWonoQuery = `
        SELECT COUNT(*) AS count
        FROM inspections
        WHERE status <> 'superseded'
          AND (wono IS NULL OR TRIM(wono) = '')
          AND ${dateCondition}
      `
      const nullResult = await sql.query(nullWonoQuery, [])
      nullWonoCount = Number(nullResult[0]?.count) || 0
      console.log('NBCW inspections without work order:', nullWonoCount)
    } catch (nullErr) {
      console.error('NBCW null wono query failed:', nullErr.message, nullErr.stack)
    }

    // 2b. Contar inspecciones de hoy (todas, no solo las que cruzan con TPR)
    let inspectedTodayCount = 0
    try {
      const todayInspectedQuery = `
        SELECT COUNT(*) AS count
        FROM inspections
        WHERE status <> 'superseded'
          AND ${dateCondition}
      `
      const todayResult = await sql.query(todayInspectedQuery, [])
      inspectedTodayCount = Number(todayResult[0]?.count) || 0
      console.log('NBCW inspectedToday count:', inspectedTodayCount)
    } catch (todayErr) {
      console.error('NBCW inspectedToday query failed:', todayErr.message, todayErr.stack)
    }

    // 3. Fallback por tractor para inspecciones sin work order (datos antiguos).
    let fallbackTractors = new Set()
    try {
      const fallbackQuery = `
        SELECT DISTINCT UPPER(TRIM(tractor_number)) AS tractor_number
        FROM inspections
        WHERE status <> 'superseded'
          AND (wono IS NULL OR TRIM(wono) = '')
          AND tractor_number IS NOT NULL
          AND TRIM(tractor_number) <> ''
          AND ${dateCondition}
      `
      const fallbackRows = await sql.query(fallbackQuery, [])
      for (const row of fallbackRows) {
        if (row.tractor_number) fallbackTractors.add(row.tractor_number)
      }
      console.log('NBCW fallbackTractors count:', fallbackTractors.size)
    } catch (fallbackErr) {
      console.error('NBCW fallbackRows query failed:', fallbackErr.message, fallbackErr.stack)
    }

    console.log('NBCW samples:', {
      sampleTprWonos: tprRows.slice(0, 5).map(r => r.wono?.toString().trim().toUpperCase()).filter(Boolean),
      sampleInspectionWonos: Array.from(inspectedSet).slice(0, 5),
      sampleFallbackTractors: Array.from(fallbackTractors).slice(0, 5),
      allInspectionWonos: inspectedWonosList,
      nullWonoCount,
      inspectedTodayCount
    })

    const perYard = new Map()
    for (const m of tprRows) {
      const wono = m.wono?.toString().trim().toUpperCase()
      const truck = m.truckid?.toString().trim().toUpperCase()
      const fromd = m.fromd?.toString().trim().toUpperCase()
      // Normalizar fecha TPR (MM/DD/YYYY) a ISO (YYYY-MM-DD) para coincidir
      // con el formato usado en inspectedSet (evita mismatch de ceros iniciales).
      const fecha = parseMdyToIso(m.fecha?.toString().trim()) || ''
      const sqlId = m.sql_id?.toString().trim() || ''
      const compositeKey = `${wono || ''}::${truck || ''}::${fromd || ''}::${fecha}::${sqlId}`
      const sqlIdKey = sqlId && wono ? `${wono}::${sqlId.toLowerCase()}` : null
      const wonoWithDateKey = wono && fecha ? `${wono}::${fecha}` : null
      const alreadyByWono = !!(wono && inspectedSet.has(compositeKey))
      const alreadyBySqlId = !!(sqlIdKey && inspectedBySqlId.has(sqlIdKey))
      const alreadyByWonoOnly = !!(wonoWithDateKey && inspectedByWonoWithDate.has(wonoWithDateKey))
      const alreadyByTractor = !!(truck && fallbackTractors.has(truck))
      const already = alreadyByWono || alreadyBySqlId || alreadyByWonoOnly || alreadyByTractor

      nbcw.total++
      if (already) nbcw.inspected++

      const yc = m.fromd?.toString().trim().toUpperCase()
      if (yc) {
        if (!perYard.has(yc)) perYard.set(yc, { total: 0, inspected: 0 })
        const entry = perYard.get(yc)
        entry.total++
        if (already) entry.inspected++
      }
    }
    nbcw.pending = Math.max(0, nbcw.total - nbcw.inspected)
    nbcw.inspectedToday = inspectedTodayCount
    console.log('NBCW result:', nbcw)

    if (isAllYards) {
      nbcwByYard = yards
        .map(y => {
          const e = perYard.get(String(y.code || '').trim().toUpperCase()) || { total: 0, inspected: 0 }
          return {
            yard_id: y.id,
            yard_name: y.name,
            yard_code: y.code,
            nbcw_total: e.total,
            nbcw_inspected: e.inspected,
            nbcw_pending: Math.max(0, e.total - e.inspected),
          }
        })
        .filter(y => y.nbcw_total > 0)
        .sort((a, b) => b.nbcw_total - a.nbcw_total)
    }

    // ============================================================
    // RESPUESTA
    // ============================================================
    return res.status(200).json({
      success: true,
      period,
      dateLabel,
      yardCode: isAllYards ? 'all' : yardCode,
      isAllYards,
      yards,
      general: generalMetrics[0] || {},
      byDay: dailyMetrics,
      byGuard: guardMetrics,
      byYard,
      nbcw,
      nbcwByYard,
      debug: {
        anchorDate,
        offset,
        tprDateCondition,
        dateCondition,
        tprRowsCount: tprRows.length,
        inspectedSetSize: inspectedSet.size,
        inspectedBySqlIdSize: inspectedBySqlId.size,
        inspectedByWonoWithDateSize: inspectedByWonoWithDate.size,
        fallbackTractorsSize: fallbackTractors.size,
        nullWonoCount,
        inspectedTodayCount,
        allInspectionWonos: inspectedWonosList,
        nbcw
      }
    })

  } catch (error) {
    console.error('Metrics Query Error:', error)
    return res.status(500).json({
      error: 'Failed to query metrics',
      details: error.message
    })
  }
}
