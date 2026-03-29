import 'dotenv/config';
import db from './api/db.js';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function migrate() {
    try {
        console.log("Dropping old constraint: sale_items_product_id_fkey");
        await db.query(`ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey`);

        console.log("Adding new constraint with ON DELETE SET NULL...");
        await db.query(`ALTER TABLE sale_items ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL`);

        console.log("Migration successful: ON DELETE SET NULL successfully applied.");
    } catch (err) {
        console.error("Migration failed:", err.message);
    } finally {
        process.exit();
    }
}

migrate();
