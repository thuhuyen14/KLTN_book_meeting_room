// 🌐 Hàm gọi API chung
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// 🌐 Biến toàn cục
let allTeams = [];
let allParticipants = [];
let teamSelectTom, participantSelectTom;

// ==========================================
// 🛠️ CÁC HÀM HELPER (Xử lý ngày tháng & Logic)
// ==========================================

// Format hiển thị đẹp (VD: 14:00 - 10/12/2025)
function formatDisplayDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Check xem có được phép tạo văn bản không (Logic -30 ngày -> +7 ngày)
function canCreateDocument(startTimeStr) {
    const start = new Date(startTimeStr);
    const now = new Date();
    const diffTime = start - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Trong vòng 30 ngày trước và 7 ngày tới
    return diffDays >= -30 && diffDays <= 7;
}

// Format cho input datetime-local
function formatLocalDatetime(dt) {
  if (!dt) return '';
  const dateObj = new Date(dt);
  if (isNaN(dateObj.getTime())) return '';
  const tzOffset = dateObj.getTimezoneOffset();
  const local = new Date(dateObj.getTime() - tzOffset * 60000);
  return local.toISOString().slice(0, 16);
}

// ==========================================
// 🚀 LOGIC CHÍNH
// ==========================================

// 🏁 Hàm load ban đầu
async function load() {
  await loadTeamsAndParticipants(); // Load danh mục trước để TomSelect ko bị lỗi
  
  const rooms = await api('/rooms');
  const roomFilter = document.getElementById('roomFilter');
  const editRoomSelect = document.getElementById('editRoom');

  // Fill Filter
  roomFilter.innerHTML = '<option value="">-- Tất cả phòng --</option>';
  rooms.forEach(r => roomFilter.add(new Option(r.name, r.id)));

  // Fill Modal Select
  if (editRoomSelect) {
    editRoomSelect.innerHTML = '';
    rooms.forEach(r => editRoomSelect.add(new Option(r.name, r.id)));
  }

  // Mặc định chọn hôm nay
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('viewDate').value = today;

  await renderBookings();
  await renderWeeklySchedule();
}

async function loadTeamsAndParticipants() {
  try {
    const [teams, users] = await Promise.all([api('/teams'), api('/users')]);
    allTeams = teams || [];
    
    // Map user dữ liệu chuẩn
    allParticipants = (users || []).map(u => ({
      id: String(u.id ?? u.user_id),
      name: u.full_name || u.username || 'User'
    }));

    // Init TomSelect (Thư viện chọn nhiều)
    if (document.getElementById('editTeamSelect')) {
        teamSelectTom = new TomSelect('#editTeamSelect', { plugins: ['remove_button'], valueField: 'id', labelField: 'name', searchField: 'name', options: allTeams.map(t => ({id: String(t.id), name: t.name})) });
    }
    if (document.getElementById('editParticipantsSelect')) {
        participantSelectTom = new TomSelect('#editParticipantsSelect', { plugins: ['remove_button'], valueField: 'id', labelField: 'name', searchField: 'name', options: allParticipants });
    }
  } catch (err) {
    console.error('Lỗi load danh mục:', err);
  }
}

