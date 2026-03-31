// ========================================
// Sell Page — POS Interface
// ========================================
import { findProductByBarcode, findProductsByBarcode, getProducts, saveSale, formatPrice } from './store.js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { playScanSound } from './utils.js';

let cart = [];
let html5QrcodeScanner = null;

export function renderSell() {
  const products = getProducts();

  return `
    <div class="page-enter">
      <div class="page-header">
        <h1 class="page-title">🛒 Sotish</h1>
        <p class="page-subtitle">Shtrix-kodni skanerlang yoki kiriting</p>
      </div>

      <div class="sell-layout">
        <div class="barcode-section">
          <div class="card" style="margin-bottom: var(--space-lg);">
            <div class="scanner-controls">
              <button class="btn btn-primary" id="toggle-camera-btn" style="width: 100%; gap: 10px;">
                📷 Kamera orqali skanerlash
              </button>
            </div>
            <div class="barcode-input-wrapper">
              <input
                type="text"
                id="barcode-input"
                class="input input-large"
                placeholder="Shtrix-kodni kiriting..."
                autocomplete="off"
                autofocus
              />
              <div class="scan-indicator"></div>
            </div>
            <div id="barcode-feedback" style="text-align:center; margin-top: var(--space-sm); min-height: 24px;"></div>
          </div>

          <div class="card recent-products">
            <h3 style="margin-bottom: var(--space-md); font-size: 0.95rem; color: var(--text-secondary); display:flex; justify-content:space-between; align-items:center;">
              <span>📦 Katalog</span>
              <input type="text" id="product-search-input" class="input" placeholder="🔍 Nomi bilan qidirish..." style="max-width: 180px; padding: 6px 10px; font-size:0.85rem;" autocomplete="off" />
            </h3>
            <div id="product-list">
              ${products.map(p => {
    const isLow = p.stock < 10;
    const isOut = p.stock <= 0;
    return `
                        <div class="product-quick-card ${isOut ? 'out-of-stock' : ''}" data-id="${p.id}">
                            <div class="pq-name">${p.name}</div>
                            <div class="pq-price">${formatPrice(p.price)}</div>
                            <div class="pq-stock ${isLow ? 'low' : ''}">${p.stock} ta</div>
                            <div class="pq-code">${p.barcode}</div>
                        </div>
                    `;
  }).join('')}
            </div>
          </div>
        </div>

        <div class="cart-panel card">
          <h3 style="margin-bottom: var(--space-sm); font-size: 1rem;">🧾 Savatcha</h3>
          <div class="cart-items-wrapper" id="cart-items-wrapper">
            ${renderCartItems()}
          </div>
          <div class="cart-total-section">
            <div class="cart-total-row">
              <span class="cart-total-label">Jami:</span>
              <span class="cart-total-value" id="cart-total">${formatPrice(getCartTotal())}</span>
            </div>
            <button class="btn btn-success btn-lg pay-btn" id="pay-btn" ${cart.length === 0 ? 'disabled' : ''}>
              💳 To'lov qilish
            </button>
            <button class="btn btn-secondary btn-lg" id="clear-cart-btn" style="width:100%; margin-top: var(--space-sm);" ${cart.length === 0 ? 'disabled' : ''}>
              🗑️ Savatchani tozalash
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Camera Scanner Modal -->
    <div id="scanner-modal" class="modal-overlay hidden">
      <div class="modal-content scanner-modal-content">
        <div class="scanner-header">
          <h3 style="margin: 0;">📷 Kamera skaneri</h3>
          <button class="btn btn-secondary btn-sm" id="close-scanner-btn" style="padding: 5px 10px; min-width: auto;">✖</button>
        </div>
        <div id="reader"></div>
        <p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; margin-top: 15px;">
          Shtrix-kod yoki QR-kodni kamera qarshisiga tuting
        </p>
      </div>
    </div>

    <!-- Multi Product Modal -->
    <div id="multi-product-modal" class="modal-overlay hidden">
      <div class="modal-content" style="max-width: 500px; width: 95%;">
        <h3 style="margin-bottom: var(--space-md);">Aynan qaysi mahsulot?</h3>
        <p style="color: var(--text-secondary); margin-bottom: 15px; font-size:0.9rem;">Ushbu shtrix-kod ostida bir nechta mahsulot topildi:</p>
        <div id="multi-product-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 50vh; overflow-y: auto; padding-right:5px;"></div>
        <div class="form-actions" style="margin-top: 20px;">
          <button class="btn btn-secondary" id="close-multi-modal" style="width:100%">Bekor qilish</button>
        </div>
      </div>
    </div>
  `;
}

