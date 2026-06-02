const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Get attendance list
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    const { month, year, student_id, batch_id, search } = req.query;
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(parseInt(req.query.limit) || 50, 1000);
    const offset = (page - 1) * limit;

    let cond = ["s.status = 'active'"]; 
    let params = []; 
    let i = 1;

    const hasMonthYear = (month && year);
    let fromClause = "";
    
    if (hasMonthYear) {
      fromClause = `FROM students s LEFT JOIN attendance a ON a.student_id = s.id AND a.month = $${i++} AND a.year = $${i++}`;
      params.push(month, year);
    } else {
      fromClause = `FROM attendance a JOIN students s ON s.id = a.student_id`;
      if (month) { cond.push(`a.month=$${i++}`); params.push(month); }
      if (year)  { cond.push(`a.year=$${i++}`); params.push(year); }
    }

    if (req.user.role === "student") {
      cond.push(`s.id=$${i++}`);
      params.push(req.user.id);
    } else {
      if (student_id)        { cond.push(`s.id=$${i++}`); params.push(student_id); }
      else if (req.branchId) { cond.push(`s.branch_id=$${i++}`);  params.push(req.branchId); }
      const aid = req.academyId;
      if (aid) {
        cond.push(`s.academy_id=$${i++}`);
        params.push(aid);
      }
    }
    
    if (batch_id) { cond.push(`s.batch_id=$${i++}`); params.push(batch_id); }
    
    if (search) {
      cond.push(`s.name ILIKE $${i++}`);
      params.push(`%${search}%`);
    }

    const where = cond.length ? "WHERE " + cond.join(" AND ") : "";

    const mParam = hasMonthYear ? "$1" : "a.month";
    const yParam = hasMonthYear ? "$2" : "a.year";
    const selectCols = `
      COALESCE(a.id, 0) AS id,
      s.id AS student_id,
      s.branch_id,
      COALESCE(a.month, ${mParam}) AS month,
      COALESCE(a.year, ${yParam}) AS year,
      COALESCE(a.total_days, 0) AS total_days,
      COALESCE(a.present, 0) AS present,
      s.name AS student_name, s.phone, s.photo_url,
      b.name AS batch_name, br.name AS branch_name,
      COALESCE(LEAST(ROUND((COALESCE(a.present,0)::numeric / NULLIF(COALESCE(a.total_days,0),0)) * 100, 1), 100), 0) AS percentage
    `;

    const orderBy = hasMonthYear ? `ORDER BY s.name` : `ORDER BY a.year DESC, a.month DESC, s.name`;

    if (req.query.page) {
      const { rows: countRows } = await db.query(
        `SELECT COUNT(*) ${fromClause} LEFT JOIN batches b ON b.id = s.batch_id JOIN branches br ON br.id = s.branch_id ${where}`,
        params
      );
      const total = parseInt(countRows[0].count);
      const totalPages = Math.ceil(total / limit);

      const { rows } = await db.query(
        `SELECT ${selectCols}
         ${fromClause}
         LEFT JOIN batches b ON b.id = s.batch_id
         JOIN branches br ON br.id = s.branch_id
         ${where} ${orderBy} LIMIT $${i++} OFFSET $${i++}`,
        [...params, limit, offset]
      );
      return res.json({ data: rows, page, limit, total, totalPages });
    }

    const { rows } = await db.query(
      `SELECT ${selectCols}
       ${fromClause}
       LEFT JOIN batches b ON b.id = s.batch_id
       JOIN branches br ON br.id = s.branch_id
       ${where} ${orderBy} LIMIT $${i}`,
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
    // Fix #5: Cap at 31 — no month has more days. Prevents data corruption
    // from accidental large values typed in the manual entry modal.
    total_days = Math.min(parseInt(total_days) || 0, 31);
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
      // Fix #5: Cap at 31 — same guard as the single-save route.
      const total_days = Math.min(parseInt(r.total_days) || 0, 31);
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
  // Count up to and including today for the current month, all days for past months.
  // The mark-day route uses a direct targeted update so this function is only called
  // for bulk "Sync from QR" and the nightly cron — both should count today's scans.
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

  let created = 0; let updated = 0;
  // NOTE: We intentionally do NOT use BEGIN/COMMIT here.
  // The DATABASE_URL points to a Supabase pgBouncer pooler (port 6543) running in
  // transaction mode. Explicit multi-statement transactions are not supported in that
  // mode — they cause 500 errors. Each UPSERT below is atomic on its own, which is
  // sufficient for attendance recalculation.
  for (const s of students) {
    // --- Admission-date-aware working days calculation ---
    let admissionStartDay = 1;

    if (s.admission_date) {
      const adm = new Date(s.admission_date);
      const admYear  = adm.getFullYear();
      const admMonth = adm.getMonth() + 1;
      const admDay   = adm.getDate();

      // Student admitted AFTER this month entirely — skip
      if (admYear > year || (admYear === year && admMonth > month)) continue;

      // Student admitted IN this month — count from their admission day
      if (admYear === year && admMonth === month) {
        admissionStartDay = admDay;
      }
    }

    const countUpTo = Math.min(globalCountUpTo, daysInMonth);
    const totalWorkingDays = admissionStartDay > countUpTo
      ? 0
      : Math.max(0, (countUpTo - admissionStartDay + 1) - buildHolidayCount(admissionStartDay, countUpTo));

    // Present = actual QR scans, capped at working days
    const present = Math.min(scanMap[s.id] || 0, totalWorkingDays);

    // Single UPSERT — no SELECT needed, no transaction needed
    const { rowCount } = await db.query(
      `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (student_id, month, year)
       DO UPDATE SET total_days = $5, present = LEAST($5, $6)`,
      [s.id, bid, month, year, totalWorkingDays, present]
    );
    // pg returns rowCount=1 for INSERT, rowCount=1 for UPDATE via ON CONFLICT
    if (rowCount === 1) updated++;
  }
  return { created, updated: updated, students: students.length };
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

// Get daily attendance for a student/month
router.get("/daily", auth, async (req, res) => {
  try {
    let { student_id, month, year } = req.query;
    if (req.user.role === "student") student_id = req.user.id;
    if (!student_id || !month || !year) return res.status(400).json({ error: "missing params" });

    const sId = parseInt(student_id);
    const m = parseInt(month);
    const y = parseInt(year);

    const { rows: students } = await db.query(`SELECT id, branch_id, admission_date FROM students WHERE id=$1`, [sId]);
    if (!students[0]) return res.status(404).json({ error: "student not found" });
    const s = students[0];

    const { rows: scans } = await db.query(
      `SELECT DISTINCT scan_date FROM qr_scans 
       WHERE student_id=$1 AND EXTRACT(YEAR FROM scan_date)=$2 AND EXTRACT(MONTH FROM scan_date)=$3 AND exit_time IS NOT NULL`,
      [sId, y, m]
    );
    const scanDates = new Set(scans.map(r => {
      const d = new Date(r.scan_date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }));

    const { rows: holidays } = await db.query(
      `SELECT date, is_working, note FROM working_days 
       WHERE branch_id=$1 AND EXTRACT(YEAR FROM date)=$2 AND EXTRACT(MONTH FROM date)=$3`,
      [s.branch_id, y, m]
    );
    const holidayMap = {};
    holidays.forEach(h => {
      const d = new Date(h.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      holidayMap[dateStr] = h;
    });

    const daysInMonth = new Date(y, m, 0).getDate();
    const result = [];

    // Bug fix: use string-based date comparison for admission_date to avoid
    // UTC parsing issues where e.g. "2025-06-01" becomes May 31 at midnight IST.
    // We format the admission_date as a YYYY-MM-DD string server-side.
    let admStr = null;
    if (s.admission_date) {
      const adm = new Date(s.admission_date);
      // toISOString() gives UTC date; for admission dates stored as DATE (no time),
      // use UTC components directly which match what Postgres stores.
      admStr = `${adm.getUTCFullYear()}-${String(adm.getUTCMonth() + 1).padStart(2, '0')}-${String(adm.getUTCDate()).padStart(2, '0')}`;
    }

    const nowUtcMs  = Date.now();
    const istNow    = new Date(nowUtcMs + 5.5 * 60 * 60 * 1000);
    const istYear   = istNow.getUTCFullYear();
    const istMonth  = istNow.getUTCMonth() + 1;
    const istDay    = istNow.getUTCDate();

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isFuture = (y > istYear) || (y === istYear && m > istMonth) || (y === istYear && m === istMonth && i > istDay);
      
      let status = "absent";
      if (admStr && dateStr < admStr) status = "not_enrolled";
      else if (isFuture) status = "future";
      else if (holidayMap[dateStr] && !holidayMap[dateStr].is_working) status = "holiday";
      else if (scanDates.has(dateStr)) status = "present";
      
      result.push({ day: i, date: dateStr, status, note: holidayMap[dateStr]?.note || "" });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mark / Unmark attendance for a specific day
router.post("/mark-day", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { student_id, date, status } = req.body;
    if (!student_id || !date || !status) return res.status(400).json({ error: "missing params" });

    const sId = parseInt(student_id);
    const aid = req.academyId;
    // Bug fix: scope student lookup to academy_id to prevent cross-academy data manipulation
    const whereClause = aid ? "WHERE id=$1 AND academy_id=$2" : "WHERE id=$1";
    const sParams = aid ? [sId, aid] : [sId];
    const { rows: students } = await db.query(`SELECT id, branch_id FROM students ${whereClause}`, sParams);
    if (!students[0]) return res.status(404).json({ error: "student not found" });
    const bId = students[0].branch_id;

    if (status === "present") {
      const { rows: existing } = await db.query(`SELECT id FROM qr_scans WHERE student_id=$1 AND scan_date=$2`, [sId, date]);
      if (existing.length === 0) {
        // Use bId only if not null; a null branch_id would violate qr_scans NOT NULL constraint
        await db.query(
          `INSERT INTO qr_scans (student_id, branch_id, scan_date, entry_time, exit_time, scanned_by)
           VALUES ($1, $2, $3, NOW(), NOW(), $4)`,
          [sId, bId || null, date, req.user.id]
        );
      }
    } else {
      // Bug fix: only delete manually-inserted scans (scanned_by IS NOT NULL) to avoid
      // removing legitimate QR-scanned records when marking absent.
      // Falls back to deleting all if no manual scans exist, to stay backward-compatible.
      const { rowCount } = await db.query(
        `DELETE FROM qr_scans WHERE student_id=$1 AND scan_date=$2 AND scanned_by IS NOT NULL`,
        [sId, date]
      );
      // If nothing was deleted (all scans are real QR scans), delete them all as the admin
      // is explicitly overriding the attendance for this day.
      if (rowCount === 0) {
        await db.query(`DELETE FROM qr_scans WHERE student_id=$1 AND scan_date=$2`, [sId, date]);
      }
    }
    
    const d = new Date(date);
    const m = d.getUTCMonth() + 1;
    const y = d.getUTCFullYear();

    // Targeted single-student update — count actual scans for this student this month
    // and write directly to the attendance row. No branch-wide recalc needed, no complex
    // logic, guaranteed to work. The heavy generateMonthForBranch is only for bulk sync.
    const { rows: scanRows } = await db.query(
      `SELECT COUNT(DISTINCT scan_date)::int AS present_days
       FROM qr_scans
       WHERE student_id=$1
         AND EXTRACT(YEAR  FROM scan_date)=$2
         AND EXTRACT(MONTH FROM scan_date)=$3
         AND exit_time IS NOT NULL`,
      [sId, y, m]
    );
    const newPresent = scanRows[0]?.present_days || 0;

    // Update attendance record: keep total_days as-is, just fix the present count.
    // UPSERT so this works even if no attendance row exists yet for the student+month.
    await db.query(
      `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present)
       VALUES ($1, $2, $3, $4, 1, $5)
       ON CONFLICT (student_id, month, year)
       DO UPDATE SET present = LEAST(attendance.total_days, $5)`,
      [sId, bId, m, y, newPresent]
    );

    res.json({ ok: true, present: newPresent });
  } catch (e) {
    console.error("[mark-day] ERROR:", e.message, "\nStudent:", req.body?.student_id, "\nDate:", req.body?.date, "\nStatus:", req.body?.status);
    res.status(500).json({ error: e.message });
  }
});

// Mark all working days as present for a student in a month
router.post("/mark-all", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { student_id, month, year } = req.body;
    if (!student_id || !month || !year) return res.status(400).json({ error: "missing params" });

    const sId = parseInt(student_id);
    const m = parseInt(month);
    const y = parseInt(year);

    const aid = req.academyId;
    // Bug fix: scope student lookup to academy_id to prevent cross-academy data manipulation
    const whereClause = aid ? "WHERE id=$1 AND academy_id=$2" : "WHERE id=$1";
    const sParams = aid ? [sId, aid] : [sId];
    const { rows: students } = await db.query(`SELECT branch_id, admission_date FROM students ${whereClause}`, sParams);
    if (!students[0]) return res.status(404).json({ error: "student not found" });
    const { branch_id, admission_date } = students[0];

    // 1. Get all non-working days (holidays)
    const { rows: holidays } = await db.query(
      `SELECT date FROM working_days WHERE branch_id=$1 AND EXTRACT(MONTH FROM date)=$2 AND EXTRACT(YEAR FROM date)=$3 AND is_working=false`,
      [branch_id, m, y]
    );
    const holidaySet = new Set(holidays.map(h => new Date(h.date).toISOString().split('T')[0]));

    // 2. Iterate days of month and insert scans if not holiday and not before admission
    const daysInMonth = new Date(y, m, 0).getDate();
    // Bug fix: use UTC date parsing for admission_date to avoid timezone off-by-one
    let admStr = null;
    if (admission_date) {
      const adm = new Date(admission_date);
      admStr = `${adm.getUTCFullYear()}-${String(adm.getUTCMonth() + 1).padStart(2, '0')}-${String(adm.getUTCDate()).padStart(2, '0')}`;
    }

    const nowUtcMs = Date.now();
    const istNow = new Date(nowUtcMs + 5.5 * 60 * 60 * 1000);
    const todayStr = istNow.getUTCFullYear() + "-" + String(istNow.getUTCMonth() + 1).padStart(2, '0') + "-" + String(istNow.getUTCDate()).padStart(2, '0');

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      if (dateStr > todayStr) continue;
      if (admStr && dateStr < admStr) continue;
      if (holidaySet.has(dateStr)) continue;

      // Check if already exists
      const { rows: existing } = await db.query(`SELECT id FROM qr_scans WHERE student_id=$1 AND scan_date=$2`, [sId, dateStr]);
      if (existing.length === 0) {
        await db.query(
          `INSERT INTO qr_scans (student_id, branch_id, scan_date, entry_time, exit_time, scanned_by)
           VALUES ($1, $2, $3, NOW(), NOW(), $4)`,
          [sId, branch_id, dateStr, req.user.id]
        );
      }
    }

    await generateMonthForBranch(branch_id, m, y);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.generateMonthForBranch = generateMonthForBranch;
