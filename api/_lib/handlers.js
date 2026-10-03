import { getSql, logAudit, getClientIp, readJsonBody } from './db.js'
import { uploadPdf, downloadPdfBuffer, isBlobConfigured } from './blob.js'

/** POST /api/inspections — create new inspection */
export async function createInspection(req, res) {
  console.log('=== createInspection called ===')
  try {
    const body = await readJsonBody(req)
    console.log('Request body keys:', Object.keys(body))
    const {
      unitInfo = {},
      points = {},
      sealPhoto = null,
      guardSignature = {},
      supervisorSignature = {},
      operatorSignature = {},
      auditorSignature = {},
      language = 'es',
      pdfBase64,
      pdfFilename,
      counts = {},
    } = body

    // PDF is now optional - backend will generate it if not provided
    if (!guardSignature?.name || !guardSignature?.signature) {
      return res.status(400).json({ error: 'Guard signature is required' })
    }

    // Rechazar inspecciones sin yarda: location viene de unitInfo.location
    const reqLocation = (unitInfo.location || '').toString().trim()
    if (!reqLocation) {
      return res.status(400).json({ error: 'No yard assigned. The inspection must have a location (yard code).' })
    }

    const sql = getSql()
    const ip = getClientIp(req)
    const ua = req.headers['user-agent'] || null

    // Strip data:... prefix (handle both with and without filename)
    // If pdfBase64 is null, set pdfBuffer to null (PDF will be generated later)
    let pdfBuffer = null
    if (pdfBase64) {
      const pdfDataB64 = String(pdfBase64).replace(/^data:application\/pdf(;[^,]*)?;base64,/, '')
      pdfBuffer = Buffer.from(pdfDataB64, 'base64')
    }

    const inspectionDate = unitInfo.inspectionDate ? new Date(unitInfo.inspectionDate) : new Date()

    // Support both old camelCase (trailerNumber) and new snake_case (trailer_number)
    const ui = unitInfo
    const trailer_number = ui.trailer_number || ui.trailerNumber || null

    console.log('Create inspection unitInfo:', {
      equipmentNomenclature: ui.equipmentNomenclature || ui.equipment_nomenclature,
      customerPrefix: ui.customerPrefix || ui.customer_prefix,
      crownFleet: ui.crownFleet || ui.crown_fleet,
      trailerNumber: trailer_number,
      tractorNumber: ui.tractorNumber || ui.tractor_number
    })
    console.log('Counts received:', counts)
    console.log('Supervisor signature received:', {
      name: supervisorSignature?.name,
      hasSignature: !!supervisorSignature?.signature,
      signedAt: supervisorSignature?.signedAt
    })
    const seal_number = ui.seal_number || ui.sealNumber || null
    const lock_number = ui.lock_number || ui.lockNumber || null
    const driver_name = ui.driver_name || ui.driverName || null
    const odometer = ui.odometer || null
    const location = ui.location || null
    const guard_name_field = ui.guard_name || guardSignature.name || null
    const raw_work_order = (ui.workOrder || ui.wono || '').toString().trim() || null
    const sql_id = ui.sqlId ? ui.sqlId.toString().trim() : null
    // Si viene el sql_id (ID estable de SQL Server), guardamos wono como clave compuesta
    // (work_order::sql_id) para poder cruzar de forma exacta sin importar los IDs de Neon.
    const work_order = sql_id && raw_work_order
      ? `${raw_work_order}::${sql_id}`
      : raw_work_order

    console.log('createInspection work_order saved:', work_order, 'sql_id:', sql_id, 'raw:', raw_work_order)

    // Use PDF from frontend if provided; otherwise save inspection without PDF (client will upload it separately)
    // PDFs are now stored in Vercel Blob Storage, NOT in the database (Neon has a 512 MB limit)
    let pdfUrlToSave = null
    let pdfFilenameToSave = pdfFilename || null
    let pdfSizeToSave = 0

    if (pdfBuffer && isBlobConfigured()) {
      try {
        const blobResult = await uploadPdf(pdfBuffer, pdfFilename || 'inspection.pdf')
        pdfUrlToSave = blobResult.url
        pdfSizeToSave = blobResult.size
        console.log('PDF uploaded to Blob:', pdfUrlToSave, '- size:', pdfSizeToSave)
      } catch (blobErr) {
        console.error('Blob upload failed, continuing without PDF:', blobErr.message)
      }
    } else if (pdfBuffer && !isBlobConfigured()) {
      console.warn('BLOB_READ_WRITE_TOKEN not configured - PDF will not be stored')
    } else {
      console.log('No PDF provided - saving inspection without PDF (client will upload via PUT /pdf)')
    }

    // Save inspection always (PDF can be updated later)
    const [inspection] = await sql`
      INSERT INTO inspections (
        trailer_number, seal_number, lock_number, driver_name, odometer, location,
        inspection_date, high_security_seal, seal_affixed, language,
        operator_name, operator_signature, operator_signed_at,
        guard_name, guard_signature, guard_signed_at,
        supervisor_name, supervisor_signature, supervisor_signed_at,
        auditor_name, auditor_signed_at,
        status, total_good, total_bad, total_pending,
        pdf_filename, pdf_url, pdf_size_bytes,
        created_ip, created_user_agent,
        equipment_nomenclature, tractor_number, container_number, customer_prefix, crown_fleet,
        inspection_type, trailer_type, wono
      ) VALUES (
        ${trailer_number},
        ${seal_number},
        ${lock_number},
        ${driver_name},
        ${odometer},
        ${location},
        ${inspectionDate},
        ${ui.highSecuritySeal === 'yes' || ui.high_security_seal === true},
        ${ui.sealAffixed === 'yes' || ui.seal_affixed === true},
        ${language},
        ${operatorSignature?.name || null},
        ${operatorSignature?.signature || null},
        ${operatorSignature?.signedAt ? new Date(operatorSignature.signedAt) : null},
        ${guard_name_field},
        ${guardSignature.signature || null},
        ${guardSignature.signedAt ? new Date(guardSignature.signedAt) : new Date()},
        ${supervisorSignature?.name || null},
        ${supervisorSignature?.signature || null},
        ${supervisorSignature?.signedAt ? new Date(supervisorSignature.signedAt) : null},
        ${auditorSignature.name || null},
        ${auditorSignature.signedAt ? new Date(auditorSignature.signedAt) : null},
        ${auditorSignature.signature && guardSignature?.signature ? 'audited' : (supervisorSignature?.signature && guardSignature?.signature ? 'completed' : 'pending')},
        ${counts.good || 0},
        ${counts.bad || 0},
        ${counts.pending || 0},
        ${pdfFilenameToSave || 'inspection.pdf'},
        ${pdfUrlToSave},
        ${pdfSizeToSave},
        ${ip},
        ${ua},
        ${ui.equipmentNomenclature || ui.equipment_nomenclature || null},
        ${ui.tractorNumber || ui.tractor_number || null},
        ${ui.containerNumber || ui.container_number || null},
        ${ui.customerPrefix || ui.customer_prefix || null},
        ${ui.crownFleet || ui.crown_fleet || null},
        ${ui.inspectionType || ui.inspection_type || 'LOADED'},
        ${ui.trailerType || ui.trailer_type || null},
        ${work_order}
      )
      RETURNING id, uuid, created_at
    `

    // Insert per-point details
    const pointRows = Object.entries(points).map(([id, p]) => ({
      id: parseInt(id, 10),
      status: p.status,
      issueId: p.issueId,
      issueText: p.issueText || null,
      hasPhoto: !!p.photo,
      photo: p.photo || null,
    }))
    for (const pt of pointRows) {
      await sql`
        INSERT INTO inspection_points (inspection_id, point_id, status, issue_id, issue_text, photo)
        VALUES (${inspection.id}, ${pt.id}, ${pt.status}, ${pt.issueId}, ${pt.issueText}, ${pt.photo})
      `
    }

    // Audit entries
    await logAudit({
      inspectionId: inspection.id, userName: driver_name || 'system',
      role: 'operator', action: 'created',
      details: { trailer: trailer_number, seal: seal_number, lock: lock_number },
      ip, ua,
    })
    await logAudit({
      inspectionId: inspection.id, userName: guardSignature.name,
      role: 'guard', action: 'signed_guard',
      details: { signedAt: guardSignature.signedAt },
      ip, ua,
    })
    if (operatorSignature?.signature && operatorSignature?.name) {
      await logAudit({
        inspectionId: inspection.id, userName: operatorSignature.name,
        role: 'operator', action: 'signed_operator',
        details: { signedAt: operatorSignature.signedAt },
        ip, ua,
      })
    }
    if (supervisorSignature?.signature && supervisorSignature?.name) {
      await logAudit({
        inspectionId: inspection.id, userName: supervisorSignature.name,
        role: 'supervisor', action: 'signed_supervisor',
        details: { signedAt: supervisorSignature.signedAt },
        ip, ua,
      })
    }
    if (auditorSignature.signature && auditorSignature.name) {
      await logAudit({
        inspectionId: inspection.id, userName: auditorSignature.name,
        role: 'auditor', action: 'signed_auditor',
        details: { signedAt: auditorSignature.signedAt },
        ip, ua,
      })
    }

    return res.status(201).json({
      success: true,
      id: inspection.id,
      uuid: inspection.uuid,
      createdAt: inspection.created_at,
      pdfUrl: `/api/inspections/${inspection.id}/pdf`,
    })
  } catch (err) {
    console.error('createInspection error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

/** GET /api/inspections — list */
export async function listInspections(req, res) {
  try {
    const sql = getSql()
    const url = new URL(req.url, 'http://x')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)
    const yardCode = url.searchParams.get('yardCode') || ''
    const guardName = url.searchParams.get('guardName') || ''

    // NOTE: pdf_data (bytea) is intentionally excluded here. With up to 200-500
    // rows per request, including the full PDF binary blows past Neon's 64MB
    // response limit (HTTP 507). The PDF is fetched separately per-inspection
    // via GET /api/inspections/:id/pdf, or regenerated client-side from the
    // signature fields (which are included below).
    const LIST_COLUMNS = `
      id, uuid, trailer_number, tractor_number, container_number, seal_number, lock_number,
      driver_name, odometer, location, inspection_date, high_security_seal, seal_affixed,
      language, operator_name, operator_signature, operator_signed_at,
      guard_name, guard_signature, guard_signed_at,
      supervisor_name, supervisor_signature, supervisor_signed_at,
      auditor_name, auditor_signed_at,
      status, total_good, total_bad, total_pending,
      pdf_filename, pdf_url, pdf_size_bytes,
      equipment_nomenclature, customer_prefix, crown_fleet,
      inspection_type, trailer_type, wono, created_at,
      original_inspection_id, reconfirmation_reason, is_reconfirmation
    `

    let rows
    if (guardName) {
      // Filter by guard name (for guards to see only their own inspections)
      rows = await sql`
        SELECT ${sql.unsafe(LIST_COLUMNS)} FROM inspections
        WHERE guard_name = ${guardName}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else if (yardCode) {
      // Filter by yard code(s) - handle multiple yards separated by comma
      // Normalizar con UPPER(TRIM()) para tolerar diferencias de case/whitespace
      const yardCodes = yardCode.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
      if (yardCodes.length === 1) {
        rows = await sql`
          SELECT ${sql.unsafe(LIST_COLUMNS)} FROM inspections
          WHERE UPPER(TRIM(location)) = ${yardCodes[0]}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      } else {
        rows = await sql`
          SELECT ${sql.unsafe(LIST_COLUMNS)} FROM inspections
          WHERE UPPER(TRIM(location)) = ANY(${yardCodes})
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      }
    } else {
      rows = await sql`
        SELECT ${sql.unsafe(LIST_COLUMNS)} FROM inspections
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    }
    return res.status(200).json({ data: rows, limit, offset })
  } catch (err) {
    console.error('listInspections error:', err)
    return res.status(500).json({ error: err.message })
  }
}

/** GET /api/inspections/:id */
export async function getInspection(req, res, id) {
  try {
    const sql = getSql()
    const [insp] = await sql`SELECT * FROM inspections WHERE id = ${id} LIMIT 1`
    if (!insp) return res.status(404).json({ error: 'Not found' })

    const points = await sql`
      SELECT point_id, status, issue_id, issue_text, photo
      FROM inspection_points WHERE inspection_id = ${id}
      ORDER BY point_id
    `
    const audits = await sql`
      SELECT id, user_name, role, action, details, ip_address, created_at
      FROM audit_log WHERE inspection_id = ${id}
      ORDER BY created_at ASC
    `
    return res.status(200).json({ inspection: insp, points, audits })
  } catch (err) {
    console.error('getInspection error:', err)
    return res.status(500).json({ error: err.message })
  }
}

/** GET /api/inspections/:id/pdf */
export async function downloadPdf(req, res, id) {
  try {
    const sql = getSql()
    const [row] = await sql`SELECT pdf_filename, pdf_url, pdf_data FROM inspections WHERE id = ${id} LIMIT 1`
    if (!row) return res.status(404).json({ error: 'PDF not found' })

    await logAudit({
      inspectionId: parseInt(id, 10),
      action: 'downloaded_pdf',
      ip: getClientIp(req),
      ua: req.headers['user-agent'] || null,
    })

    // Try Blob URL first (new storage), fall back to pdf_data (legacy)
    if (row.pdf_url) {
      const buf = await downloadPdfBuffer(row.pdf_url)
      if (buf) {
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `inline; filename="${row.pdf_filename || 'inspection.pdf'}"`)
        res.setHeader('Content-Length', buf.length)
        return res.status(200).end(buf)
      }
    }

    if (row.pdf_data) {
      const buf = Buffer.isBuffer(row.pdf_data) ? row.pdf_data : Buffer.from(row.pdf_data)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${row.pdf_filename || 'inspection.pdf'}"`)
      res.setHeader('Content-Length', buf.length)
      return res.status(200).end(buf)
    }

    return res.status(404).json({ error: 'PDF not available - frontend will generate it' })
  } catch (err) {
    console.error('downloadPdf error:', err)
    return res.status(500).json({ error: err.message })
  }
}

/** POST /api/inspections/:id/sign-auditor — add auditor signature later */
export async function signAuditor(req, res, id) {
  try {
    const body = await readJsonBody(req)
    const { name, signedAt } = body
    if (!name) return res.status(400).json({ error: 'name required' })

    const sql = getSql()
    const ts = signedAt ? new Date(signedAt) : new Date()
    const [row] = await sql`
      UPDATE inspections
      SET auditor_name = ${name}, auditor_signed_at = ${ts}, status = 'audited', updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, auditor_name, auditor_signed_at, status
    `
    if (!row) return res.status(404).json({ error: 'Not found' })

    await logAudit({
      inspectionId: parseInt(id, 10),
      userName: name, role: 'auditor', action: 'signed_auditor',
      details: { signedAt: ts },
      ip: getClientIp(req), ua: req.headers['user-agent'] || null,
    })

    return res.status(200).json({ success: true, ...row })
  } catch (err) {
    console.error('signAuditor error:', err)
    return res.status(500).json({ error: err.message })
  }
}

/** POST /api/inspections/:id/reconfirm — create reconfirmation linked to original */
export async function reconfirmInspection(req, res, originalId) {
  try {
    const body = await readJsonBody(req)
    const {
      reason,
      modifications = [],
      reconfirmed_by,
      reconfirmed_by_name,
      pdfBase64,
      pdfFilename,
    } = body

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Reason (>=10 chars) is required' })
    }
    if (!modifications.length) {
      return res.status(400).json({ error: 'At least one modification required' })
    }

    const sql = getSql()
    const ip = getClientIp(req)
    const ua = req.headers['user-agent'] || null

    // Get original
    const [original] = await sql`SELECT * FROM inspections WHERE id = ${originalId} LIMIT 1`
    if (!original) return res.status(404).json({ error: 'Original inspection not found' })

    // Compute new totals from modifications + original points
    const origPoints = await sql`
      SELECT point_id, status, issue_id, issue_text, photo
      FROM inspection_points WHERE inspection_id = ${originalId}
    `
    const pointsMap = {}
    for (const p of origPoints) pointsMap[p.point_id] = { ...p }
    for (const mod of modifications) {
      pointsMap[mod.pointId] = {
        point_id: mod.pointId,
        status: mod.status,
        issue_id: mod.issueId || null,
        issue_text: mod.issueText || null,
        photo: mod.photo,
      }
    }
    const allPoints = Object.values(pointsMap)
    const total_good = allPoints.filter(p => p.status === 'good').length
    const total_bad = allPoints.filter(p => p.status === 'bad').length
    const total_pending = allPoints.length - total_good - total_bad

    // Upload PDF to Vercel Blob if provided
    let pdfUrlToSave = null
    let pdfSizeToSave = 0
    if (pdfBase64 && isBlobConfigured()) {
      try {
        const pdfDataB64 = String(pdfBase64).replace(/^data:application\/pdf(;[^,]*)?;base64,/, '')
        const pdfBuffer = Buffer.from(pdfDataB64, 'base64')
        const blobResult = await uploadPdf(pdfBuffer, pdfFilename || 'inspection.pdf')
        pdfUrlToSave = blobResult.url
        pdfSizeToSave = blobResult.size
      } catch (blobErr) {
        console.error('Blob upload failed during reconfirm:', blobErr.message)
      }
    }

    // Insert new inspection (reconfirmation)
    const [newInsp] = await sql`
      INSERT INTO inspections (
        trailer_number, seal_number, lock_number, driver_name, location,
        inspection_date, language,
        operator_name, guard_name, guard_signed_at,
        status, total_good, total_bad, total_pending,
        original_inspection_id, reconfirmation_reason, is_reconfirmation,
        pdf_filename, pdf_url, pdf_size_bytes,
        created_ip, created_user_agent
      ) VALUES (
        ${original.trailer_number}, ${original.seal_number}, ${original.lock_number},
        ${original.driver_name}, ${original.location},
        NOW(), ${original.language},
        ${reconfirmed_by_name || original.operator_name || original.guard_name},
        ${reconfirmed_by_name || original.guard_name},
        NOW(),
        'reconfirmed', ${total_good}, ${total_bad}, ${total_pending},
        ${originalId}, ${reason}, TRUE,
        ${pdfFilename || 'inspection.pdf'},
        ${pdfUrlToSave},
        ${pdfSizeToSave},
        ${ip}, ${ua}
      )
      RETURNING id, uuid, created_at
    `

    // Insert merged points
    for (const pt of allPoints) {
      await sql`
        INSERT INTO inspection_points (inspection_id, point_id, status, issue_id, issue_text, photo)
        VALUES (${newInsp.id}, ${pt.point_id}, ${pt.status}, ${pt.issue_id}, ${pt.issue_text}, ${pt.photo})
      `
    }

    // Mark original as superseded
    await sql`UPDATE inspections SET status = 'superseded', updated_at = NOW() WHERE id = ${originalId}`

    // Audit logs
    await logAudit({
      inspectionId: newInsp.id,
      userId: reconfirmed_by, userName: reconfirmed_by_name,
      role: 'guard', action: 'reconfirmed',
      details: { original_id: originalId, reason, modified_points: modifications.length },
      ip, ua,
    })
    await logAudit({
      inspectionId: originalId,
      userId: reconfirmed_by, userName: reconfirmed_by_name,
      role: 'guard', action: 'superseded_by',
      details: { new_inspection_id: newInsp.id, reason },
      ip, ua,
    })

    return res.status(201).json({
      success: true,
      id: newInsp.id,
      uuid: newInsp.uuid,
      original_id: originalId,
      pdfUrl: null,
      modifications: modifications.length,
    })
  } catch (err) {
    console.error('reconfirmInspection error:', err)
    return res.status(500).json({ error: err.message })
  }
}

