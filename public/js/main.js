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
