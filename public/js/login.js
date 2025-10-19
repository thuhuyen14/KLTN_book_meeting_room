// ✅ Dọn sạch dữ liệu & reset thông báo khi load trang login
window.addEventListener("load", () => {
  localStorage.clear(); // Xóa toàn bộ dữ liệu phiên cũ
  sessionStorage.clear();
  const errorEl = document.getElementById("loginError");
  if (errorEl) errorEl.textContent = "";
});

// ✅ Xử lý sự kiện submit form đăng nhập
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Đăng nhập thất bại");

    // ✅ Lưu thông tin phiên mới
    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);
    localStorage.setItem("full_name", data.full_name);
    localStorage.setItem("role", data.role);
    localStorage.setItem("id", data.id);
    localStorage.setItem("branch_id", data.branch_id);

    // ✅ Chuyển hướng theo vai trò
    if (data.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "index.html";
    }
  } catch (err) {
    const errorEl = document.getElementById("loginError");
    if (errorEl) errorEl.textContent = err.message;
  }
});

// ✅ Xóa thông báo lỗi khi người dùng nhập lại form
document.getElementById("loginForm").addEventListener("input", () => {
  const errorEl = document.getElementById("loginError");
  if (errorEl) errorEl.textContent = "";
});
