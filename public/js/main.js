// js/main.js
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username"); // nếu bạn có lưu sau khi login
  const full_name = localStorage.getItem("full_name");
  const userMenu = document.getElementById("userMenu");

  if (!userMenu) return; // nếu trang không có userMenu thì bỏ qua

  if (token) {
    userMenu.innerHTML = `
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">
          <img src="images/avatar_default.png" alt="avatar" class="rounded-circle me-2" width="30" height="30">
          <span>${full_name || "Tài khoản"}</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end">
          <li class="dropdown-item-text text-muted small">Vai trò: ${role || "user"}</li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="profile.html">Trang cá nhân</a></li>
          <li><a class="dropdown-item" href="#" id="logoutBtn">Đăng xuất</a></li>
        </ul>
      </li>
    `;

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("username");
        window.location.href = "index.html";
      });
    }
  } else {
    userMenu.innerHTML = `
      <li class="nav-item">
        <a class="btn btn-outline-light ms-2" href="login.html">Đăng nhập</a>
      </li>
    `;
  }
});
// ---- Notification ----
const notifBell = document.getElementById('notification-bell');
const notifDropdown = document.getElementById('notification-dropdown');
const notifList = document.getElementById('notification-list');
const notifCount = document.getElementById('notification-count');

async function loadNotifications() {
  const userId = localStorage.getItem('id'); // ID người đăng nhập
  if (!userId) return;

  try {
    const res = await fetch(`/api/notifications/${userId}`);
    if (!res.ok) throw new Error('Không tải được thông báo');
    const data = await res.json();

    notifList.innerHTML = '';
    if (data.length === 0) {
      notifList.innerHTML = '<li>Chưa có thông báo nào</li>';
      notifCount.textContent = '0';
    } else {
      notifCount.textContent = data.length;
      data.forEach(n => {
        const li = document.createElement('li');
        li.textContent = `${new Date(n.created_at).toLocaleString()} - ${n.message}`;
        notifList.appendChild(li);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

// Toggle dropdown
notifBell.addEventListener('click', () => {
  notifDropdown.classList.toggle('d-none');
});

// Load thông báo khi mở trang
loadNotifications();

// (Tuỳ chọn) Refresh định kỳ mỗi 60s
setInterval(loadNotifications, 60000);

