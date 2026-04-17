import 'dotenv/config';
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

const JWT_SECRET = process.env.JWT_SECRET || 'bookprint_fallback_secret_change_me';
let globalDataUpdated = new Date().toISOString();

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
            discount INTEGER DEFAULT 0,
            date TEXT NOT NULL,
            user_id INTEGER REFERENCES users(id)
        )`);
        await db.query(`CREATE TABLE IF NOT EXISTS sale_items (
            id SERIAL PRIMARY KEY,
            sale_id INTEGER REFERENCES sales(id),
            product_id INTEGER REFERENCES products(id),
            name TEXT,
            barcode TEXT,
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

        // Add name/barcode columns to sale_items if missing (migration)
        try {
            await db.query(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS name TEXT`);
            await db.query(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS barcode TEXT`);
        } catch (e) {
            // columns already exist, ignore
        }

        // Fix foreign key constraint for product deletion
        try {
            await db.query(`ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey`);
            await db.query(`ALTER TABLE sale_items ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL`);
        } catch (e) {
            console.error("Constraint migration error:", e.message);
        }

        // Add discount column to sales if missing
        try {
            await db.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount INTEGER DEFAULT 0`);
        } catch (e) {
            console.error("Discount column migration error:", e.message);
        }

        // Fix foreign key constraint for user deletion
        try {
            await db.query(`ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey`);
            await db.query(`ALTER TABLE sales ADD CONSTRAINT sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`);
        } catch (e) {
            console.error("User constraint migration error:", e.message);
        }

        // Allow duplicate barcodes
        try {
            await db.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key`);
        } catch (e) {
            console.error("Barcode constraint migration error:", e.message);
        }

        console.log('Database tables verified/created.');
    } catch (err) {
        console.error('Database initialization error:', err);
    }
}
initDb();

