const router    = require("express").Router();
const db        = require("../db");
const { auth }  = require("../middleware");
const rateLimit = require("express-rate-limit");

async function initAdmissionColumns() {
  try {
    // Ensure basic columns exist
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS photo_url   TEXT`);
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS academy_id  INT REFERENCES academies(id) ON DELETE CASCADE`);
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS enquiry_no TEXT`);
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS batch_name TEXT`);
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS course     TEXT`);
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS email      TEXT`);
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS notes      TEXT`);
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS dob        DATE`);
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS gender     TEXT`);

    // Force the status check constraint to be exactly what we expect
    try {
      await db.query(`ALTER TABLE admission_enquiries DROP CONSTRAINT IF EXISTS admission_enquiries_status_check`);
      await db.query(`ALTER TABLE admission_enquiries ADD CONSTRAINT admission_enquiries_status_check CHECK (status IN ('pending', 'approved', 'rejected'))`);
    } catch (e) {
      console.warn("[admissions] status constraint sync:", e.message);
    }

    await db.query(`CREATE INDEX IF NOT EXISTS idx_admission_enquiries_academy ON admission_enquiries(academy_id)`);
    
    // Ensure students table has all columns the approve route needs
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_no VARCHAR(30)`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS due_day  INT DEFAULT 1`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT`);
    
    console.log("✅ admission system ready");
  } catch (e) { console.error("Admission migration error:", e.message); }
}
initAdmissionColumns();

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { error: "Too many enquiries submitted. Please try again after 15 minutes." },
});

// ── Public: form-data scoped by slug ───────────────────────────────────────────────
router.get("/form-data", async (req, res) => {
  const { slug } = req.query;
  try {
    if (slug) {
      const { rows: acadRows } = await db.query(
        `SELECT id FROM academies WHERE slug = $1 AND is_active = true`, [slug]
      );
      if (!acadRows[0]) return res.status(404).json({ error: "Academy not found" });
      const academyId = acadRows[0].id;
      const [branches, batches] = await Promise.all([
        db.query(`SELECT id, name FROM branches WHERE academy_id = $1 ORDER BY name`, [academyId]),
        db.query(`SELECT id, name, branch_id, fee_monthly FROM batches
                  WHERE branch_id IN (SELECT id FROM branches WHERE academy_id = $1)
                  ORDER BY name`, [academyId]),
      ]);
      return res.json({ branches: branches.rows, batches: batches.rows, academy_id: academyId });
    }
    const [branches, batches] = await Promise.all([
      db.query("SELECT id, name FROM branches ORDER BY name"),
      db.query("SELECT id, name, branch_id, fee_monthly FROM batches ORDER BY name"),
    ]);
    res.json({ branches: branches.rows, batches: batches.rows });
  } catch (e) {
    console.error("Form data error:", e.message);
    res.status(500).json({ error: "Failed to load form data" });
  }
});

// ── Public: submit enquiry ─────────────────────────────────────────────────────────
router.post("/enquiry", enquiryLimiter, async (req, res) => {
  const { name, phone, parent_phone, email, batch_id, address, branch_id, extra, academy_id, slug } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Name and phone are required" });
  try {
    let resolvedAcademyId = academy_id || null;
    if (!resolvedAcademyId && slug) {
      const { rows } = await db.query(
        `SELECT id FROM academies WHERE slug = $1 AND is_active = true`, [slug]
      );
      if (rows[0]) resolvedAcademyId = rows[0].id;
    }
    let photoUrl = null;
    if (extra) {
      try {
        const ex = typeof extra === "string" ? JSON.parse(extra) : extra;
        photoUrl = ex.photo_url || null;
      } catch {}
    }
    // Auto-generate enquiry number if academy_id is known
    let enquiryNo = null;
    if (resolvedAcademyId) {
      const { rows: cnt } = await db.query(
        `SELECT COUNT(*) AS c FROM admission_enquiries WHERE academy_id = $1`, [resolvedAcademyId]
      );
      const seq = String(parseInt(cnt[0].c) + 1).padStart(4, "0");
      enquiryNo = `ENQ-${seq}`;
    }

    // Extract dob/gender from extra if present
    let dob = null, gender = null;
    if (extra) {
      try {
        const ex = typeof extra === "string" ? JSON.parse(extra) : extra;
        dob = ex.dob || null;
        gender = ex.gender || null;
      } catch {}
    }

    const { rows } = await db.query(
      `INSERT INTO admission_enquiries
       (name, phone, parent_phone, email, batch_id, address, branch_id, extra, photo_url, academy_id, enquiry_no, status, dob, gender)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending', $12, $13) RETURNING *`,
      [name, phone, parent_phone || null, email || null,
       batch_id || null, address || null, branch_id || null,
       typeof extra === "string" ? extra : JSON.stringify(extra || {}),
       photoUrl, resolvedAcademyId, enquiryNo, dob, gender]
    );
    res.json({ success: true, enquiry_id: rows[0].id });
  } catch (e) {
    console.error("Admission enquiry error:", e.message);
    res.status(500).json({ error: "Failed to submit enquiry" });
  }
});

