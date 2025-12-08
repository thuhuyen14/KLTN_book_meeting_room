/* =========================================================
   NAVBAR CONTROLLER
   Xử lý logic hiển thị menu, thông báo và sự kiện
   ========================================================= */

// Biến toàn cục để chứa ID người dùng
let CURRENT_USER_ID = null;

// Chạy sau khi navbar HTML đã được load vào div placeholder
function initNavbar() {
    // Nếu truy cập vào root "/" thì ép về index.html
  if (window.location.pathname === "/" || window.location.pathname === "") {
    window.location.replace("index.html");
  }

  // Kiểm tra nếu đang có màn đen mà không có modal nào hiển thị -> Xóa ngay
  const backdrops = document.querySelectorAll('.modal-backdrop');
  if (backdrops.length > 0) {
      // Xóa tất cả các thẻ div màn đen
      backdrops.forEach(el => el.remove());
      
      // Trả lại thanh cuộn cho body
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      
      console.log("Đã dọn dẹp lớp overlay bị kẹt!");
  }
  // 1. Lấy thông tin user từ localStorage
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const full_name = localStorage.getItem("full_name");
  const avatar_url = localStorage.getItem("avatar_url");
  const userMenu = document.getElementById("userMenu");
  
  // Lưu ID ra biến toàn cục để dùng cho các hàm khác
  CURRENT_USER_ID = localStorage.getItem("id");

  if (!userMenu) return;

// 2. Logic phân quyền theo role
const currentPage = window.location.pathname.split("/").pop();
if (!currentPage) currentPage = "index.html";
const roleNorm = role?.toLowerCase() || "user";

// Các trang theo role
const USER_PAGES = [
  "index.html","booking.html","rooms.html","schedule.html",
  "documents.html","templates.html","users.html", "profile.html"
];

const ADMIN_PAGES = [
  ...USER_PAGES,
  "admin.html"
];

const MANAGER_PAGES = [
  ...USER_PAGES,
  "report.html","analytic.html"
];

// Map role -> allowed pages
const ROLE_PAGES = {
  "administrator": ADMIN_PAGES,
  "manager": MANAGER_PAGES,
  "user": USER_PAGES
};

// Nếu role không hợp lệ thì coi như user
const allowedPages = ROLE_PAGES[roleNorm] || USER_PAGES;

// Redirect nếu truy cập trang không hợp lệ
if (!allowedPages.includes(currentPage)) {
  alert("Bạn không có quyền truy cập trang này");
  window.location.href = "index.html";
  return;
}

// Ẩn tab theo role  
function hideTabs(selector) {
  document.querySelectorAll(selector).forEach(el => el.style.display = "none");
}

// Ẩn tab admin-only nếu không phải admin
if (roleNorm !== "administrator") {
  hideTabs(".admin-only");
}

// Ẩn tab manager-only nếu không phải manager
if (roleNorm !== "manager") {
  hideTabs(".manager-only");
}


  // 3. Render Avatar & Menu User
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
        <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <img src="${avatarSrc}" alt="avatar" class="rounded-circle me-2" width="30" height="30">
          <span class="d-none d-sm-inline">${full_name || "Tài khoản"}</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end shadow">
          <li class="dropdown-item-text text-muted small">Vai trò: <strong>${role || "User"}</strong></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="profile.html"><i class="bi bi-person me-2"></i>Trang cá nhân</a></li>
          <li><a class="dropdown-item text-danger" href="#" id="logoutBtn"><i class="bi bi-box-arrow-right me-2"></i>Đăng xuất</a></li>
        </ul>
      </li>
    `;
    
    // Gắn sự kiện đăng xuất
// Gắn sự kiện đăng xuất (ĐÃ SỬA ĐỂ FIX LỖI MÀN HÌNH ĐEN)
    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      
      // 1. Dọn dẹp dữ liệu phiên
      localStorage.clear();
      sessionStorage.clear();

      // 2. 🔥 CƯỠNG CHẾ XÓA MỌI LỚP MÀN ĐEN NGAY LẬP TỨC
      // Xóa class khóa cuộn của body
      document.body.classList.remove('modal-open', 'swal2-shown', 'swal2-height-auto');
      document.body.style = ""; 

      // Tìm và diệt các thẻ div màn đen (của Bootstrap Modal hoặc SweetAlert)
      document.querySelectorAll('.modal-backdrop, .swal2-container, .swal2-backdrop-show').forEach(el => el.remove());

      // 3. Dùng replace thay vì href để người dùng không bấm Back quay lại được
      window.location.replace("login.html");
    });

    // 4. Tải thông báo (Chỉ tải khi đã đăng nhập)
    loadNotifications();

  } else {
    // Chưa đăng nhập
    userMenu.innerHTML = `<li class="nav-item"><a class="btn btn-outline-light ms-2" href="login.html">Đăng nhập</a></li>`;
  }

  // 5. Active Link (Tô đậm tab hiện tại)
  const path = window.location.pathname.split("/").pop();
  document.querySelectorAll(".navbar-nav .nav-link").forEach(link => {
    link.classList.remove("active");
    if (link.getAttribute('href') === path) {
        link.classList.add("active");
    }
  });
}

/* =========================================================
   LOGIC THÔNG BÁO (NOTIFICATION)
   Được đưa ra ngoài scope của initNavbar để HTML onclick gọi được
   ========================================================= */

// Hàm tải danh sách thông báo từ API
async function loadNotifications() {
  const notifList = document.getElementById('notification-list');
  const userId = CURRENT_USER_ID || localStorage.getItem("id");

  if (!userId || !notifList) return;

  try {
    const res = await fetch(`/api/notifications/${userId}`);
    // Xử lý lỗi nếu server trả về 404 hoặc 500
    if (!res.ok) {
        console.warn("API thông báo lỗi hoặc không có dữ liệu");
        return;
    }
    
    const data = await res.json();
    notifList.innerHTML = '';

    // Logic đếm số lượng chưa đọc (is_read == 0)
    // Lưu ý: Dùng filter lọc các bản ghi có is_read là 0 hoặc "0"
    const unreadCount = data.filter(n => n.is_read == 0).length;
    
    // Cập nhật Badge
    updateBadgeCount(unreadCount);

    if (data.length === 0) {
      notifList.innerHTML = `
        <div class="p-4 text-center text-muted">
            <i class="bi bi-bell-slash display-6 mb-2 d-block"></i>
            <small>Bạn chưa có thông báo nào</small>
        </div>`;
    } else {
      data.forEach(n => {
        // Kiểm tra xem tin này đã đọc hay chưa
        const isUnread = (n.is_read == 0);
        
        // Tạo phần tử DIV cho mỗi thông báo
        const div = document.createElement('div');
        div.id = `notif-item-${n.id}`;
        // Thêm class list-group-item của Bootstrap + CSS tùy chỉnh
        div.className = "list-group-item list-group-item-action d-flex align-items-start p-3 border-bottom";
        
        // Màu nền: Xanh nhạt nếu chưa đọc, trắng nếu đã đọc
        div.style.backgroundColor = isUnread ? "#e8f5e9" : "#fff";
        div.style.transition = "background-color 0.3s";

        // Format thời gian
        const dateObj = new Date(n.created_at);
        const timeStr = !isNaN(dateObj) 
            ? dateObj.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
            : '';

        // Nội dung HTML
        div.innerHTML = `
          <div class="flex-grow-1 pe-2">
             <div class="mb-1 ${isUnread ? 'fw-bold text-dark' : 'text-secondary'}" style="font-size: 0.9rem; line-height: 1.4;">
                ${n.message}
             </div>
             <small class="text-muted" style="font-size: 0.75rem;">
                <i class="bi bi-clock me-1"></i>${timeStr}
             </small>
          </div>
          
          ${isUnread ? `
            <div class="ms-2">
                <button class="btn btn-outline-success btn-sm rounded-circle d-flex align-items-center justify-content-center p-0" 
                        style="width: 32px; height: 32px;"
                        title="Đánh dấu đã xem" 
                        onclick="window.markAsRead(${n.id}, event)">
                  <i class="bi bi-check-lg"></i>
                </button>
            </div>
          ` : ''}
        `;
        
        notifList.appendChild(div);
      });
    }
  } catch (err) {
    console.error('Lỗi khi tải thông báo:', err);
    notifList.innerHTML = '<div class="p-3 text-center text-danger small">Không tải được dữ liệu</div>';
  }
}

// Hàm đánh dấu đã đọc (Gắn vào window để gọi được từ HTML onclick)
window.markAsRead = async function(notifId, event) {
  // 1. Chặn sự kiện click lan ra ngoài (để không đóng dropdown)
  if(event) {
      event.stopPropagation();
      event.preventDefault();
  }

  console.log("Đang tick đã xem ID:", notifId); // Debug

  try {
    const res = await fetch(`/api/notifications/read/${notifId}`, { method: 'PUT' });
    
    if (res.ok) {
      // 2. Tìm dòng thông báo đó trong DOM
      const itemRow = document.getElementById(`notif-item-${notifId}`);
      if (!itemRow) return;

      // 3. Ẩn nút tick đi (tìm nút button và xóa nó)
      const btnDiv = itemRow.querySelector("div:last-child");
      if(btnDiv && btnDiv.querySelector("button")) {
          btnDiv.remove(); // Xóa cả cụm chứa nút tick
      }

      // 4. Đổi màu nền về trắng và chữ về thường
      itemRow.style.backgroundColor = "#fff";
      const msgContent = itemRow.querySelector("div:first-child > div");
      if(msgContent) {
          msgContent.classList.remove("fw-bold", "text-dark");
          msgContent.classList.add("text-secondary");
      }

      // 5. Giảm số trên badge đỏ
      const notifCountBadge = document.getElementById('notification-count');
      if(notifCountBadge) {
          let currentCount = parseInt(notifCountBadge.textContent || '0');
          if (currentCount > 0) {
            updateBadgeCount(currentCount - 1);
          }
      }
    } else {
        console.error("Lỗi server khi update trạng thái");
    }
  } catch (e) {
    console.error("Lỗi kết nối:", e);
  }
};

// Hàm cập nhật hiển thị số badge
function updateBadgeCount(count) {
  const badge = document.getElementById('notification-count');
  if (!badge) return;
  
  const num = parseInt(count);

  if (num > 0) {
    badge.textContent = num > 99 ? '99+' : num;
    badge.style.display = 'inline-block'; // Bắt buộc hiện
    badge.classList.remove('d-none');
    
    // Hiệu ứng rung chuông khi có tin mới (Optional)
    const bellIcon = document.querySelector("#notification-bell i");
    if(bellIcon) bellIcon.classList.add("animate__animated", "animate__swing");
  } else {
    badge.textContent = '0';
    badge.style.display = 'none'; // Ẩn đi
  }
}