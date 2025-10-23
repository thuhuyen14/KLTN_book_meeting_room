// --- Hàm fetch API ---
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// --- Load danh sách phòng ---
async function loadRooms() {
  const rooms = await api('/rooms');
  const el = document.getElementById('roomsAdmin');
  el.innerHTML = '';

  rooms.forEach(r => {
    const col = document.createElement('div');
    col.className = 'col-md-4';
    col.innerHTML = `
      <div class="card p-2">
        <img src="${r.image}" class="img-fluid" style="height:200px;object-fit:cover"/>
        <h5>${r.name}</h5>
        <p>${r.room_description || ''}</p>
        <button class="btn btn-sm btn-warning mt-2 edit-room-btn" 
          data-id="${r.id}" 
          data-name="${r.name}" 
          data-image="${r.image}"
          data-room-type-id="${r.room_type_id || ''}"
          data-location-id="${r.location_id || ''}">Sửa</button>
        <button class="btn btn-sm btn-danger mt-2 delete-room-btn" data-id="${r.id}">Xóa</button>
      </div>
    `;
    el.appendChild(col);
  });
}

// --- Load danh sách nhân viên ---
async function loadUsers() {
  const users = await api('/users');
  const el = document.getElementById('usersAdmin');
  el.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'table table-striped';
  table.innerHTML = `
      <thead>
          <tr>
              <th>ID</th>
              <th>Họ & tên</th>
              <th>Email</th>
              <th>Phòng ban</th>
              <th>Chức vụ</th>
              <th>Chi nhánh</th>
          </tr>
      </thead>
      <tbody></tbody>
  `;
  el.appendChild(table);

  const tbody = table.querySelector('tbody');
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.full_name || ''}</td>
        <td>${u.email || ''}</td>
        <td>${u.department || ''}</td>
        <td>${u.job_title || ''}</td>
        <td>${u.branch_name || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Load loại phòng ---
async function loadRoomTypes(selectId) {
  try {
    const roomTypes = await api('/room_types');
    console.log('roomTypes', roomTypes);
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- Chọn loại phòng --</option>';
    roomTypes.forEach(rt => {
      const opt = document.createElement('option');
      opt.value = rt.id;
      opt.textContent = rt.description;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Lỗi load loại phòng:', err);
  }
}

// --- Load location ---
async function loadLocations(selectId) {
  try {
    const locations = await api('/locations');
    console.log('locations', locations);
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- Chọn tầng & chi nhánh --</option>';
    locations.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = `Tầng ${l.floor} - ${l.branch_name}`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Lỗi load locations:', err);
  }
}

// --- Mở modal thêm phòng ---
document.getElementById('addRoomBtn').addEventListener('click', async () => {
  await loadRoomTypes('newRoomType');
  await loadLocations('newRoomLocation');
  const modal = new bootstrap.Modal(document.getElementById('addRoomModal'));
  modal.show();
});

// --- Lưu phòng mới ---
document.getElementById('createRoomBtn').addEventListener('click', async () => {
  const id = document.getElementById('newRoomId').value.trim();
  const name = document.getElementById('newRoomName').value.trim();
  const room_type_id = document.getElementById('newRoomType').value;
  const location_id = document.getElementById('newRoomLocation').value;
  const image = document.getElementById('newRoomImage').value.trim();

  if (!id || !name || !room_type_id || !location_id) {
    alert('Vui lòng nhập đầy đủ thông tin!');
    return;
  }

  try {
    await api('/rooms', {
      method: 'POST',
      body: JSON.stringify({ id, name, room_type_id, location_id, image })
    });
    alert('Đã thêm phòng mới!');
    loadRooms();
    bootstrap.Modal.getInstance(document.getElementById('addRoomModal')).hide();

    // Reset form
    document.getElementById('newRoomId').value = '';
    document.getElementById('newRoomName').value = '';
    document.getElementById('newRoomType').value = '';
    document.getElementById('newRoomLocation').value = '';
    document.getElementById('newRoomImage').value = '';
  } catch (err) {
    alert('Lỗi khi thêm phòng: ' + err.message);
  }
});

// --- Mở modal sửa phòng ---
document.addEventListener('click', async e => {
  if (e.target.classList.contains('edit-room-btn')) {
    const id = e.target.dataset.id;
    const name = e.target.dataset.name;
    const image = e.target.dataset.image;
    const room_type_id = e.target.dataset.roomTypeId;
    const location_id = e.target.dataset.locationId;

    await loadRoomTypes('editRoomType');
    await loadLocations('editRoomLocation');

    document.getElementById('editRoomId').value = id;
    document.getElementById('editRoomName').value = name;
    document.getElementById('editRoomImage').value = image;
    document.getElementById('editRoomType').value = room_type_id || '';
    document.getElementById('editRoomLocation').value = location_id || '';

    const modal = new bootstrap.Modal(document.getElementById('editRoomModal'));
    modal.show();
  }
});

// --- Lưu thay đổi phòng ---
document.getElementById('saveRoomBtn').addEventListener('click', async () => {
  const id = document.getElementById('editRoomId').value;
  const name = document.getElementById('editRoomName').value;
  const image = document.getElementById('editRoomImage').value;
  const room_type_id = document.getElementById('editRoomType').value;
  const location_id = document.getElementById('editRoomLocation').value;

  try {
    await api(`/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, image, room_type_id, location_id })
    });
    alert('Đã cập nhật phòng!');
    loadRooms();
    bootstrap.Modal.getInstance(document.getElementById('editRoomModal')).hide();
  } catch (err) {
    alert('Lỗi khi cập nhật: ' + err.message);
  }
});

// --- Xóa phòng ---
document.addEventListener('click', async e => {
  if (e.target.classList.contains('delete-room-btn')) {
    const id = e.target.dataset.id;
    if (!confirm('Bạn có chắc muốn xóa phòng này không?')) return;

    try {
      await api(`/rooms/${id}`, { method: 'DELETE' });
      alert('Đã xóa phòng!');
      loadRooms();
    } catch (err) {
      alert('Lỗi khi xóa: ' + err.message);
    }
  }
});

// --- Load dữ liệu khi mở trang ---
document.addEventListener('DOMContentLoaded', () => {
  loadRooms();
  loadUsers();
});
