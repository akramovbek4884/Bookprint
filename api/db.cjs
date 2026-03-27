const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Planusa01%26@db.unfjcyajqahsmxcptgno.supabase.co:5432/postgres';

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // Required for Supabase in many environments
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool
};
