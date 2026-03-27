// ========================================
// Store — API & Memory persistence layer
// ========================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

let memoryProducts = [];
let memorySales = [];
let isInitialized = false;

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('kmarket_token')}`
    };
}

// ---- Init ----
export async function initStore() {
    try {
        const headers = getAuthHeaders();
        const [prodRes, salesRes] = await Promise.all([
            fetch(`${API_URL}/products`, { headers }),
            fetch(`${API_URL}/sales`, { headers })
        ]);

        if (prodRes.ok && salesRes.ok) {
            memoryProducts = await prodRes.json();
            memorySales = await salesRes.json();
            // Parse SQLite JSON items if needed
            memorySales.forEach(s => {
                if (typeof s.items === 'string') {
                    try { s.items = JSON.parse(s.items); } catch (e) { s.items = []; }
                }
            });
            isInitialized = true;
            console.log("Memory Store synced with Backend");
        } else {
            console.error("Backend qaytargan xato:", await prodRes.text(), await salesRes.text());
        }
    } catch (err) {
        console.error("Backend bilan ulanishda xato. Lokal rejim ishga tushirildi:", err);
    }
}

// ---- Products ----
export function getProducts() {
    return memoryProducts;
}

export function saveProducts(products) {
    memoryProducts = products;
}

export function addProduct(product) {
    memoryProducts.push(product);

    // Background sync
    fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(product)
    }).then(res => res.json()).then(data => {
        if (data.id) {
            const idx = memoryProducts.findIndex(p => p.barcode === product.barcode);
            if (idx !== -1) Object.assign(memoryProducts[idx], data);
        }
    }).catch(err => console.error("Sync Error:", err));

    return memoryProducts;
}

export function updateProduct(barcode, updates) {
    const idx = memoryProducts.findIndex(p => p.barcode === barcode);
    if (idx !== -1) {
        memoryProducts[idx] = { ...memoryProducts[idx], ...updates };

        const dbId = memoryProducts[idx].id;
        if (dbId) {
            fetch(`${API_URL}/products/${dbId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(memoryProducts[idx])
            }).catch(console.error);
        }
    }
    return memoryProducts;
}

export function deleteProduct(barcode) {
    const product = memoryProducts.find(p => p.barcode === barcode);
    if (product && product.id) {
        fetch(`${API_URL}/products/${product.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        }).catch(console.error);
    }
    memoryProducts = memoryProducts.filter(p => p.barcode !== barcode);
    return memoryProducts;
}

export function findProductByBarcode(barcode) {
    return memoryProducts.find(p => p.barcode === barcode) || null;
}

export function searchProducts(query) {
    const q = query.toLowerCase();
    return memoryProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.category.toLowerCase().includes(q)
    );
}

// ---- Sales ----
export function getSales() {
    return memorySales;
}

export function saveSale(sale) {
    // Generate IDs locally first for immediate UI feedback
    sale.timestamp = sale.timestamp || new Date().toISOString();
    sale.date = sale.timestamp; // matching db schema
    sale.receiptNo = sale.receiptNo || generateReceiptNo();

    memorySales.unshift(sale); // Add to beginning (latest first)

    // Update local stock optimistically
    sale.items.forEach(item => {
        const prod = memoryProducts.find(p => p.barcode === item.barcode);
        if (prod) {
            prod.stock = Math.max(0, prod.stock - item.qty);
        }
    });

    // Background sync
    fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(sale)
    }).catch(console.error);

    return sale;
}

// Helper query functions...
export function getSalesByDate(dateStr) {
    return memorySales.filter(s => (s.date || s.timestamp).startsWith(dateStr));
}

export function getSalesByMonth(monthStr) {
    return memorySales.filter(s => (s.date || s.timestamp).startsWith(monthStr));
}

export function getDailySummary(dateStr) {
    const sales = getSalesByDate(dateStr);
    return buildSummary(sales);
}

export function getMonthlySummary(monthStr) {
    const sales = getSalesByMonth(monthStr);
    const summary = buildSummary(sales);

    const dailyMap = {};
    sales.forEach(s => {
        const day = (s.date || s.timestamp).slice(0, 10);
        if (!dailyMap[day]) dailyMap[day] = { revenue: 0, count: 0 };
        dailyMap[day].revenue += s.total;
        dailyMap[day].count += 1;
    });
    summary.dailyMap = dailyMap;
    summary.avgDaily = Object.keys(dailyMap).length > 0 ? summary.totalRevenue / Object.keys(dailyMap).length : 0;

    return summary;
}

function buildSummary(sales) {
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const totalItems = sales.reduce((sum, s) => sum + (s.items ? s.items.reduce((is, i) => is + i.qty, 0) : 0), 0);

    const hourly = {};
    for (let h = 0; h < 24; h++) hourly[h] = 0;

    const productMap = {};

    sales.forEach(s => {
        const timeStr = s.date || s.timestamp;
        if (timeStr) {
            const hour = new Date(timeStr).getHours();
            hourly[hour] += s.total;
        }

        if (s.items) {
            s.items.forEach(item => {
                if (!productMap[item.name]) productMap[item.name] = { qty: 0, revenue: 0 };
                productMap[item.name].qty += item.qty;
                productMap[item.name].revenue += item.subtotal;
            });
        }
    });

    const topProducts = Object.entries(productMap)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    return { sales, totalRevenue, totalItems, salesCount: sales.length, hourly, topProducts };
}

// ---- Helpers ----
function generateReceiptNo() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todaySales = memorySales.filter(s => (s.date || s.timestamp).startsWith(new Date().toISOString().slice(0, 10)));
    return `KM-${today}-${String(todaySales.length + 1).padStart(4, '0')}`;
}

export function formatPrice(num) {
    return new Intl.NumberFormat('uz-UZ').format(num || 0) + " so'm";
}

export function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(dateStr) {
    return formatDate(dateStr) + ' ' + formatTime(dateStr);
}

export function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
}

export function getCurrentMonthStr() {
    return new Date().toISOString().slice(0, 7);
}
