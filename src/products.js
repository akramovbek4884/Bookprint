// ========================================
// Products Management Page
// ========================================
import { getProducts, addProduct, updateProduct, deleteProduct, formatPrice, searchProducts } from './store.js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { playScanSound } from './utils.js';

export function renderProducts() {
  const products = getProducts();
  const userStr = localStorage.getItem('kmarket_user');
  const user = userStr ? JSON.parse(userStr) : { role: 'cashier' };
  const isAdmin = user.role === 'admin';

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:10px;">
        <div>
          <h1 class="page-title">📦 Mahsulotlar</h1>
          <p class="page-subtitle">Mahsulotlarni boshqarish — ${products.length} ta mahsulot</p>
        </div>
        ${isAdmin ? `
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
          <div style="background: var(--bg-card); border: 2px solid var(--border-color); padding: 10px 15px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align:right;">
            <div style="font-size:0.8rem; color:var(--text-secondary); text-transform:uppercase; font-weight:bold; letter-spacing:0.5px; margin-bottom:4px;">Kutilayotgan Tushum</div>
            <h1 id="expected-revenue" style="margin:0; font-size:1.4rem; color:var(--text-primary);">${formatPrice(products.reduce((s, p) => s + (p.price * p.stock), 0))}</h1>
          </div>
          <div style="background: var(--bg-card); border: 2px solid var(--accent-success); padding: 10px 15px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align:right;">
            <div style="font-size:0.8rem; color:var(--text-secondary); text-transform:uppercase; font-weight:bold; letter-spacing:0.5px; margin-bottom:4px;">Kutilayotgan Sof Foyda</div>
            <h1 id="expected-profit" style="margin:0; font-size:1.4rem; color:var(--accent-success);">${formatPrice(products.reduce((s, p) => s + ((p.price - (p.cost_price || 0)) * p.stock), 0))}</h1>
          </div>
        </div>
        ` : ''}
      </div>

      <div class="search-bar">
        <input type="text" id="product-search" class="input" placeholder="🔍 Qidirish (nomi, kodi, kategoriya)..." />
        ${isAdmin ? `<button class="btn btn-primary" id="add-product-btn">➕ Yangi mahsulot</button>` : ''}
      </div>

      <div class="card">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Shtrix-kod</th>
                <th>Nomi</th>
                <th>Kategoriya</th>
                ${isAdmin ? `<th class="text-right">Kelish narxi</th>` : ''}
                <th class="text-right">Sotish narxi</th>
                <th class="text-center">Ombor</th>
                ${isAdmin ? `<th class="text-center">Amallar</th>` : ''}
              </tr>
            </thead>
            <tbody id="products-tbody">
              ${renderProductRows(products)}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="product-form-modal" class="modal-overlay hidden">
      <div class="modal-content">
        <h3 style="margin-bottom: var(--space-lg);" id="product-form-title">➕ Yangi mahsulot</h3>
        <div class="form-grid">
          <div class="input-group full-width">
            <label for="pf-barcode">Shtrix-kod</label>
            <div style="display: flex; gap: 10px;">
              <input type="text" id="pf-barcode" class="input mono" style="flex: 1;" placeholder="4901234567890" />
              <button class="btn btn-secondary" id="pf-scan-btn" title="Kamera orqali skanerlash">📷 Skanerlash</button>
            </div>
          </div>
          <div class="input-group full-width">
            <label for="pf-name">Mahsulot nomi</label>
            <input type="text" id="pf-name" class="input" placeholder="Coca-Cola 1L" />
          </div>
          <div class="input-group">
            <label for="pf-cost-price">Kelish narxi (so'm)</label>
            <input type="number" id="pf-cost-price" class="input mono" placeholder="10000" min="0" />
          </div>
          <div class="input-group">
            <label for="pf-price">Sotish narxi (so'm)</label>
            <input type="number" id="pf-price" class="input mono" placeholder="12000" min="0" />
          </div>
          <div class="input-group">
            <label for="pf-stock">Ombordagi soni</label>
            <input type="number" id="pf-stock" class="input mono" placeholder="100" min="0" />
          </div>
          <div class="input-group full-width">
            <label for="pf-category">Kategoriya</label>
            <input type="text" id="pf-category" class="input" placeholder="Oziq-ovqat" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" id="pf-cancel">Bekor qilish</button>
          <button class="btn btn-primary" id="pf-save">💾 Saqlash</button>
        </div>
      </div>
    </div>

    <!-- Custom Delete Confirmation Modal -->
    <div id="delete-confirm-modal" class="modal-overlay hidden">
      <div class="modal-content" style="max-width: 400px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: var(--space-md);">⚠️</div>
        <h3 style="margin-bottom: var(--space-sm);">Mahsulotni o'chirish</h3>
        <p style="color: var(--text-secondary); margin-bottom: var(--space-xl);">
          Haqiqatan ham bu mahsulotni tizimdan butunlay o'chirib tashlamoqchimisiz?
        </p>
        <div class="form-actions" style="justify-content: center;">
          <button class="btn btn-secondary" id="delete-cancel">Bekor qilish</button>
          <button class="btn btn-danger" id="delete-confirm">🗑️ O'chirish</button>
        </div>
      </div>
    </div>

    <!-- Camera Scanner Modal -->
    <div id="product-scanner-modal" class="modal-overlay hidden">
      <div class="modal-content scanner-modal-content">
        <div class="scanner-header">
          <h3 style="margin: 0;">📷 Shtrix-kod skaneri</h3>
          <button class="btn btn-secondary btn-sm" id="ps-close-scanner-btn" style="padding: 5px 10px; min-width: auto;">✖</button>
        </div>
        <div id="product-reader"></div>
        <p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; margin-top: 15px;">
          Shtrix-kodni kamera qarshisiga tuting
        </p>
      </div>
    </div>
  `;
}

function renderProductRows(products) {
  const userStr = localStorage.getItem('kmarket_user');
  const user = userStr ? JSON.parse(userStr) : { role: 'cashier' };
  const isAdmin = user.role === 'admin';

  if (products.length === 0) {
    return `<tr><td colspan="${isAdmin ? 7 : 6}"><div class="empty-state"><div class="empty-icon">📦</div><p>Mahsulotlar topilmadi</p></div></td></tr>`;
  }

  return products.map((p, i) => {
    let stockBadge = 'badge-success';
    if (p.stock < 10) stockBadge = 'badge-danger';
    else if (p.stock < 30) stockBadge = 'badge-warning';

    return `
      <tr>
        <td class="text-muted">${i + 1}</td>
        <td class="mono">${p.barcode}</td>
        <td><strong>${p.name}</strong></td>
        <td><span class="badge badge-success">${p.category}</span></td>
        ${isAdmin ? `<td class="text-right text-muted">${formatPrice(p.cost_price)}</td>` : ''}
        <td class="text-right price">${formatPrice(p.price)}</td>
        <td class="text-center"><span class="badge ${stockBadge}">${p.stock} ta</span></td>
        ${isAdmin ? `
        <td class="text-center">
          <button class="btn btn-sm btn-secondary edit-product-btn" data-id="${p.id}" title="Tahrirlash">✏️</button>
          <button class="btn btn-sm btn-danger delete-product-btn" data-id="${p.id}" title="O'chirish">🗑️</button>
        </td>
        ` : ''}
      </tr>
    `;
  }).join('');
}

export function initProducts() {
  const searchInput = document.getElementById('product-search');
  const addBtn = document.getElementById('add-product-btn');
  const modal = document.getElementById('product-form-modal');
  const scannerModal = document.getElementById('product-scanner-modal');
  let editingId = null;
  let html5QrcodeScanner = null;

  function onScanSuccess(decodedText) {
    playScanSound();
    const barcodeInput = document.getElementById('pf-barcode');
    if (barcodeInput) {
      barcodeInput.value = decodedText;
    }
    stopScanner();
  }

  function startScanner() {
    if (scannerModal) scannerModal.classList.remove('hidden');

    if (!html5QrcodeScanner) {
      html5QrcodeScanner = new Html5QrcodeScanner(
        "product-reader",
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: "environment"
          }
        },
      /* verbose= */ false
      );
      html5QrcodeScanner.render(onScanSuccess);
    }
  }

  function stopScanner() {
    if (scannerModal) scannerModal.classList.add('hidden');

    if (html5QrcodeScanner) {
      html5QrcodeScanner.clear().then(() => {
        html5QrcodeScanner = null;
      }).catch(err => {
        console.error("Failed to clear scanner", err);
        html5QrcodeScanner = null;
      });
    }
  }

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      const filtered = q ? searchProducts(q) : getProducts();
      const tbody = document.getElementById('products-tbody');
      if (tbody) tbody.innerHTML = renderProductRows(filtered);
      attachProductRowListeners();
    });
  }

  // Add product
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      editingId = null;
      document.getElementById('product-form-title').textContent = '➕ Yangi mahsulot';
      const barcodeInput = document.getElementById('pf-barcode');
      if (barcodeInput) {
        barcodeInput.value = '';
        barcodeInput.disabled = false;
      }
      document.getElementById('pf-name').value = '';
      document.getElementById('pf-cost-price').value = '';
      document.getElementById('pf-price').value = '';
      document.getElementById('pf-stock').value = '';
      document.getElementById('pf-category').value = '';
      if (modal) modal.classList.remove('hidden');
    });
  }

  // Scanner toggle
  document.getElementById('pf-scan-btn')?.addEventListener('click', () => {
    startScanner();
  });

  document.getElementById('ps-close-scanner-btn')?.addEventListener('click', () => {
    stopScanner();
  });

  // Cancel
  document.getElementById('pf-cancel')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Save
  document.getElementById('pf-save')?.addEventListener('click', async () => {
    const barcode = document.getElementById('pf-barcode').value.trim();
    const name = document.getElementById('pf-name').value.trim();
    const cost_price = parseInt(document.getElementById('pf-cost-price').value) || 0;
    const price = parseInt(document.getElementById('pf-price').value) || 0;
    const stock = parseInt(document.getElementById('pf-stock').value) || 0;
    const category = document.getElementById('pf-category').value.trim() || 'Boshqa';

    if (!barcode || !name || price <= 0) {
      alert('Iltimos, barcha maydonlarni to\'ldiring!');
      return;
    }

    const saveBtn = document.getElementById('pf-save');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '⌛ Saqlanmoqda...';

    let result;
    if (editingId) {
      result = await updateProduct(editingId, { barcode, name, price, cost_price, stock, category });
    } else {
      result = await addProduct({ barcode, name, price, cost_price, stock, category });
    }

    saveBtn.disabled = false;
    saveBtn.textContent = originalText;

    if (result.success) {
      modal.classList.add('hidden');
      refreshProductTable();
    } else {
      alert('Xatolik: ' + result.error);
    }
  });

  // Close modals on overlay click
  [modal, document.getElementById('delete-confirm-modal')].forEach(m => {
    m?.addEventListener('click', (e) => {
      if (e.target === m) m.classList.add('hidden');
    });
  });

  // Custom Delete Confirmation Logic
  let deleteTargetId = null;
  const deleteModal = document.getElementById('delete-confirm-modal');

  document.getElementById('delete-cancel')?.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    deleteTargetId = null;
  });

  document.getElementById('delete-confirm')?.addEventListener('click', async () => {
    if (deleteTargetId) {
      const confirmBtn = document.getElementById('delete-confirm');
      confirmBtn.disabled = true;
      confirmBtn.textContent = '⌛ O\'chirilmoqda...';

      const result = await deleteProduct(deleteTargetId);

      confirmBtn.disabled = false;
      confirmBtn.textContent = '🗑️ O\'chirish';

      if (result.success) {
        deleteModal.classList.add('hidden');
        deleteTargetId = null;
        refreshProductTable();
      } else {
        alert('Xatolik: ' + result.error);
      }
    }
  });

  attachProductRowListeners();

  function attachProductRowListeners() {
    document.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const products = getProducts();
        const product = products.find(p => p.id === id);
        if (!product) return;

        editingId = id;
        document.getElementById('product-form-title').textContent = '✏️ Mahsulotni tahrirlash';
        const barcodeInput = document.getElementById('pf-barcode');
        if (barcodeInput) {
          barcodeInput.value = product.barcode;
          barcodeInput.disabled = false; // Allow changing barcode too if needed, though backend handles it
        }
        document.getElementById('pf-name').value = product.name;
        document.getElementById('pf-cost-price').value = product.cost_price || '';
        document.getElementById('pf-price').value = product.price;
        document.getElementById('pf-stock').value = product.stock;
        document.getElementById('pf-category').value = product.category || '';
        if (modal) modal.classList.remove('hidden');
      });
    });

    document.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const product = getProducts().find(p => p.id === id);
        if (product) {
          deleteTargetId = product.id;
          deleteModal.classList.remove('hidden');
        }
      });
    });
  }

  function refreshProductTable() {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return; // Prevent execution on other pages if listener leaks

    const userStr = localStorage.getItem('kmarket_user');
    const user = userStr ? JSON.parse(userStr) : { role: 'cashier' };
    const isAdmin = user.role === 'admin';

    const q = searchInput?.value.trim();
    const filtered = q ? searchProducts(q) : getProducts();
    if (tbody) tbody.innerHTML = renderProductRows(filtered);
    attachProductRowListeners();
    // Update subtitle
    const subtitle = document.querySelector('.page-subtitle');
    if (subtitle) subtitle.textContent = `Mahsulotlarni boshqarish — ${getProducts().length} ta mahsulot`;

    // Update Expected Revenue and Profit
    if (isAdmin) {
      const revEl = document.getElementById('expected-revenue');
      const profitEl = document.getElementById('expected-profit');
      if (revEl) {
        const rev = filtered.reduce((sum, p) => sum + (p.price * p.stock), 0);
        revEl.textContent = formatPrice(rev);
      }
      if (profitEl) {
        const prof = filtered.reduce((sum, p) => sum + ((p.price - (p.cost_price || 0)) * p.stock), 0);
        profitEl.textContent = formatPrice(prof);
      }
    }
  }

  // Surgical refresh: update only the table when store data changes
  window.addEventListener('store-updated', refreshProductTable);
}
