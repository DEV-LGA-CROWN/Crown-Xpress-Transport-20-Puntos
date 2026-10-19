import { getSql } from './_lib/db.js'
import { requireAuth, requireRole } from './_lib/session.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const authUser = await requireAuth(req, res)
    if (!authUser) return
    // Crear/editar/borrar yardas y asignaciones: solo admin
    if (req.method !== 'GET' && !requireRole(authUser, ['admin'], res)) return

    const sql = getSql()
    const { method, query } = req
    const { type } = query

    // YARD MANAGEMENT ENDPOINTS
    if (type === 'yards') {
      // GET - List all yards or get specific yard
      if (method === 'GET') {
        const { id } = query
        
        if (id) {
          const [yard] = await sql`
            SELECT * FROM yards 
            WHERE id = ${parseInt(id)} AND is_active = true
          `
          if (!yard) {
            return res.status(404).json({ error: 'Yard not found' })
          }
          return res.status(200).json({ success: true, yard })
        } else {
          const yards = await sql`
            SELECT * FROM yards 
            WHERE is_active = true 
            ORDER BY type, name
          `
          return res.status(200).json({ success: true, data: yards })
        }
      }

      // POST - Create new yard
      if (method === 'POST') {
        const { name, code, type, description, address, capacities } = req.body

        if (!name || !code || !type) {
          return res.status(400).json({ error: 'Name, code, and type are required' })
        }

        const [yard] = await sql`
          INSERT INTO yards (name, code, type, description, address, 
            max_trailers, max_trucks, max_boxes, max_platforms, max_machinery,
            min_trailers, min_trucks, min_boxes, min_platforms, min_machinery)
          VALUES (${name}, ${code}, ${type}, ${description || null}, ${address || null},
            ${capacities?.max_trailers || 0}, ${capacities?.max_trucks || 0}, ${capacities?.max_boxes || 0}, 
            ${capacities?.max_platforms || 0}, ${capacities?.max_machinery || 0},
            ${capacities?.min_trailers || 0}, ${capacities?.min_trucks || 0}, ${capacities?.min_boxes || 0}, 
            ${capacities?.min_platforms || 0}, ${capacities?.min_machinery || 0})
          RETURNING *
        `
        return res.status(201).json({ success: true, yard })
      }

      // PUT - Update yard
      if (method === 'PUT') {
        const { id, ...updates } = req.body
        if (!id) return res.status(400).json({ error: 'Yard ID required' })

        // Build dynamic update query
        const updateFields = Object.keys(updates).map(key => `${key} = ${updates[key]}`).join(', ')
        const [yard] = await sql`
          UPDATE yards SET ${updateFields}, updated_at = NOW()
          WHERE id = ${parseInt(id)} RETURNING *
        `
        if (!yard) return res.status(404).json({ error: 'Yard not found' })
        return res.status(200).json({ success: true, yard })
      }

      // DELETE - Deactivate yard
      if (method === 'DELETE') {
        const { id } = query
        if (!id) return res.status(400).json({ error: 'Yard ID required' })

        await sql`UPDATE yards SET is_active = false, updated_at = NOW() WHERE id = ${parseInt(id)}`
        return res.status(200).json({ success: true, message: 'Yard deactivated' })
      }
    }

    // YARD ASSIGNMENTS ENDPOINTS
    if (type === 'assignments') {
      // GET - List assignments
      if (method === 'GET') {
        const { employee_id, yard_id } = query
        
        let assignments
        if (employee_id && yard_id) {
          assignments = await sql`
            SELECT ya.*, e.full_name as employee_name, y.name as yard_name, y.type as yard_type
            FROM yard_assignments ya
            JOIN employees e ON ya.employee_id = e.id
            JOIN yards y ON ya.yard_id = y.id
            WHERE ya.is_active = true AND ya.employee_id = ${employee_id} AND ya.yard_id = ${yard_id}
            ORDER BY ya.assigned_at DESC
          `
        } else if (employee_id) {
          assignments = await sql`
            SELECT ya.*, e.full_name as employee_name, y.name as yard_name, y.type as yard_type
            FROM yard_assignments ya
            JOIN employees e ON ya.employee_id = e.id
            JOIN yards y ON ya.yard_id = y.id
            WHERE ya.is_active = true AND ya.employee_id = ${employee_id}
            ORDER BY ya.assigned_at DESC
          `
        } else if (yard_id) {
          assignments = await sql`
            SELECT ya.*, e.full_name as employee_name, y.name as yard_name, y.type as yard_type
            FROM yard_assignments ya
            JOIN employees e ON ya.employee_id = e.id
            JOIN yards y ON ya.yard_id = y.id
            WHERE ya.is_active = true AND ya.yard_id = ${yard_id}
            ORDER BY ya.assigned_at DESC
          `
        } else {
          assignments = await sql`
            SELECT ya.*, e.full_name as employee_name, y.name as yard_name, y.type as yard_type
            FROM yard_assignments ya
            JOIN employees e ON ya.employee_id = e.id
            JOIN yards y ON ya.yard_id = y.id
            WHERE ya.is_active = true
            ORDER BY ya.assigned_at DESC
          `
        }
        
        return res.status(200).json({ success: true, data: assignments })
      }

      // POST - Create assignment
      if (method === 'POST') {
        const { employee_id, yard_id, assigned_by } = req.body
        if (!employee_id || !yard_id) {
          return res.status(400).json({ error: 'Employee ID and Yard ID required' })
        }

        // Check if assignment already exists
        const [existing] = await sql`
          SELECT id FROM yard_assignments 
          WHERE employee_id = ${employee_id} AND yard_id = ${yard_id}
        `

        if (existing) {
          // Reactivate if exists
          const [assignment] = await sql`
            UPDATE yard_assignments 
            SET is_active = true, assigned_by = ${assigned_by || null}, updated_at = NOW()
            WHERE id = ${existing.id}
            RETURNING *
          `
          return res.status(200).json({ success: true, assignment })
        }

        // Create new assignment (don't deactivate existing ones - allow multiple)
        const [assignment] = await sql`
          INSERT INTO yard_assignments (employee_id, yard_id, assigned_by)
          VALUES (${employee_id}, ${yard_id}, ${assigned_by || null})
          RETURNING *
        `
        return res.status(201).json({ success: true, assignment })
      }

      // DELETE - Deactivate assignment
      if (method === 'DELETE') {
        const { id } = query
        if (!id) return res.status(400).json({ error: 'Assignment ID required' })

        await sql`UPDATE yard_assignments SET is_active = false WHERE id = ${parseInt(id)}`
        return res.status(200).json({ success: true, message: 'Assignment deactivated' })
      }
    }

    // SETUP ENDPOINT
    if (type === 'setup') {
      if (method === 'POST') {
        try {
          // Create yards table
          await sql`
            CREATE TABLE IF NOT EXISTS yards (
              id SERIAL PRIMARY KEY,
              name VARCHAR(100) NOT NULL UNIQUE,
              code VARCHAR(20) NOT NULL UNIQUE,
              type VARCHAR(20) NOT NULL CHECK (type IN ('PHYSICAL', 'VIRTUAL')),
              description TEXT,
              address TEXT,
              max_trailers INTEGER DEFAULT 0,
              max_trucks INTEGER DEFAULT 0,
              max_boxes INTEGER DEFAULT 0,
              max_platforms INTEGER DEFAULT 0,
              max_machinery INTEGER DEFAULT 0,
              min_trailers INTEGER DEFAULT 0,
              min_trucks INTEGER DEFAULT 0,
              min_boxes INTEGER DEFAULT 0,
              min_platforms INTEGER DEFAULT 0,
              min_machinery INTEGER DEFAULT 0,
              current_trailers INTEGER DEFAULT 0,
              current_trucks INTEGER DEFAULT 0,
              current_boxes INTEGER DEFAULT 0,
              current_platforms INTEGER DEFAULT 0,
              current_machinery INTEGER DEFAULT 0,
              is_active BOOLEAN DEFAULT true,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
          `

          // Create yard_assignments table
          await sql`
            CREATE TABLE IF NOT EXISTS yard_assignments (
              id SERIAL PRIMARY KEY,
              employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
              yard_id INTEGER NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
              assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              assigned_by INTEGER REFERENCES employees(id),
              is_active BOOLEAN DEFAULT true,
              UNIQUE(employee_id, yard_id),
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
          `

          // Insert initial yards data
          await sql`
            INSERT INTO yards (name, code, type, description, max_trailers, max_trucks, max_boxes, max_platforms, min_trailers, min_trucks, min_boxes, min_platforms) VALUES
            ('Yard A - Laredo', 'YDA', 'PHYSICAL', 'Main yard in Laredo, TX', 50, 30, 100, 20, 10, 5, 20, 5),
            ('Yard B - El Paso', 'YDB', 'PHYSICAL', 'Secondary yard in El Paso, TX', 30, 20, 60, 15, 5, 3, 12, 3),
            ('Yard C - Dallas', 'YDC', 'PHYSICAL', 'Yard in Dallas, TX', 40, 25, 80, 18, 8, 4, 16, 4),
            ('Yard D - Houston', 'YDH', 'PHYSICAL', 'Yard in Houston, TX', 35, 22, 70, 16, 6, 3, 14, 3),
            ('Yard E - San Antonio', 'YDS', 'PHYSICAL', 'Yard in San Antonio, TX', 25, 15, 50, 12, 4, 2, 10, 2),
            ('Virtual Yard 1', 'VY1', 'VIRTUAL', 'Virtual yard for overflow management', 100, 60, 200, 40, 20, 10, 40, 8),
            ('Virtual Yard 2', 'VY2', 'VIRTUAL', 'Virtual yard for peak hours', 80, 50, 160, 32, 16, 8, 32, 6)
            ON CONFLICT (name) DO NOTHING
          `

          // Create indexes
          await sql`CREATE INDEX IF NOT EXISTS idx_yards_type ON yards(type)`
          await sql`CREATE INDEX IF NOT EXISTS idx_yards_active ON yards(is_active)`
          await sql`CREATE INDEX IF NOT EXISTS idx_yard_assignments_employee ON yard_assignments(employee_id)`
          await sql`CREATE INDEX IF NOT EXISTS idx_yard_assignments_yard ON yard_assignments(yard_id)`
          await sql`CREATE INDEX IF NOT EXISTS idx_yard_assignments_active ON yard_assignments(is_active)`

          return res.status(200).json({ success: true, message: 'Yards setup completed' })
        } catch (error) {
          console.error('Setup Error:', error)
          return res.status(500).json({ error: error.message })
        }
      }
    }

    return res.status(404).json({ error: 'Endpoint not found' })

  } catch (error) {
    console.error('Yard Management API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
