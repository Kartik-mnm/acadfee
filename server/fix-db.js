const db = require("./db");

async function fixDb() {
  const client = await db.pool.connect();
  console.log("Connected to DB, running fixes...");
  try {
    await client.query("BEGIN");

    // 1. Rename test_scores to test_results
    try {
      await client.query("ALTER TABLE test_scores RENAME TO test_results");
      console.log("Renamed test_scores to test_results");
    } catch (e) {
      console.log("test_scores already renamed or doesn't exist:", e.message);
    }

    // 2. Fix expenses expense_date
    try {
      await client.query("ALTER TABLE expenses RENAME COLUMN paid_on TO expense_date");
      console.log("Renamed expenses.paid_on to expense_date");
    } catch (e) {
      console.log("expenses.paid_on already renamed:", e.message);
    }

    // 3. Fix attendance table
    try {
      // Drop the incorrect daily attendance table
      await client.query("DROP TABLE IF EXISTS attendance CASCADE");
      
      // Recreate it as the Monthly attendance table exactly how attendance.js needs it
      await client.query(`
        CREATE TABLE attendance (
          id SERIAL PRIMARY KEY,
          student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          branch_id INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
          month INT NOT NULL,
          year INT NOT NULL,
          total_days INT DEFAULT 0,
          present INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(student_id, month, year)
        )
      `);
      console.log("Recreated attendance table with correct schema (month, year, total_days, present)");
    } catch (e) {
      console.log("Failed to recreate attendance:", e.message);
    }

    await client.query("COMMIT");
    console.log("Database fixes applied successfully!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("FATAL ERROR:", e);
  } finally {
    client.release();
    process.exit(0);
  }
}

fixDb();
