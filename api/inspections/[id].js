import { getSql } from '../_lib/db.js'
import { uploadPdf, downloadPdfBuffer, isBlobConfigured } from '../_lib/blob.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Check both req.query and req.params for id (Express compatibility)
  const id = req.query.id || req.params.id

  try {
    const sql = getSql()

    // PDF download endpoint
    if (req.method === 'GET' && req.query.pdf === 'true') {
      console.log('PDF download request for ID:', id, 'Type:', typeof id)

      // Clean ID - remove .pdf extension if present
      const cleanId = String(id).replace(/\.pdf$/, '')
      const inspectionId = parseInt(cleanId)

      if (isNaN(inspectionId)) {
        console.error('Invalid inspection ID:', id, 'Cleaned:', cleanId)
        return res.status(400).json({ error: 'Invalid inspection ID' })
      }

      const [inspection] = await sql`
        SELECT pdf_filename, pdf_url, pdf_data::bytea as pdf_data, trailer_number, seal_number, lock_number, driver_name, location, inspection_date, inspection_type, trailer_type, guard_name, guard_signature, guard_signed_at, supervisor_name, supervisor_signature, supervisor_signed_at, operator_name, operator_signature, language, tractor_number, container_number, equipment_nomenclature, customer_prefix, odometer, high_security_seal, seal_affixed, wono
        FROM inspections
        WHERE id = ${inspectionId}
      `

      console.log('Inspection found:', !!inspection, 'Has PDF URL:', !!(inspection?.pdf_url), 'Has PDF data:', !!(inspection?.pdf_data))

      if (!inspection) {
        return res.status(404).json({ error: 'Inspection not found' })
      }

      // Try Blob URL first (new storage), fall back to pdf_data (legacy)
      if (inspection.pdf_url) {
        try {
          const pdfBuffer = await downloadPdfBuffer(inspection.pdf_url)
          if (pdfBuffer) {
            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader('Content-Disposition', `inline; filename="${inspection.pdf_filename || `inspection-${id}.pdf`}"`)
            res.setHeader('Content-Length', pdfBuffer.length)
            return res.status(200).end(pdfBuffer)
          }
        } catch (blobErr) {
          console.error('Blob download failed, trying legacy pdf_data:', blobErr.message)
        }
      }

      if (inspection.pdf_data) {
        // Return stored PDF as binary buffer (legacy fallback)
        let pdfData = inspection.pdf_data
        let pdfBuffer
        if (Buffer.isBuffer(pdfData)) {
          pdfBuffer = pdfData
        } else if (typeof pdfData === 'string') {
          if (pdfData.startsWith('data:application/pdf')) {
            pdfData = pdfData.replace(/^data:application\/pdf(;[^,]*)?;base64,/, '')
            pdfBuffer = Buffer.from(pdfData, 'base64')
          } else if (pdfData.match(/^[0-9a-fA-F]+$/)) {
            pdfBuffer = Buffer.from(pdfData, 'hex')
          } else {
            pdfBuffer = Buffer.from(pdfData, 'base64')
          }
        } else {
          pdfBuffer = Buffer.from(pdfData)
        }

        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `inline; filename="${inspection.pdf_filename || `inspection-${id}.pdf`}"`)
        res.setHeader('Content-Length', pdfBuffer.length)
        return res.status(200).end(pdfBuffer)
      }

      // PDF not stored - let frontend generate it
      return res.status(404).json({ error: 'PDF not available - frontend will generate it' })
    }

    if (req.method === 'GET') {
      // Get inspection by ID or UUID
      // Clean ID - remove .pdf extension if present
      const cleanId = String(id).replace(/\.pdf$/, '')
      const isUuid = cleanId.includes('-')

      const inspections = isUuid
        ? await sql`SELECT * FROM inspections WHERE uuid = ${cleanId}`
        : await sql`SELECT * FROM inspections WHERE id = ${parseInt(cleanId)}`

      if (inspections.length === 0) {
        return res.status(404).json({ error: 'Inspection not found' })
      }

      const inspection = inspections[0]

      // Get points
      const points = await sql`
        SELECT point_id, status, issue_id, issue_text, photo
        FROM inspection_points
        WHERE inspection_id = ${inspection.id}
        ORDER BY point_id
      `

      // Get audit logs
      const audits = await sql`
        SELECT * FROM audit_log
        WHERE inspection_id = ${inspection.id}
        ORDER BY created_at DESC
      `

      return res.status(200).json({
        inspection,
        points,
        audits
      })
    }

    if (req.method === 'POST') {
      const { name, signature, signedAt, pdfBase64, pdfFilename } = req.body

      console.log('POST /api/inspections/[id] - Supervisor signature request')
      console.log('Name:', name)
      console.log('Has signature:', !!signature)
      console.log('Signature length:', signature?.length || 0)
      console.log('SignedAt:', signedAt)
      console.log('Has pdfBase64:', !!pdfBase64)
      console.log('pdfBase64 length:', pdfBase64?.length || 0)

      if (!name || !signedAt) {
        return res.status(400).json({ error: 'Name and signedAt are required' })
      }

      // Clean ID - remove .pdf extension if present
      const cleanId = String(id).replace(/\.pdf$/, '')
      const inspectionId = parseInt(cleanId)

      // Prepare PDF update only if provided by frontend. We DO NOT regenerate the
      // PDF in the backend here because it is heavy (jsPDF + images) and can time
      // out on serverless, causing the supervisor signature to fail to save.
      // The frontend uploads the regenerated PDF separately via PUT /pdf.
      // PDFs are now stored in Vercel Blob, NOT in the database.
      let pdfUpdate = {}
      if (pdfBase64) {
        const pdfDataB64 = String(pdfBase64).replace(/^data:application\/pdf(;[^,]*)?;base64,/, '')
        const pdfBuffer = Buffer.from(pdfDataB64, 'base64')
        console.log('Supervisor sign - PDF provided, size:', pdfBuffer.length)

        if (isBlobConfigured()) {
          try {
            const blobResult = await uploadPdf(pdfBuffer, pdfFilename || 'inspection.pdf')
            pdfUpdate = {
              pdf_filename: pdfFilename || 'inspection.pdf',
              pdf_url: blobResult.url,
              pdf_size_bytes: blobResult.size
            }
            console.log('PDF uploaded to Blob:', blobResult.url)
          } catch (blobErr) {
            console.error('Blob upload failed during supervisor sign:', blobErr.message)
          }
        } else {
          console.warn('BLOB_READ_WRITE_TOKEN not configured - PDF not stored')
        }
      }

      // Update inspection with supervisor signature and mark as completed
      const setClauses = [
        'supervisor_name = $1',
        'supervisor_signature = $2',
        'supervisor_signed_at = $3',
        "status = 'completed'",
        'updated_at = NOW()'
      ]
      const params = [name, signature || null, signedAt]
      if (Object.keys(pdfUpdate).length > 0) {
        setClauses.push(`pdf_filename = $${params.length + 1}`)
        params.push(pdfUpdate.pdf_filename)
        setClauses.push(`pdf_url = $${params.length + 1}`)
        params.push(pdfUpdate.pdf_url)
        setClauses.push('pdf_data = NULL')
        setClauses.push(`pdf_size_bytes = $${params.length + 1}`)
        params.push(pdfUpdate.pdf_size_bytes)
      }
      params.push(inspectionId)
      const result = await sql.query(
        `UPDATE inspections SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      )

      console.log('Update result:', result.length > 0 ? 'Success' : 'Failed')
      if (result.length > 0) {
        console.log('Updated supervisor_name:', result[0].supervisor_name)
        console.log('Updated supervisor_signature length:', result[0].supervisor_signature?.length || 0)
      }

      if (result.length === 0) {
        return res.status(404).json({ error: 'Inspection not found' })
      }

      return res.status(200).json({
        message: 'Supervisor signature added successfully',
        inspection: result[0]
      })
    }

    if (req.method === 'PUT') {
      const { pdfBase64, pdfFilename } = req.body
      if (!pdfBase64) {
        return res.status(400).json({ error: 'pdfBase64 required' })
      }

      // id may be '56' or '56/pdf' depending on how Vercel routes it
      const rawId = String(id).replace(/\/pdf$/, '').replace(/\.pdf$/, '')
      const inspectionId = parseInt(rawId)
      if (isNaN(inspectionId)) {
        return res.status(400).json({ error: 'Invalid inspection ID' })
      }

      const pdfDataB64 = String(pdfBase64).replace(/^data:application\/pdf(;[^,]*)?;base64,/, '')
      const pdfBuffer = Buffer.from(pdfDataB64, 'base64')

      console.log('PUT /api/inspections/[id] - Uploading PDF to Blob, size:', pdfBuffer.length, 'bytes')

      // Upload to Vercel Blob instead of database
      let pdfUrl = null
      if (isBlobConfigured()) {
        try {
          const blobResult = await uploadPdf(pdfBuffer, pdfFilename || 'inspection.pdf')
          pdfUrl = blobResult.url
        } catch (blobErr) {
          console.error('Blob upload failed:', blobErr.message)
          return res.status(500).json({ error: 'Failed to upload PDF to Blob: ' + blobErr.message })
        }
      } else {
        return res.status(500).json({ error: 'Blob storage not configured (BLOB_READ_WRITE_TOKEN missing)' })
      }

      const [updated] = await sql`
        UPDATE inspections
        SET pdf_filename = ${pdfFilename || 'inspection.pdf'},
            pdf_url = ${pdfUrl},
            pdf_data = NULL,
            pdf_size_bytes = ${pdfBuffer.length},
            updated_at = NOW()
        WHERE id = ${inspectionId}
        RETURNING id
      `

      if (!updated) {
        return res.status(404).json({ error: 'Inspection not found' })
      }

      return res.status(200).json({ success: true, pdfSize: pdfBuffer.length, pdfUrl })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
