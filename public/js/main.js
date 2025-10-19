// ==============================
// 🟦 XỬ LÝ LOGIN / LOGOUT & MENU
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const full_name = localStorage.getItem("full_name");
  const userMenu = document.getElementById("userMenu");

  if (!userMenu) return;

  // Nếu đã đăng nhập -> hiển thị menu tài khoản
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
        // Xóa toàn bộ dữ liệu phiên
        localStorage.clear();
        sessionStorage.clear();

        // Reset menu & thông báo
        userMenu.innerHTML = `<li class="nav-item"><a class="btn btn-outline-light ms-2" href="login.html">Đăng nhập</a></li>`;
        const notifList = document.getElementById("notification-list");
        const notifCount = document.getElementById("notification-count");
        if (notifList) notifList.innerHTML = '<li>Chưa có thông báo nào</li>';
        if (notifCount) notifCount.textContent = '0';

        // Vẫn ở index.html, không redirect
      });
    }
  } else {
    // Nếu chưa đăng nhập -> hiển thị nút đăng nhập
    userMenu.innerHTML = `<li class="nav-item"><a class="btn btn-outline-light ms-2" href="login.html">Đăng nhập</a></li>`;
  }

  // ===== 3️⃣ Kiểm tra quyền truy cập trang khác =====
  const protectedPages = ["profile.html", "booking.html", "other.html"]; // danh sách các trang cần login
  const currentPage = window.location.pathname.split("/").pop();
  if (!token && protectedPages.includes(currentPage)) {
    alert("Vui lòng đăng nhập để sử dụng tính năng này");
    window.location.href = "login.html"; // redirect về login
  }
});

// ==============================
// 🟨 THÔNG BÁO NGƯỜI DÙNG (Notification)
// ==============================
const notifBell = document.getElementById('notification-bell');
const notifDropdown = document.getElementById('notification-dropdown');
const notifList = document.getElementById('notification-list');
const notifCount = document.getElementById('notification-count');

async function loadNotifications() {
  const userId = localStorage.getItem('id'); // ID người đăng nhập
  if (!userId || !notifList || !notifCount) return;

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
    console.error('Lỗi khi tải thông báo:', err);
  }
}

if (notifBell && notifDropdown) {
  notifBell.addEventListener('click', () => {
    notifDropdown.classList.toggle('d-none');
  });
}

// Load thông báo khi mở trang
loadNotifications();

// Refresh định kỳ mỗi 60s
setInterval(loadNotifications, 60000);
