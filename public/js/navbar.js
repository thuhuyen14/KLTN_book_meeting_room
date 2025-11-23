// Chạy sau khi navbar đã load xong
function initNavbar() {
  // User menu
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const full_name = localStorage.getItem("full_name");
  const avatar_url = localStorage.getItem("avatar_url");
  const userMenu = document.getElementById("userMenu");

  if (!userMenu) return;
  // ===== 4️⃣ Phân quyền admin =====
  const isAdmin = role?.toLowerCase() === 'administrator'; // lấy tên role, tránh nhầm role_id với role name
  const currentPage = window.location.pathname.split("/").pop();
  const adminPages = ["admin.html", "report.html"];

  if (!isAdmin) {
    // Ẩn tab admin
    document.querySelectorAll(".admin-only").forEach(tab => tab.style.display = "none");

    // Chặn truy cập trực tiếp
    if (adminPages.includes(currentPage)) {
      alert("Bạn không có quyền truy cập trang này");
      window.location.href = "index.html";
    }
  }

  function normalizeAvatar(url, name) {
    if (url && url.trim() !== '') return url;
    if (name && name.trim() !== '') {
      const initial = encodeURIComponent(name.trim()[0].toUpperCase());
      return `https://ui-avatars.com/api/?name=${initial}&background=random&color=fff&size=64`;
    }
    return 'images/avatar_default.png';
  }

  if (token) {
    const avatarSrc = normalizeAvatar(avatar_url, full_name);
    userMenu.innerHTML = `
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">
          <img src="${avatarSrc}" alt="avatar" class="rounded-circle me-2" width="30" height="30">
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
        localStorage.clear();
        sessionStorage.clear();
        userMenu.innerHTML = `<li class="nav-item"><a class="btn btn-outline-light ms-2" href="login.html">Đăng nhập</a></li>`;
        const notifList = document.getElementById("notification-list");
        const notifCount = document.getElementById("notification-count");
        if (notifList) notifList.innerHTML = '<li>Chưa có thông báo nào</li>';
        if (notifCount) notifCount.textContent = '0';
      });
    }
  } else {
    userMenu.innerHTML = `<li class="nav-item"><a class="btn btn-outline-light ms-2" href="login.html">Đăng nhập</a></li>`;
  }

  // Notifications
  loadNotifications();

  // Active link
  const path = window.location.pathname.split("/").pop();
  document.querySelectorAll(".navbar-nav .nav-link").forEach(link => link.classList.remove("active"));
  const currentLink = document.querySelector(`.navbar-nav .nav-link[href='${path}']`);
  if (currentLink) currentLink.classList.add("active");
}

// Thông báo
async function loadNotifications() {
  const notifList = document.getElementById('notification-list');
  const notifCount = document.getElementById('notification-count');
  const userId = localStorage.getItem('id');
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
        const createdAt = new Date(n.created_at);
        const formattedDate = isNaN(createdAt) ? n.created_at :
          createdAt.toLocaleString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false});
        li.textContent = `${formattedDate} - ${n.message}`;
        notifList.appendChild(li);
      });
    }
  } catch (err) {
    console.error('Lỗi khi tải thông báo:', err);
  }
}