// --- AUTH MIDDLEWARE ---
function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Ruhsat yo'q (Token topilmadi)" });

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ error: 'Token yaroqsiz' });
        try {
            const result = await db.query('SELECT role FROM users WHERE id = $1', [user.id]);
            if (result.rowCount === 0) {
                return res.status(401).json({ error: 'Foydalanuvchi tizimdan o\'chirilgan' });
            }
            req.user = { id: user.id, username: user.username, role: result.rows[0].role };
            next();
        } catch (dbErr) {
            res.status(500).json({ error: dbErr.message });
        }
    });
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Faqat admin uchun ruxsat berilgan" });
    }
    next();
}

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
            res.status(401).json({ error: "Parol noto'g'ri" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- USERS API (Admin only) ---
app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, role FROM users ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username va parol kiritilishi shart" });
    }

    try {
        const hash = bcrypt.hashSync(password, 8);
        const validRole = role === 'admin' ? 'admin' : 'cashier';
        const result = await db.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, hash, validRole]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.message.includes('unique') || err.message.includes('duplicate')) {
            return res.status(400).json({ error: "Bu foydalanuvchi nomi allaqachon mavjud" });
        }
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;

    // Prevent deleting main admin accounts (id 1 and 21)
    if (parseInt(id) === 1 || parseInt(id) === 21) {
        return res.status(400).json({ error: "Asosiy admin foydalanuvchilarini o'chirib bo'lmaydi!" });
    }

    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: "O'zingizni o'chira olmaysiz" });
    }

    try {
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: "O'chirildi" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/password', authenticate, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: "Yangi parol 4 belgidan kam bo'lmasligi kerak" });
    }
    try {
        const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        if (result.rowCount === 0) return res.status(401).json({ error: "Foydalanuvchi topilmadi" });
        if (!bcrypt.compareSync(oldPassword, result.rows[0].password_hash)) {
            return res.status(400).json({ error: "Eski parol noto'g'ri" });
        }
        const hash = bcrypt.hashSync(newPassword, 8);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
        res.json({ message: "Parol muvaffaqiyatli o'zgartirildi" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PRODUCTS API (Protected) ---
app.get('/api/products', authenticate, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM products ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', authenticate, requireAdmin, async (req, res) => {
    const { barcode, name, price, cost_price, stock, category } = req.body;
    if (!barcode || !name || price == null || stock == null) {
        return res.status(400).json({ error: "Barcha maydonlar to'ldirilishi shart" });
    }
    if (price < 0 || stock < 0 || (cost_price && cost_price < 0)) {
        return res.status(400).json({ error: "Manfiy son kiritish taqiqlangan" });
    }

    try {
        const sql = 'INSERT INTO products (barcode, name, price, cost_price, stock, category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
        const result = await db.query(sql, [barcode, name, price, cost_price || 0, stock, category || 'Unclassified']);
        globalDataUpdated = new Date().toISOString();
        res.json({ id: result.rows[0].id, barcode, name, price, cost_price, stock, category });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { barcode, name, price, cost_price, stock, category } = req.body;

    if (price < 0 || stock < 0 || (cost_price && cost_price < 0)) {
        return res.status(400).json({ error: "Manfiy son kiritish taqiqlangan" });
    }

    try {
        const sql = 'UPDATE products SET barcode = $1, name = $2, price = $3, cost_price = $4, stock = $5, category = $6 WHERE id = $7';
        await db.query(sql, [barcode, name, price, cost_price || 0, stock, category, id]);
        globalDataUpdated = new Date().toISOString();
        res.json({ id, barcode, name, price, cost_price, stock, category });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM products WHERE id = $1', [id]);
        globalDataUpdated = new Date().toISOString();
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sales', authenticate, async (req, res) => {
    const { items, discount = 0 } = req.body;
    let receiptno = req.body.receiptno || req.body.receiptNo;

    if (!receiptno) {
        receiptno = `BP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    const date = new Date().toISOString();
    const user_id = req.user.id;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: "Sotish uchun mahsulotlar yo'q" });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        let calculatedTotal = 0;
        const processedItems = [];

        // Validate stock and calculate real total
        for (const item of items) {
            if (item.id) {
                const prodResult = await client.query('SELECT name, barcode, price, stock FROM products WHERE id = $1 FOR UPDATE', [item.id]);
                if (prodResult.rowCount === 0) {
                    throw new Error(`${item.name || item.barcode || 'Mahsulot'} bazada topilmadi.`);
                }
                const dbProduct = prodResult.rows[0];
                if (dbProduct.stock < item.qty) {
                    throw new Error(`${dbProduct.name} - yetarli emas (Bazada qiymati: ${dbProduct.stock} ta).`);
                }

                const dbPrice = dbProduct.price;
                const dbSubtotal = dbPrice * item.qty;
                calculatedTotal += dbSubtotal;

                processedItems.push({
                    id: item.id,
                    name: dbProduct.name,
                    barcode: dbProduct.barcode,
                    qty: item.qty,
                    price: dbPrice,
                    subtotal: dbSubtotal
                });
            } else {
                const customPrice = item.price || 0;
                const customSubtotal = customPrice * item.qty;
                calculatedTotal += customSubtotal;
                processedItems.push({
                    id: null,
                    name: item.name || 'Noma\'lum',
                    barcode: item.barcode || '',
                    qty: item.qty,
                    price: customPrice,
                    subtotal: customSubtotal
                });
            }
        }

        const netTotal = Math.max(0, calculatedTotal - discount);

        const saleResult = await client.query(
            'INSERT INTO sales (receiptno, total, discount, date, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [receiptno, netTotal, discount, date, user_id]
        );
        const saleId = saleResult.rows[0].id;

        for (const item of processedItems) {
            await client.query(
                'INSERT INTO sale_items (sale_id, product_id, name, barcode, qty, price, subtotal) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [saleId, item.id, item.name, item.barcode, item.qty, item.price, item.subtotal]
            );
            if (item.id) {
                await client.query(
                    'UPDATE products SET stock = stock - $1 WHERE id = $2',
                    [item.qty, item.id]
                );
            }
        }

        await client.query('COMMIT');
        globalDataUpdated = new Date().toISOString();
        res.json({ success: true, saleId, calculatedTotal, items: processedItems });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.get('/api/sales', authenticate, async (req, res) => {
    try {
        const salesResult = await db.query('SELECT * FROM sales ORDER BY id DESC');
        const itemsResult = await db.query(`
            SELECT si.*, p.name AS product_name, p.barcode AS product_barcode
            FROM sale_items si
            LEFT JOIN products p ON si.product_id = p.id
        `);

        const sales = salesResult.rows.map(sale => {
            return {
                ...sale,
                items: itemsResult.rows
                    .filter(item => item.sale_id === sale.id)
                    .map(item => ({
                        ...item,
                        name: item.name || item.product_name || 'Noma\'lum',
                        barcode: item.barcode || item.product_barcode || ''
                    }))
            };
        });

        res.json(sales);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/sync', authenticate, async (req, res) => {
    const { since } = req.query;
    try {
        let products = [];
        if (!since || since < globalDataUpdated) {
            const prodRes = await db.query('SELECT * FROM products ORDER BY id DESC');
            products = prodRes.rows;
        }

        let sales = [];
        if (since) {
            const salesResult = await db.query('SELECT * FROM sales WHERE date > $1 ORDER BY id DESC LIMIT 200', [since]);
            if (salesResult.rows.length > 0) {
                const saleIds = salesResult.rows.map(s => s.id);
                const itemsResult = await db.query(`
                    SELECT si.*, p.name AS product_name, p.barcode AS product_barcode
                    FROM sale_items si
                    LEFT JOIN products p ON si.product_id = p.id
                    WHERE si.sale_id = ANY($1)
                `, [saleIds]);

                sales = salesResult.rows.map(sale => {
                    return {
                        ...sale,
                        items: itemsResult.rows
                            .filter(item => item.sale_id === sale.id)
                            .map(item => ({
                                ...item,
                                name: item.name || item.product_name || 'Noma\'lum',
                                barcode: item.barcode || item.product_barcode || ''
                            }))
                    };
                });
            }
        }
        res.json({ products, newSales: sales });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/sales/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
        await client.query('DELETE FROM sales WHERE id = $1', [id]);
        await client.query('COMMIT');
        globalDataUpdated = new Date().toISOString();
        res.json({ success: true, message: "Sotuv o'chirildi" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/sales/date/:date', authenticate, requireAdmin, async (req, res) => {
    const { date } = req.params;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const salesResult = await client.query('SELECT id FROM sales WHERE date LIKE $1 OR date LIKE $2', [`${date}%`, `${date} %`]);
        const saleIds = salesResult.rows.map(r => r.id);

        if (saleIds.length > 0) {
            await client.query('DELETE FROM sale_items WHERE sale_id = ANY($1)', [saleIds]);
            await client.query('DELETE FROM sales WHERE id = ANY($1)', [saleIds]);
        }

        await client.query('COMMIT');
        globalDataUpdated = new Date().toISOString();
        res.json({ success: true, message: "Kunlik savdolar o'chirildi" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log('Server is running on http://localhost:' + PORT);
    });
}

export default app;
