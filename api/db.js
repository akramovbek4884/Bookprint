import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.unfjcyajqahsmxcptgno:Planusa01%26@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require';

const pool = new Pool({
    connectionString: connectionString,
    ssl: connectionString.includes('localhost') ? false : {
        rejectUnauthorized: false
    }
});

export default {
    query: (text, params) => pool.query(text, params),
    pool: pool
};
