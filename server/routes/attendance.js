const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Get attendance list
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    const { month, year, student_id } = req.query;
    let cond = []; let params = []; let i = 1;

    if (req.user.role === "student") {
      cond.push(`a.student_id=$${i++}`);
      params.push(req.user.id);
    } else {
      if (student_id)        { cond.push(`a.student_id=$${i++}`); params.push(student_id); }
      else if (req.branchId) { cond.push(`a.branch_id=$${i++}`);  params.push(req.branchId); }
      // Always scope to this academy
      const aid = req.academyId;
      if (aid && !student_id) {
        cond.push(`s.academy_id=$${i++}`);
        params.push(aid);
      }
    }
    if (month) { cond.push(`a.month=$${i++}`); params.push(month); }
    if (year)  { cond.push(`a.year=$${i++}`);  params.push(year); }

    const where = cond.length ? "WHERE " + cond.join(" AND ") : "";
    const { rows } = await db.query(
      `SELECT a.*, s.name AS student_name, s.phone, s.photo_url,
              b.name AS batch_name, br.name AS branch_name,
              LEAST(ROUND((a.present::numeric / NULLIF(a.total_days,0)) * 100, 1), 100) AS percentage
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       LEFT JOIN batches b ON b.id = s.batch_id
       JOIN branches br ON br.id = a.branch_id
       ${where} ORDER BY a.year DESC, a.month DESC, s.name`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("Get attendance error:", e.message);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// Save / update single attendance record — FIX: verify student belongs to this academy
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    let { student_id, month, year, total_days, present } = req.body;
    if (!student_id || !month || !year) return res.status(400).json({ error: "student_id, month and year are required" });
    total_days = parseInt(total_days) || 0;
    present    = Math.min(parseInt(present) || 0, total_days);

    const aid = req.academyId;
    const whereClause = aid ? "WHERE id=$1 AND academy_id=$2" : "WHERE id=$1";
    const sParams = aid ? [student_id, aid] : [student_id];
    const { rows: sRows } = await db.query(`SELECT branch_id FROM students ${whereClause}`, sParams);
    if (!sRows[0]) return res.status(404).json({ error: "Student not found in your academy" });

    const { rows } = await db.query(
      `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (student_id, month, year)
       DO UPDATE SET total_days=$5, present=LEAST($6, $5)
       RETURNING *`,
      [student_id, sRows[0].branch_id, month, year, total_days, present]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Save attendance error:", e.message);
    res.status(500).json({ error: "Failed to save attendance" });
  }
});

// Bulk save attendance — FIX: verify all students belong to this academy
router.post("/bulk", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0)
    return res.status(400).json({ error: "records array is required" });

  const aid = req.academyId;
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    let saved = 0;
    for (const r of records) {
      const total_days = parseInt(r.total_days) || 0;
      const present    = Math.min(parseInt(r.present) || 0, total_days);

      // Verify student belongs to this academy
      const whereClause = aid ? "WHERE id=$1 AND academy_id=$2" : "WHERE id=$1";
      const sParams = aid ? [r.student_id, aid] : [r.student_id];
      const { rows: sRows } = await client.query(`SELECT branch_id FROM students ${whereClause}`, sParams);
      if (!sRows[0]) continue; // skip silently — student doesn't belong to this academy

      await client.query(
        `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (student_id, month, year)
         DO UPDATE SET total_days=$5, present=LEAST($6, $5)`,
        [r.student_id, sRows[0].branch_id, r.month, r.year, total_days, present]
      );
      saved++;
    }
    await client.query("COMMIT");
    res.json({ saved });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Bulk attendance error:", e.message);
    res.status(500).json({ error: "Bulk save failed" });
  } finally {
    client.release();
  }
});

