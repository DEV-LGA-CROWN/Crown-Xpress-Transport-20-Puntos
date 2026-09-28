import { getSql } from '../_lib/db.js'
import { createInspection } from '../_lib/handlers.js'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const sql = getSql()
    
    if (req.method === 'GET') {
      // List inspections
      const allRows = req.query.limit === 'all'
      const limit = allRows ? null : (parseInt(req.query.limit) || 50)
      const offset = parseInt(req.query.offset) || 0
      const yardCode = req.query.yardCode
      const guardName = req.query.guardName

      // Soportar múltiples yardas separadas por coma (ej: "YARD1,YARD2,YARD3")
      const yardCodes = yardCode
        ? yardCode.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
        : []

      const selectColumns = `
        id, uuid, trailer_number, tractor_number, container_number, seal_number, lock_number,
        driver_name, odometer, location, inspection_date,
        high_security_seal, seal_affixed,
        guard_name, guard_signed_at,
        auditor_name, auditor_signed_at,
        total_good, total_bad, total_pending,
        status, language, created_at, original_inspection_id, wono, inspection_type, trailer_type,
        equipment_nomenclature, customer_prefix, crown_fleet, pdf_url
      `

      let inspections
      let countResult

      if (yardCodes.length > 0) {
        // Soportar múltiples yardas: usamos sql.query con placeholders ($1, $2, ...)
        // igual que tpr.js, porque el driver Neon lo soporta bien.
        const placeholders = yardCodes.map((_, i) => `$${i + 1}`).join(', ')
        let paramIdx = yardCodes.length
        const listParams = [...yardCodes]
        const countParams = [...yardCodes]
        let listWhere = `UPPER(TRIM(location)) IN (${placeholders})`
        let countWhere = `UPPER(TRIM(location)) IN (${placeholders})`

        if (guardName) {
          listWhere += ` AND guard_name = $${++paramIdx}`
          countWhere += ` AND guard_name = $${paramIdx}`
          listParams.push(guardName)
          countParams.push(guardName)
        }

        let listQuery = `SELECT ${selectColumns} FROM inspections WHERE ${listWhere} ORDER BY created_at DESC`
        if (allRows) {
          inspections = await sql.query(listQuery, listParams)
        } else {
          listQuery += ` LIMIT $${++paramIdx} OFFSET $${++paramIdx}`
          inspections = await sql.query(listQuery, [...listParams, limit, offset])
        }
        const countQuery = `SELECT COUNT(*) as total FROM inspections WHERE ${countWhere}`
        countResult = await sql.query(countQuery, countParams)
      } else if (guardName) {
        inspections = allRows
          ? await sql`
              SELECT ${sql.unsafe(selectColumns)}
              FROM inspections
              WHERE guard_name = ${guardName}
              ORDER BY created_at DESC
            `
          : await sql`
              SELECT ${sql.unsafe(selectColumns)}
              FROM inspections
              WHERE guard_name = ${guardName}
              ORDER BY created_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `
        countResult = await sql`SELECT COUNT(*) as total FROM inspections WHERE guard_name = ${guardName}`
      } else {
        inspections = allRows
          ? await sql`
              SELECT ${sql.unsafe(selectColumns)}
              FROM inspections
              ORDER BY created_at DESC
            `
          : await sql`
              SELECT ${sql.unsafe(selectColumns)}
              FROM inspections
              ORDER BY created_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `
        countResult = await sql`SELECT COUNT(*) as total FROM inspections`
      }

      const total = parseInt(countResult[0]?.total || 0)

      return res.status(200).json({
        data: inspections,
        limit,
        offset,
        total
      })
    }

    if (req.method === 'POST') {
      return createInspection(req, res)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
