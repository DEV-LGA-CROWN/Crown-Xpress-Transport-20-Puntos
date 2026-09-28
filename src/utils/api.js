/** Simple API client for Crown Xpress Inspection */
import { getApplicablePoints } from '../data/inspectionPoints'
import { addPendingInspection, isOnline, getTprMovements as getCachedTprMovements, saveTprMovements, markTprInspected, getInspectedSqlIds } from './offlineDB'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Modo offline solo activo en preproduccion
const OFFLINE_ENABLED = import.meta.env.VITE_OFFLINE_MODE === 'true'

/** Get supervisors by yard code */
export async function getSupervisorsByYard(yardCode) {
  const res = await fetchJson(`${API_BASE}/employees?role=supervisor`)
  const supervisors = res.data || []
  // Filter supervisors assigned to this yard
  return supervisors.filter(s => 
    s.yard_assignments?.some(ya => ya.yard_code === yardCode)
  )
}

/** Helper to handle fetch errors */
async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  
  // Clone response before reading body (in case we need to read it twice)
  const text = await res.text()
  
  if (!res.ok) {
    let err = {}
    try { err = JSON.parse(text) } catch {}
    throw new Error(err.error || err.message || `HTTP ${res.status}`)
  }
  
  // Parse JSON from text
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Upload inspection + PDF to backend (or queue offline) */
export async function createInspection(payload, pdfBase64 = null, pdfFilename = null) {
  // Marcar el movimiento TPR como inspeccionado localmente (solo si offline está activo)
  const sqlId = payload?.sql_id || payload?.unitInfo?.sqlId
  if (OFFLINE_ENABLED && sqlId) {
    await markTprInspected([sqlId])
  }

  // Si offline está activo y no hay internet, guardar en IndexedDB
  if (OFFLINE_ENABLED && !isOnline()) {
    console.log('Offline: guardando inspección en cola local')
    const localId = await addPendingInspection({
      payload,
      pdfBase64,
      pdfFilename,
    })
    return {
      success: true,
      offline: true,
      localId,
      message: 'Inspección guardada localmente. Se sincronizará cuando haya conexión.',
    }
  }
  const res = await fetchJson(`${API_BASE}/inspections`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res // { success, id, uuid, createdAt, pdfUrl }
}

/** Upload PDF separately after inspection is saved (to avoid 413) */
export async function updateInspectionPdf(id, pdfBase64, pdfFilename) {
  const res = await fetchJson(`${API_BASE}/inspections/${id}/pdf`, {
    method: 'PUT',
    body: JSON.stringify({ pdfBase64, pdfFilename }),
  })
  return res
}

/** List inspections (paginated) */
export async function listInspections({ limit = 50, offset = 0, yardCode = '', guardName = '' } = {}) {
  const params = { limit, offset }
  if (yardCode) params.yardCode = yardCode
  if (guardName) params.guardName = guardName
  const qs = new URLSearchParams(params)
  const res = await fetchJson(`${API_BASE}/inspections?${qs}`)
  return res // { data, limit, offset }
}

/** Get inspection details + points + audit */
export async function getInspection(id) {
  const res = await fetchJson(`${API_BASE}/inspections/${id}`)
  return res // { inspection, points, audits }
}

/** Download PDF binary */
export async function downloadPdf(id) {
  const res = await fetch(`${API_BASE}/inspections/${id}?pdf=true`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to download PDF: ${res.status} ${text}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/pdf')) {
    throw new Error(`Unexpected content type: ${contentType}`)
  }
  const blob = await res.blob()
  if (!blob || blob.size === 0) {
    throw new Error('PDF empty')
  }
  return blob
}

/** Add supervisor signature later (optional) */
export async function signSupervisor(id, { name, signature, signedAt, pdfBase64, pdfFilename }) {
  const body = { name, signature, signedAt }
  if (pdfBase64) {
    body.pdfBase64 = pdfBase64
    body.pdfFilename = pdfFilename
  }
  const res = await fetchJson(`${API_BASE}/inspections/${id}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return res // { success, id, supervisor_name, supervisor_signed_at, status }
}

/** Health check */
export async function healthCheck() {
  return await fetchJson(`${API_BASE}/health`)
}

/** Get TPR movements (empty loads) - with offline cache */
export async function getTprMovements({ type = 'empty', date = null, yardCode = null } = {}) {
  // Obtener IDs inspeccionados localmente
  const localInspectedIds = await getInspectedSqlIds()

  // Si offline está activo y hay internet, intentar online y guardar en cache
  if (!OFFLINE_ENABLED || isOnline()) {
    try {
      const params = new URLSearchParams({ type })
      if (date) params.append('date', date)
      if (yardCode) params.append('yardCode', yardCode)
      const res = await fetchJson(`${API_BASE}/tpr?${params}`)
      // Guardar en cache local para uso offline (solo si offline está activo)
      if (res?.data) {
        const data = OFFLINE_ENABLED
          ? res.data.map(m => ({
              ...m,
              already_inspected: m.already_inspected || localInspectedIds.has(m.sql_id),
            }))
          : res.data
        if (OFFLINE_ENABLED) await saveTprMovements(data)
        return { ...res, data }
      }
      return res // { success, data, count }
    } catch (err) {
      if (!OFFLINE_ENABLED) throw err
      console.warn('TPR online failed, falling back to cache:', err.message)
    }
  }
  // Offline o fallo online: usar cache local (solo si offline está activo)
  if (!OFFLINE_ENABLED) {
    return { success: false, data: [], count: 0, error: 'No connection' }
  }
  const cached = await getCachedTprMovements()
  // Marcar los inspeccionados localmente
  const data = cached.map(m => ({
    ...m,
    already_inspected: m.already_inspected || localInspectedIds.has(m.sql_id),
  }))
  return {
    success: true,
    data,
    count: data.length,
    offline: true,
    message: 'Mostrando movimientos precargados (sin conexión)',
  }
}

/** Search operator by employee number */
export async function searchOperator(employeeNumber) {
  const res = await fetchJson(`${API_BASE}/employees?employee_number=${encodeURIComponent(employeeNumber)}`)
  return res // { success, operator: { id, employeeNumber, fullName, ... } }
}

/** Search operators by name */
export async function searchOperatorsByName(name) {
  const res = await fetchJson(`${API_BASE}/employees?search_name=${encodeURIComponent(name)}`)
  return res // { success, operators: [...] }
}

/** List all active operators */
export async function listOperators() {
  const res = await fetchJson(`${API_BASE}/employees?list_operators=true`)
  return res // { success, operators: [...] }
}

/** Reconfirm an inspection (create new linked record) */
export async function reconfirmInspection(originalId, payload) {
  const res = await fetchJson(`${API_BASE}/inspections/${originalId}/reconfirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res
}

/** Get inspection chain (original + reconfirmations) */
export async function getInspectionChain(id) {
  const res = await fetchJson(`${API_BASE}/inspections/${id}/chain`)
  return res
}

/**
 * Compress a base64 image to reduce payload size
 * @param {string} base64Image - Base64 encoded image (with or without data URI prefix)
 * @param {number} maxWidth - Maximum width in pixels (default 800)
 * @param {number} quality - JPEG quality 0-1 (default 0.6)
 * @returns {Promise<string>} - Compressed base64 image
 */
export async function compressImage(base64Image, maxWidth = 800, quality = 0.6, format = 'image/jpeg') {
  if (!base64Image) return null
  
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      // Calculate new dimensions
      let width = img.width
      let height = img.height
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      // JPEG has no alpha channel: fill white background first so transparent
      // pixels (e.g. signatures on transparent canvas) don't turn black.
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
      }
      ctx.drawImage(img, 0, 0, width, height)
      
      // Convert to compressed format (JPEG or PNG)
      const compressed = canvas.toDataURL(format, quality)
      resolve(compressed)
    }
    img.onerror = () => {
      // If compression fails, return original
      resolve(base64Image)
    }
    img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`
  })
}

/** Build payload for createInspection (with aggressive image compression) */
export async function buildPayload(ctx, pdfBase64, pdfFilename) {
  console.log('buildPayload received pdfBase64:', pdfBase64 ? pdfBase64.length : 'null')
  const { unitInfo, points, sealPhoto, guardSignature, supervisorSignature, operatorSignature, completedCount, failedCount, goodCount } = ctx
  const supervisorSig = supervisorSignature || { name: '', signature: null, signedAt: null }

  // Compress seal photo
  const compressedSealPhoto = sealPhoto ? await compressImage(sealPhoto, 150, 0.15) : null

  // Map points to API shape with compressed photos
  const pointsPayload = {}
  for (const [id, p] of Object.entries(points)) {
    const compressedPhoto = p.photo ? await compressImage(p.photo, 150, 0.15) : null
    pointsPayload[id] = {
      status: p.status || 'pending',
      issueId: p.issueId || null,
      issueText: null,
      photo: compressedPhoto,
    }
  }

  // Compress signatures as PNG to preserve transparency (JPEG would turn the
  // transparent background black). PNG at 300px is small enough for the payload.
  const compressedGuardSig = guardSignature?.signature ? await compressImage(guardSignature.signature, 300, 1, 'image/png') : null
  const compressedSupervisorSig = supervisorSignature?.signature ? await compressImage(supervisorSignature.signature, 300, 1, 'image/png') : null
  const compressedOperatorSig = operatorSignature?.signature ? await compressImage(operatorSignature.signature, 300, 1, 'image/png') : null

  // Send the full PDF to backend for storage
  const payload = {
    unitInfo,
    points: pointsPayload,
    guardSignature: { ...guardSignature, signature: compressedGuardSig },
    supervisorSignature: { ...supervisorSig, signature: compressedSupervisorSig },
    operatorSignature: { ...operatorSignature, signature: compressedOperatorSig },
    sealPhoto: compressedSealPhoto,
    language: 'es',
    counts: {
      good: goodCount || 0,
      bad: failedCount || 0,
      pending: Math.max(0, getApplicablePoints(
        unitInfo?.trailerType === 'RABON' ? 'RABON' :
        unitInfo?.trailerType === 'FLATBED' ? 'FLATBED' :
        unitInfo?.inspectionType
      ).length - (completedCount || 0))
    },
  }

  // Only include PDF if provided (to avoid 413 error)
  if (pdfBase64) {
    payload.pdfBase64 = pdfBase64
    payload.pdfFilename = pdfFilename
  }

  // Log payload size for debugging
  const unitInfoSize = JSON.stringify(unitInfo).length
  const pointsSize = JSON.stringify(pointsPayload).length
  const guardSigSize = JSON.stringify(guardSignature).length
  const supervisorSigSize = JSON.stringify(supervisorSignature).length
  const operatorSigSize = JSON.stringify(operatorSignature).length
  const sealPhotoSize = JSON.stringify(sealPhoto).length
  const pdfBase64Size = JSON.stringify(pdfBase64).length
  const payloadSize = JSON.stringify(payload).length

  console.log('UnitInfo size:', unitInfoSize, 'bytes')
  console.log('Points size:', pointsSize, 'bytes')
  console.log('Guard signature size:', guardSigSize, 'bytes')
  console.log('Supervisor signature size:', supervisorSigSize, 'bytes')
  console.log('Operator signature size:', operatorSigSize, 'bytes')
  console.log('Seal photo size:', sealPhotoSize, 'bytes')
  console.log('PDF base64 size:', pdfBase64Size, 'bytes')
  console.log('Total payload size:', payloadSize, 'bytes')

  return payload
}
