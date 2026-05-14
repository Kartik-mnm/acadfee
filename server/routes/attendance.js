const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Get attendance list
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    const { month, year, student_id, batch_id } = req.query;
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(parseInt(req.query.limit) || 50, 1000);
    const offset = (page - 1) * limit;

    let cond = []; let params = []; let i = 1;

    if (req.user.role === "student") {
      cond.push(`a.student_id=$${i++}`);
      params.push(req.user.id);
    } else {
      if (student_id)        { cond.push(`a.student_id=$${i++}`); params.push(student_id); }
      else if (req.branchId) { cond.push(`a.branch_id=$${i++}`);  params.push(req.branchId); }
      const aid = req.academyId;
      if (aid) {
        cond.push(`s.academy_id=$${i++}`);
        params.push(aid);
      }
    }
    if (month)    { cond.push(`a.month=$${i++}`);    params.push(month); }
    if (year)     { cond.push(`a.year=$${i++}`);     params.push(year); }
    if (batch_id) { cond.push(`s.batch_id=$${i++}`); params.push(batch_id); }

    const where = cond.length ? "WHERE " + cond.join(" AND ") : "";

    if (req.query.page) {
      const { rows: countRows } = await db.query(
        `SELECT COUNT(*) FROM attendance a JOIN students s ON s.id = a.student_id ${where}`,
        params
      );
      const total = parseInt(countRows[0].count);
      const totalPages = Math.ceil(total / limit);

      const { rows } = await db.query(
        `SELECT a.*, s.name AS student_name, s.phone, s.photo_url,
                b.name AS batch_name, br.name AS branch_name,
                COALESCE(LEAST(ROUND((a.present::numeric / NULLIF(a.total_days,0)) * 100, 1), 100), 0) AS percentage
         FROM attendance a
         JOIN students s ON s.id = a.student_id
         LEFT JOIN batches b ON b.id = s.batch_id
         JOIN branches br ON br.id = a.branch_id
         ${where} ORDER BY a.year DESC, a.month DESC, s.name LIMIT $${i++} OFFSET $${i++}`,
        [...params, limit, offset]
      );
      return res.json({ data: rows, page, limit, total, totalPages });
    }

    const { rows } = await db.query(
      `SELECT a.*, s.name AS student_name, s.phone, s.photo_url,
              b.name AS batch_name, br.name AS branch_name,
              COALESCE(LEAST(ROUND((a.present::numeric / NULLIF(a.total_days,0)) * 100, 1), 100), 0) AS percentage
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       LEFT JOIN batches b ON b.id = s.batch_id
       JOIN branches br ON br.id = a.branch_id
       ${where} ORDER BY a.year DESC, a.month DESC, s.name LIMIT $${i}`,
      [...params, limit]
    );
    res.json(rows);
  } catch (e) {
    console.error("Get attendance error:", e.message);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// Save / update single attendance record
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

// Bulk save attendance
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
      const whereClause = aid ? "WHERE id=$1 AND academy_id=$2" : "WHERE id=$1";
      const sParams = aid ? [r.student_id, aid] : [r.student_id];
      const { rows: sRows } = await client.query(`SELECT branch_id FROM students ${whereClause}`, sParams);
      if (!sRows[0]) continue;
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

/**
 * Shared logic used by both the API route and the nightly cron.
 *
 * FIX (Issue 4): Working days are now counted PER STUDENT from their
 * admission_date. If a student was admitted on the 15th of April, their
 * total_days for April starts from the 15th, not the 1st.
 * Students admitted in a future month are skipped entirely.
 */
async function generateMonthForBranch(bid, month, year) {
  // Use IST "now" via UTC+5:30 arithmetic so the server timezone never matters
  const nowUtcMs  = Date.now();
  const istNow    = new Date(nowUtcMs + 5.5 * 60 * 60 * 1000);
  const istYear   = istNow.getUTCFullYear();
  const istMonth  = istNow.getUTCMonth() + 1;
  const istDay    = istNow.getUTCDate();

  const daysInMonth    = new Date(year, month, 0).getDate();
  const isCurrentMonth = istYear === year && istMonth === month;
  // How many days of the month have passed (or all days if past month)
  const globalCountUpTo = isCurrentMonth ? istDay : daysInMonth;

  // Holidays for this branch/month
  const { rows: holidays } = await db.query(
    `SELECT DATE_PART('day', date)::int AS day FROM working_days
     WHERE branch_id=$1 AND EXTRACT(YEAR FROM date)=$2 AND EXTRACT(MONTH FROM date)=$3 AND is_working=false`,
    [bid, year, month]
  );
  // Build a Set of holiday day-numbers (only those within our counting window)
  const buildHolidayCount = (fromDay, toDay) => {
    let count = 0;
    for (const h of holidays) {
      if (h.day >= fromDay && h.day <= toDay) count++;
    }
    return count;
  };

  // Fetch students WITH their admission date so we can count from that day
  const { rows: students } = await db.query(
    `SELECT id, admission_date FROM students WHERE branch_id=$1 AND status='active'`, [bid]
  );

  // QR scan counts per student for this month (exit_time required = completed attendance)
  const { rows: scanCounts } = await db.query(
    `SELECT student_id, COUNT(DISTINCT scan_date) AS present_days FROM qr_scans
     WHERE branch_id=$1
       AND EXTRACT(YEAR  FROM scan_date)=$2
       AND EXTRACT(MONTH FROM scan_date)=$3
       AND exit_time IS NOT NULL
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
      // --- Admission-date-aware working days calculation ---
      // Default: count from day 1 of the month
      let admissionStartDay = 1;

      if (s.admission_date) {
        const adm = new Date(s.admission_date);
        const admYear  = adm.getFullYear();
        const admMonth = adm.getMonth() + 1;
        const admDay   = adm.getDate();

        // Student admitted AFTER this month entirely — skip, they have no attendance yet
        if (admYear > year || (admYear === year && admMonth > month)) continue;

        // Student admitted IN this month — count from their admission day
        if (admYear === year && admMonth === month) {
          admissionStartDay = admDay;
        }
        // Student admitted BEFORE this month — count from day 1 (admissionStartDay stays 1)
      }

      // Effective range: from admissionStartDay up to globalCountUpTo
      const countUpTo = Math.min(globalCountUpTo, daysInMonth);
      if (admissionStartDay > countUpTo) {
        // Admitted today or after today in the current month — 0 working days yet
        const present = 0;
        const totalWorkingDays = 0;
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
            `UPDATE attendance SET total_days=$1, present=LEAST($1, GREATEST(present, $2)) WHERE student_id=$3 AND month=$4 AND year=$5`,
            [totalWorkingDays, present, s.id, month, year]
          );
          updated++;
        }
        continue;
      }

      // Count holidays only within the student's effective range
      const holidaysInRange  = buildHolidayCount(admissionStartDay, countUpTo);
      const totalWorkingDays = (countUpTo - admissionStartDay + 1) - holidaysInRange;

      // Present = actual QR scans, but never more than working days
      const present = Math.min(scanMap[s.id] || 0, Math.max(0, totalWorkingDays));

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
          `UPDATE attendance SET total_days=$1, present=LEAST($1, GREATEST(present, $2)) WHERE student_id=$3 AND month=$4 AND year=$5`,
          [totalWorkingDays, present, s.id, month, year]
        );
        updated++;
      }
    }
    await client.query("COMMIT");
    return { created, updated, students: students.length };
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
    const nowUtcMs = Date.now();
    const istNow   = new Date(nowUtcMs + 5.5 * 60 * 60 * 1000);
    const daysInMonth    = new Date(year, month, 0).getDate();
    const isCurrentMonth = istNow.getUTCFullYear() === parseInt(year) && istNow.getUTCMonth() + 1 === parseInt(month);
    const countUpToDay   = isCurrentMonth ? istNow.getUTCDate() : daysInMonth;
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
