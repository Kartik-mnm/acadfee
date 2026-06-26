const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter, studentSelf } = require("../middleware");

/**
 * Build roll number prefix from academy + branch + batch prefixes.
 * e.g. academy="NA", branch="DW", batch="A" → "NADWA"
 */
function buildRollPrefix(academyPrefix, branchPrefix, batchCode, branchName) {
  const acad   = (academyPrefix || "").toUpperCase().trim();
  const branch = (branchPrefix  || "").toUpperCase().trim();
  const batch  = (batchCode     || "").toUpperCase().trim();
  if (acad || branch || batch) return acad + branch + batch;
  if (!branchName) return "NA";
  const lower = branchName.toLowerCase();
  const LEGACY = {
    "favinagar": "RN", "ravinagar": "RN",
    "dattawadi": "DW", "dattwadi":  "DW",
    "dabha":     "DB", "dhabha":    "DB",
  };
  for (const [key, pfx] of Object.entries(LEGACY)) {
    if (lower.includes(key)) return pfx;
  }
  return branchName.replace(/[^a-zA-Z]/g, "").substring(0, 2).toUpperCase() || "NA";
}

router.post("/backfill-roll-numbers", auth, async (req, res) => {
  if (req.user.role !== "super_admin") return res.status(403).json({ error: "Super admin only" });
  try {
    const aid = req.academyId;
    if (!aid) return res.status(400).json({ error: "Academy ID is required" });

    // 1. Fetch academy details to get roll_prefix and roll_reset_done
    const { rows: acadRows } = await db.query(
      `SELECT roll_prefix, roll_reset_done FROM academies WHERE id = $1`,
      [aid]
    );
    const academyPrefix = acadRows[0]?.roll_prefix || "";
    const rollResetDone = acadRows[0]?.roll_reset_done || false;

    let students = [];
    const maxSerial = {};

    if (!rollResetDone) {
      // ONE-TIME RESET: Select ALL students in the academy, regardless of whether they have a roll number
      const { rows } = await db.query(
        `SELECT s.id, s.branch_id, s.batch_id, br.name AS branch_name, br.roll_prefix AS branch_prefix, ba.batch_code
         FROM students s
         JOIN branches br ON br.id = s.branch_id
         LEFT JOIN batches ba ON ba.id = s.batch_id
         WHERE s.academy_id = $1
         ORDER BY s.branch_id, s.batch_id, s.id ASC`,
        [aid]
      );
      students = rows;
      // Since it's a reset, all sequences start at 0
    } else {
      // INCREMENTAL SYNC: Select only students missing a roll number
      const { rows } = await db.query(
        `SELECT s.id, s.branch_id, s.batch_id, br.name AS branch_name, br.roll_prefix AS branch_prefix, ba.batch_code
         FROM students s
         JOIN branches br ON br.id = s.branch_id
         LEFT JOIN batches ba ON ba.id = s.batch_id
         WHERE (s.roll_no IS NULL OR s.roll_no = '') AND s.academy_id = $1
         ORDER BY s.branch_id, s.batch_id, s.id ASC`,
        [aid]
      );
      students = rows;

      // Fetch existing max serials grouped by batch_id
      const { rows: existing } = await db.query(
        `SELECT batch_id, MAX(CAST(REGEXP_REPLACE(roll_no, '[^0-9]', '', 'g') AS INTEGER)) AS max_serial
         FROM students 
         WHERE roll_no IS NOT NULL AND academy_id = $1 AND batch_id IS NOT NULL
         GROUP BY batch_id`,
        [aid]
      );
      existing.forEach((r) => {
        maxSerial[r.batch_id] = r.max_serial || 0;
      });
    }

    let updated = 0;
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      for (const s of students) {
        // Fallback batch_id to 0 in maxSerial map if a student has no batch_id (should not happen, but safe)
        const batchKey = s.batch_id || 0;
        const prefix = buildRollPrefix(academyPrefix, s.branch_prefix, s.batch_code, s.branch_name);
        const serial = (maxSerial[batchKey] || 0) + 1;
        maxSerial[batchKey] = serial;
        const rollNo = `${prefix}${String(serial).padStart(4, "0")}`;
        await client.query(`UPDATE students SET roll_no=$1 WHERE id=$2`, [rollNo, s.id]);
        updated++;
      }

      // Mark the one-time reset as done
      if (!rollResetDone) {
        await client.query(`UPDATE academies SET roll_reset_done = true WHERE id = $1`, [aid]);
      }

      await client.query("COMMIT");
      res.json({ updated, message: `Roll numbers synchronized for ${updated} students` });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("Backfill roll numbers error:", e.message);
    res.status(500).json({ error: "Failed to sync roll numbers: " + e.message });
  }
});

