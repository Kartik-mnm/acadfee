require('dotenv').config();
const db = require("./db");

async function migrate() {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    
    console.log("Creating custom_subjects table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_subjects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        academy_id INT REFERENCES academies(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(name, academy_id)
      )
    `);

    console.log("Adding subjects to students...");
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb`);
    
    console.log("Adding subjects JSONB to tests...");
    await client.query(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb`);
    
    console.log("Migrating test subjects...");
    await client.query(`
      UPDATE tests 
      SET subjects = jsonb_build_array(subject)
      WHERE subject IS NOT NULL AND subject != '' AND (subjects IS NULL OR jsonb_array_length(subjects) = 0)
    `);

    console.log("Migrating batches subjects...");
    const { rows } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'batches' AND column_name = 'subjects'
    `);
    
    if (rows.length > 0 && rows[0].data_type === 'text') {
      console.log("Renaming text column to subjects_legacy and creating JSONB column...");
      await client.query(`ALTER TABLE batches RENAME COLUMN subjects TO subjects_legacy`);
      await client.query(`ALTER TABLE batches ADD COLUMN subjects JSONB DEFAULT '[]'::jsonb`);
      
      const { rows: batchRows } = await client.query(`SELECT id, subjects_legacy FROM batches WHERE subjects_legacy IS NOT NULL AND subjects_legacy != ''`);
      for (const b of batchRows) {
        const arr = b.subjects_legacy.split(',').map(s => s.trim()).filter(Boolean);
        await client.query(`UPDATE batches SET subjects = $1 WHERE id = $2`, [JSON.stringify(arr), b.id]);
      }
    } else if (rows.length === 0) {
      await client.query(`ALTER TABLE batches ADD COLUMN subjects JSONB DEFAULT '[]'::jsonb`);
    }

    await client.query("COMMIT");
    console.log("Migration complete!");
  } catch(e) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", e);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
