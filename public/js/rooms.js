async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function renderRooms() {
  const rooms = await api('/rooms');
  const container = document.getElementById('roomsGrid');
  container.innerHTML = '';

  const userBranch = localStorage.getItem('branch_id'); // chi nhánh người dùng

  rooms.forEach(r => {
    const col = document.createElement('div');
    col.className = 'col-md-4';
    
    // Kiểm tra chi nhánh
    const disabled = String(r.branch_id) !== String(userBranch);

    col.innerHTML = `
      <div class="card shadow-sm">
        
        <!-- ẢNH + OVERLAY -->
        <div class="room-wrapper" data-room-id="${r.id}">
          <img src="${r.image}?v=${Date.now()}" class="card-img-top" alt="${r.name}">
          <div class="overlay">
            <i class="bi bi-search"></i>&nbsp; Xem chi tiết
          </div>
        </div>

        <div class="card-body">
          <h5 class="card-title">${r.name}</h5>
          <p class="card-text">${r.room_description || ''}</p>
          <p><strong>Sức chứa:</strong> ${r.capacity} người</p>
          ${r.location_name ? `<p><strong>Vị trí:</strong> ${r.location_name}</p>` : ''}

                    <a href="booking.html?room_id=${r.id}&room_name=${encodeURIComponent(`${r.name} - ${r.location_name} - ${r.capacity} người`)}"
             class="btn btn-sm btn-primary ${disabled ? 'disabled' : ''}" 
             ${disabled ? 'tabindex="-1" aria-disabled="true"' : ''}>
             Đặt phòng
          </a>
          <button class="btn btn-sm btn-outline-secondary" onclick="showTimeline('${r.id}', '${r.name}')">Xem lịch</button>
        </div>
      </div>
    `;
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
// CLICK ẢNH → Xem chi tiết phòng
document.addEventListener('click', async (e) => {
  const wrapper = e.target.closest('.room-wrapper');  
  if (!wrapper) return;
  const roomId = wrapper.dataset.roomId;
  openRoomDetail(roomId);
});

async function openRoomDetail(roomId) {
  // console.log("OPEN DETAIL RUNNING, roomId =", roomId);
  const container = document.getElementById('roomDetailContainer');
  container.innerHTML = 'Đang tải...';

  try {
    const room = await api(`/rooms/${roomId}`);
    // console.log("ROOM DATA =", room);

    // Tạo danh sách thiết bị HTML
    let equipmentHtml = '<ul>';
    if (room.equipment && room.equipment.length > 0) {
      room.equipment.forEach(e => {
        equipmentHtml += `<li>${e.name} (${e.quantity}): ${e.description}</li>`;
      });
    } else {
      equipmentHtml += '<li>Không có thiết bị</li>';
    }
    equipmentHtml += '</ul>';

    container.innerHTML = `
      <div class="row">
        <div class="col-md-5">
          <img src="${room.image}" class="img-fluid rounded" style="object-fit:cover;height:250px;">
        </div>

        <div class="col-md-7">
          <h4>${room.name}</h4>
          <p><strong>Mô tả:</strong> ${room.room_description || 'Không có mô tả'}</p>
          <p><strong>Sức chứa:</strong> ${room.capacity || '--'} người</p>
          <p><strong>Loại phòng:</strong> ${room.room_type || '--'}</p>
          ${room.location_name ? `<p><strong>Vị trí:</strong> ${room.location_name}</p>` : ''}
          <p><strong>Thiết bị:</strong>${equipmentHtml}</p>
        </div>
      </div>
    `;

    new bootstrap.Modal(document.getElementById('roomDetailModal')).show();

  } catch (err) {
    console.error("ROOM DETAIL ERROR:", err);
    container.innerHTML = `<p class="text-danger">Lỗi tải thông tin phòng.</p>`;
  }
}


renderRooms();