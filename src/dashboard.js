// ========================================
// Dashboard Page
// ========================================
import { getSales, getDailySummary, getTodayStr, formatPrice, formatTime } from './store.js';
import { showReceipt } from './sell.js';

export function renderDashboard() {
  const today = getTodayStr();
  const summary = getDailySummary(today);
  const allSales = getSales();
  const recentSales = allSales.slice(0, 5);

  const userStr = localStorage.getItem('kmarket_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user && user.role === 'admin';

  return `
    <div class="page-enter">
      <div class="page-header">
        <h1 class="page-title">📊 Bosh sahifa</h1>
        <p class="page-subtitle">Katta Market — Savdo tizimi</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon primary">🛒</div>
          <div class="stat-info">
            <h3>Bugungi savdolar</h3>
            <div class="stat-value">${summary.salesCount}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">💰</div>
          <div class="stat-info">
            <h3>Bugungi tushum</h3>
            <div class="stat-value">${formatPrice(summary.totalRevenue)}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warning">📦</div>
          <div class="stat-info">
            <h3>Sotilgan mahsulotlar</h3>
            <div class="stat-value">${summary.totalItems}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon info">📋</div>
          <div class="stat-info">
            <h3>Jami savdolar</h3>
            <div class="stat-value">${allSales.length}</div>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <a href="#/sell" class="quick-action-btn" id="qa-sell">
          <div class="qa-icon" style="background: rgba(99,102,241,0.15)">🛒</div>
          <div class="qa-text">
            <h3>Yangi savdo</h3>
            <p>Shtrix-kod orqali sotish</p>
          </div>
        </a>
        <a href="#/products" class="quick-action-btn" id="qa-products">
          <div class="qa-icon" style="background: rgba(34,197,94,0.15)">📦</div>
          <div class="qa-text">
            <h3>Mahsulotlar</h3>
            <p>Mahsulot qo'shish/tahrirlash</p>
          </div>
        </a>
        <a href="#/daily" class="quick-action-btn" id="qa-daily">
          <div class="qa-icon" style="background: rgba(245,158,11,0.15)">📅</div>
          <div class="qa-text">
            <h3>Kunlik hisobot</h3>
            <p>Bugungi statistika</p>
          </div>
        </a>
      </div>

      <div class="card">
        <h2 style="margin-bottom: var(--space-md); font-size: 1.1rem;">So'nggi savdolar</h2>
        <div class="recent-sales-list">
          ${recentSales.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">🛍️</div>
              <p>Hali savdo qilinmagan</p>
            </div>
          ` : recentSales.map((sale, i) => {
    const productNames = sale.items && sale.items.length > 0
      ? sale.items.map(p => p.name).join(', ')
      : "Noma'lum mahsulot";

    return `
            <div class="recent-sale-item">
              <div class="sale-info" style="min-width: 0; flex: 1;">
                <div class="sale-number">#${i + 1}</div>
                <div class="sale-details" style="min-width: 0;">
                  <h4 title="${productNames}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${productNames}</h4>
                  <p>${sale.receiptno || sale.receiptNo || 'Cheksiz'} • ${formatTime(sale.timestamp || sale.date)}</p>
                </div>
              </div>
              <div class="sale-amount" style="white-space: nowrap; display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                ${formatPrice(sale.total)}
                ${isAdmin ? `<button class="btn-clear-sale" data-id="${sale.id}" style="background: none; border: none; font-size: 1.1rem; color: #ef4444; cursor: pointer; padding: 4px;" title="Ro'yxatdan tozalash">✖</button>` : ''}
              </div>
            </div>
          `}).join('')}
        </div>
      </div>
    </div>
  `;
}

export function initDashboard() {
  window.addEventListener('store-updated', () => {
    const mainContent = document.getElementById('main-content');
    if (mainContent && (window.location.hash === '' || window.location.hash === '#/')) {
      console.log("Refreshing dashboard stats...");
      mainContent.innerHTML = renderDashboard();
      attachDashboardEvents();
    }
  });

  attachDashboardEvents();
}

function attachDashboardEvents() {
  const allSales = getSales();
  const recentSales = allSales.slice(0, 5);

  document.querySelectorAll('.recent-sale-item').forEach((item, i) => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      if (recentSales[i]) {
        showReceipt(recentSales[i]);
      }
    });
  });

  document.querySelectorAll('.btn-clear-sale').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (!isNaN(id)) {
        const hidden = JSON.parse(localStorage.getItem('hiddenSales') || '[]');
        if (!hidden.includes(id)) {
          hidden.push(id);
          localStorage.setItem('hiddenSales', JSON.stringify(hidden));

          const mainContent = document.getElementById('main-content');
          if (mainContent) {
            mainContent.innerHTML = renderDashboard();
            attachDashboardEvents();
          }
        }
      }
    });
  });
}
