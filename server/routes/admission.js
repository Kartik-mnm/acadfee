const router    = require("express").Router();
const db        = require("../db");
const { auth }  = require("../middleware");
const rateLimit = require("express-rate-limit");

async function initAdmissionColumns() {
  try {
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS photo_url   TEXT`);
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS academy_id  INT REFERENCES academies(id) ON DELETE CASCADE`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_admission_enquiries_academy ON admission_enquiries(academy_id)`);
    console.log("\u2705 admission_enquiries columns ready");
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
    const { rows } = await db.query(
      `INSERT INTO admission_enquiries
       (name, phone, parent_phone, email, batch_id, address, branch_id, extra, photo_url, academy_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
      [name, phone, parent_phone || null, email || null,
       batch_id || null, address || null, branch_id || null,
       typeof extra === "string" ? extra : JSON.stringify(extra || {}),
       photoUrl, resolvedAcademyId]
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

// ── Admin: approve enquiry — BUG FIX: handle null branch_id gracefully ─────────────
router.post("/enquiries/:id/approve", auth, async (req, res) => {
  try {
    const academyId = req.academyId;

    // Fetch the enquiry — scoped to this academy
    const whereClause = academyId
      ? "WHERE ae.id=$1 AND (ae.academy_id=$2 OR ae.academy_id IS NULL)"
      : "WHERE ae.id=$1";
    const params = academyId ? [req.params.id, academyId] : [req.params.id];

    const { rows } = await db.query(
      `SELECT ae.*,
              br.academy_id AS branch_academy_id
       FROM admission_enquiries ae
       LEFT JOIN branches br ON br.id = ae.branch_id
       ${whereClause}`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "Enquiry not found or does not belong to your academy" });
    const e = rows[0];

    // Resolve the correct academy_id:
    // Priority: enquiry.academy_id → branch.academy_id → logged-in admin's academy_id
    const resolvedAcademyId = e.academy_id || e.branch_academy_id || academyId;

    // branch_id is required for creating a student
    // If the student didn’t select a branch, fall back to the first branch of this academy
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
        error: "Cannot approve: no branch is set for this enquiry and no branches exist for this academy. Please add a branch first."
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

    // Create the student
    const { rows: stuRows } = await db.query(
      `INSERT INTO students
       (branch_id, batch_id, name, phone, parent_phone, email, address,
        admission_date, status, photo_url, academy_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7, CURRENT_DATE, 'active', $8, $9)
       RETURNING *`,
      [
        resolvedBranchId,
        e.batch_id || null,
        e.name,
        e.phone,
        e.parent_phone || null,
        e.email || null,
        e.address || null,
        photoUrl,
        resolvedAcademyId,
      ]
    );

    // Mark enquiry approved
    await db.query(
      "UPDATE admission_enquiries SET status='approved', student_id=$1, academy_id=$2 WHERE id=$3",
      [stuRows[0].id, resolvedAcademyId, req.params.id]
    );

    res.json({ success: true, student: stuRows[0] });
  } catch (e) {
    console.error("Approve error:", e.message);
    res.status(500).json({ error: "Failed to approve enquiry: " + e.message });
  }
});

// ── Admin: reject enquiry scoped to academy ───────────────────────────────────────
router.patch("/enquiries/:id/reject", auth, async (req, res) => {
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
