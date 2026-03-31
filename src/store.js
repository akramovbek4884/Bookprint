// ========================================
// Store — API & Memory persistence layer
// ========================================

const API_URL = '/api';

let memoryProducts = [];
let memorySales = [];
let isInitialized = false;
let lastSyncTime = null;

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

        if (prodRes.status === 401 || prodRes.status === 403 || salesRes.status === 401 || salesRes.status === 403) {
            console.error("Autentifikatsiya xatosi — token yaroqsiz");
            localStorage.removeItem('kmarket_token');
            localStorage.removeItem('kmarket_user');
            return false;
        }

        if (prodRes.ok && salesRes.ok) {
            memoryProducts = await prodRes.json();
            memorySales = await salesRes.json();

            // Clean up sales items correctly
            memorySales.forEach(s => {
                if (typeof s.items === 'string') {
                    try { s.items = JSON.parse(s.items); } catch (e) { s.items = []; }
                }
                if (!Array.isArray(s.items)) s.items = [];
            });

            isInitialized = true;
            lastSyncTime = new Date().toISOString();
            console.log("Memory Store synced with Backend");
            return true;
        } else {
            console.error("Backend error:", await prodRes.text());
            return false;
        }
    } catch (err) {
        console.error("Connection error:", err);
        return false;
    }
}

export async function syncStore() {
    if (!lastSyncTime || !isInitialized) return await initStore();

    try {
        const headers = getAuthHeaders();
        const res = await fetch(`${API_URL}/sync?since=${encodeURIComponent(lastSyncTime)}`, { headers });
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('kmarket_token');
            localStorage.removeItem('kmarket_user');
            window.location.hash = '#/login';
            return false;
        }
        if (res.ok) {
            const data = await res.json();
            if (data.products && data.products.length > 0) {
                memoryProducts = data.products;
            }
            if (data.newSales && data.newSales.length > 0) {
                data.newSales.forEach(s => {
                    if (typeof s.items === 'string') {
                        try { s.items = JSON.parse(s.items); } catch (e) { s.items = []; }
                    }
                    if (!Array.isArray(s.items)) s.items = [];

                    if (!memorySales.find(ms => ms.id === s.id)) {
                        memorySales.push(s);
                    }
                });
                memorySales.sort((a, b) => b.id - a.id);
            }
            lastSyncTime = new Date().toISOString();
            console.log("Store synced delta.");
            return true;
        }
    } catch (err) {
        console.error("Sync error:", err);
        return false;
    }
}

// ---- Products ----
export function getProducts() {
    return memoryProducts;
}

export function findProductByBarcode(barcode) {
    return memoryProducts.find(p => p.barcode === barcode) || null;
}

export function findProductsByBarcode(barcode) {
    return memoryProducts.filter(p => p.barcode === barcode);
}

export function searchProducts(query) {
    const q = query.toLowerCase();
    return memoryProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.category.toLowerCase().includes(q)
    );
}

export async function addProduct(product) {
    try {
        const res = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(product)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Saqlashda xatolik yuz berdi");
        }

        const savedProduct = await res.json();
        memoryProducts.push(savedProduct);
        return { success: true, product: savedProduct };
    } catch (err) {
        console.error("Add Product Error:", err);
        return { success: false, error: err.message };
    }
}

export async function updateProduct(dbId, updates) {
    if (!dbId) return { success: false, error: "Mahsulot ID si topilmadi" };

    try {
        const res = await fetch(`${API_URL}/products/${dbId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updates)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Yangilashda xatolik yuz berdi");
        }

        const updatedProduct = await res.json();
        const idx = memoryProducts.findIndex(p => p.id === parseInt(dbId));
        if (idx !== -1) {
            memoryProducts[idx] = { ...memoryProducts[idx], ...updatedProduct };
        }
        return { success: true, product: updatedProduct };
    } catch (err) {
        console.error("Update Product Error:", err);
        return { success: false, error: err.message };
    }
}

export async function deleteProduct(dbId) {
    if (!dbId) return { success: false, error: "Mahsulot ID si topilmadi" };

    try {
        const res = await fetch(`${API_URL}/products/${dbId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "O'chirishda xatolik yuz berdi");
        }

        memoryProducts = memoryProducts.filter(p => p.id !== parseInt(dbId));
        return { success: true };
    } catch (err) {
        console.error("Delete Product Error:", err);
        return { success: false, error: err.message };
    }
}