function renderCartItems() {
  if (cart.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">🛒</div>
        <p>Savatcha bo'sh</p>
      </div>
    `;
  }

  return cart.map((item, idx) => `
    <div class="cart-item" data-index="${idx}">
      <div class="cart-item-name">
        ${item.name}
        <small>${item.barcode}</small>
      </div>
      <div class="qty-controls">
        <button class="qty-minus" data-index="${idx}">−</button>
        <span>${item.qty}</span>
        <button class="qty-plus" data-index="${idx}">+</button>
      </div>
      <div class="cart-item-subtotal">${formatPrice(item.price * item.qty)}</div>
      <button class="cart-item-remove" data-index="${idx}" title="O'chirish">✕</button>
    </div>
  `).join('');
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function updateCartUI() {
  const wrapper = document.getElementById('cart-items-wrapper');
  const totalEl = document.getElementById('cart-total');
  const payBtn = document.getElementById('pay-btn');
  const clearBtn = document.getElementById('clear-cart-btn');

  if (wrapper) wrapper.innerHTML = renderCartItems();
  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
  if (payBtn) payBtn.disabled = cart.length === 0;
  if (clearBtn) clearBtn.disabled = cart.length === 0;

  attachCartEventListeners();
}

function showMultiProductModal(products) {
  const modal = document.getElementById('multi-product-modal');
  const listEl = document.getElementById('multi-product-list');
  if (!modal || !listEl) return;

  listEl.innerHTML = products.map(p => `
    <div class="product-quick-card" style="width:100%; border: 1px solid var(--border-color); cursor:pointer; padding: 10px; border-radius: 8px; background: var(--bg-card);" data-id="${p.id}">
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <strong style="font-size:1rem;">${p.name}</strong>
        <span style="color:var(--accent-success); font-weight:bold;">${formatPrice(p.price)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-secondary);">
        <span>Kategoriya: ${p.category || 'Noma\'lum'}</span>
        <span style="${p.stock < 10 ? 'color:var(--accent-danger)' : ''}">Ombor: ${p.stock} ta</span>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.product-quick-card').forEach(card => {
    card.onclick = () => {
      const id = parseInt(card.dataset.id);
      const product = products.find(p => p.id === id);
      if (product) {
        handleProductSelection(product);
        modal.classList.add('hidden');
      }
    };
  });

  modal.classList.remove('hidden');
  document.getElementById('close-multi-modal').onclick = () => modal.classList.add('hidden');
}

function handleProductSelection(product) {
  const feedback = document.getElementById('barcode-feedback');
  const inCart = cart.find(item => item.id === product.id);
  const currentQtyInCart = inCart ? inCart.qty : 0;

  if (product.stock <= currentQtyInCart) {
    if (feedback) {
      feedback.innerHTML = `<span style="color: var(--accent-danger);">⚠️ Ombor yetarli emas: ${product.stock} ta qolgan</span>`;
      setTimeout(() => { if (feedback) feedback.innerHTML = ''; }, 3000);
    }
    return;
  }

  addToCart(product);
  playScanSound();
  if (feedback) {
    feedback.innerHTML = `<span style="color: var(--accent-success);">✅ ${product.name} — ${formatPrice(product.price)}</span>`;
    setTimeout(() => { if (feedback) feedback.innerHTML = ''; }, 3000);
  }
}

function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  updateCartUI();
}

