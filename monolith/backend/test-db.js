const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres.omzkmugaxusblmunctwp:8011nedimK216@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres' });
pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public'")
  .then(res => {
    console.log("Tables found:");
    console.log(res.rows);
  })
  .catch(err => console.error(err))
  .finally(() => pool.end());
