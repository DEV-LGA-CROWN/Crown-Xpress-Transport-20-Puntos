import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { getSql } from './db.js'

const SESSION_TTL_HOURS = 12

// La tabla se crea lazy una sola vez por cold start.
let tableReady = null
async function ensureSessionsTable(sql) {
  if (!tableReady) {
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `.then(() => sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`)
      .then(() => true)
      .catch(err => { tableReady = null; throw err })
  }
  return tableReady
}

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10)
}

// Verifica contra bcrypt; si la columna guarda plaintext legacy, compara directo.
export async function verifyPassword(plain, stored) {
  if (!stored) return { ok: false, legacy: false }
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
    return { ok: await bcrypt.compare(plain, stored), legacy: false }
  }
  return { ok: stored === plain, legacy: true }
}

export async function createSession(employeeId) {
  const sql = getSql()
  await ensureSessionsTable(sql)
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000)
  await sql`
    INSERT INTO sessions (token, employee_id, expires_at)
    VALUES (${token}, ${employeeId}, ${expiresAt})
  `
  return token
}

export async function destroySession(token) {
  if (!token) return
  const sql = getSql()
  try { await sql`DELETE FROM sessions WHERE token = ${token}` } catch {}
}

export function getBearerToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

// Devuelve el empleado autenticado o null. Uso:
//   const user = await getAuthUser(req); if (!user) return res.status(401)...
export async function getAuthUser(req) {
  const token = getBearerToken(req)
  if (!token) return null
  const sql = getSql()
  try {
    await ensureSessionsTable(sql)
    const rows = await sql`
      SELECT e.id, e.username, e.full_name, e.role, e.location_id, e.location_name, e.active, e.profile_photo
      FROM sessions s
      JOIN employees e ON e.id = s.employee_id
      WHERE s.token = ${token} AND s.expires_at > NOW() AND e.active = true
    `
    return rows[0] || null
  } catch {
    return null
  }
}

// Envía 401 y devuelve null si no hay sesión válida; si hay, devuelve el user.
export async function requireAuth(req, res) {
  const user = await getAuthUser(req)
  if (!user) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión.' })
    return null
  }
  return user
}

export function requireRole(user, roles, res) {
  if (!roles.includes(user.role)) {
    res.status(403).json({ error: 'Sin permisos para esta acción.' })
    return false
  }
  return true
}
