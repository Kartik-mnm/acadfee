const router = require("express").Router();
const db = require("../db");
const { auth } = require("../middleware");

async function ensureSubjectsTables() {
  try {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS custom_subjects (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          academy_id INT REFERENCES academies(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(name, academy_id)
        )
      `);

      await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb`);
      await client.query(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb`);
      
      const { rows: testCols } = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tests' AND column_name = 'subject'
      `);
      if (testCols.length > 0) {
        await client.query(`
          UPDATE tests 
          SET subjects = jsonb_build_array(subject)
          WHERE subject IS NOT NULL AND subject != '' AND (subjects IS NULL OR jsonb_array_length(subjects) = 0)
        `);
      }

      const { rows } = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'batches' AND column_name = 'subjects'
      `);
      
      if (rows.length > 0 && rows[0].data_type === 'text') {
        await client.query(`ALTER TABLE batches RENAME COLUMN subjects TO subjects_legacy`);
        await client.query(`ALTER TABLE batches ADD COLUMN subjects JSONB DEFAULT '[]'::jsonb`);
        
        const { rows: batchRows } = await client.query(`SELECT id, subjects_legacy FROM batches WHERE subjects_legacy IS NOT NULL AND subjects_legacy != ''`);
        for (const b of batchRows) {
          const arr = b.subjects_legacy.split(',').map(s => s.trim()).filter(Boolean);
          await client.query(`UPDATE batches SET subjects = $1 WHERE id = $2`, [JSON.stringify(arr), b.id]);
        }
      } else if (rows.length === 0) {
        await client.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb`);
      }

      await client.query("COMMIT");
    } catch(e) {
      await client.query("ROLLBACK");
      console.error("[subjects] Migration error inside transaction:", e.message);
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("[subjects] table ensure error:", e.message);
  }
}
ensureSubjectsTables();

// List custom subjects
router.get("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    if (!aid) return res.json([]);
    const { rows } = await db.query(
      `SELECT * FROM custom_subjects WHERE academy_id=$1 ORDER BY name ASC`,
      [aid]
    );
    res.json(rows);
  } catch (e) { 
    res.status(500).json({ error: "Failed to fetch custom subjects" }); 
  }
});

// Create custom subject
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { name } = req.body;
    const aid = req.academyId;
    if (!name) return res.status(400).json({ error: "Subject name is required" });
    if (!aid) return res.status(400).json({ error: "Academy context missing" });
    
    const { rows } = await db.query(
      `INSERT INTO custom_subjects (name, academy_id) VALUES ($1, $2)
       ON CONFLICT (name, academy_id) DO NOTHING RETURNING *`,
      [name.trim(), aid]
    );
    if (!rows[0]) {
      const { rows: existing } = await db.query(`SELECT * FROM custom_subjects WHERE name=$1 AND academy_id=$2`, [name.trim(), aid]);
      return res.json(existing[0]);
    }
    res.json(rows[0]);
  } catch (e) { 
    res.status(500).json({ error: "Failed to create custom subject" }); 
  }
});

// Delete custom subject
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    await db.query(`DELETE FROM custom_subjects WHERE id=$1 AND academy_id=$2`, [req.params.id, aid]);
    res.json({ success: true });
  } catch (e) { 
    res.status(500).json({ error: "Failed to delete custom subject" }); 
  }
});

module.exports = router;
