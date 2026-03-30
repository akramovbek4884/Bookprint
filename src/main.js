// ========================================
// Main Entry — Router & Clock
// ========================================
import './style.css';
import { initStore, startPolling, stopPolling, syncStore } from './store.js';
import { renderDashboard, initDashboard } from './dashboard.js';
import { renderSell, initSell } from './sell.js';
import { renderProducts, initProducts } from './products.js';
import { renderDaily, initDaily } from './daily.js';
import { renderMonthly, initMonthly } from './monthly.js';
import { renderLogin, initLogin } from './login.js';
import { renderUsers, initUsers } from './users.js';
import { initRobot } from './robot.js';

// ---- Router ----
const routes = {
  '/': { render: renderDashboard, init: initDashboard, navId: 'nav-dashboard' },
  '/sell': { render: renderSell, init: initSell, navId: 'nav-sell' },
  '/products': { render: renderProducts, init: initProducts, navId: 'nav-products' },
  '/daily': { render: renderDaily, init: initDaily, navId: 'nav-daily', adminOnly: true },
  '/monthly': { render: renderMonthly, init: initMonthly, navId: 'nav-monthly', adminOnly: true },
  '/users': { render: renderUsers, init: initUsers, navId: 'nav-users', adminOnly: true },
  '/login': { render: renderLogin, init: initLogin, navId: null },
};

function getRoute() {
  const hash = window.location.hash.slice(1) || '/';
  return hash;
}

function getCurrentUser() {
  const userStr = localStorage.getItem('kmarket_user');
  return userStr ? JSON.parse(userStr) : null;
}

function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

function updateSidebarVisibility() {
  const admin = isAdmin();
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = admin ? '' : 'none';
  });
}

function navigateTo(path) {
  const token = localStorage.getItem('kmarket_token');
  if (!token && path !== '/login') {
    window.location.hash = '/login';
    return;
  }

  const route = routes[path] || routes['/'];

  // Prevent cashier from accessing admin-only pages
  if (route.adminOnly && !isAdmin()) {
    window.location.hash = '/';
    return;
  }

  const mainContent = document.getElementById('main-content');

  // Render page
  mainContent.innerHTML = route.render();

  // Init page logic
  if (route.init) {
    setTimeout(() => route.init(), 50);
  }

  // Update active nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.id === route.navId);
  });

  // Update sidebar visibility based on role
  updateSidebarVisibility();
}

// Initialize store and then render
initStore().then((success) => {
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    navigateTo(getRoute());
  });

  // Agar store yuklash muvaffaqiyatsiz bo'lsa — login sahifasiga yo'naltirish
  if (!success && getRoute() !== '/login') {
    localStorage.removeItem('kmarket_token');
    localStorage.removeItem('kmarket_user');
    window.location.hash = '/login';
  }

  // Final load
  navigateTo(getRoute());

  // Initial sync complete
});

// ---- Synchronization Logic ----
async function triggerSync(btn = null) {
  let origHtml = '';
  if (btn) {
    origHtml = btn.innerHTML;
    btn.innerHTML = '⏳ Yuklanmoqda...';
    btn.disabled = true;
    btn.style.opacity = '0.7';
  }

  console.log("Syncing store...");
  const success = await syncStore();

  if (success) {
    // Trigger surgical update on current page
    window.dispatchEvent(new CustomEvent('store-updated'));
  }

  if (btn) {
    setTimeout(() => {
      btn.innerHTML = origHtml;
      btn.disabled = false;
      btn.style.opacity = '1';
    }, 500);
  }
}

// 1. Manual Refresh logic
document.getElementById('mobile-refresh-btn')?.addEventListener('click', (e) => triggerSync(e.currentTarget));
document.getElementById('sidebar-refresh-btn')?.addEventListener('click', (e) => triggerSync(e.currentTarget));

// 2. Visibility-based sync
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log("Tab focused, triggering sync...");
    triggerSync();
  }
});

// Refresh current view if store updates via polling
window.addEventListener('store-updated', () => {
  console.log("Store updated, informing active page...");
  // navigateTo is no longer called here to avoid resetting UI state (inputs, modals, camera)
});

// ---- Logout ----
document.getElementById('logout-btn')?.addEventListener('click', () => {
  stopPolling();
  localStorage.removeItem('kmarket_token');
  localStorage.removeItem('kmarket_user');
  window.location.hash = '/login';
  window.location.reload();
});

// ---- Password Change Logic ----
document.getElementById('sidebar-password-btn')?.addEventListener('click', () => {
  const mo = document.getElementById('password-modal');
  if (mo) {
    document.getElementById('pass-old').value = '';
    document.getElementById('pass-new').value = '';
    document.getElementById('pass-confirm').value = '';
    mo.classList.remove('hidden');
  }
});

document.getElementById('pass-close-btn')?.addEventListener('click', () => {
  document.getElementById('password-modal')?.classList.add('hidden');
});

document.getElementById('pass-save-btn')?.addEventListener('click', async () => {
  const oldP = document.getElementById('pass-old').value;
  const newP = document.getElementById('pass-new').value;
  const confP = document.getElementById('pass-confirm').value;

  if (!oldP || !newP) return alert("Barcha maydonlarni to'ldiring");
  if (newP !== confP) return alert("Yangi parol va tasdiqlash paroli bir xil emas");
  if (newP.length < 4) return alert("Yangi parol kamida 4 belgi bo'lishi kerak");

  try {
    const token = localStorage.getItem('kmarket_token');
    const res = await fetch('/api/users/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ oldPassword: oldP, newPassword: newP })
    });
    const data = await res.json();
    if (res.ok) {
      alert("Parolingiz muvaffaqiyatli o'zgartirildi! Xavfsizlik uchun qayta kiring.");
      document.getElementById('logout-btn').click();
    } else {
      alert(data.error || "Xatolik yuz berdi");
    }
  } catch (e) {
    alert("Tarmoq xatosi yoki server ishlamayapti");
  }
});

// ---- Mobile Menu Logic ----
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  const closeMenu = () => {
    sidebar.classList.remove('active');
    hamburger.classList.remove('active');
    overlay.classList.add('hidden');
  };

  const toggleMenu = () => {
    sidebar.classList.toggle('active');
    hamburger.classList.toggle('active');
    overlay.classList.toggle('hidden');
  };

  if (hamburger) {
    hamburger.addEventListener('click', toggleMenu);
  }

  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  // Close menu when clicking nav items on mobile
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        closeMenu();
      }
    });
  });
}

// Initial mobile menu setup
initMobileMenu();

// ---- Clock ----
function updateClock() {
  const clockEl = document.getElementById('sidebar-clock');
  if (clockEl) {
    const now = new Date();
    const time = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = now.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    clockEl.innerHTML = `<div>${time}</div><div style="font-size: 0.75rem; color: var(--text-muted);">${date}</div>`;
  }
}

updateClock();
setInterval(updateClock, 1000);

// ---- Global Robot ----
initRobot();