router.get("/", auth, branchFilter, studentSelf, async (req, res) => {
  try {
    const aid = req.academyId;
    if (req.user.role === "student") {
      const { rows } = await db.query(
        `SELECT s.*, b.name AS batch_name, br.name AS branch_name
         FROM students s LEFT JOIN batches b ON b.id=s.batch_id LEFT JOIN branches br ON br.id=s.branch_id
         WHERE s.id=$1`, [req.user.id]
      );
      return res.json(rows);
    }

    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(parseInt(req.query.limit) || 20, 1000); // allow up to 1000 for performance page
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();

    let conditions = []; let params = []; let idx = 1;
    if (aid) { conditions.push(`s.academy_id=$${idx++}`); params.push(aid); }

    // FIX: respect branch_id query param for super_admin (needed by Performance/Results page)
    // branchFilter middleware sets req.branchId for branch_managers automatically
    const branchId = req.branchId || (req.user.role === "super_admin" ? req.query.branch_id : null);
    if (branchId) { conditions.push(`s.branch_id=$${idx++}`); params.push(branchId); }

    if (req.query.batch_id) { conditions.push(`s.batch_id=$${idx++}`);  params.push(req.query.batch_id); }
    if (req.query.status)   { conditions.push(`s.status=$${idx++}`);    params.push(req.query.status); }
    if (search) {
      conditions.push(`(s.name ILIKE $${idx} OR s.phone ILIKE $${idx} OR s.parent_phone ILIKE $${idx} OR s.email ILIKE $${idx} OR s.roll_no ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    // If page param present, return paginated response; otherwise return all (for dropdowns etc.)
    if (req.query.page) {
      const { rows: countRows } = await db.query(`SELECT COUNT(*) FROM students s ${where}`, [...params]);
      const total = parseInt(countRows[0].count);
      const totalPages = Math.ceil(total / limit);
      const limitIdx  = idx;
      const offsetIdx = idx + 1;
      params.push(limit); params.push(offset);
      const { rows } = await db.query(
        `SELECT s.*, b.name AS batch_name, br.name AS branch_name
         FROM students s LEFT JOIN batches b ON b.id=s.batch_id LEFT JOIN branches br ON br.id=s.branch_id
         ${where} ORDER BY s.id DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
      );
      return res.json({ data: rows, page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 });
    }

    // No page param — return flat array (used by Performance, ID cards, etc.)
    const limitClause = limit ? `LIMIT $${idx}` : "";
    if (limit) params.push(limit);
    const { rows } = await db.query(
      `SELECT s.*, b.name AS batch_name, br.name AS branch_name
       FROM students s LEFT JOIN batches b ON b.id=s.batch_id LEFT JOIN branches br ON br.id=s.branch_id
       ${where} ORDER BY s.name ${limitClause}`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("List students error:", e.message);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

router.get("/:id", auth, studentSelf, async (req, res) => {
  try {
    const aid = req.academyId;
    const conditions = ["s.id=$1"];
    const params = [req.params.id];
    if (req.user.role !== "student" && aid) {
      conditions.push(`s.academy_id=$2`);
      params.push(aid);
    }
    const { rows } = await db.query(
      `SELECT s.*, b.name AS batch_name, br.name AS branch_name
       FROM students s LEFT JOIN batches b ON b.id=s.batch_id LEFT JOIN branches br ON br.id=s.branch_id
       WHERE ${conditions.join(" AND ")}`, params
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: "Failed to fetch student" }); }
});

router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { branch_id, batch_id, name, phone, parent_phone, email, address, dob, gender,
            admission_date, fee_type, admission_fee, discount, discount_reason, due_day, photo_url } = req.body;
    if (!name || !batch_id) return res.status(400).json({ error: "name and batch_id are required" });
    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    if (!bid) return res.status(400).json({ error: "Please select a branch" });
    const aid = req.academyId;
    const dueDaySafe = Math.min(Math.max(parseInt(due_day) || 10, 1), 28);

    const { rows: brRows } = await db.query(
      `SELECT br.name, br.roll_prefix AS branch_prefix, a.roll_prefix AS academy_prefix, ba.batch_code
       FROM branches br 
       LEFT JOIN academies a ON a.id = br.academy_id
       LEFT JOIN batches ba ON ba.id = $2
       WHERE br.id=$1`, [bid, batch_id]
    );
    const branchInfo = brRows[0] || {};
    const prefix = buildRollPrefix(
      branchInfo.academy_prefix || "",
      branchInfo.branch_prefix  || "",
      branchInfo.batch_code     || "",
      branchInfo.name           || ""
    );

    const { rows: maxRows } = await db.query(
      `SELECT MAX(CAST(REGEXP_REPLACE(roll_no, '[^0-9]', '', 'g') AS INTEGER)) AS max_serial
       FROM students WHERE batch_id=$1 AND roll_no IS NOT NULL`, [batch_id]
    );
    const serial = (maxRows[0]?.max_serial || 0) + 1;
    const rollNo = `${prefix}${String(serial).padStart(4, "0")}`;

    let resolvedAdmissionFee = parseFloat(admission_fee || 0);
    let resolvedFeeType      = fee_type || 'monthly';

    // Auto-inherit batch course fee if not provided
    if (batch_id && resolvedAdmissionFee === 0) {
      const { rows: bRows } = await db.query("SELECT fee_course FROM batches WHERE id=$1", [batch_id]);
      if (bRows[0] && parseFloat(bRows[0].fee_course) > 0) {
        resolvedAdmissionFee = parseFloat(bRows[0].fee_course);
        resolvedFeeType = 'course';
      }
    }

    const { rows } = await db.query(
      `INSERT INTO students (branch_id, batch_id, name, phone, parent_phone, email, address, dob, gender,
        admission_date, fee_type, admission_fee, discount, discount_reason, due_day, photo_url, roll_no, academy_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [
        bid,
        batch_id,
        name,
        phone           || null,
        parent_phone    || null,
        email           || null,
        address         || null,
        dob             || null,
        gender          || null,
        admission_date  || null,
        resolvedFeeType,
        resolvedAdmissionFee,
        discount        || 0,
        discount_reason || null,
        dueDaySafe,
        photo_url       || null,
        rollNo,
        aid
      ]
    );
    if (email) { const { addContactToResend } = require("../email"); addContactToResend(name, email).catch(console.error); }

    // Initial Fee Record Creation
    try {
      const student = rows[0];
      if (student.fee_type === "course" && parseFloat(student.admission_fee) > 0) {
        const today = new Date();
        const dueDate = today.toISOString().split("T")[0];
        await db.query(
          `INSERT INTO fee_records (student_id, branch_id, amount_due, due_date, period_label) 
           VALUES ($1, $2, $3, $4, $5)`,
          [student.id, student.branch_id, student.admission_fee, dueDate, "Course Fee"]
        );
      }
    } catch (feeErr) {
      console.error("Initial fee creation error:", feeErr.message);
    }

    res.json(rows[0]);
  } catch (e) {
    console.error("Create student error:", e.message);
    res.status(500).json({ error: "Failed to create student: " + e.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const { batch_id, name, phone, parent_phone, email, address, dob, gender, admission_date,
            fee_type, admission_fee, discount, discount_reason, status, due_day, photo_url } = req.body;
    const dueDaySafe = Math.min(Math.max(parseInt(due_day) || 10, 1), 28);
    
    const bid = req.user.role === "super_admin" ? (req.body.branch_id || null) : req.user.branch_id;
    
    // Explicitly handle empty strings for date/numeric fields to prevent PG 500 errors
    const params = [
      bid,
      batch_id || null, 
      name, 
      phone || null, 
      parent_phone || null, 
      email || null, 
      address || null, 
      dob || null, 
      gender || null, 
      admission_date || null,
      fee_type || 'monthly', 
      parseFloat(admission_fee || 0), 
      parseFloat(discount || 0), 
      discount_reason || null, 
      status || 'active', 
      dueDaySafe, 
      photo_url || null,
      req.params.id
    ];

    let idx = 19;
    let whereClause = "WHERE id=$18";
    if (aid) {
      whereClause += ` AND academy_id=$${idx}`;
      params.push(aid);
    }

    const { rows } = await db.query(
      `UPDATE students SET branch_id=$1, batch_id=$2, name=$3, phone=$4, parent_phone=$5, email=$6, address=$7,
        dob=$8, gender=$9, admission_date=$10, fee_type=$11, admission_fee=$12, discount=$13, 
        discount_reason=$14, status=$15, due_day=$16, photo_url=$17 
        ${whereClause} RETURNING *`,
      params
    );

    if (!rows[0]) return res.status(404).json({ error: "Student not found in your academy" });
    const updatedStudent = rows[0];

    // If admission_fee was changed, sync it to the "Course Fee" record
    if (admission_fee !== undefined && updatedStudent.fee_type === "course") {
      try {
        const { rowCount } = await db.query(
          `UPDATE fee_records SET amount_due = $1 
           WHERE student_id = $2 AND period_label = 'Course Fee'`,
          [updatedStudent.admission_fee, updatedStudent.id]
        );
        // If no 'Course Fee' record found, update the FIRST record found for this student
        if (rowCount === 0) {
          await db.query(
            `UPDATE fee_records SET amount_due = $1 
             WHERE id = (SELECT id FROM fee_records WHERE student_id = $2 ORDER BY id ASC LIMIT 1)`,
            [updatedStudent.admission_fee, updatedStudent.id]
          );
        }
      } catch (syncErr) {
        console.error("Sync admission fee error:", syncErr.message);
      }
    }

    if (email) { const { addContactToResend } = require("../email"); addContactToResend(name, email).catch(console.error); }
    res.json(updatedStudent);
  } catch (e) { 
    console.error("Update student error:", e.message);
    res.status(500).json({ error: "Failed to update student: " + e.message }); 
  }
});

router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const whereClause = aid ? "WHERE id=$1 AND academy_id=$2" : "WHERE id=$1";
    const params = aid ? [req.params.id, aid] : [req.params.id];
    const { rowCount } = await db.query(`DELETE FROM students ${whereClause}`, params);
    if (rowCount === 0) return res.status(404).json({ error: "Student not found in your academy" });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Failed to delete student" }); }
});

router.post("/:id/send-email", auth, async (req, res) => {
  if (req.user.role === "student" && req.user.id !== parseInt(req.params.id))
    return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    if (req.user.role !== "student" && aid) {
      const { rows: check } = await db.query(
        `SELECT id FROM students WHERE id=$1 AND academy_id=$2`, [req.params.id, aid]
      );
      if (!check[0]) return res.status(403).json({ error: "Student does not belong to your academy" });
    }
    const { sendFeeSummaryEmail } = require("../email");
    const [stuRes, feeRes, payRes, attRes, testRes, acadRes] = await Promise.all([
      db.query(`SELECT s.*, b.name AS batch_name, br.name AS branch_name FROM students s LEFT JOIN batches b ON b.id=s.batch_id LEFT JOIN branches br ON br.id=s.branch_id WHERE s.id=$1`, [req.params.id]),
      db.query("SELECT * FROM fee_records WHERE student_id=$1 ORDER BY due_date DESC", [req.params.id]),
      db.query(`SELECT p.*, fr.period_label FROM payments p JOIN fee_records fr ON fr.id=p.fee_record_id WHERE p.student_id=$1 ORDER BY p.paid_on DESC`, [req.params.id]),
      db.query(`SELECT a.*, LEAST(ROUND((a.present::numeric / NULLIF(a.total_days,0)) * 100, 1), 100) AS percentage FROM attendance a WHERE a.student_id=$1 ORDER BY a.year DESC, a.month DESC`, [req.params.id]),
      db.query(`SELECT tr.*, t.name AS test_name, t.subject, t.total_marks, t.test_date, ROUND((tr.marks/t.total_marks::numeric)*100,1) AS percentage FROM test_results tr JOIN tests t ON t.id=tr.test_id WHERE tr.student_id=$1 ORDER BY t.test_date DESC`, [req.params.id]),
      aid ? db.query(`SELECT name, phone, primary_color, accent_color FROM academies WHERE id=$1`, [aid]) : Promise.resolve({ rows: [{}] }),
    ]);
    if (!stuRes.rows[0]) return res.status(404).json({ error: "Student not found" });
    if (!stuRes.rows[0].email) return res.status(400).json({ error: "Student has no email address" });
    const result = await sendFeeSummaryEmail({
      student:    stuRes.rows[0],
      fees:       feeRes.rows,
      payments:   payRes.rows,
      attendance: attRes.rows,
      tests:      testRes.rows,
      academy:    acadRes.rows[0] || {},
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: "Failed to send email" }); }
});

module.exports = router;
