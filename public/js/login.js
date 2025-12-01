// js/login.js

// 1. Chạy ngay khi file được load để dọn dẹp tàn dư của phiên trước
(function cleanUpSession() {
    localStorage.clear();
    sessionStorage.clear();
    
    // Xóa lớp màn đen của modal (Backdrop) nếu bị kẹt từ trang trước
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(bd => bd.remove());
    document.body.classList.remove('modal-open');
    document.body.style = ""; 
})();

// 2. Xử lý Submit Form
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter; // Nút bấm
    const errorEl = document.getElementById("loginError");
    
    // Disable nút để tránh click nhiều lần
    if(btn) btn.disabled = true;
    if(errorEl) errorEl.textContent = "Đang xử lý...";

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.error || "Sai tên đăng nhập hoặc mật khẩu");
        }

        // Lưu thông tin
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("full_name", data.full_name);
        localStorage.setItem("role", data.role);
        localStorage.setItem("id", data.id);
        if(data.branch_id) localStorage.setItem("branch_id", data.branch_id);

        // Chuyển hướng
        if (data.role?.toLowerCase() === "administrator" || data.role === "admin") {
             window.location.href = "admin.html";
        } else {
             window.location.href = "index.html";
        }

    } catch (err) {
        if(errorEl) errorEl.textContent = err.message;
        if(btn) btn.disabled = false; // Mở lại nút
    }
});

// 3. Xóa lỗi khi nhập lại
document.getElementById("loginForm")?.addEventListener("input", () => {
    const errorEl = document.getElementById("loginError");
    if (errorEl) errorEl.textContent = "";
});