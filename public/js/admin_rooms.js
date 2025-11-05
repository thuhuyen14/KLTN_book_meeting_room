let ROOMS = [];
let roomsState = { page: 1, perPage: 10, q: '' };

async function loadRooms() {
  ROOMS = await api('/rooms');
  renderRooms();
}

function renderRooms() {
  const q = (document.getElementById('rooms-search').value || '').toLowerCase();
  roomsState.q = q;
  roomsState.perPage = parseInt(document.getElementById('rooms-per-page').value || 10, 10);
  let filtered = ROOMS.filter(r => {
    if (!q) return true;
    return (r.id && r.id.toLowerCase().includes(q)) ||
           (r.name && r.name.toLowerCase().includes(q)) ||
           (r.room_description && r.room_description.toLowerCase().includes(q));
  });
  const p = paginate(filtered, roomsState.page, roomsState.perPage);
  const tbody = document.querySelector('#roomsTable tbody');
  tbody.innerHTML = '';
  p.data.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-semibold">${r.id}</td>
      <td><img src="${r.image||'images/placeholder.png'}" class="avatar-sm" /></td>
      <td><div class="truncate">${r.name || ''}</div></td>
      <td>${r.room_description || ''}</td>
      <td>${r.location_name || ''}</td>
      <td>${r.capacity || ''}</td>
      <td>
        <button class="btn btn-sm btn-outline-info me-1 edit-room" data-id="${r.id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-room" data-id="${r.id}"><i class="bi bi-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('rooms-stats').textContent = `Hiển thị ${p.data.length}/${p.total} phòng`;
  renderPagination(document.getElementById('rooms-pagination'), p.pages, p.page, (page)=>{ roomsState.page = page; renderRooms(); });

  document.querySelectorAll('.edit-room').forEach(b => b.addEventListener('click', (e)=> openRoomModal(e.target.closest('button').dataset.id)));
  document.querySelectorAll('.delete-room').forEach(b => b.addEventListener('click', (e)=> askDelete('room', e.target.closest('button').dataset.id)));
}

document.getElementById('btn-create-room').addEventListener('click', async ()=> {
  document.getElementById('modalRoomTitle').textContent = 'Thêm phòng';
  ['roomId','room_code','room_name','room_capacity','room_image','room_description'].forEach(id => document.getElementById(id).value = '');
  await loadListCached('room_types', '/room_types').then(list => fillSelect(document.getElementById('room_type'), list, i=>i.id, i=>i.description));
  await loadListCached('locations', '/locations').then(list => fillSelect(document.getElementById('room_location'), list, i=>i.id, i=>`Tầng ${i.floor} - ${i.branch_name}`));
  new bootstrap.Modal(document.getElementById('modalRoom')).show();
});

async function openRoomModal(id) {
  const r = await api(`/rooms/${id}`);
  document.getElementById('modalRoomTitle').textContent = `Sửa phòng ${r.id}`;
  document.getElementById('roomId').value = r.id;
  document.getElementById('room_code').value = r.id;
  document.getElementById('room_name').value = r.name;
  document.getElementById('room_capacity').value = r.capacity || '';
  document.getElementById('room_image').value = r.image || '';
  document.getElementById('room_description').value = r.room_description || '';
  await loadListCached('room_types', '/room_types').then(list => fillSelect(document.getElementById('room_type'), list, i=>i.id, i=>i.description));
  await loadListCached('locations', '/locations').then(list => fillSelect(document.getElementById('room_location'), list, i=>i.id, i=>`Tầng ${i.floor} - ${i.branch_name}`));
  document.getElementById('room_type').value = r.room_type_id || '';
  document.getElementById('room_location').value = r.location_id || '';
  new bootstrap.Modal(document.getElementById('modalRoom')).show();
}

document.getElementById('saveRoom').addEventListener('click', async () => {
  const id = document.getElementById('roomId').value.trim();
  const payload = {
    id: document.getElementById('room_code').value.trim(),
    name: document.getElementById('room_name').value.trim(),
    room_type_id: document.getElementById('room_type').value || null,
    location_id: document.getElementById('room_location').value || null,
    capacity: parseInt(document.getElementById('room_capacity').value || 0, 10),
    image: document.getElementById('room_image').value.trim(),
    room_description: document.getElementById('room_description').value.trim()
  };
  try {
    if (!payload.id || !payload.name) { alert('Mã và tên phòng bắt buộc'); return; }
    if (id) {
      await api(`/rooms/${id}`, { method:'PUT', body: JSON.stringify(payload) });
      alert('Cập nhật phòng thành công');
    } else {
      await api('/rooms', { method:'POST', body: JSON.stringify(payload) });
      alert('Thêm phòng thành công');
    }
    loadRooms();
    bootstrap.Modal.getInstance(document.getElementById('modalRoom')).hide();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
});

document.getElementById('rooms-search').addEventListener('input', ()=> { roomsState.page = 1; renderRooms(); });
document.getElementById('rooms-per-page').addEventListener('change', ()=> { roomsState.page = 1; renderRooms(); });

document.addEventListener('DOMContentLoaded', loadRooms);