// ---- Sales ----
export function getSales() {
    const hiddenSales = JSON.parse(localStorage.getItem('hiddenSales') || '[]').map(String);
    const hiddenDays = JSON.parse(localStorage.getItem('hiddenDays') || '[]');
    return memorySales.filter(s => {
        const d = getLocalYMD(new Date(s.date || s.timestamp));
        return !hiddenSales.includes(String(s.id)) && !hiddenDays.includes(d);
    });
}

export async function saveSale(sale) {
    try {
        const res = await fetch(`${API_URL}/sales`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(sale)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Sotuvni saqlashda xatolik yuz berdi");
        }

        const result = await res.json();

        // Finalize sale locally for immediate report update
        const finalSale = {
            ...sale,
            id: result.saleId,
            total: result.calculatedTotal !== undefined ? result.calculatedTotal : sale.total,
            items: result.items || sale.items,
            timestamp: new Date().toISOString()
        };
        memorySales.unshift(finalSale);

        // Sync products stock from server after sale to ensure consistency
        await syncStore();

        return { success: true, sale: finalSale };
    } catch (err) {
        console.error("Save Sale Error:", err);
        return { success: false, error: err.message };
    }
}

export async function deleteSale(id) {
    if (!id) return { success: false, error: "Savdo ID si topilmadi" };
    try {
        const res = await fetch(`${API_URL}/sales/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "O'chirishda xatolik yuz berdi");
        }
        memorySales = memorySales.filter(s => String(s.id) !== String(id));
        return { success: true };
    } catch (err) {
        console.error("Delete Sale Error:", err);
        return { success: false, error: err.message };
    }
}

export async function deleteSalesByDate(dateStr) {
    if (!dateStr) return { success: false, error: "Sana kiritilmadi" };
    try {
        const res = await fetch(`${API_URL}/sales/date/${dateStr}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "O'chirishda xatolik yuz berdi");
        }
        memorySales = memorySales.filter(s => !(s.date || s.timestamp).startsWith(dateStr));
        return { success: true };
    } catch (err) {
        console.error("Delete Sales Date Error:", err);
        return { success: false, error: err.message };
    }
}

// ---- Helpers ----
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

export function getLocalYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function getTodayStr() {
    return getLocalYMD(new Date());
}

export function getCurrentMonthStr() {
    return getLocalYMD(new Date()).slice(0, 7);
}

export function getSalesByDate(dateStr) {
    return getSales().filter(s => getLocalYMD(new Date(s.date || s.timestamp)) === dateStr);
}

export function getSalesByMonth(monthStr) {
    return getSales().filter(s => getLocalYMD(new Date(s.date || s.timestamp)).startsWith(monthStr));
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
        const day = getLocalYMD(new Date(s.date || s.timestamp));
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
                const name = item.name || item.product_name || 'Noma\'lum';
                if (!productMap[name]) productMap[name] = { qty: 0, revenue: 0, barcode: item.barcode };
                productMap[name].qty += item.qty;
                productMap[name].revenue += item.subtotal;
            });
        }
    });

    const hiddenTopProducts = JSON.parse(localStorage.getItem('hiddenTopProducts') || '[]').map(String);
    const topProducts = Object.entries(productMap)
        .map(([name, d]) => ({ name, ...d }))
        .filter(p => !hiddenTopProducts.includes(String(p.barcode)))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    return { sales, totalRevenue, totalItems, salesCount: sales.length, hourly, topProducts };
}

export function generateReceiptNo() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todaySales = memorySales.filter(s => (s.date || s.timestamp).startsWith(new Date().toISOString().slice(0, 10)));
    return `KM-${today}-${String(todaySales.length + 1).padStart(4, '0')}`;
}

// ---- Polling ----
let pollingInterval = null;

export function startPolling(intervalMs = 15000) {
    if (pollingInterval) return; // Already polling

    pollingInterval = setInterval(async () => {
        // Only poll if the user is logged in
        if (localStorage.getItem('kmarket_token')) {
            console.log("Polling for updates...");
            await syncStore();

            // Trigger a custom event so the UI can refresh if needed
            window.dispatchEvent(new CustomEvent('store-updated'));
        }
    }, intervalMs);
}

export function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}