function attachCartEventListeners() {
  document.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      if (cart[idx].qty > 1) {
        cart[idx].qty -= 1;
      } else {
        cart.splice(idx, 1);
      }
      updateCartUI();
    });
  });

  document.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      const item = cart[idx];
      const product = getProducts().find(p => p.id === item.id);

      if (product && product.stock <= item.qty) {
        const feedback = document.getElementById('barcode-feedback');
        if (feedback) {
          feedback.innerHTML = `<span style="color: var(--accent-danger);">⚠️ Ombor yetarli emas: ${product.stock} ta qolgan</span>`;
          setTimeout(() => { if (feedback) feedback.innerHTML = ''; }, 3000);
        }
        return;
      }

      item.qty += 1;
      updateCartUI();
    });
  });

  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      cart.splice(idx, 1);
      updateCartUI();
    });
  });
}

function onScanSuccess(decodedText) {
  const feedback = document.getElementById('barcode-feedback');
  const products = findProductsByBarcode(decodedText);

  if (products.length === 1) {
    handleProductSelection(products[0]);
    stopScanner();
  } else if (products.length > 1) {
    playScanSound();
    showMultiProductModal(products);
    stopScanner();
  } else {
    if (feedback) {
      feedback.innerHTML = `<span style="color: var(--accent-danger);">❌ Mahsulot topilmadi: ${decodedText}</span>`;
      setTimeout(() => { if (feedback) feedback.innerHTML = ''; }, 3000);
    }
  }
}

function startScanner() {
  const modal = document.getElementById('scanner-modal');
  modal.classList.remove('hidden');

  if (!html5QrcodeScanner) {
    html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
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
  const modal = document.getElementById('scanner-modal');
  modal.classList.add('hidden');

  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().then(() => {
      html5QrcodeScanner = null;
    }).catch(err => {
      console.error("Failed to clear scanner", err);
      html5QrcodeScanner = null;
    });
  }
}

export function initSell() {
  const barcodeInput = document.getElementById('barcode-input');
  const feedback = document.getElementById('barcode-feedback');
  const toggleCameraBtn = document.getElementById('toggle-camera-btn');
  const closeScannerBtn = document.getElementById('close-scanner-btn');

  // Camera Toggle
  if (toggleCameraBtn) {
    toggleCameraBtn.addEventListener('click', () => {
      startScanner();
    });
  }

  if (closeScannerBtn) {
    closeScannerBtn.addEventListener('click', () => {
      stopScanner();
    });
  }

  // Auto-focus barcode input
  if (barcodeInput) {
    barcodeInput.focus();

    barcodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = barcodeInput.value.trim();
        if (!code) return;

        const products = findProductsByBarcode(code);
        if (products.length === 1) {
          handleProductSelection(products[0]);
        } else if (products.length > 1) {
          playScanSound();
          showMultiProductModal(products);
        } else {
          if (feedback) {
            feedback.innerHTML = `<span style="color: var(--accent-danger);">❌ Mahsulot topilmadi: ${code}</span>`;
            setTimeout(() => { if (feedback) feedback.innerHTML = ''; }, 3000);
          }
        }

        barcodeInput.value = '';
        barcodeInput.focus();
      }
    });

    // Handle clicks outside to refocus
    document.addEventListener('click', (e) => {
      const modal = document.getElementById('scanner-modal');
      if (modal && !modal.classList.contains('hidden')) return;
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.closest('.modal-content') && !e.target.closest('.btn')) {
        barcodeInput.focus();
      }
    });
  }

  // Product quick cards
  document.querySelectorAll('.product-quick-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      const product = getProducts().find(p => p.id === id);
      if (product) {
        handleProductSelection(product);
      }
    });
  });

  // Pay button
  const payBtn = document.getElementById('pay-btn');
  if (payBtn) {
    payBtn.addEventListener('click', async () => {
      if (cart.length === 0) return;

      // Final stock check before saving
      const products = getProducts();
      for (const item of cart) {
        const prod = products.find(p => p.barcode === item.barcode);
        if (prod && prod.stock < item.qty) {
          alert(`Xatolik: ${item.name} mahsulotidan omborda yetarli emas (${prod.stock} ta qolgan).`);
          return;
        }
      }

      const originalText = payBtn.textContent;
      payBtn.disabled = true;
      payBtn.textContent = '⌛ Saqlanmoqda...';

      const sale = {
        receiptno: `BP-${Date.now()}`,
        items: cart.map(item => ({
          id: item.id,
          barcode: item.barcode,
          name: item.name,
          price: item.price,
          qty: item.qty,
          subtotal: item.price * item.qty,
        })),
        total: getCartTotal(),
      };

      const result = await saveSale(sale);

      payBtn.disabled = false;
      payBtn.textContent = originalText;

      if (result.success) {
        showReceipt(result.sale);
        cart = [];
        updateCartUI();

        // Refresh local product list UI from the now-synced store
        refreshProductListUI();
      } else {
        alert('Xatolik: ' + result.error);
      }
    });
  }

  function refreshProductListUI() {
    const productList = document.getElementById('product-list');
    const searchInput = document.getElementById('product-search-input');
    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (productList) {
      const updatedProducts = getProducts();
      const filtered = term ? updatedProducts.filter(p => p.name.toLowerCase().includes(term) || p.barcode.includes(term)) : updatedProducts;

      productList.innerHTML = filtered.map(p => {
        const isLow = p.stock < 10;
        const isOut = p.stock <= 0;
        return `
          <div class="product-quick-card ${isOut ? 'out-of-stock' : ''}" data-id="${p.id}">
            <div class="pq-name">${p.name}</div>
            <div class="pq-price">${formatPrice(p.price)}</div>
            <div class="pq-stock ${isLow ? 'low' : ''}">${p.stock} ta</div>
            <div class="pq-code">${p.barcode}</div>
          </div>
        `;
      }).join('');
      attachQuickCardListeners();
    }
  }

  // Product Search Listener
  const productSearchInput = document.getElementById('product-search-input');
  if (productSearchInput) {
    productSearchInput.addEventListener('input', refreshProductListUI);
  }

  // Clear cart
  const clearBtn = document.getElementById('clear-cart-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      cart = [];
      updateCartUI();
    });
  }

  attachCartEventListeners();
  attachQuickCardListeners();

  // Surgical refresh: update only the product list when store data changes
  window.addEventListener('store-updated', refreshProductListUI);
}

