import { pool, log, head } from './config.js';

// =============================================================================
// SEED — synthetic app layer.
//
// The one rule: exercise the machinery, never bypass it.
//   * assignments are created by CALLing app.assign_study_set, not by INSERT
//   * progress is changed by UPDATE so trg_progress_stats and trg_progress_audit
//     fire naturally
//   * review sessions are written inside an explicit BEGIN/COMMIT
//
// The payoff is that student_stats and audit_log end up correct by construction
// and demonstrably live. Bulk-inserting around them produces a demo running on
// data the triggers never touched — which is exactly the thing being claimed.
//
// Distribution is deliberately uneven so the analytics pages have something to
// show: some circles busy, one dormant, students at different depths, and a
// handful of teacher mastery overrides to populate the shadow table.
// =============================================================================

const N_TEACHERS = 4;
const N_STUDENTS = 40;
const N_CIRCLES  = 5;
const SET_SIZE   = 25;
const BCRYPT_DUMMY = '$2b$10$abcdefghijklmnopqrstuvREPLACEatRegistration.....';

const AR_FIRST = ['محمد','أحمد','عبد الله','عائشة','فاطمة','عمر','زينب','يوسف','مريم','إبراهيم'];
const AR_LAST  = ['الرحمن','الهاشمي','الأنصاري','السلمي','القرشي','البخاري','النيسابوري','الطبري'];