// ==========================================
// 📅 RENDER DANH SÁCH (LIST VIEW) - ĐÃ LÀM ĐẸP
// ==========================================
async function renderBookings() {
  const date = document.getElementById('viewDate').value;
  const room_id = document.getElementById('roomFilter').value;
  const div = document.getElementById('bookings');
  
  div.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>';

  try {
      const q = new URLSearchParams();
      if (room_id) q.set('room_id', room_id);
      if (date) q.set('date', date);

      const rows = await api('/bookings?' + q.toString());
      div.innerHTML = '';

      if (!rows || rows.length === 0) {
        div.innerHTML = `
            <div class="text-center text-muted py-4 bg-light rounded border border-dashed">
                <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
                Không có lịch họp nào trong ngày này.
            </div>`;
        return;
      }

      const currentUser = localStorage.getItem('id');

      rows.forEach(b => {
        const isOwner = String(b.user_id) === String(currentUser);
        const allowCreateDoc = canCreateDocument(b.start_time);

        // Nút Lập văn bản (chỉ hiện khi đúng hạn)
        let createDocAction = '';
        if (allowCreateDoc) {
            createDocAction = `
                <a href="documents.html?create_from_booking=${b.id}" 
                   class="btn btn-outline-success btn-circle-action ms-2" 
                   title="Lập văn bản trình ký" target="_blank">
                    <i class="bi bi-file-earmark-plus-fill"></i>
                </a>
            `;
        }

        // Card HTML đẹp
        const card = document.createElement('div');
        card.className = 'card mb-3 shadow-sm border-0 border-start border-4 border-primary';
        card.innerHTML = `
          <div class="card-body d-flex justify-content-between align-items-center p-3">
            <div style="flex: 1;">
                <div class="d-flex align-items-center mb-1">
                    <h5 class="card-title mb-0 fw-bold text-primary me-2">${b.title}</h5>
                    <span class="badge bg-light text-dark border"><i class="bi bi-geo-alt"></i> ${b.room_name || 'N/A'}</span>
                </div>
                <div class="text-muted small">
                    <i class="bi bi-clock"></i> ${formatDisplayDate(b.start_time)} 
                    <i class="bi bi-arrow-right-short"></i> ${new Date(b.end_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                    <span class="mx-2">|</span> 
                    <i class="bi bi-person-circle"></i> ${b.booked_by || 'Admin'}
                </div>
            </div>

            <div class="d-flex align-items-center">
                ${isOwner ? `
                    <button class="btn btn-light text-primary btn-circle-action me-1" onclick="openEditModal(${b.id})" title="Chỉnh sửa">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-light text-danger btn-circle-action" onclick="deleteBooking(${b.id})" title="Xóa">
                        <i class="bi bi-trash"></i>
                    </button>
                ` : ''}

                ${createDocAction}
            </div>
          </div>
        `;
        div.appendChild(card);
      });

  } catch (e) {
      console.error(e);
      div.innerHTML = '<div class="alert alert-danger">Lỗi tải lịch.</div>';
  }
}

