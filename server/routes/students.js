const router  = require("express").Router();
const db      = require("../db");
const bcrypt  = require("bcryptjs");
const { auth, branchFilter } = require("../middleware");
const cloudinary = (() => { try { return require("cloudinary").v2; } catch { return null; } })();

if (cloudinary && process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ── Helper: generate academy prefix from academy name ───────────────────────────────
// e.g. "Kavita's Kitchen" → "KK", "Nishchay Academy" → "NA"
function academyPrefix(name) {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
}

// ── List students (with server-side pagination) ──────────────────────────────────────
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    if (req.user.role === "student") {
      const { rows } = await db.query(
        `SELECT s.*, b.name AS batch_name, br.name AS branch_name
         FROM students s
         LEFT JOIN batches  b  ON b.id  = s.batch_id
         LEFT JOIN branches br ON br.id = s.branch_id
         WHERE s.id = $1`, [req.user.id]
      );
      return res.json(rows);
    }

    const { status, batch_id, search, limit, page } = req.query;
    const aid = req.academyId;
    let conditions = []; let params = []; let idx = 1;
    if (aid)          { conditions.push(`s.academy_id=$${idx++}`);  params.push(aid); }
    if (req.branchId) { conditions.push(`s.branch_id=$${idx++}`);   params.push(req.branchId); }
    if (status)       { conditions.push(`s.status=$${idx++}`);      params.push(status); }
    if (batch_id)     { conditions.push(`s.batch_id=$${idx++}`);    params.push(batch_id); }
    if (search)       {
      conditions.push(`(s.name ILIKE $${idx} OR s.phone ILIKE $${idx} OR COALESCE(s.roll_no,'') ILIKE $${idx} OR COALESCE(s.email,'') ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    // FIX (Issue 5): Server-side pagination. If page is provided return paginated result.
    // If no page param (legacy usage with limit), fall back to simple LIMIT.
    if (page) {
      const pageNum  = Math.max(1, parseInt(page) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset   = (pageNum - 1) * pageSize;

      const { rows: countRows } = await db.query(
        `SELECT COUNT(*)::int AS total FROM students s ${where}`, params
      );
      const total      = countRows[0].total;
      const totalPages = Math.ceil(total / pageSize);

      const { rows } = await db.query(
        `SELECT s.*, b.name AS batch_name, br.name AS branch_name
         FROM students s
         LEFT JOIN batches  b  ON b.id  = s.batch_id
         LEFT JOIN branches br ON br.id = s.branch_id
         ${where} ORDER BY s.name
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pageSize, offset]
      );
      return res.json({ data: rows, page: pageNum, totalPages, total, limit: pageSize });
    }

    // Legacy: no pagination (used by ID cards, attendance, etc.)
    const limitClause = limit ? `LIMIT ${parseInt(limit)}` : "";
    const { rows } = await db.query(
      `SELECT s.*, b.name AS batch_name, br.name AS branch_name
       FROM students s
       LEFT JOIN batches  b  ON b.id  = s.batch_id
       LEFT JOIN branches br ON br.id = s.branch_id
       ${where} ORDER BY s.name ${limitClause}`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("List students error:", e.message);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// ── Get one student ─────────────────────────────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.role === "student" && req.user.id !== targetId)
      return res.status(403).json({ error: "Access denied" });
    const { rows } = await db.query(
      `SELECT s.*, b.name AS batch_name, br.name AS branch_name
       FROM students s
       LEFT JOIN batches b ON b.id = s.batch_id
       LEFT JOIN branches br ON br.id = s.branch_id
       WHERE s.id = $1`, [targetId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Student not found" });
    if (req.academyId && req.user.role !== "student" && rows[0].academy_id && rows[0].academy_id !== req.academyId)
      return res.status(403).json({ error: "Access denied" });
    res.json(rows[0]);
  } catch (e) {
    console.error("Get student error:", e.message);
    res.status(500).json({ error: "Failed to fetch student" });
  }
});

