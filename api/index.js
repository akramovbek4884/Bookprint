import express from 'express';
import cors from 'cors';
import db from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'bookprint_super_secret_key_123'; // In production, use process.env

async function initDb() {
    try {
        await db.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'cashier'
        )`);
        await db.query(`CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            barcode TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            cost_price INTEGER DEFAULT 0,
            stock INTEGER NOT NULL,
            category TEXT
        )`);
        await db.query(`CREATE TABLE IF NOT EXISTS sales (
            id SERIAL PRIMARY KEY,
            receiptNo TEXT UNIQUE NOT NULL,
            total INTEGER NOT NULL,
            date TEXT NOT NULL,
            user_id INTEGER REFERENCES users(id)
        )`);
        await db.query(`CREATE TABLE IF NOT EXISTS sale_items (
            id SERIAL PRIMARY KEY,
            sale_id INTEGER REFERENCES sales(id),
            product_id INTEGER REFERENCES products(id),
            qty INTEGER NOT NULL,
            price INTEGER NOT NULL,
            subtotal INTEGER NOT NULL
        )`);

        // Default admin
        const adminCheck = await db.query('SELECT id FROM users WHERE username = $1', ['admin']);
        if (adminCheck.rowCount === 0) {
            const hash = bcrypt.hashSync('admin123', 8);
            await db.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', hash, 'admin']);
        }
        console.log('Database tables verified/created.');
    } catch (err) {
        console.error('Database initialization error:', err);
    }
}
initDb();

// --- AUTH API ---
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });

        if (bcrypt.compareSync(password, user.password_hash)) {
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
            res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
        } else {
            res.status(401).json({ error: 'Parol noto\'g\'ri' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Middleware to protect routes
function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Ruhsat yo\'q (Token topilmadi)' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token yaroqsiz' });
        req.user = user;
        next();
    });
}

// --- PRODUCTS API ---

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM products ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a product
app.post('/api/products', async (req, res) => {
    const { barcode, name, price, cost_price, stock, category } = req.body;
    if (!barcode || !name || price == null || stock == null) {
        return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart' });
    }

    try {
        const sql = 'INSERT INTO products (barcode, name, price, cost_price, stock, category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
        const result = await db.query(sql, [barcode, name, price, cost_price || 0, stock, category || 'Unclassified']);
        res.json({ id: result.rows[0].id, barcode, name, price, cost_price, stock, category });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a product
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { barcode, name, price, cost_price, stock, category } = req.body;

    try {
        const sql = 'UPDATE products SET barcode = $1, name = $2, price = $3, cost_price = $4, stock = $5, category = $6 WHERE id = $7';
        await db.query(sql, [barcode, name, price, cost_price || 0, stock, category, id]);
        res.json({ id, barcode, name, price, cost_price, stock, category });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM products WHERE id = $1', [id]);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SALES API ---

// Add a new sale
app.post('/api/sales', async (req, res) => {
    const { receiptNo, total, items, user_id } = req.body;
    const date = new Date().toISOString();

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const saleResult = await client.query(
            'INSERT INTO sales (receiptNo, total, date, user_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [receiptNo, total, date, user_id || null]
        );
        const saleId = saleResult.rows[0].id;

        for (const item of items) {
            await client.query(
                'INSERT INTO sale_items (sale_id, product_id, qty, price, subtotal) VALUES ($1, $2, $3, $4, $5)',
                [saleId, item.id, item.qty, item.price, item.subtotal]
            );
            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [item.qty, item.id]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, saleId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Get all sales (simplified for reporting)
app.get('/api/sales', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM sales ORDER BY date DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log('Server is running on http://localhost:' + PORT);
    });
}

export default app;
