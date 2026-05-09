const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DB_URL = 'postgresql://acadfee_user:My2hhs4Hfi8srlAj5mMGxJyZpglaPmUL@dpg-d6pbmqhr0fns73e91pbg-a.oregon-postgres.render.com/acadfee';
const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  console.log('Connected');
  
  await client.query(`ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner'`);
  console.log('Added role column');
  
  await client.query(`UPDATE platform_admins SET role = 'owner' WHERE email = 'kartik@exponent.app'`);
  
  const hash = await bcrypt.hash('Password123', 10);
  await client.query(`
    INSERT INTO platform_admins (email, password_hash, name, role) 
    VALUES ('cofounder@exponent.app', $1, 'Co-Founder', 'viewer')
    ON CONFLICT (email) DO NOTHING
  `, [hash]);
  console.log('Inserted cofounder');
  
  const res = await client.query('SELECT id, email, role FROM platform_admins');
  console.table(res.rows);
  
  await client.end();
}

run().catch(console.error);
