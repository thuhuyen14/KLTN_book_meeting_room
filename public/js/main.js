// ==============================
// 🟦 MAIN.JS - CHỈ XỬ LÝ ĐIỀU HƯỚNG TRANG
// (Logic Navbar & Thông báo đã chuyển sang navbar.js)
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");

  // ===== Kiểm tra quyền truy cập trang =====
  // Danh sách các trang bắt buộc phải đăng nhập
  const protectedPages = [
    "profile.html", 
    "booking.html", 
    "schedule.html",
    "rooms.html",
    "users.html",
    "report.html",
    "analytic.html"
  ]; 
  
  const currentPage = window.location.pathname.split("/").pop();

  // Nếu trang hiện tại nằm trong danh sách cấm và chưa có token
  if (!token && protectedPages.includes(currentPage)) {
    alert("Vui lòng đăng nhập để sử dụng tính năng này");
    window.location.href = "login.html"; 
  }
});
// // comment đi vì đã xử lý hết trong navbar.js rồi  
// ==============================
// // 🟦 XỬ LÝ LOGIN / LOGOUT & MENU
// // ==============================
// document.addEventListener("DOMContentLoaded", async () => {
//   const token = localStorage.getItem("token");
//   const role = localStorage.getItem("role");
//   const full_name = localStorage.getItem("full_name");
//   const avatar_url = localStorage.getItem("avatar_url"); // giả sử lưu avatar user

//   const userMenu = document.getElementById("userMenu");
//   if (!userMenu) return;

//   // Hàm tạo avatar mặc định chữ cái đầu
//   function normalizeAvatar(url, name) {
//     if (url && url.trim() !== '') return url;
//     if (name && name.trim() !== '') {
//       const initial = encodeURIComponent(name.trim()[0].toUpperCase());
//       return `https://ui-avatars.com/api/?name=${initial}&background=random&color=fff&size=64`;
//     }
//     return 'images/avatar_default.png';
//   }

//   if (token) {
//     const avatarSrc = normalizeAvatar(avatar_url, full_name);
//     userMenu.innerHTML = `
//       <li class="nav-item dropdown">
//         <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">
//           <img src="${avatarSrc}" alt="avatar" class="rounded-circle me-2" width="30" height="30">
//           <span>${full_name || "Tài khoản"}</span>
//         </a>
//         <ul class="dropdown-menu dropdown-menu-end">
//           <li class="dropdown-item-text text-muted small">Vai trò: ${role || "user"}</li>
//           <li><hr class="dropdown-divider"></li>
//           <li><a class="dropdown-item" href="profile.html">Trang cá nhân</a></li>
//           <li><a class="dropdown-item" href="#" id="logoutBtn">Đăng xuất</a></li>
//         </ul>
//       </li>
//     `;

//     const logoutBtn = document.getElementById("logoutBtn");
//     if (logoutBtn) {
//       logoutBtn.addEventListener("click", () => {
//         // Xóa toàn bộ dữ liệu phiên
//         localStorage.clear();
//         sessionStorage.clear();

//         // Reset menu & thông báo
//         userMenu.innerHTML = `<li class="nav-item"><a class="btn btn-outline-light ms-2" href="login.html">Đăng nhập</a></li>`;
//         const notifList = document.getElementById("notification-list");
//         const notifCount = document.getElementById("notification-count");
//         if (notifList) notifList.innerHTML = '<li>Chưa có thông báo nào</li>';
//         if (notifCount) notifCount.textContent = '0';

//         // Vẫn ở index.html, không redirect
//       });
//     }
//   } else {
//     // Nếu chưa đăng nhập -> hiển thị nút đăng nhập
//     userMenu.innerHTML = `<li class="nav-item"><a class="btn btn-outline-light ms-2" href="login.html">Đăng nhập</a></li>`;
//   }

//   // ===== 3️⃣ Kiểm tra quyền truy cập trang khác =====
//   const protectedPages = ["profile.html", "booking.html", "other.html"]; // danh sách các trang cần login
//   const currentPage = window.location.pathname.split("/").pop();
//   if (!token && protectedPages.includes(currentPage)) {
//     alert("Vui lòng đăng nhập để sử dụng tính năng này");
//     window.location.href = "login.html"; // redirect về login
//   }
// });

// // ==============================
// // 🟨 THÔNG BÁO NGƯỜI DÙNG (Notification)
// // ==============================
// const notifBell = document.getElementById('notification-bell');
// const notifDropdown = document.getElementById('notification-dropdown');
// // const notifList = document.getElementById('notification-list');
// // const notifCount = document.getElementById('notification-count');

// async function loadNotifications() {
//   const notifList = document.getElementById('notification-list');
//   const notifCount = document.getElementById('notification-count');
//   const userId = localStorage.getItem('id'); // ID người đăng nhập
//   if (!userId || !notifList || !notifCount) return;

//   try {
//     const res = await fetch(`/api/notifications/${userId}`);
//     if (!res.ok) throw new Error('Không tải được thông báo');
//     const data = await res.json();

//     notifList.innerHTML = '';
//     if (data.length === 0) {
//       notifList.innerHTML = '<li>Chưa có thông báo nào</li>';
//       notifCount.textContent = '0';
//     } else {
//       notifCount.textContent = data.length;
//       data.forEach(n => {
//       const li = document.createElement('li');
//       try {
//         const createdAt = new Date(n.created_at);
//         if (isNaN(createdAt)) throw new Error('Invalid date');
        
//         const formattedDate = createdAt.toLocaleString('vi-VN', {
//           day: '2-digit',
//           month: '2-digit',
//           year: 'numeric',
//           hour: '2-digit',
//           minute: '2-digit',
//           second: '2-digit',
//           hour12: false
//         });
        
//         li.textContent = `${formattedDate} - ${n.message}`;
//       } catch (err) {
//         console.warn('Lỗi format thời gian:', err, n.created_at);
//         // fallback nếu có lỗi định dạng
//         li.textContent = `${n.created_at} - ${n.message}`;
//       }
//       notifList.appendChild(li);
//     });

//     }
//   } catch (err) {
//     console.error('Lỗi khi tải thông báo:', err);
//   }
// }

// if (notifBell && notifDropdown) {
//   notifBell.addEventListener('click', () => {
//     notifDropdown.classList.toggle('d-none');
//   });
// }

// // Load thông báo khi mở trang
// loadNotifications();

// // Refresh định kỳ mỗi 60s
// setInterval(loadNotifications, 60000);