export async function seed({ reset = true } = {}) {
  const p = pool();
  const c = await p.connect();
  head('SEED app layer');
  try {
    const { rows: hc } = await c.query('SELECT count(*)::int n FROM corpus.hadiths');
    if (hc[0].n === 0) throw new Error('corpus is empty — run the ETL before seeding');
    log(`corpus has ${hc[0].n} hadiths`);

    if (reset) {
      await c.query(`
        TRUNCATE app.audit_log, app.review_items, app.review_sessions,
                 app.progress, app.student_stats, app.assignments,
                 app.set_items, app.study_sets, app.enrollments, app.circles
        RESTART IDENTITY CASCADE`);
      await c.query('DELETE FROM app.students');
      await c.query('DELETE FROM app.teachers');
      await c.query('DELETE FROM app.admins');
      await c.query('ALTER SEQUENCE app.user_id_seq RESTART');
    }

    // --- users ------------------------------------------------------------
    const teachers = [], students = [];
    for (let i = 1; i <= N_TEACHERS; i++) {
      const { rows } = await c.query(
        `INSERT INTO app.teachers (email, password_hash, full_name, role,
                                   institution, specialization)
         VALUES ($1,$2,$3,'teacher',$4,$5) RETURNING user_id`,
        [`teacher${i}@ilham.test`, BCRYPT_DUMMY, name(i * 7),
         ['دار الحديث','جامعة الأزهر','Madrasah Ilham'][i % 3],
         ['Rijal expert','Isnad criticism','Fiqh al-Hadith'][i % 3]]);
      teachers.push(rows[0].user_id);
    }
    for (let i = 1; i <= N_STUDENTS; i++) {
      const { rows } = await c.query(
        `INSERT INTO app.students (email, password_hash, full_name, role, student_level)
         VALUES ($1,$2,$3,'student',$4) RETURNING user_id`,
        [`student${i}@ilham.test`, BCRYPT_DUMMY, name(i),
         ['beginner','intermediate','advanced'][i % 3]]);
      students.push(rows[0].user_id);
    }
    await c.query(
      `INSERT INTO app.admins (email, password_hash, full_name, role, admin_level)
       VALUES ('admin@ilham.test',$1,'Platform Admin','admin','super')`, [BCRYPT_DUMMY]);
    log(`users: ${teachers.length} teachers, ${students.length} students, 1 admin`);

    // --- circles and enrollments ------------------------------------------
    const circles = [];
    for (let i = 0; i < N_CIRCLES; i++) {
      const { rows } = await c.query(
        `INSERT INTO app.circles (teacher_id, name) VALUES ($1,$2) RETURNING circle_id`,
        [teachers[i % teachers.length], `حلقة ${i + 1}`]);
      circles.push(rows[0].circle_id);
    }
    // Uneven on purpose: circle 0 is large, the last one is left empty so the
    // dashboard has a zero-state to render rather than only happy paths.
    const sizes = [16, 10, 8, 6, 0];
    // Walk a moving offset so the circles draw on DIFFERENT students. Slicing
    // from the front every time enrolls the same handful repeatedly and leaves
    // most of the roster with no stats row at all — the dashboards then look
    // sparse for a reason that is the seed's fault, not the app's.
    let cursor = 0;
    for (let i = 0; i < circles.length; i++) {
      const members = [];
      for (let k = 0; k < sizes[i]; k++) members.push(students[(cursor + k) % students.length]);
      cursor += Math.max(1, Math.floor(sizes[i] * 0.7));   // slight overlap is realistic
      for (const s of members) {
        await c.query(
          `INSERT INTO app.enrollments (circle_id, student_id) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`, [circles[i], s]);
      }
    }
    log(`circles: ${circles.length} (sizes ${sizes.join(', ')})`);

    // --- study sets -------------------------------------------------------
    // Drawn from the best-resolved collections: a set full of unresolved
    // chains makes the isnad pages look broken for reasons that are the data's
    // fault, not the app's.
    const sets = [];
    for (let i = 0; i < 6; i++) {
      const { rows } = await c.query(
        `INSERT INTO app.study_sets (owner_id, name) VALUES ($1,$2) RETURNING set_id`,
        [teachers[i % teachers.length], `مجموعة الدراسة ${i + 1}`]);
      const setId = rows[0].set_id;
      await c.query(
        `INSERT INTO app.set_items (set_id, hadith_id)
         SELECT $1, h.hadith_id FROM (
           SELECT l.hadith_id,
                  count(*) FILTER (WHERE l.narrator_id IS NOT NULL)::numeric
                    / nullif(count(*),0) AS res_rate
           FROM corpus.isnad_links l WHERE NOT l.is_compiler
           GROUP BY l.hadith_id
           HAVING count(*) >= 3
           ORDER BY res_rate DESC, l.hadith_id
           OFFSET $3 LIMIT $2
         ) h ON CONFLICT DO NOTHING`,
        [setId, SET_SIZE, i * SET_SIZE]);
      sets.push(setId);
    }
    log(`study sets: ${sets.length} x ~${SET_SIZE} hadiths`);

    // --- assignments, THROUGH THE PROCEDURE -------------------------------
    // Postgres forbids subqueries in CALL arguments, so the ids are bound as
    // parameters. This is exactly how the Express layer must invoke it.
    let assigned = 0;
    for (let i = 0; i < circles.length; i++) {
      if (sizes[i] === 0) continue;
      for (let j = 0; j <= i % 3; j++) {
        const due = new Date(Date.now() + (7 + j * 14) * 864e5).toISOString().slice(0, 10);
        await c.query('CALL app.assign_study_set($1, $2, $3)',
                      [circles[i], sets[(i + j) % sets.length], due]);
        assigned++;
      }
    }
    const { rows: pr } = await c.query('SELECT count(*)::int n FROM app.progress');
    log(`assignments: ${assigned} calls -> ${pr[0].n} progress rows (trigger 4a fired on each)`);

    // --- study activity: UPDATEs so both triggers fire --------------------
    const { rows: prog } = await c.query(
      `SELECT progress_id, student_id FROM app.progress ORDER BY random() LIMIT $1`,
      [Math.floor(pr[0].n * 0.55)]);
    for (const r of prog) {
      const m = weightedMastery();
      // Self-study: the student IS the actor. Without this the audit table
      // fills with NULL changed_by rows, which is legal (the column is
      // best-effort by design) but makes the audit page useless to demo.
      await c.query('SELECT set_config($1,$2,false)', ['ilham.user_id', String(r.student_id)]);
      await c.query(
        `UPDATE app.progress
         SET mastery = $2, times_reviewed = times_reviewed + $3, last_reviewed = now()
         WHERE progress_id = $1`, [r.progress_id, m, 1 + Math.floor(Math.random() * 4)]);
    }
    log(`progress updated: ${prog.length} rows`);

    // --- review sessions: the explicit multi-table transaction ------------
    let sessions = 0, items = 0;
    for (let i = 0; i < 30; i++) {
      const ci = i % circles.length;
      if (sizes[ci] === 0) continue;
      const { rows: er } = await c.query(
        `SELECT student_id FROM app.enrollments WHERE circle_id=$1 ORDER BY random() LIMIT 1`,
        [circles[ci]]);
      if (!er.length) continue;
      const studentId = er[0].student_id;
      const teacherId = teachers[ci % teachers.length];

      await c.query('BEGIN');
      try {
        // The actor for trigger 4b. Without this the audit rows land with a
        // NULL changed_by, which is legal but useless for the audit page.
        await c.query('SELECT set_config($1,$2,true)', ['ilham.user_id', String(teacherId)]);
        const { rows: sr } = await c.query(
          `INSERT INTO app.review_sessions (student_id, reviewer_id, circle_id)
           VALUES ($1,$2,$3) RETURNING session_id`, [studentId, teacherId, circles[ci]]);
        const sid = sr[0].session_id;

        const { rows: hs } = await c.query(
          `SELECT DISTINCT hadith_id FROM app.progress
           WHERE student_id=$1 ORDER BY hadith_id LIMIT 6`, [studentId]);
        for (const h of hs) {
          const res = ['pass','pass','partial','fail'][Math.floor(Math.random() * 4)];
          await c.query(
            `INSERT INTO app.review_items (session_id, hadith_id, result)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [sid, h.hadith_id, res]);
          items++;
          // The mastery write is what makes this a genuine multi-table
          // transaction: session + items + progress succeed or fail together.
          const delta = res === 'pass' ? 1 : res === 'fail' ? -1 : 0;
          await c.query(
            `UPDATE app.progress
             SET mastery = greatest(0, least(4, mastery + $3)),
                 times_reviewed = times_reviewed + 1,
                 last_reviewed = now()
             WHERE student_id=$1 AND hadith_id=$2`, [studentId, h.hadith_id, delta]);
        }
        await c.query('COMMIT');
        sessions++;
      } catch (e) {
        await c.query('ROLLBACK');
        log(`session rolled back: ${e.message}`);
      }
    }
    log(`review sessions: ${sessions} (${items} items), each one transaction`);

    // --- teacher overrides: the audit trail's reason for existing ---------
    const { rows: ov } = await c.query(
      `SELECT progress_id FROM app.progress WHERE mastery < 4 ORDER BY random() LIMIT 12`);
    await c.query('SELECT set_config($1,$2,false)', ['ilham.user_id', String(teachers[0])]);
    for (const r of ov) {
      await c.query('UPDATE app.progress SET mastery = 4 WHERE progress_id = $1', [r.progress_id]);
    }
    log(`teacher overrides: ${ov.length}`);

    // --- notes ------------------------------------------------------------
    const { rows: nh } = await c.query('SELECT hadith_id FROM app.set_items ORDER BY random() LIMIT 25');
    for (const h of nh) {
      await c.query(
        `INSERT INTO app.notes (user_id, hadith_id, body) VALUES ($1,$2,$3)`,
        [students[Math.floor(Math.random() * students.length)], h.hadith_id,
         'ملاحظة على الإسناد ومتن الحديث.']);
    }

    // --- verify the triggers actually did their job -----------------------
    head('VERIFY');
    const checks = await c.query(`
      SELECT (SELECT count(*) FROM app.student_stats)                       AS stats_rows,
             (SELECT count(*) FROM app.audit_log)                           AS audit_rows,
             (SELECT count(*) FROM app.audit_log WHERE changed_by IS NULL)  AS audit_no_actor,
             (SELECT count(*) FROM app.progress)                            AS progress_rows,
             (SELECT count(*) FROM app.assignments)                         AS assignments,
             (SELECT count(*) FROM app.review_sessions)                     AS sessions`);
    const v = checks.rows[0];
    for (const [k, val] of Object.entries(v)) log(`${k.padEnd(16)} ${val}`);

    // student_stats is trigger-maintained; recomputing it independently and
    // comparing is the only way to know the trigger is right rather than merely
    // present.
    const drift = await c.query(`
      SELECT count(*)::int AS n FROM (
        SELECT p.student_id,
               count(DISTINCT p.hadith_id) FILTER (WHERE p.mastery >= 3) AS m,
               coalesce(sum(p.times_reviewed),0) AS r
        FROM app.progress p GROUP BY p.student_id) t
      JOIN app.student_stats s USING (student_id)
      WHERE s.mastered_count <> t.m OR s.review_count <> t.r`);
    if (drift.rows[0].n > 0) {
      throw new Error(`trigger 4a drift on ${drift.rows[0].n} students — stats do not match a recomputation`);
    }
    log('trigger 4a: student_stats matches independent recomputation');
    if (Number(v.audit_rows) === 0) throw new Error('trigger 4b produced no audit rows');
    log('trigger 4b: audit trail populated');
  } finally {
    c.release();
    await p.end();
  }
}

// Skewed low: most study is in progress, not finished. A uniform distribution
// makes every dashboard look identical and hides ordering bugs.
function weightedMastery() {
  const r = Math.random();
  return r < 0.30 ? 1 : r < 0.55 ? 2 : r < 0.80 ? 3 : r < 0.95 ? 4 : 0;
}
const name = (i) =>
  `${AR_FIRST[i % AR_FIRST.length]} ${AR_LAST[(i * 3) % AR_LAST.length]}`;