// ── Admin: list enquiries scoped to academy ───────────────────────────────────────
router.get("/enquiries", auth, async (req, res) => {
  try {
    const academyId = req.academyId;
    let query, params;
    if (req.user.role === "branch_manager") {
      query = `SELECT ae.*, b.name AS batch_name, br.name AS branch_name
               FROM admission_enquiries ae
               LEFT JOIN batches b ON b.id = ae.batch_id
               LEFT JOIN branches br ON br.id = ae.branch_id
               WHERE ae.branch_id = $1
               ${academyId ? "AND ae.academy_id = $2" : ""}
               ORDER BY ae.created_at DESC`;
      params = academyId ? [req.user.branch_id, academyId] : [req.user.branch_id];
    } else {
      query = `SELECT ae.*, b.name AS batch_name, br.name AS branch_name
               FROM admission_enquiries ae
               LEFT JOIN batches b ON b.id = ae.batch_id
               LEFT JOIN branches br ON br.id = ae.branch_id
               ${academyId ? "WHERE ae.academy_id = $1" : ""}
               ORDER BY ae.created_at DESC`;
      params = academyId ? [academyId] : [];
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error("Enquiries fetch error:", e.message);
    res.status(500).json({ error: "Failed to fetch enquiries" });
  }
});

// ── Admin: approve enquiry ─────────────────────────────────────────────────────────
router.post("/enquiries/:id/approve", auth, async (req, res) => {
  try {
    const academyId = req.academyId;

    const whereClause = academyId
      ? "WHERE ae.id=$1 AND (ae.academy_id=$2 OR ae.academy_id IS NULL)"
      : "WHERE ae.id=$1";
    const params = academyId ? [req.params.id, academyId] : [req.params.id];

    const { rows } = await db.query(
      `SELECT ae.*, br.academy_id AS branch_academy_id
       FROM admission_enquiries ae
       LEFT JOIN branches br ON br.id = ae.branch_id
       ${whereClause}`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "Enquiry not found or does not belong to your academy" });
    const e = rows[0];

    // Resolve academy_id: enquiry → branch → logged-in user
    const resolvedAcademyId = e.academy_id || e.branch_academy_id || academyId;

    // Resolve branch_id — fall back to first branch of academy if not set
    let resolvedBranchId = e.branch_id;
    if (!resolvedBranchId && resolvedAcademyId) {
      const { rows: branchRows } = await db.query(
        `SELECT id FROM branches WHERE academy_id = $1 ORDER BY id LIMIT 1`,
        [resolvedAcademyId]
      );
      if (branchRows[0]) resolvedBranchId = branchRows[0].id;
    }
    if (!resolvedBranchId) {
      return res.status(400).json({
        error: "Cannot approve: no branch found for this academy. Please add a branch first."
      });
    }

    // Resolve photo
    let photoUrl = e.photo_url || null;
    if (!photoUrl && e.extra) {
      try {
        const ex = typeof e.extra === "string" ? JSON.parse(e.extra) : e.extra;
        photoUrl = ex.photo_url || null;
      } catch {}
    }

    // Auto-generate roll_no: count existing students in this academy + 1
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) AS cnt FROM students WHERE academy_id = $1`,
      [resolvedAcademyId]
    );
    const rollNo = String(parseInt(countRows[0]?.cnt || 0) + 1).padStart(4, "0");

    // Resolve dob and gender from enquiry columns or extra
    let dob = e.dob || null;
    let gender = e.gender || null;
    if ((!dob || !gender) && e.extra) {
      try {
        const ex = typeof e.extra === "string" ? JSON.parse(e.extra) : e.extra;
        if (!dob) dob = ex.dob || null;
        if (!gender) gender = ex.gender || null;
      } catch {}
    }

    // Fetch batch details to get fees
    let admissionFee = 0;
    let feeType = "monthly";
    if (e.batch_id) {
      const { rows: batchRows } = await db.query(
        "SELECT fee_monthly, fee_course FROM batches WHERE id = $1",
        [e.batch_id]
      );
      if (batchRows[0]) {
        if (parseFloat(batchRows[0].fee_course) > 0) {
          admissionFee = batchRows[0].fee_course;
          feeType = "course";
        } else if (parseFloat(batchRows[0].fee_monthly) > 0) {
          feeType = "monthly";
        }
      }
    }

    // Create student — using only columns guaranteed to exist
    const { rows: stuRows } = await db.query(
      `INSERT INTO students
         (branch_id, batch_id, name, phone, parent_phone, email, address,
          admission_date, status, photo_url, academy_id, roll_no, dob, gender, admission_fee, fee_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7, CURRENT_DATE, 'active', $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        resolvedBranchId,
        e.batch_id   || null,
        e.name,
        e.phone,
        e.parent_phone || null,
        e.email        || null,
        e.address      || null,
        photoUrl,
        resolvedAcademyId,
        rollNo,
        dob,
        gender,
        admissionFee,
        feeType
      ]
    );

    await db.query(
      "UPDATE admission_enquiries SET status='approved', student_id=$1, academy_id=$2 WHERE id=$3",
      [stuRows[0].id, resolvedAcademyId, req.params.id]
    );

    res.json({ success: true, student: stuRows[0] });
  } catch (e) {
    console.error("Approve error:", e.message, e.stack);
    res.status(500).json({ error: "Failed to approve: " + e.message });
  }
});

// ── Admin: reject enquiry ─────────────────────────────────────────────────────────
router.post("/enquiries/:id/reject", auth, async (req, res) => {
  try {
    const academyId = req.academyId;
    const whereClause = academyId
      ? "WHERE id=$1 AND (academy_id=$2 OR academy_id IS NULL)"
      : "WHERE id=$1";
    const params = academyId ? [req.params.id, academyId] : [req.params.id];
    const { rowCount } = await db.query(
      `UPDATE admission_enquiries SET status='rejected' ${whereClause}`, params
    );
    if (rowCount === 0) return res.status(404).json({ error: "Enquiry not found" });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to reject enquiry" });
  }
});

module.exports = router;
