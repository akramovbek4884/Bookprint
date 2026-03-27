// ========================================
// Users Management Page (Admin only)
// ========================================
import { formatPrice } from './store.js';

export function renderUsers() {
    return `
    <div class="page-enter">
      <div class="page-header">
        <h1 class="page-title">👥 Foydalanuvchilar</h1>
        <p class="page-subtitle">Foydalanuvchilarni boshqarish</p>
      </div>

      <div class="search-bar">
        <div></div>
        <button class="btn btn-primary" id="add-user-btn">➕ Yangi foydalanuvchi</button>
      </div>

      <div class="card">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Foydalanuvchi nomi</th>
                <th>Rol</th>
                <th class="text-center">Amallar</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              <tr><td colspan="4"><div class="empty-state"><div class="empty-icon">⏳</div><p>Yuklanmoqda...</p></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Add User Modal -->
    <div id="user-form-modal" class="modal-overlay hidden">
      <div class="modal-content" style="max-width: 420px;">
        <h3 style="margin-bottom: var(--space-lg);" id="user-form-title">➕ Yangi foydalanuvchi</h3>
        <div class="form-grid">
          <div class="input-group full-width">
            <label for="uf-username">Foydalanuvchi nomi</label>
            <input type="text" id="uf-username" class="input" placeholder="kassir1" />
          </div>
          <div class="input-group full-width">
            <label for="uf-password">Parol</label>
            <input type="password" id="uf-password" class="input" placeholder="••••••••" />
          </div>
          <div class="input-group full-width">
            <label for="uf-role">Rol</label>
            <select id="uf-role" class="input">
              <option value="cashier">Kassir</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div id="user-form-error" style="color: #ff5252; font-size: 0.85rem; margin-top: var(--space-sm); text-align: center; display: none;"></div>
        <div class="form-actions" style="margin-top: var(--space-lg);">
          <button class="btn btn-secondary" id="uf-cancel">Bekor qilish</button>
          <button class="btn btn-primary" id="uf-save">💾 Saqlash</button>
        </div>
      </div>
    </div>

    <!-- Delete User Confirmation Modal -->
    <div id="user-delete-modal" class="modal-overlay hidden">
      <div class="modal-content" style="max-width: 400px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: var(--space-md);">⚠️</div>
        <h3 style="margin-bottom: var(--space-sm);">Foydalanuvchini o'chirish</h3>
        <p style="color: var(--text-secondary); margin-bottom: var(--space-xl);">
          Haqiqatan ham bu foydalanuvchini o'chirmoqchimisiz?
        </p>
        <div class="form-actions" style="justify-content: center;">
          <button class="btn btn-secondary" id="user-delete-cancel">Bekor qilish</button>
          <button class="btn btn-danger" id="user-delete-confirm">🗑️ O'chirish</button>
        </div>
      </div>
    </div>
  `;
}

export function initUsers() {
    const token = localStorage.getItem('kmarket_token');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    let deleteTargetId = null;

    // Load users
    loadUsers();

    async function loadUsers() {
        try {
            const res = await fetch('/api/users', { headers });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Xatolik');
            }
            const users = await res.json();
            renderUsersTable(users);
        } catch (err) {
            const tbody = document.getElementById('users-tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">❌</div><p>${err.message}</p></div></td></tr>`;
            }
        }
    }

    function renderUsersTable(users) {
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">👤</div><p>Foydalanuvchilar topilmadi</p></div></td></tr>';
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('kmarket_user') || '{}');

        tbody.innerHTML = users.map((u, i) => {
            const roleBadge = u.role === 'admin'
                ? '<span class="badge badge-warning">Admin</span>'
                : '<span class="badge badge-success">Kassir</span>';
            const isSelf = u.id === currentUser.id;

            return `
                <tr>
                    <td class="text-muted">${i + 1}</td>
                    <td><strong>${u.username}</strong>${isSelf ? ' <span style="color: var(--text-muted); font-size: 0.8em;">(siz)</span>' : ''}</td>
                    <td>${roleBadge}</td>
                    <td class="text-center">
                        ${isSelf ? '<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>' :
                    `<button class="btn btn-sm btn-danger delete-user-btn" data-id="${u.id}" title="O'chirish">🗑️</button>`}
                    </td>
                </tr>
            `;
        }).join('');

        attachDeleteListeners();
    }

    function attachDeleteListeners() {
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteTargetId = btn.dataset.id;
                document.getElementById('user-delete-modal').classList.remove('hidden');
            });
        });
    }

    // Add user button
    document.getElementById('add-user-btn')?.addEventListener('click', () => {
        document.getElementById('uf-username').value = '';
        document.getElementById('uf-password').value = '';
        document.getElementById('uf-role').value = 'cashier';
        const errDiv = document.getElementById('user-form-error');
        if (errDiv) errDiv.style.display = 'none';
        document.getElementById('user-form-modal').classList.remove('hidden');
    });

    // Cancel
    document.getElementById('uf-cancel')?.addEventListener('click', () => {
        document.getElementById('user-form-modal').classList.add('hidden');
    });

    // Save user
    document.getElementById('uf-save')?.addEventListener('click', async () => {
        const username = document.getElementById('uf-username').value.trim();
        const password = document.getElementById('uf-password').value.trim();
        const role = document.getElementById('uf-role').value;
        const errDiv = document.getElementById('user-form-error');

        if (!username || !password) {
            errDiv.textContent = "Username va parol kiritilishi shart";
            errDiv.style.display = 'block';
            return;
        }

        if (password.length < 4) {
            errDiv.textContent = "Parol kamida 4 ta belgidan iborat bo'lishi kerak";
            errDiv.style.display = 'block';
            return;
        }

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers,
                body: JSON.stringify({ username, password, role })
            });

            const data = await res.json();
            if (!res.ok) {
                errDiv.textContent = data.error || 'Xatolik';
                errDiv.style.display = 'block';
                return;
            }

            document.getElementById('user-form-modal').classList.add('hidden');
            loadUsers();
        } catch (err) {
            errDiv.textContent = "Serverga ulanib bo'lmayapti";
            errDiv.style.display = 'block';
        }
    });

    // Delete cancel
    document.getElementById('user-delete-cancel')?.addEventListener('click', () => {
        document.getElementById('user-delete-modal').classList.add('hidden');
        deleteTargetId = null;
    });

    // Delete confirm
    document.getElementById('user-delete-confirm')?.addEventListener('click', async () => {
        if (!deleteTargetId) return;

        try {
            const res = await fetch(`/api/users/${deleteTargetId}`, {
                method: 'DELETE',
                headers
            });

            if (!res.ok) {
                const data = await res.json();
                alert(data.error || 'Xatolik');
            }
        } catch (err) {
            alert("Serverga ulanib bo'lmayapti");
        }

        document.getElementById('user-delete-modal').classList.add('hidden');
        deleteTargetId = null;
        loadUsers();
    });

    // Close modals on overlay click
    ['user-form-modal', 'user-delete-modal'].forEach(id => {
        const modal = document.getElementById(id);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });
}
