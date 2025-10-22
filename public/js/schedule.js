async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function load() {
  const rooms = await api('/rooms');
  const roomFilter = document.getElementById('roomFilter');
  roomFilter.innerHTML = '<option value="">-- Tất cả phòng --</option>';
  rooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    roomFilter.appendChild(opt);
  });

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('viewDate').value = today;

  await renderBookings();
  await renderWeeklySchedule();
}

async function renderBookings() {
  const date = document.getElementById('viewDate').value;
  const room_id = document.getElementById('roomFilter').value;
  const q = new URLSearchParams();
  if (room_id) q.set('room_id', room_id);
  if (date) q.set('date', date);

  const rows = await api('/bookings?' + q.toString());
  const div = document.getElementById('bookings');
  div.innerHTML = '';

  if (rows.length === 0) {
    div.innerHTML = '<div class="alert alert-info">Không có lịch</div>';
    return;
  }

  rows.forEach(b => {
    const card = document.createElement('div');
    card.className = 'card mb-2 p-2';
    card.innerHTML = `
      <strong>${b.title}</strong>
      <div class="text-muted">
        ${b.room_name} — ${new Date(b.start_time).toLocaleString()} → ${new Date(b.end_time).toLocaleString()} — ${b.booked_by}
      </div>
    `;

    const del = document.createElement('button');
    del.className = 'btn btn-sm btn-outline-danger mt-2';
    del.textContent = 'Xóa';
    del.onclick = async () => {
      if (!confirm('Xác nhận xóa?')) return;
      await fetch('/api/bookings/' + b.id, { method: 'DELETE' });
      await renderBookings();
      await renderWeeklySchedule();
    };

    card.appendChild(del);
    div.appendChild(card);
  });
}
async function renderWeeklySchedule() {
  const userId = localStorage.getItem('id');
  if (!userId) return;

  const container = document.getElementById("personalSchedule");
  if (!container) return;

  container.innerHTML = '';

  try {
    // Lấy toàn bộ lịch trong tháng hiện tại
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    console.log("📅 Fetch bookings for:", start.toISOString(), "→", end.toISOString());
    console.log("👤 userId:", userId);

    const bookings = await api(`/bookings/personal/${userId}?start=${start.toISOString()}&end=${end.toISOString()}`);
    console.log("📅 Booking data nhận được từ API:", bookings);

    if (!Array.isArray(bookings) || bookings.length === 0) {
      console.warn("⚠️ Không có dữ liệu cuộc họp nào được trả về từ API!");
    }

    // Cấu hình khung thời gian hiển thị (8h đến 18h)
    const dayStart = 8;
    const dayEnd = 18;
    const containerHeight = 500;
    const hourHeight = containerHeight / (dayEnd - dayStart);

    // CSS cho container dạng timeline cuộn ngang
    container.style.overflowX = "auto";
    container.style.whiteSpace = "nowrap";
    container.style.position = "relative";
    container.style.height = containerHeight + "px";
    container.style.border = "1px solid #ccc";
    container.style.display = "flex";
    container.style.background = "#fff";

    // Tạo cột cho từng ngày trong tháng
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayDiv = document.createElement("div");
      dayDiv.className = "day-column";
      dayDiv.style.flex = "0 0 150px";
      dayDiv.style.borderRight = "1px solid #eee";
      dayDiv.style.position = "relative";
      dayDiv.style.height = "100%";
      dayDiv.style.boxSizing = "border-box";
      dayDiv.style.padding = "2px";
      dayDiv.innerHTML = `
        <div class="text-center fw-bold border-bottom small" style="background:#f8f9fa">
          ${d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
        </div>
      `;
      days.push({ date: new Date(d), element: dayDiv });
      container.appendChild(dayDiv);
    }

    // Vẽ cột giờ cố định bên trái
    const hourLabels = document.createElement("div");
    hourLabels.style.position = "absolute";
    hourLabels.style.left = "0";
    hourLabels.style.top = "0";
    hourLabels.style.height = "100%";
    hourLabels.style.width = "50px";
    hourLabels.style.background = "#f9f9f9";
    hourLabels.style.borderRight = "1px solid #ddd";
    hourLabels.style.zIndex = "10";

    for (let h = dayStart; h <= dayEnd; h++) {
      const label = document.createElement("div");
      label.style.position = "absolute";
      label.style.top = (h - dayStart) * hourHeight - 6 + "px";
      label.style.fontSize = "0.75rem";
      label.style.color = "#555";
      label.textContent = `${h}:00`;
      hourLabels.appendChild(label);
    }

    container.prepend(hourLabels);

    // Vẽ các sự kiện (event)
    bookings.forEach(b => {
      const startTime = new Date(b.start_time);
      const endTime = new Date(b.end_time);

      // tìm cột tương ứng với ngày event theo local timezone
      const eventDay = days.find(d => {
        const dayLocal = d.date.toLocaleDateString('vi-VN');
        const eventLocal = startTime.toLocaleDateString('vi-VN');
        return dayLocal === eventLocal;
      });
      if (!eventDay) return;

      const startHour = startTime.getHours() + startTime.getMinutes() / 60;
      const endHour = endTime.getHours() + endTime.getMinutes() / 60;
      // const roomName = b.room_name ? ` (${b.room_name})` : '';
      const eventDiv = document.createElement("div");
      eventDiv.className = "personal-event";
      eventDiv.style.position = "absolute";
      eventDiv.style.top = (startHour - dayStart) * hourHeight + "px";
      eventDiv.style.height = (endHour - startHour) * hourHeight + "px";
      eventDiv.style.left = "5px";
      eventDiv.style.right = "5px";
      eventDiv.style.width = "calc(100% - 10px)"; // để event chiếm hết cột
      eventDiv.style.backgroundColor = "#0d6efd";
      eventDiv.style.color = "white";
      eventDiv.style.borderRadius = "4px";
      eventDiv.style.fontSize = "0.8rem";
      eventDiv.style.padding = "2px 5px";
      eventDiv.style.overflow = "visible";
      eventDiv.style.textOverflow = "clip";
      eventDiv.style.whiteSpace = "normal"; // cho phép xuống dòng
      eventDiv.style.wordBreak = "break-word"; // ngắt từ nếu quá dài
      // eventDiv.title = `${b.title}\n${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}\n${b.room_name}`;
      // xóa eventDiv.title cũ
      // dùng Bootstrap Tooltip
      new bootstrap.Tooltip(eventDiv, {
          title: `
              <strong>${b.title}</strong><br>
              Phòng: ${b.room_name}<br>
              Thời gian: ${startTime.toLocaleTimeString()} → ${endTime.toLocaleTimeString()}
          `,
          placement: 'top',
          trigger: 'hover',
          container: 'body',
          html: true
      });
      eventDiv.textContent = `${b.title}\n - ${b.room_name}`;


      eventDay.element.appendChild(eventDiv);
    });

  } catch (err) {
    console.error("❌ Lỗi load lịch cá nhân:", err);
  }
}


// Giữ lại các phần event listener cũ
document.getElementById('viewDate').addEventListener('change', async () => {
  await renderBookings();
  await renderWeeklySchedule();
});
document.getElementById('roomFilter').addEventListener('change', renderBookings);

// Gọi khi load trang
load().then(renderWeeklySchedule);
