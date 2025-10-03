document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role"); // lấy role
  const userMenu = document.getElementById("userMenu");

  if (token) {
    userMenu.innerHTML = `
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
          Tài khoản của tôi (${role})
        </a>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><a class="dropdown-item" href="#" id="logoutBtn">Đăng xuất</a></li>
        </ul>
      </li>
    `;

    document.getElementById("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      location.href = "index.html";
    });
  }
  else {
    // Nếu chưa login, hiển thị nút Đăng nhập
    userMenu.innerHTML = `<a class="btn btn-primary" href="login.html">Đăng nhập</a>`;
  }
});
