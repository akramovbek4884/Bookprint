const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const dbFile = path.join(dbDir, 'market.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('Database unlashda xatolik:', err.message);
    } else {
        console.log('SQLite bazaga ulandi.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // 1. Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'cashier'
    )`);

        // 2. Products table
        db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      cost_price INTEGER DEFAULT 0,
      stock INTEGER NOT NULL,
      category TEXT
    )`);

        // Retrofit cost_price if the table already existed
        db.run(`ALTER TABLE products ADD COLUMN cost_price INTEGER DEFAULT 0`, (err) => {
            // Ignore error if column already exists
        });

        // 3. Sales table
        db.run(`CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receiptNo TEXT UNIQUE NOT NULL,
      total INTEGER NOT NULL,
      date TEXT NOT NULL,
      user_id INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

        // 4. Sale Items table
        db.run(`CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      qty INTEGER NOT NULL,
      price INTEGER NOT NULL,
      subtotal INTEGER NOT NULL,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

        // Create a default admin user if none exists
        const bcrypt = require('bcryptjs');
        db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
            if (!row) {
                const hash = bcrypt.hashSync('admin123', 8);
                db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', hash, 'admin']);
                console.log('Default admin yaratildi. Login: admin, Parol: admin123');
            }
        });
    });
}

module.exports = db;
