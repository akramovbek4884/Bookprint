export function renderLogin() {
  return `
    <div style="display: flex; justify-content: center; align-items: center; min-height: 80vh;">
      <div class="card card-glass" style="width: 100%; max-width: 400px; padding: var(--space-xl);">
        <div style="text-align: center; margin-bottom: var(--space-xl);">
          <img src="/src/assets/logo.png" alt="Bookprint Logo" class="logo-img" style="width: 64px; height: 64px; margin-bottom: var(--space-sm);" />
          <h2 class="page-title">Tizimga kirish</h2>
          <p class="page-subtitle">Iltimos, o'z hisob ma'lumotlaringizni kiriting</p>
        </div>
        
        <form id="login-form">
          <div class="input-group full-width" style="margin-bottom: var(--space-md);">
            <label for="login-username">Foydalanuvchi nomi</label>
            <input type="text" id="login-username" class="input" placeholder="admin" required />
          </div>
          <div class="input-group full-width" style="margin-bottom: var(--space-lg);">
            <label for="login-password">Parol</label>
            <input type="password" id="login-password" class="input" placeholder="••••••••" required />
          </div>
          
          <div id="login-error" style="color: var(--accent-danger); font-size: 0.85rem; margin-bottom: var(--space-md); text-align: center; display: none;"></div>
          
          <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Kirish</button>
        </form>
      </div>
    </div>
  `;
}

export function initLogin() {
  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('login-error');

  // Hide sidebar if on login page
  const sidebar = document.getElementById('sidebar');
  const mobileHeader = document.querySelector('.mobile-header');
  if (sidebar) sidebar.style.display = 'none';
  if (mobileHeader) mobileHeader.style.display = 'none';

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
          localStorage.setItem('kmarket_token', data.token);
          localStorage.setItem('kmarket_user', JSON.stringify(data.user));

          // Restore layout
          if (sidebar) sidebar.style.display = 'flex';
          if (mobileHeader) mobileHeader.style.display = 'flex';

          window.location.hash = '/';
          window.location.reload(); // Reload to initialize store with token
        } else {
          errorDiv.textContent = data.error || 'Kirishda xatolik';
          errorDiv.style.display = 'block';
        }
      } catch (err) {
        errorDiv.textContent = "Serverga ulanib bo'lmayapti";
        errorDiv.style.display = 'block';
      }
    });
  }
}
