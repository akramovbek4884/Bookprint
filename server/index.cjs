const express = require('express');
const cors = require('cors');
const db = require('./db.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'bookprint_super_secret_key_123'; // In production, use process.env

// --- AUTH API ---
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });

        if (bcrypt.compareSync(password, user.password_hash)) {
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
            res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
        } else {
            res.status(401).json({ error: 'Parol noto\'g\'ri' });
        }
    });
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
app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add a product
app.post('/api/products', (req, res) => {
    const { barcode, name, price, cost_price, stock, category } = req.body;
    if (!barcode || !name || price == null || stock == null) {
        return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart' });
    }

    const sql = 'INSERT INTO products (barcode, name, price, cost_price, stock, category) VALUES (?, ?, ?, ?, ?, ?)';
    db.run(sql, [barcode, name, price, cost_price || 0, stock, category || 'Unclassified'], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, barcode, name, price, cost_price, stock, category });
    });
});

// Update a product
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { barcode, name, price, cost_price, stock, category } = req.body;

    const sql = 'UPDATE products SET barcode = ?, name = ?, price = ?, cost_price = ?, stock = ?, category = ? WHERE id = ?';
    db.run(sql, [barcode, name, price, cost_price || 0, stock, category, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, barcode, name, price, cost_price, stock, category });
    });
});

// Delete a product
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM products WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Deleted', changes: this.changes });
    });
});

// --- SALES API ---

// Add a new sale
app.post('/api/sales', (req, res) => {
    const { receiptNo, total, items, user_id } = req.body;
    const date = new Date().toISOString();

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = 'INSERT INTO sales (receiptNo, total, date, user_id) VALUES (?, ?, ?, ?)';
        db.run(stmt, [receiptNo, total, date, user_id || null], function (err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            const saleId = this.lastID;
            const itemStmt = db.prepare('INSERT INTO sale_items (sale_id, product_id, qty, price, subtotal) VALUES (?, ?, ?, ?, ?)');
            const stockStmt = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

            items.forEach(item => {
                itemStmt.run([saleId, item.id, item.qty, item.price, item.subtotal]);
                stockStmt.run([item.qty, item.id]);
            });

            itemStmt.finalize();
            stockStmt.finalize();

            db.run('COMMIT', (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, saleId });
            });
        });
    });
});

// Get all sales (simplified for reporting)
app.get('/api/sales', (req, res) => {
    db.all('SELECT * FROM sales ORDER BY date DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log('Server is running on http://localhost:' + PORT);
});
