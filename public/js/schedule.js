async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function load() {
  // Lấy danh sách phòng để hiển thị filter
  const rooms = await api('/rooms');
  const roomFilter = document.getElementById('roomFilter');
  roomFilter.innerHTML = '<option value="">-- Tất cả phòng --</option>';
  rooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    roomFilter.appendChild(opt);
  });

  // Mặc định hiển thị lịch của ngày hôm nay
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('viewDate').value = today;
  await renderBookings();
}

async function renderBookings() {
  const date = document.getElementById('viewDate').value;
  const room_id = document.getElementById('roomFilter').value;
  const q = new URLSearchParams();
  if (room_id) q.set('room_id', room_id);
  if (date) q.set('date', date);

  const rows = await api('/bookings?' + q.toString());
  console.log('Bookings:', rows); // kiểm tra dữ liệu

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
    };

    card.appendChild(del);
    div.appendChild(card);
  });
}

// Event listener khi thay đổi bộ lọc
document.getElementById('viewDate').addEventListener('change', renderBookings);
document.getElementById('roomFilter').addEventListener('change', renderBookings);

// Khởi chạy
load();