// ==========================================
// 📆 RENDER LỊCH TUẦN (WEEKLY GRID) - CLICK ĐỂ MỞ MODAL
// ==========================================
async function renderWeeklySchedule() {
  const userId = localStorage.getItem('id');
  const container = document.getElementById("personalSchedule");
  if (!userId || !container) return;

  container.innerHTML = '<div class="p-3">Đang tải lịch cá nhân...</div>';

  try {
    const today = new Date();
    // Lấy nguyên tháng để hiển thị cho rộng
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const bookings = await api(`/bookings/personal/${userId}?start=${start.toISOString()}&end=${end.toISOString()}`);

    // Cấu hình vẽ lịch
    const dayStart = 7; // Từ 7h sáng
    const dayEnd = 19;  // Đến 19h tối
    const containerHeight = 600;
    const hourHeight = containerHeight / (dayEnd - dayStart);

    // CSS Container
    Object.assign(container.style, {
        overflowX: "auto", whiteSpace: "nowrap", position: "relative",
        height: containerHeight + "px", border: "1px solid #e0e0e0",
        display: "flex", background: "#fff", borderRadius: "8px"
    });

    container.innerHTML = ''; // Clear loading

    // 1. Vẽ cột giờ (Trục tung)
    const hourLabels = document.createElement("div");
    Object.assign(hourLabels.style, {
        position: "sticky", left: "0", top: "0", height: "100%", width: "60px",
        background: "#f8f9fa", borderRight: "1px solid #ddd", zIndex: "20", flexShrink: 0
    });

    for (let h = dayStart; h <= dayEnd; h++) {
      const label = document.createElement("div");
      Object.assign(label.style, {
          position: "absolute", top: (h - dayStart) * hourHeight - 10 + "px",
          width: "100%", textAlign: "center", fontSize: "0.75rem", color: "#666", fontWeight: "bold"
      });
      label.textContent = `${h}:00`;
      hourLabels.appendChild(label);
      
      // Kẻ dòng ngang
      const line = document.createElement("div");
      Object.assign(line.style, {
         position: "absolute", top: (h - dayStart) * hourHeight + "px",
         left: "60px", right: "0", borderTop: "1px solid #f0f0f0", width: "3000px", zIndex: "0", pointerEvents: "none"
      });
      container.appendChild(line);
    }
    container.appendChild(hourLabels);

    // 2. Vẽ các cột ngày (Trục hoành)
    const daysMap = new Map();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayDiv = document.createElement("div");
      const isToday = d.toDateString() === new Date().toDateString();
      
      Object.assign(dayDiv.style, {
          flex: "0 0 160px", borderRight: "1px solid #eee", position: "relative", height: "100%",
          backgroundColor: isToday ? "#fff8e1" : "transparent" // Highlight hôm nay
      });

      // Header ngày
      const header = document.createElement("div");
      header.className = `text-center py-2 border-bottom small ${isToday ? 'text-primary fw-bold' : 'text-muted'}`;
      header.style.background = isToday ? "#ffecb3" : "#f8f9fa";
      header.innerHTML = `${d.toLocaleDateString('vi-VN', { weekday: 'short' })}<br>${d.getDate()}/${d.getMonth()+1}`;
      
      dayDiv.appendChild(header);
      daysMap.set(d.toDateString(), dayDiv);
      container.appendChild(dayDiv);
    }

    // 3. Vẽ sự kiện lên lịch
    bookings.forEach(b => {
      const startTime = new Date(b.start_time);
      const endTime = new Date(b.end_time);
      
      const dayEl = daysMap.get(startTime.toDateString());
      if (!dayEl) return;

      const startHour = startTime.getHours() + startTime.getMinutes() / 60;
      const endHour = endTime.getHours() + endTime.getMinutes() / 60;

      // Tính toán vị trí top/height
      const top = (startHour - dayStart) * hourHeight;
      const height = (endHour - startHour) * hourHeight;

      // ✅ LOGIC MÀU SẮC (SỬA LẠI Ở ĐÂY LÀ ĐÚNG)
      const isOwner = String(b.user_id) === String(userId);
      const bgClass = isOwner ? "#3b82f6" : "#6c757d"; // Xanh hoặc Xám
      const borderClass = isOwner ? "#1d4ed8" : "#495057";
      const eventDiv = document.createElement("div");
      eventDiv.className = "personal-event text-white rounded p-1 small";
      Object.assign(eventDiv.style, {
          position: "absolute", top: top + "px", height: Math.max(height, 25) + "px",
          left: "4px", right: "4px", 
          background: bgClass, overflow: "hidden", zIndex: "10"
      });

      // Nội dung thẻ
      eventDiv.innerHTML = `
        <div class="fw-bold text-truncate">${b.title}</div>
        <div class="text-truncate" style="font-size:10px; opacity:0.9">${b.room_name}</div>
      `;
      
      // Sự kiện click -> Mở Modal (để xem chi tiết hoặc tạo văn bản)
      eventDiv.onclick = () => openEditModal(b.id);
      
      // Tooltip
      new bootstrap.Tooltip(eventDiv, {
         title: `${b.title} (${b.room_name})`, placement: 'top'
      });

      dayEl.appendChild(eventDiv);
    });

  } catch (err) {
    console.error("Lỗi render lịch tuần:", err);
  }
}

// ==========================================
// ✏️ MODAL EDIT & ACTIONS
// ==========================================

