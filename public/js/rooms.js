async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function renderRooms() {
  const rooms = await api('/rooms');
  const container = document.getElementById('roomsGrid');
  container.innerHTML = '';
    rooms.forEach(r => {
        const col = document.createElement('div');
        col.className = 'col-md-4';
        col.innerHTML = `
  <div class="card shadow-sm">
          <img src="${r.image}?v=${Date.now()}" class="card-img-top" alt="${r.name}">
          <div class="card-body">
            <h5 class="card-title">${r.name}</h5>
            <p class="card-text">${r.room_description || ''}</p>
            <p><strong>Sức chứa:</strong> ${r.capacity} người</p>
            ${r.location_name ? `<p><strong>Vị trí:</strong> ${r.location_name}</p>` : ''}
      <a href="booking.html" class="btn btn-sm btn-primary">Đặt phòng</a>
      <button class="btn btn-sm btn-outline-secondary" onclick="showTimeline('${r.id}', '${r.name}')">Xem lịch</button>
      </div>
  </div>`;
        container.appendChild(col);
  });
}
async function showTimeline(roomId, roomName) {
  const modal = new bootstrap.Modal(document.getElementById('timelineModal'));
  const container = document.getElementById('timelineContainer');
  container.innerHTML = 'Đang tải...';

  try {
    const bookings = await api(`/bookings?room_id=${roomId}`);
    if (bookings.length === 0) {
      container.innerHTML = `<p>Chưa có lịch đặt nào cho phòng <strong>${roomName}</strong>.</p>`;
    } else {
      container.innerHTML = `
        <h6>Phòng: ${roomName}</h6>
        <ul class="list-group">
          ${bookings.map(b => `
            <li class="list-group-item">
              <strong>${b.title}</strong><br>
              ${new Date(b.start_time).toLocaleString()} - ${new Date(b.end_time).toLocaleString()}<br>
              <em>Người đặt: ${b.booked_by || 'N/A'}</em>
            </li>
          `).join('')}
        </ul>
      `;
    }
    modal.show();
  } catch (err) {
    container.innerHTML = `<p class="text-danger">Lỗi tải timeline</p>`;
    console.error(err);
  }
}
renderRooms();