// Auto-generate attendance for a month
router.post("/generate-month", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { month, year, branch_id } = req.body;
    if (!month || !year) return res.status(400).json({ error: "month and year are required" });
    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    if (!bid) return res.status(400).json({ error: "branch_id required" });

    // Verify branch belongs to this academy
    const aid = req.academyId;
    if (aid) {
      const { rows: brRows } = await db.query(`SELECT id FROM branches WHERE id=$1 AND academy_id=$2`, [bid, aid]);
      if (!brRows[0]) return res.status(403).json({ error: "Branch does not belong to your academy" });
    }

    const result = await generateMonthForBranch(bid, parseInt(month), parseInt(year));
    res.json(result);
  } catch (e) {
    console.error("Generate month attendance error:", e.message);
    res.status(500).json({ error: "Failed to generate attendance" });
  }
});

// Shared logic used by both API and cron
async function generateMonthForBranch(bid, month, year) {
  const today = new Date();
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const countUpToDay   = isCurrentMonth ? today.getDate() : daysInMonth;

  const { rows: holidays } = await db.query(
    `SELECT DATE_PART('day', date)::int AS day FROM working_days
     WHERE branch_id=$1 AND EXTRACT(YEAR FROM date)=$2 AND EXTRACT(MONTH FROM date)=$3 AND is_working=false`,
    [bid, year, month]
  );
  const holidaySet = new Set(holidays.map((h) => h.day).filter((d) => d <= countUpToDay));
  const totalWorkingDays = countUpToDay - holidaySet.size;

  const { rows: students } = await db.query(
    `SELECT id FROM students WHERE branch_id=$1 AND status='active'`, [bid]
  );
  const { rows: scanCounts } = await db.query(
    `SELECT student_id, COUNT(*) AS present_days FROM qr_scans
     WHERE branch_id=$1 AND EXTRACT(YEAR FROM scan_date)=$2 AND EXTRACT(MONTH FROM scan_date)=$3 AND exit_time IS NOT NULL
     GROUP BY student_id`,
    [bid, year, month]
  );
  const scanMap = {};
  scanCounts.forEach((s) => { scanMap[s.student_id] = parseInt(s.present_days); });

  const client = await db.pool.connect();
  let created = 0; let updated = 0;
  try {
    await client.query("BEGIN");
    for (const s of students) {
      const present = Math.min(scanMap[s.id] || 0, totalWorkingDays);
      const { rows: existing } = await client.query(
        `SELECT id FROM attendance WHERE student_id=$1 AND month=$2 AND year=$3`, [s.id, month, year]
      );
      if (existing.length === 0) {
        await client.query(
          `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present) VALUES ($1,$2,$3,$4,$5,$6)`,
          [s.id, bid, month, year, totalWorkingDays, present]
        );
        created++;
      } else {
        await client.query(
          `UPDATE attendance SET total_days=$1, present=$2 WHERE student_id=$3 AND month=$4 AND year=$5`,
          [totalWorkingDays, present, s.id, month, year]
        );
        updated++;
      }
    }
    await client.query("COMMIT");
    return { created, updated, total_working_days: totalWorkingDays, students: students.length };
  } catch (e) {
    await client.query("ROLLBACK"); throw e;
  } finally { client.release(); }
}

// Get working days count
router.get("/working-days-count", auth, async (req, res) => {
  try {
    const { month, year, branch_id } = req.query;
    if (!month || !year) return res.status(400).json({ error: "month and year required" });
    const bid = branch_id || (req.user.role !== "super_admin" ? req.user.branch_id : null);
    if (!bid) return res.status(400).json({ error: "branch_id required" });
    const today = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();
    const isCurrentMonth = today.getFullYear() === parseInt(year) && today.getMonth() + 1 === parseInt(month);
    const countUpToDay   = isCurrentMonth ? today.getDate() : daysInMonth;
    const { rows: holidays } = await db.query(
      `SELECT COUNT(*) AS cnt FROM working_days
       WHERE branch_id=$1 AND EXTRACT(YEAR FROM date)=$2 AND EXTRACT(MONTH FROM date)=$3
         AND is_working=false AND DATE_PART('day', date)::int <= $4`,
      [bid, year, month, countUpToDay]
    );
    res.json({
      working_days: countUpToDay - parseInt(holidays[0].cnt),
      total_days: daysInMonth, counted_days: countUpToDay,
      holidays: parseInt(holidays[0].cnt), is_current_month: isCurrentMonth,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.generateMonthForBranch = generateMonthForBranch;