function attachQuickCardListeners() {
  const feedback = document.getElementById('barcode-feedback');
  document.querySelectorAll('.product-quick-card').forEach(card => {
    card.onclick = () => {
      const id = parseInt(card.dataset.id);
      const product = getProducts().find(p => p.id === id);
      if (product) {
        handleProductSelection(product);
      }
    };
  });
}

export function showReceipt(sale) {
  const modal = document.getElementById('receipt-modal');
  const content = document.getElementById('receipt-content');

  const now = new Date(sale.timestamp);
  const dateStr = now.toLocaleDateString('uz-UZ');
  const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  content.innerHTML = `
    <div class="receipt-header">
      <h2>🌳 BOOKPRINT</h2>
      <p>Sana: ${dateStr} | Vaqt: ${timeStr}</p>
      <p>Chek №: ${sale.receiptno || sale.receiptNo || 'Cheksiz'}</p>
    </div>
    <table class="receipt-items">
      <thead>
        <tr>
          <th style="text-align:left">Mahsulot</th>
          <th style="text-align:center">Soni</th>
          <th style="text-align:right">Narxi</th>
          <th style="text-align:right">Summa</th>
        </tr>
      </thead>
      <tbody>
        ${sale.items.map(item => `
          <tr>
            <td>${item.name}</td>
            <td style="text-align:center">${item.qty}</td>
            <td style="text-align:right">${new Intl.NumberFormat('uz-UZ').format(item.price)}</td>
            <td style="text-align:right">${new Intl.NumberFormat('uz-UZ').format(item.subtotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="receipt-total">
      JAMI: ${new Intl.NumberFormat('uz-UZ').format(sale.total)} so'm
    </div>
    <div class="receipt-footer">
      <p>Xaridingiz uchun rahmat! 🙏</p>
      <p>BOOKPRINT — Sifat va qulay narxlar</p>
    </div>
  `;

  modal.classList.remove('hidden');

  document.getElementById('receipt-print-btn').onclick = () => {
    window.print();
  };

  document.getElementById('receipt-close-btn').onclick = () => {
    modal.classList.add('hidden');
  };
}
