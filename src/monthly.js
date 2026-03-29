// ========================================
// Monthly Report Page
// ========================================
import { getMonthlySummary, getCurrentMonthStr, formatPrice } from './store.js';
import { exportToCSV } from './utils.js';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

let monthlyLineChart = null;
let monthlyPieChart = null;

export function renderMonthly() {
  const currentMonth = getCurrentMonthStr();

  return `
    <div class="page-enter">
      <div class="page-header">
        <h1 class="page-title">📈 Oylik hisobot</h1>
        <p class="page-subtitle">Tanlangan oy bo'yicha savdo statistikasi</p>
      </div>

      <div class="report-controls">
        <div class="input-group report-date-group">
          <label>📆 Oyni tanlang:</label>
          <input type="month" id="monthly-picker" value="${currentMonth}" class="input" />
        </div>
        <button class="btn btn-secondary" id="monthly-export-btn">📥 Excel</button>
      </div>

      <div class="stats-grid" id="monthly-stats">
        <!-- Filled by JS -->
      </div>

      <div class="charts-grid">
        <div class="card">
          <h3 style="margin-bottom: var(--space-sm); font-size: 1rem;">📊 Kunlik tushum tendensiyasi</h3>
          <div class="chart-container">
            <canvas id="monthly-line-chart"></canvas>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-bottom: var(--space-sm); font-size: 1rem;">🥧 Eng ko'p sotilgan mahsulotlar</h3>
          <div class="chart-container">
            <canvas id="monthly-pie-chart"></canvas>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: var(--space-xl);">
        <h3 style="margin-bottom: var(--space-md); font-size: 1rem;">📋 Kunlik taqsimot</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Sana</th>
                <th class="text-center">Savdolar soni</th>
                <th class="text-right">Tushum</th>
              </tr>
            </thead>
            <tbody id="monthly-daily-tbody"></tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top: var(--space-xl);">
        <h3 style="margin-bottom: var(--space-md); font-size: 1rem;">🏆 Top mahsulotlar</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Mahsulot</th>
                <th class="text-center">Sotilgan soni</th>
                <th class="text-right">Tushum</th>
              </tr>
            </thead>
            <tbody id="monthly-top-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function initMonthly() {
  const picker = document.getElementById('monthly-picker');
  const exportBtn = document.getElementById('monthly-export-btn');

  if (picker) {
    loadMonthlyData(picker.value);
    picker.addEventListener('change', () => {
      loadMonthlyData(picker.value);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const monthStr = picker ? picker.value : getCurrentMonthStr();
      const summary = getMonthlySummary(monthStr);
      const entries = Object.entries(summary.dailyMap).sort(([a], [b]) => a.localeCompare(b));

      if (entries.length === 0) {
        alert("Eksport qilish uchun ma'lumot yo'q.");
        return;
      }

      const headers = ['Sana', 'Savdolar soni', 'Tushum'];
      const rows = entries.map(([day, data]) => [
        day,
        data.count,
        data.revenue
      ]);

      exportToCSV(headers, rows, `Oylik_Hisobot_${monthStr}.csv`);
    });
  }
}

function getIsAdmin() {
  const userStr = localStorage.getItem('kmarket_user');
  const user = userStr ? JSON.parse(userStr) : null;
  return user && user.role === 'admin';
}

function loadMonthlyData(monthStr) {
  const summary = getMonthlySummary(monthStr);
  const isAdmin = getIsAdmin();

  // Stats
  const statsEl = document.getElementById('monthly-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon primary">🛒</div>
        <div class="stat-info">
          <h3>Jami savdolar</h3>
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
        <div class="stat-icon info">📊</div>
        <div class="stat-info">
          <h3>O'rtacha kunlik tushum</h3>
          <div class="stat-value">${formatPrice(Math.round(summary.avgDaily))}</div>
        </div>
      </div>
    `;
  }

  // Daily breakdown table
  const dailyTbody = document.getElementById('monthly-daily-tbody');
  if (dailyTbody) {
    const dailyEntries = Object.entries(summary.dailyMap).sort(([a], [b]) => a.localeCompare(b));
    if (dailyEntries.length === 0) {
      dailyTbody.innerHTML = '<tr><td colspan="3"><div class="empty-state"><p>Bu oyda savdo qilinmagan</p></div></td></tr>';
    } else {
      dailyTbody.innerHTML = dailyEntries.map(([day, data]) => `
        <tr>
          <td class="mono">${day}</td>
          <td class="text-center">${data.count}</td>
          <td class="text-right price">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
              ${formatPrice(data.revenue)}
              ${isAdmin ? `<button class="btn-clear-day" data-day="${day}" style="background: none; border: none; font-size: 1.1rem; color: #ef4444; cursor: pointer; padding: 4px;" title="Kunni tozalash">✖</button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');

      // Total row
      dailyTbody.innerHTML += `
        <tr style="font-weight: 700; border-top: 2px solid var(--border-color);">
          <td>JAMI</td>
          <td class="text-center">${summary.salesCount}</td>
          <td class="text-right price">${formatPrice(summary.totalRevenue)}</td>
        </tr>
      `;
    }
  }

  // Top products table
  const topTbody = document.getElementById('monthly-top-tbody');
  if (topTbody) {
    if (summary.topProducts.length === 0) {
      topTbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>Ma\'lumot yo\'q</p></div></td></tr>';
    } else {
      topTbody.innerHTML = summary.topProducts.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${p.name}</strong></td>
          <td class="text-center">${p.qty} ta</td>
          <td class="text-right price">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
              ${formatPrice(p.revenue)}
              ${isAdmin ? `<button class="btn-clear-top-product" data-barcode="${p.barcode}" style="background: none; border: none; font-size: 1.1rem; color: #ef4444; cursor: pointer; padding: 4px;" title="Ro'yxatdan tozalash">✖</button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  // Charts
  renderMonthlyLineChart(summary.dailyMap);
  renderMonthlyPieChart(summary.topProducts);

  // Click listeners for clearing
  document.querySelectorAll('.btn-clear-day').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const day = btn.dataset.day;
      if (day) {
        const hidden = JSON.parse(localStorage.getItem('hiddenDays') || '[]');
        if (!hidden.includes(day)) {
          hidden.push(day);
          localStorage.setItem('hiddenDays', JSON.stringify(hidden));
          loadMonthlyData(monthStr); // triggers global app re-computation since store.js excludes the day
        }
      }
    });
  });

  document.querySelectorAll('.btn-clear-top-product').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const barcode = btn.dataset.barcode;
      if (barcode) {
        const hidden = JSON.parse(localStorage.getItem('hiddenTopProducts') || '[]');
        if (!hidden.includes(barcode)) {
          hidden.push(barcode);
          localStorage.setItem('hiddenTopProducts', JSON.stringify(hidden));
          loadMonthlyData(monthStr);
        }
      }
    });
  });
}

function renderMonthlyLineChart(dailyMap) {
  const ctx = document.getElementById('monthly-line-chart');
  if (!ctx) return;

  if (monthlyLineChart) monthlyLineChart.destroy();

  const entries = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b));
  const labels = entries.map(([day]) => day.slice(8)); // day number only
  const data = entries.map(([, d]) => d.revenue);

  monthlyLineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Kunlik tushum',
        data,
        borderColor: 'rgba(99, 102, 241, 1)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
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
          ticks: { color: '#8b95b0' },
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

function renderMonthlyPieChart(topProducts) {
  const ctx = document.getElementById('monthly-pie-chart');
  if (!ctx) return;

  if (monthlyPieChart) monthlyPieChart.destroy();

  const top5 = topProducts.slice(0, 5);
  if (top5.length === 0) return;

  const colors = [
    'rgba(99, 102, 241, 0.8)',
    'rgba(34, 197, 94, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(6, 182, 212, 0.8)',
    'rgba(239, 68, 68, 0.8)',
  ];

  monthlyPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: top5.map(p => p.name),
      datasets: [{
        data: top5.map(p => p.revenue),
        backgroundColor: colors.slice(0, top5.length),
        borderColor: 'rgba(26, 34, 53, 1)',
        borderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#8b95b0',
            padding: 12,
            font: { size: 11 },
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ctx.label + ': ' + new Intl.NumberFormat('uz-UZ').format(ctx.raw) + ' so\'m',
          }
        }
      }
    }
  });
}
