export function renderLogin() {
  return `
    <div class="login-screen">
      <div class="mesh-gradient"></div>
      <div class="card card-glass login-card">
        <div class="login-logo">
          <img src="/logo.png" alt="Bookprint Logo" class="logo-img" />
          <h2 class="login-title">Tizimga kirish</h2>
          <p class="login-subtitle">Xush kelibsiz! Iltimos, ma'lumotlaringizni kiriting</p>
        </div>
        
        <form id="login-form">
          <div class="input-group">
            <label for="login-username" style="color: #ccc;">Foydalanuvchi nomi</label>
            <input type="text" id="login-username" class="input input-glass" placeholder="admin" required />
          </div>
          <div class="input-group">
            <label for="login-password" style="color: #ccc;">Parol</label>
            <input type="password" id="login-password" class="input input-glass" placeholder="••••••••" required />
          </div>
          
          <div id="login-error" style="color: #ff5252; font-size: 0.85rem; margin-bottom: var(--space-md); text-align: center; border: 1px solid rgba(255,82,82,0.3); padding: var(--space-sm); border-radius: var(--radius-sm); background: rgba(255,82,82,0.1); display: none;"></div>
          
          <button type="submit" class="btn btn-primary btn-premium" style="width: 100%;">Kirish</button>
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
