process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.unfjcyajqahsmxcptgno:Planusa2026Market@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require';

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
