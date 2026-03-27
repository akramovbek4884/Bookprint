// ========================================
// Main Entry — Router & Clock
// ========================================
import './style.css';
import { initStore } from './store.js';
import { renderDashboard } from './dashboard.js';
import { renderSell, initSell } from './sell.js';
import { renderProducts, initProducts } from './products.js';
import { renderDaily, initDaily } from './daily.js';
import { renderMonthly, initMonthly } from './monthly.js';
import { renderLogin, initLogin } from './login.js';
import { initRobot } from './robot.js';

// ---- Router ----
const routes = {
  '/': { render: renderDashboard, init: null, navId: 'nav-dashboard' },
  '/sell': { render: renderSell, init: initSell, navId: 'nav-sell' },
  '/products': { render: renderProducts, init: initProducts, navId: 'nav-products' },
  '/daily': { render: renderDaily, init: initDaily, navId: 'nav-daily' },
  '/monthly': { render: renderMonthly, init: initMonthly, navId: 'nav-monthly' },
  '/login': { render: renderLogin, init: initLogin, navId: null },
};

function getRoute() {
  const hash = window.location.hash.slice(1) || '/';
  return hash;
}

function navigateTo(path) {
  const token = localStorage.getItem('kmarket_token');
  if (!token && path !== '/login') {
    window.location.hash = '/login';
    return;
  }

  const route = routes[path] || routes['/'];
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
