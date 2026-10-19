import { getSql } from './_lib/db.js'
import { requireAuth, requireRole, hashPassword } from './_lib/session.js'

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

    const sql = getSql()
    
    // GET - List employees OR search operator by employee_number OR search by name OR list all operators
    if (req.method === 'GET') {
      const { employee_number, search_name, list_operators } = req.query
      
      // If list_operators is true, return all active operators
      if (list_operators === 'true') {
        const operators = await sql`
          SELECT id, employee_number, full_name, license_number, license_expiry, phone, status
          FROM operators
          WHERE status = 'active'
          ORDER BY full_name ASC
        `
        
        return res.status(200).json({
          success: true,
          operators: operators.map(op => ({
            id: op.id,
            employeeNumber: op.employee_number,
            fullName: op.full_name,
            licenseNumber: op.license_number,
            licenseExpiry: op.license_expiry,
            phone: op.phone,
            status: op.status
          }))
        })
      }
      
      // If employee_number is provided, search for operator
      if (employee_number) {
        const [operator] = await sql`
          SELECT id, employee_number, full_name, license_number, license_expiry, phone, status
          FROM operators
          WHERE employee_number = ${employee_number.toUpperCase()}
          AND status = 'active'
        `
        
        if (!operator) {
          return res.status(404).json({ error: 'Operator not found' })
        }
        
        return res.status(200).json({
          success: true,
          operator: {
            id: operator.id,
            employeeNumber: operator.employee_number,
            fullName: operator.full_name,
            licenseNumber: operator.license_number,
            licenseExpiry: operator.license_expiry,
            phone: operator.phone,
            status: operator.status
          }
        })
      }
      
      // If search_name is provided, search operators by name
      if (search_name) {
        const searchTerm = `%${search_name.toUpperCase()}%`
        const operators = await sql`
          SELECT id, employee_number, full_name, license_number, license_expiry, phone, status
          FROM operators
          WHERE UPPER(full_name) LIKE ${searchTerm}
          AND status = 'active'
          ORDER BY full_name ASC
          LIMIT 10
        `
        
        return res.status(200).json({
          success: true,
          operators: operators.map(op => ({
            id: op.id,
            employeeNumber: op.employee_number,
            fullName: op.full_name,
            licenseNumber: op.license_number,
            licenseExpiry: op.license_expiry,
            phone: op.phone,
            status: op.status
          }))
        })
      }
      
      // If id is provided, get single employee with yard assignments
      if (req.query.id) {
        const [employee] = await sql`
          SELECT e.id, e.username, e.full_name, e.role, e.location_id, e.location_name, e.active, e.created_at, e.profile_photo
          FROM employees e
          WHERE e.id = ${parseInt(req.query.id)}
        `
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' })
        }

        // Get all active yard assignments for this employee
        const yardAssignments = await sql`
          SELECT ya.id as assignment_id, ya.yard_id as yard_id, y.name as yard_name, y.code as yard_code, y.type as yard_type
          FROM yard_assignments ya
          JOIN yards y ON ya.yard_id = y.id
          WHERE ya.employee_id = ${parseInt(req.query.id)} AND ya.is_active = true
        `

        employee.yard_assignments = yardAssignments
        employee.location_code = yardAssignments.length > 0 ? yardAssignments.map(y => y.yard_code).join(',') : null

        return res.status(200).json({ data: employee })
      }

      // Otherwise, list all employees with yard assignments
      const employees = await sql`
        SELECT e.id, e.username, e.full_name, e.role, e.location_id, e.location_name, e.active, e.created_at, e.profile_photo
        FROM employees e
        ORDER BY role, full_name
      `

      // Get yard assignments for all employees (must be before role filter)
      const allAssignments = await sql`
        SELECT ya.employee_id, y.code as yard_code, y.name as yard_name, y.type as yard_type
        FROM yard_assignments ya
        JOIN yards y ON ya.yard_id = y.id
        WHERE ya.is_active = true
      `

      // Filter by role if specified
      if (req.query.role) {
        const filtered = employees.filter(e => e.role === req.query.role)
        // Get yard assignments for filtered employees
        const filteredIds = filtered.map(e => e.id)
        const filteredAssignments = allAssignments.filter(a => filteredIds.includes(a.employee_id))

        // Group assignments by employee
        const assignmentsByEmployee = {}
        filteredAssignments.forEach(a => {
          if (!assignmentsByEmployee[a.employee_id]) {
            assignmentsByEmployee[a.employee_id] = []
          }
          assignmentsByEmployee[a.employee_id].push({
            yard_code: a.yard_code,
            yard_name: a.yard_name,
            yard_type: a.yard_type
          })
        })

        // Add yard assignments to filtered employees
        filtered.forEach(emp => {
          emp.yard_assignments = assignmentsByEmployee[emp.id] || []
          emp.location_code = emp.yard_assignments.length > 0 ? emp.yard_assignments.map(y => y.yard_code).join(',') : null
        })

        return res.status(200).json({ data: filtered })
      }

      // Group assignments by employee
      const assignmentsByEmployee = {}
      allAssignments.forEach(a => {
        if (!assignmentsByEmployee[a.employee_id]) {
          assignmentsByEmployee[a.employee_id] = []
        }
        assignmentsByEmployee[a.employee_id].push({
          yard_code: a.yard_code,
          yard_name: a.yard_name,
          yard_type: a.yard_type
        })
      })

      // Add yard assignments to each employee
      employees.forEach(emp => {
        emp.yard_assignments = assignmentsByEmployee[emp.id] || []
        emp.location_code = emp.yard_assignments.length > 0 ? emp.yard_assignments.map(y => y.yard_code).join(',') : null
      })

      return res.status(200).json({ data: employees })
    }

    // POST - Create new employee (solo admin)
    if (req.method === 'POST') {
      if (!requireRole(authUser, ['admin'], res)) return
      const { username, password, full_name, role, location_id, location_name, profile_photo } = req.body

      if (!username || !password || !full_name || !role) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // Check if username exists
      const existing = await sql`SELECT id FROM employees WHERE username = ${username}`
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Username already exists' })
      }

      const bcryptHash = await hashPassword(password)
      const [employee] = await sql`
        INSERT INTO employees (username, password_hash, password_bcrypt, full_name, role, location_id, location_name, profile_photo)
        VALUES (${username}, ${password}, ${bcryptHash}, ${full_name}, ${role}, ${location_id || null}, ${location_name || null}, ${profile_photo || null})
        RETURNING id, username, full_name, role, location_id, location_name, active, created_at, profile_photo
      `

      return res.status(201).json({ success: true, employee })
    }

    // PUT - Update employee (solo admin)
    if (req.method === 'PUT') {
      if (!requireRole(authUser, ['admin'], res)) return
      const { id, username, password, full_name, role, location_id, location_name, active, profile_photo, yard_assignments } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Employee ID required' })
      }

      // Build update query dynamically
      let updateQuery
      if (password) {
        const bcryptHash = await hashPassword(password)
        updateQuery = await sql`
          UPDATE employees SET
            username = ${username},
            password_hash = ${password},
            password_bcrypt = ${bcryptHash},
            full_name = ${full_name},
            role = ${role},
            location_id = ${location_id || null},
            location_name = ${location_name || null},
            active = ${active !== undefined ? active : true},
            profile_photo = ${profile_photo || null},
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING id, username, full_name, role, location_id, location_name, active, profile_photo
        `
      } else {
        updateQuery = await sql`
          UPDATE employees SET
            username = ${username},
            full_name = ${full_name},
            role = ${role},
            location_id = ${location_id || null},
            location_name = ${location_name || null},
            active = ${active !== undefined ? active : true},
            profile_photo = ${profile_photo || null},
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING id, username, full_name, role, location_id, location_name, active, profile_photo
        `
      }

      if (updateQuery.length === 0) {
        return res.status(404).json({ error: 'Employee not found' })
      }

      // Handle yard assignments if provided
      if (yard_assignments && Array.isArray(yard_assignments)) {
        // Deactivate all existing assignments for this employee
        await sql`UPDATE yard_assignments SET is_active = false WHERE employee_id = ${id}`

        // Create new assignments for each yard
        for (const yardId of yard_assignments) {
          if (yardId) {
            const numericYardId = parseInt(yardId)
            if (!isNaN(numericYardId)) {
              await sql`
                INSERT INTO yard_assignments (employee_id, yard_id, is_active)
                VALUES (${id}, ${numericYardId}, true)
                ON CONFLICT (employee_id, yard_id) 
                DO UPDATE SET is_active = true, updated_at = NOW()
              `
            }
          }
        }
      }

      return res.status(200).json({ success: true, employee: updateQuery[0] })
    }

    // DELETE - Deactivate or permanently delete employee (solo admin)
    if (req.method === 'DELETE') {
      if (!requireRole(authUser, ['admin'], res)) return
      const { id, permanent } = req.query

      if (!id) {
        return res.status(400).json({ error: 'Employee ID required' })
      }

      if (permanent === 'true') {
        // Permanent delete - only allowed for inactive users
        const [employee] = await sql`SELECT active FROM employees WHERE id = ${parseInt(id)}`
        if (!employee) {
          return res.status(404).json({ error: 'Employee not found' })
        }
        if (employee.active === true) {
          return res.status(400).json({ error: 'Cannot permanently delete active user. Deactivate first.' })
        }
        await sql`DELETE FROM employees WHERE id = ${parseInt(id)}`
        return res.status(200).json({ success: true, message: 'Employee permanently deleted' })
      } else {
        // Soft delete - just deactivate
        await sql`UPDATE employees SET active = false, updated_at = NOW() WHERE id = ${parseInt(id)}`
        return res.status(200).json({ success: true })
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