/** GET /api/inspections/:id/chain — get original + all reconfirmations */
export async function getInspectionChain(req, res, id) {
  try {
    const sql = getSql()
    const chain = await sql`
      WITH RECURSIVE chain AS (
        SELECT * FROM inspections WHERE id = ${id} OR original_inspection_id = ${id}
      )
      SELECT * FROM chain ORDER BY created_at ASC
    `
    return res.status(200).json({ chain })
  } catch (err) {
    console.error('getInspectionChain error:', err)
    return res.status(500).json({ error: err.message })
  }
}

/** PUT /api/inspections/:id/pdf — upload PDF generated on frontend */
export async function updateInspectionPdf(req, res, id) {
  try {
    const body = await readJsonBody(req)
    const { pdfBase64, pdfFilename } = body
    if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 required' })

    const pdfDataB64 = String(pdfBase64).replace(/^data:application\/pdf(;[^,]*)?;base64,/, '')
    const pdfBuffer = Buffer.from(pdfDataB64, 'base64')
    const sql = getSql()

    // Upload to Vercel Blob instead of storing in database
    let pdfUrl = null
    if (isBlobConfigured()) {
      try {
        const blobResult = await uploadPdf(pdfBuffer, pdfFilename || 'inspection.pdf')
        pdfUrl = blobResult.url
      } catch (blobErr) {
        console.error('Blob upload failed:', blobErr.message)
        return res.status(500).json({ error: 'Failed to upload PDF to Blob storage: ' + blobErr.message })
      }
    } else {
      console.error('BLOB_READ_WRITE_TOKEN not configured')
      return res.status(500).json({ error: 'Blob storage not configured (BLOB_READ_WRITE_TOKEN missing)' })
    }

    const [row] = await sql`
      UPDATE inspections
      SET pdf_filename = ${pdfFilename || 'inspection.pdf'},
          pdf_url = ${pdfUrl},
          pdf_data = NULL,
          pdf_size_bytes = ${pdfBuffer.length},
          updated_at = NOW()
      WHERE id = ${parseInt(id, 10)}
      RETURNING id
    `
    if (!row) return res.status(404).json({ error: 'Inspection not found' })

    console.log('PDF uploaded to Blob for inspection', id, '- size:', pdfBuffer.length, 'bytes, url:', pdfUrl)
    return res.status(200).json({ success: true, pdfSize: pdfBuffer.length, pdfUrl })
  } catch (err) {
    console.error('updateInspectionPdf error:', err)
    return res.status(500).json({ error: err.message })
  }
}

/** GET /api/health */
export async function healthCheck(req, res) {
  try {
    const sql = getSql()
    const [r] = await sql`SELECT NOW() as now, version() as version`
    return res.status(200).json({ ok: true, db: { now: r.now, version: r.version.split(' ').slice(0, 2).join(' ') } })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}