// ── Create student ─────────────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const {
      name, email, phone, parent_phone, parent_name,
      batch_id, branch_id, status, admission_date,
      fee_type, discount, due_day, roll_no,
    } = req.body;
    if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });
    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    const aid = req.academyId;
    const { rows } = await db.query(
      `INSERT INTO students
         (name, email, phone, parent_phone, parent_name,
          batch_id, branch_id, academy_id, status, admission_date,
          fee_type, discount, due_day, roll_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [name, email||null, phone, parent_phone||null, parent_name||null,
       batch_id||null, bid, aid||null, status||"active",
       admission_date||new Date().toISOString().split("T")[0],
       fee_type||"monthly", discount||0, due_day||10, roll_no||null]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Create student error:", e.message);
    res.status(500).json({ error: "Failed to create student" });
  }
});

// ── Update student ─────────────────────────────────────────────────────────────────
router.put("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    if (aid) {
      const { rows: check } = await db.query(`SELECT academy_id FROM students WHERE id=$1`, [req.params.id]);
      if (!check[0]) return res.status(404).json({ error: "Student not found" });
      if (check[0].academy_id && check[0].academy_id !== aid) return res.status(403).json({ error: "Access denied" });
    }
    const {
      name, email, phone, parent_phone, parent_name,
      batch_id, branch_id, status, admission_date,
      fee_type, discount, due_day, roll_no,
    } = req.body;
    const { rows } = await db.query(
      `UPDATE students SET
         name=$1, email=$2, phone=$3, parent_phone=$4, parent_name=$5,
         batch_id=$6, branch_id=$7, status=$8, admission_date=$9,
         fee_type=$10, discount=$11, due_day=$12, roll_no=$13
       WHERE id=$14 RETURNING *`,
      [name, email||null, phone, parent_phone||null, parent_name||null,
       batch_id||null, branch_id, status||"active", admission_date,
       fee_type||"monthly", discount||0, due_day||10, roll_no||null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Student not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("Update student error:", e.message);
    res.status(500).json({ error: "Failed to update student" });
  }
});

// ── Delete student ─────────────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    if (aid) {
      const { rows: check } = await db.query(`SELECT academy_id FROM students WHERE id=$1`, [req.params.id]);
      if (!check[0]) return res.status(404).json({ error: "Student not found" });
      if (check[0].academy_id && check[0].academy_id !== aid) return res.status(403).json({ error: "Access denied" });
    }
    await db.query("DELETE FROM students WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error("Delete student error:", e.message);
    res.status(500).json({ error: "Failed to delete student" });
  }
});

// ── Upload photo ─────────────────────────────────────────────────────────────────
router.post("/:id/photo", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { photo_base64 } = req.body;
    if (!photo_base64) return res.status(400).json({ error: "photo_base64 is required" });
    if (!cloudinary) return res.status(500).json({ error: "Cloudinary not configured" });
    const result = await cloudinary.uploader.upload(photo_base64, {
      folder: "acadfee/students", resource_type: "image",
      transformation: [{ width: 300, height: 300, crop: "fill", gravity: "face" }],
    });
    await db.query("UPDATE students SET photo_url=$1 WHERE id=$2", [result.secure_url, req.params.id]);
    res.json({ photo_url: result.secure_url });
  } catch (e) {
    console.error("Photo upload error:", e.message);
    res.status(500).json({ error: "Photo upload failed" });
  }
});

// ── Update FCM token ─────────────────────────────────────────────────────────────────
router.post("/:id/fcm-token", auth, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.role === "student" && req.user.id !== targetId)
      return res.status(403).json({ error: "Access denied" });
    const { token, type } = req.body;
    if (!token) return res.status(400).json({ error: "token is required" });
    const col = type === "parent" ? "parent_fcm_token" : "fcm_token";
    await db.query(`UPDATE students SET ${col}=$1 WHERE id=$2`, [token, targetId]);
    res.json({ success: true });
  } catch (e) {
    console.error("FCM token update error:", e.message);
    res.status(500).json({ error: "Failed to update FCM token" });
  }
});

// ── Send fee summary email ────────────────────────────────────────────────────────────
router.post("/:id/send-email", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { rows: sRows } = await db.query(
      `SELECT s.*, b.name AS batch_name, br.name AS branch_name, a.name AS academy_name,
              a.primary_color, a.accent_color, a.phone AS academy_phone
       FROM students s
       LEFT JOIN batches  b  ON b.id  = s.batch_id
       LEFT JOIN branches br ON br.id = s.branch_id
       LEFT JOIN academies a ON a.id  = s.academy_id
       WHERE s.id = $1`, [req.params.id]
    );
    if (!sRows[0]) return res.status(404).json({ error: "Student not found" });
    const student = sRows[0];
    if (!student.email) return res.status(400).json({ error: "Student has no email address" });
    const { rows: feeRows } = await db.query(
      `SELECT * FROM fee_records WHERE student_id=$1 ORDER BY due_date DESC LIMIT 10`, [req.params.id]
    );
    const { sendFeeSummaryEmail } = require("./email");
    await sendFeeSummaryEmail(student, feeRows, {
      name: student.academy_name, primary_color: student.primary_color,
      accent_color: student.accent_color, phone: student.academy_phone,
    });
    res.json({ message: `Fee summary sent to ${student.email}` });
  } catch (e) {
    console.error("Send email error:", e.message);
    res.status(500).json({ error: e.message || "Failed to send email" });
  }
});

// ── Backfill roll numbers ───────────────────────────────────────────────────────────────
// FIX (Issue 4): Roll numbers now include academy initials prefix
// e.g. Nishchay Academy → NA0001, Kavita's Kitchen → KK0001
// Existing roll numbers that are already prefixed are left alone.
router.post("/backfill-roll-numbers", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;

    // Get academy name for prefix generation
    let prefix = "";
    if (aid) {
      const { rows: acadRows } = await db.query("SELECT name FROM academies WHERE id=$1", [aid]);
      if (acadRows[0]) prefix = academyPrefix(acadRows[0].name);
    }

    // Get all students WITHOUT roll numbers, ordered by admission date then id
    const { rows: students } = await db.query(
      `SELECT s.id FROM students s
       WHERE s.roll_no IS NULL ${aid ? "AND s.academy_id=$1" : ""}
       ORDER BY s.admission_date ASC NULLS LAST, s.id ASC`,
      aid ? [aid] : []
    );
    if (students.length === 0)
      return res.json({ message: "All students already have roll numbers.", updated: 0 });

    // Find the highest existing sequential number for this academy (strips any prefix)
    const { rows: maxRow } = await db.query(
      `SELECT roll_no FROM students
       WHERE roll_no ~ '[0-9]+$' ${aid ? "AND academy_id=$1" : ""}
       ORDER BY CAST(regexp_replace(roll_no, '^[^0-9]*', '') AS INT) DESC LIMIT 1`,
      aid ? [aid] : []
    );
    let seq = 1;
    if (maxRow[0]?.roll_no) {
      const digits = maxRow[0].roll_no.replace(/^[^0-9]*/, "");
      const n = parseInt(digits);
      if (!isNaN(n)) seq = n + 1;
    }

    let updated = 0;
    for (const s of students) {
      const roll = `${prefix}${String(seq).padStart(4, "0")}`;
      await db.query("UPDATE students SET roll_no=$1 WHERE id=$2", [roll, s.id]);
      seq++; updated++;
    }
    res.json({
      message: `Assigned roll numbers to ${updated} student(s). Format: ${prefix}0001`,
      updated,
      prefix,
    });
  } catch (e) {
    console.error("Backfill roll numbers error:", e.message);
    res.status(500).json({ error: "Failed to assign roll numbers" });
  }
});

module.exports = router;
