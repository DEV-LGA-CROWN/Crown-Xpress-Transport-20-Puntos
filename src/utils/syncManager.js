/**
 * Sync Manager: detecta cuando hay conexión y sube las inspecciones
 * pendientes creadas offline.
 */
import { getPendingInspections, markPendingSyncing, markPendingSynced, markPendingFailed, clearSyncedPending, isOnline } from './offlineDB'
import { updateInspectionPdf, getAuthHeaders } from './api'

let syncing = false
let listeners = []

export function onSyncStatusChange(callback) {
  listeners.push(callback)
  callback({ syncing, pending: 0 })
  return () => {
    listeners = listeners.filter(l => l !== callback)
  }
}

async function notify(pending) {
  for (const cb of listeners) {
    try { cb({ syncing, pending }) } catch {}
  }
}

/**
 * Sincroniza todas las inspecciones pendientes.
 * Se llama automáticamente cuando se recupera la conexión,
 * o manualmente desde el botón "Sincronizar".
 */
export async function syncPendingInspections() {
  if (syncing || !isOnline()) return
  const pending = await getPendingInspections()
  if (pending.length === 0) return

  syncing = true
  await notify(pending.length)

  for (const item of pending) {
    try {
      await markPendingSyncing(item.localId)
      // Crear la inspección directamente via fetch (no usar createInspection
      // porque eso encolaria de nuevo si isOnline() falla)
      const API_BASE = import.meta.env.VITE_API_URL || '/api'
      const res = await fetch(`${API_BASE}/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(item.payload),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let errMsg = `HTTP ${res.status}`
        try { errMsg = JSON.parse(text)?.error || errMsg } catch {}
        throw new Error(errMsg)
      }
      const result = await res.json()
      const serverId = result?.id

      // Si trae PDF, subirlo aparte
      if (item.pdfBase64 && serverId) {
        try {
          await updateInspectionPdf(serverId, item.pdfBase64, item.pdfFilename || 'inspection.pdf')
        } catch (pdfErr) {
          console.warn('PDF upload failed for inspection', serverId, pdfErr.message)
          // No fallamos toda la inspección si solo el PDF falló
        }
      }

      await markPendingSynced(item.localId, serverId)
      console.log('Inspección sincronizada:', serverId)
    } catch (err) {
      console.error('Error sincronizando inspección', item.localId, err)
      await markPendingFailed(item.localId, err.message)
    }
  }

  // Limpiar las que ya se sincronizaron
  await clearSyncedPending()

  syncing = false
  const remaining = await getPendingInspections()
  await notify(remaining.length)
}

/**
 * Registra el listener de conexión para sincronizar automáticamente.
 */
export function initSyncManager() {
  window.addEventListener('online', () => {
    console.log('Conexión recuperada - iniciando sync...')
    syncPendingInspections()
  })

  // Intentar sincronizar al cargar la app si hay internet
  if (isOnline()) {
    setTimeout(() => syncPendingInspections(), 3000)
  }
}
