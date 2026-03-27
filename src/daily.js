// ========================================
// Daily Report Page
// ========================================
import { getDailySummary, getTodayStr, formatPrice, formatTime, formatDate } from './store.js';
import { exportToCSV } from './utils.js';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

let dailyChart = null;

export function renderDaily() {
  const today = getTodayStr();

  return `
    <div class="page-enter">
      <div class="page-header">
        <h1 class="page-title">📅 Kunlik hisobot</h1>
        <p class="page-subtitle">Tanlangan kun bo'yicha savdo statistikasi</p>
      </div>

      <div class="report-controls">
        <div class="input-group report-date-group">
          <label>📆 Sanani tanlang:</label>
          <input type="date" id="daily-date-picker" value="${today}" class="input" />
        </div>
        <button class="btn btn-secondary" id="daily-export-btn">📥 Excel</button>
      </div>

      <div class="stats-grid" id="daily-stats">
        <!-- Filled by JS -->
      </div>

      <div class="charts-grid">
        <div class="card">
          <h3 style="margin-bottom: var(--space-sm); font-size: 1rem;">📊 Soatlik savdo</h3>
          <div class="chart-container">
            <canvas id="daily-hourly-chart"></canvas>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-bottom: var(--space-sm); font-size: 1rem;">🏆 Eng ko'p sotilgan mahsulotlar</h3>
          <div id="daily-top-products" style="max-height: 340px; overflow-y: auto;"></div>
        </div>
      </div>

      <div class="card" style="margin-top: var(--space-xl);">
        <h3 style="margin-bottom: var(--space-md); font-size: 1rem;">🧾 Savdolar ro'yxati</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Chek №</th>
                <th>Vaqt</th>
                <th>Mahsulotlar soni</th>
                <th class="text-right">Summa</th>
              </tr>
            </thead>
            <tbody id="daily-sales-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function initDaily() {
  const datePicker = document.getElementById('daily-date-picker');
  const exportBtn = document.getElementById('daily-export-btn');

  if (datePicker) {
    loadDailyData(datePicker.value);
    datePicker.addEventListener('change', () => {
      loadDailyData(datePicker.value);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const dateStr = datePicker ? datePicker.value : getTodayStr();
      const summary = getDailySummary(dateStr);
      if (summary.sales.length === 0) {
        alert("Eksport qilish uchun ma'lumot yo'q.");
        return;
      }

      const headers = ['Chek Nomeri', 'Sana', 'Vaqt', 'Mahsulotlar soni', 'Summa'];
      const rows = summary.sales.map(s => [
        s.receiptNo,
        formatDate(s.timestamp || s.date),
        formatTime(s.timestamp || s.date),
        s.items ? s.items.length : 0,
        s.total
      ]);

      exportToCSV(headers, rows, `Kunlik_Hisobot_${dateStr}.csv`);
    });
  }
}

function loadDailyData(dateStr) {
  const summary = getDailySummary(dateStr);

  // Stats
  const statsEl = document.getElementById('daily-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon primary">🛒</div>
        <div class="stat-info">
          <h3>Savdolar soni</h3>
          <div class="stat-value">${summary.salesCount}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon success">💰</div>
        <div class="stat-info">
          <h3>Jami tushum</h3>
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
        <div class="stat-icon info">💵</div>
        <div class="stat-info">
          <h3>O'rtacha chek</h3>
          <div class="stat-value">${summary.salesCount > 0 ? formatPrice(Math.round(summary.totalRevenue / summary.salesCount)) : '0 so\'m'}</div>
        </div>
      </div>
    `;
  }

  // Hourly chart
  renderHourlyChart(summary.hourly);

  // Top products
  const topEl = document.getElementById('daily-top-products');
  if (topEl) {
    if (summary.topProducts.length === 0) {
      topEl.innerHTML = '<div class="empty-state"><p>Ma\'lumot yo\'q</p></div>';
    } else {
      topEl.innerHTML = summary.topProducts.map((p, i) => `
        <div class="recent-sale-item">
          <div class="sale-info">
            <div class="sale-number">${i + 1}</div>
            <div class="sale-details">
              <h4>${p.name}</h4>
              <p>${p.qty} ta sotildi</p>
            </div>
          </div>
          <div class="sale-amount">${formatPrice(p.revenue)}</div>
        </div>
      `).join('');
    }
  }

  // Sales table
  const tbody = document.getElementById('daily-sales-tbody');
  if (tbody) {
    if (summary.sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>Bu kunda savdo qilinmagan</p></div></td></tr>';
    } else {
      tbody.innerHTML = summary.sales.map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td class="mono">${s.receiptNo}</td>
          <td>${formatTime(s.timestamp)}</td>
          <td class="text-center">${s.items.length}</td>
          <td class="text-right price">${formatPrice(s.total)}</td>
        </tr>
      `).join('');
    }
  }
}

function renderHourlyChart(hourly) {
  const ctx = document.getElementById('daily-hourly-chart');
  if (!ctx) return;

  if (dailyChart) {
    dailyChart.destroy();
  }

  const labels = Object.keys(hourly).map(h => `${h}:00`);
  const data = Object.values(hourly);

  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tushum (so\'m)',
        data,
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => new Intl.NumberFormat('uz-UZ').format(ctx.raw) + ' so\'m',
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(99, 102, 241, 0.06)' },
          ticks: { color: '#8b95b0', font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(99, 102, 241, 0.06)' },
          ticks: {
            color: '#8b95b0',
            callback: (v) => new Intl.NumberFormat('uz-UZ', { notation: 'compact' }).format(v),
          },
        }
      }
    }
  });
}
