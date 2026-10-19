// Migra contraseñas plaintext de employees a bcrypt en password_bcrypt.
// Uso: node scripts/migrate-passwords.js  (requiere DATABASE_URL en .env)
import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const { rows } = await pool.query(
  `SELECT id, username, password_hash, password FROM employees WHERE password_bcrypt IS NULL`
)

console.log(`Empleados sin bcrypt: ${rows.length}`)

for (const u of rows) {
  const plain = u.password_hash || u.password
  if (!plain) {
    console.log(`  ${u.username}: sin password, se omite`)
    continue
  }
  const hash = await bcrypt.hash(plain, 10)
  await pool.query('UPDATE employees SET password_bcrypt = $1 WHERE id = $2', [hash, u.id])
  console.log(`  ${u.username}: migrado`)
}

await pool.end()
console.log('Listo')