// ✏️ MODAL EDIT & ACTIONS (ĐÃ THÊM LOGIC PHÂN QUYỀN)
async function openEditModal(bookingId) {
  try {
    const currentUserId = localStorage.getItem('id');

    // 1. Fetch dữ liệu chi tiết
    const res = await fetch(`/api/bookings/${bookingId}/detail`);
    if (!res.ok) throw new Error('Lỗi tải dữ liệu');
    const booking = await res.json();

    // 2. KIỂM TRA QUYỀN SỞ HỮU
    // So sánh ID người tạo cuộc họp với ID người đang đăng nhập
    const isOwner = String(booking.user_id) === String(currentUserId);

    // 3. Xử lý giao diện Modal dựa trên quyền
    const modalTitle = document.getElementById('editBookingLabel');
    const btnSave = document.querySelector('#editBookingForm button[type="submit"]');
    const form = document.getElementById('editBookingForm');
    
    // Lấy tất cả input/select trong form
    const inputs = form.querySelectorAll('input, select, textarea');

    if (isOwner) {
        // === LÀ CHỦ SỞ HỮU ===
        modalTitle.textContent = 'Chỉnh sửa cuộc họp';
        modalTitle.className = 'modal-title text-primary fw-bold';
        
        // Hiện nút Lưu
        if(btnSave) btnSave.style.display = 'block';

        // Mở khóa các ô nhập liệu
        inputs.forEach(el => el.disabled = false);
        if (teamSelectTom) teamSelectTom.unlock();
        if (participantSelectTom) participantSelectTom.unlock();

    } else {
        // === KHÁCH MỜI (CHỈ XEM) ===
        modalTitle.innerHTML = '<i class="bi bi-eye"></i> Chi tiết cuộc họp (Chỉ xem)';
        modalTitle.className = 'modal-title text-secondary';

        // Ẩn nút Lưu (Quan trọng nhất)
        if(btnSave) btnSave.style.display = 'none';

        // Khóa tất cả ô nhập liệu (Read-only)
        inputs.forEach(el => el.disabled = true);
        
        // Khóa TomSelect (Thư viện này cần lệnh riêng)
        if (teamSelectTom) teamSelectTom.lock();
        if (participantSelectTom) participantSelectTom.lock();
    }

    // 4. Fill dữ liệu vào Form (Code cũ)
    document.getElementById('editBookingId').value = booking.id;
    document.getElementById('editTitle').value = booking.title || '';
    document.getElementById('editRoom').value = String(booking.room_id ?? '');
    
    // Format ngày giờ hiển thị
    document.getElementById('editStart').value = formatLocalDatetime(booking.start_time);
    document.getElementById('editEnd').value = formatLocalDatetime(booking.end_time);

    // Fill TomSelect
    if (teamSelectTom) {
        teamSelectTom.clear();
        if (booking.teams && booking.teams.length) {
            teamSelectTom.setValue(booking.teams.map(t => String(t.id ?? t)));
        }
    }
    if (participantSelectTom) {
        participantSelectTom.clear();
        if (booking.participants && booking.participants.length) {
            participantSelectTom.setValue(booking.participants.map(p => String(p.user_id ?? p.id ?? p)));
        }
    }

    // 5. NÚT "LẬP VĂN BẢN" (Vẫn hiện cho cả khách mời - Tùy nghiệp vụ của bạn)
    // Thường thư ký (người tham gia) vẫn cần tạo biên bản họp thay sếp
    const btnCreate = document.getElementById('btnCreateDocSchedule');
    if (btnCreate) {
        if (canCreateDocument(booking.start_time)) {
            btnCreate.style.display = 'inline-flex';
            btnCreate.href = `documents.html?create_from_booking=${booking.id}`;
        } else {
            btnCreate.style.display = 'none';
        }
    }

    new bootstrap.Modal(document.getElementById('editBookingModal')).show();

  } catch (err) {
    alert('Không thể tải thông tin cuộc họp.');
    console.error(err);
  }
}
// Xóa booking
async function deleteBooking(id) {
    if (!confirm('Xác nhận xóa cuộc họp này?')) return;
    try {
        await api('/bookings/' + id, { method: 'DELETE' });
        await renderBookings();
        await renderWeeklySchedule();
    } catch (e) { alert('Lỗi xóa: ' + e.message); }
}

// Submit Form Update
document.getElementById('editBookingForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editBookingId').value;
  // ... (giữ nguyên logic lấy value từ form của bạn) ...
  const title = document.getElementById('editTitle').value.trim();
  const room_id = document.getElementById('editRoom').value;
  const start_time = new Date(document.getElementById('editStart').value).toISOString();
  const end_time = new Date(document.getElementById('editEnd').value).toISOString();
  
  const teams = teamSelectTom ? teamSelectTom.getValue() : [];
  const participants = participantSelectTom ? participantSelectTom.getValue() : [];

  try {
    await api(`/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, room_id, start_time, end_time, teams, participants })
    });
    
    bootstrap.Modal.getInstance(document.getElementById('editBookingModal')).hide();
    alert('Cập nhật thành công!');
    await renderBookings();
    await renderWeeklySchedule();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
});

// Sự kiện đổi filter
document.getElementById('viewDate').addEventListener('change', renderBookings);
document.getElementById('roomFilter').addEventListener('change', renderBookings);

// Khởi chạy
(async () => {
  await load();
})();