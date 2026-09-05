// Seeds one demo account per role for the 60% evaluation demonstration:
// log in as student, teacher, and admin, one after another, from a clean state.
//
// Admins never self-register (POST /auth/register rejects role "admin"), so
// the admin row is inserted directly into app.admins. Idempotent: re-running
// changes nothing (ON CONFLICT DO NOTHING per child table).
//
// Local development only. The password is disposable; change it before this
// database is ever reachable from outside loopback.
//
// Usage: DEMO_PASSWORD=password123 node scripts/seed-demo-accounts.mjs
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const password = process.env.DEMO_PASSWORD || 'password123';
if (!process.env.DEMO_PASSWORD) {
  console.log('DEMO_PASSWORD not set, using the default local-dev password.');
}

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'ilham',
  user: process.env.PGUSER || 'ilham_app',
  password: process.env.PGPASSWORD,
});

const accounts = [
  {
    table: 'app.students',
    email: 'demo-student@example.com',
    name: 'Demo Student',
    extra: ', student_level',
    extraValues: ", 'beginner'",
    role: 'student',
  },
  { table: 'app.teachers', email: 'demo-teacher@example.com', name: 'Demo Teacher', extra: '', role: 'teacher' },
  {
    table: 'app.admins',
    email: 'demo-admin@example.com',
    name: 'Demo Admin',
    extra: ', admin_level',
    extraValues: ", 'super'",
    role: 'admin',
  },
];

const hash = await bcrypt.hash(password, 10);
for (const a of accounts) {
  // ON CONFLICT cannot make this idempotent: the assert_email_unique BEFORE
  // trigger raises before any constraint fires. Check first instead.
  const existing = await pool.query('SELECT 1 FROM app.users WHERE email = $1', [a.email]);
  if (existing.rowCount > 0) {
    console.log(`skip ${a.email} (already registered)`);
    continue;
  }
  await pool.query(
    `INSERT INTO ${a.table} (email, password_hash, full_name, role${a.extra})
     VALUES ($1, $2, $3, $4${a.extraValues || ''})`,
    [a.email, hash, a.name, a.role],
  );
  console.log(`ok  ${a.email}`);
}
await pool.end();
console.log('\nSign in with any of the above and password: ' + password);
