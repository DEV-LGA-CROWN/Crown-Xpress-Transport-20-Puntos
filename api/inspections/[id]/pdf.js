import { getSql } from '../../_lib/db.js'
import { uploadPdf, downloadPdfBuffer, isBlobConfigured } from '../../_lib/blob.js'
import { requireAuth } from '../../_lib/session.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const authUser = await requireAuth(req, res)
  if (!authUser) return

  if (req.method === 'GET') {
    try {
      const sql = getSql()
      const id = req.query.id || (req.params && req.params.id)

      if (!id) {
        return res.status(400).json({ error: 'Inspection ID is required' })
      }

      const [inspection] = await sql`
        SELECT pdf_filename, pdf_url, pdf_data
        FROM inspections
        WHERE id = ${parseInt(id)}
      `

      if (!inspection) {
        return res.status(404).json({ error: 'Inspection not found' })
      }

      // Try Blob URL first (new storage), fall back to pdf_data (legacy)
      if (inspection.pdf_url) {
        try {
          const pdfBuffer = await downloadPdfBuffer(inspection.pdf_url)
          if (pdfBuffer) {
            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader('Content-Disposition', `attachment; filename="${inspection.pdf_filename || `inspection-${id}.pdf`}"`)
            return res.send(pdfBuffer)
          }
        } catch (blobErr) {
          console.error('Blob download failed, trying legacy:', blobErr.message)
        }
      }

      if (inspection.pdf_data) {
        // Legacy: pdf_data stored as BYTEA in database
        const pdfBuffer = inspection.pdf_data
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="${inspection.pdf_filename || `inspection-${id}.pdf`}"`)
        return res.send(pdfBuffer)
      }

      return res.status(404).json({ error: 'PDF not available - frontend will generate it' })
    } catch (error) {
      console.error('PDF Download Error:', error)
      return res.status(500).json({ error: 'Failed to download PDF' })
    }
  }

  if (req.method === 'PUT') {
    try {
      const sql = getSql()
      const id = req.query.id || (req.params && req.params.id)

      if (!id) {
        return res.status(400).json({ error: 'Inspection ID is required' })
      }

      const body = req.body || await new Promise((resolve) => {
        let data = ''
        req.on('data', chunk => { data += chunk })
        req.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve({}) } })
      })

      const { pdfBase64, pdfFilename } = body
      if (!pdfBase64) {
        return res.status(400).json({ error: 'pdfBase64 required' })
      }

      const pdfDataB64 = String(pdfBase64).replace(/^data:application\/pdf(;[^,]*)?;base64,/, '')
      const pdfBuffer = Buffer.from(pdfDataB64, 'base64')

      console.log('PUT /api/inspections/[id]/pdf - uploading to Blob, size:', pdfBuffer.length, 'bytes')

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
        WHERE id = ${parseInt(id)}
        RETURNING id
      `

      if (!updated) {
        return res.status(404).json({ error: 'Inspection not found' })
      }

      return res.status(200).json({ success: true, pdfSize: pdfBuffer.length, pdfUrl })
    } catch (error) {
      console.error('PDF Upload Error:', error)
      return res.status(500).json({ error: 'Failed to upload PDF' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
