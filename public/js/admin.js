
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || 'API error');
  }
  return res.json();
}

/* ---------- Utility: pagination & render helpers ---------- */
function paginate(items, page = 1, perPage = 10) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const offset = (page - 1) * perPage;
  return { page, perPage, total, pages, data: items.slice(offset, offset + perPage) };
}

function renderPagination(containerEl, pages, current, onClick) {
  containerEl.innerHTML = '';
  if (pages <= 1) return;
  for (let i = 1; i <= pages; i++) {
    const li = document.createElement('li');
    li.className = 'page-item' + (i === current ? ' active' : '');
    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    li.addEventListener('click', (e) => { e.preventDefault(); onClick(i); });
    containerEl.appendChild(li);
  }
}

/* ---------- Load supporting lists (teams, depts, job titles, branches, room types/locations) ---------- */
let CACHE = {};
async function loadListCached(key, path) {
  if (CACHE[key]) return CACHE[key];
  const list = await api(path);
  CACHE[key] = list;
  return list;
}

/* populate select helper */
function fillSelect(selectEl, list, valueFn = (x)=>x.id, labelFn = (x)=>x.name, includeEmpty=true) {
  selectEl.innerHTML = includeEmpty ? `<option value="">-- Chọn --</option>` : '';
  list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = valueFn(item);
    opt.textContent = labelFn(item);
    selectEl.appendChild(opt);
  });
}

/* ---------- ROOMS: load, search, pagination, CRUD ---------- */
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

  // attach events
  document.querySelectorAll('.edit-room').forEach(b => b.addEventListener('click', (e)=> openRoomModal(e.target.closest('button').dataset.id)));
  document.querySelectorAll('.delete-room').forEach(b => b.addEventListener('click', (e)=> askDelete('room', e.target.closest('button').dataset.id)));
}

/* open add room modal */
document.getElementById('btn-create-room').addEventListener('click', async ()=> {
  document.getElementById('modalRoomTitle').textContent = 'Thêm phòng';
  document.getElementById('roomId').value = '';
  document.getElementById('room_code').value = '';
  document.getElementById('room_name').value = '';
  document.getElementById('room_capacity').value = '';
  document.getElementById('room_image').value = '';
  document.getElementById('room_description').value = '';
  await loadListCached('room_types', '/room_types').then(list => fillSelect(document.getElementById('room_type'), list, i=>i.id, i=>i.description));
  await loadListCached('locations', '/locations').then(list => fillSelect(document.getElementById('room_location'), list, i=>i.id, i=>`Tầng ${i.floor} - ${i.branch_name}`));
  new bootstrap.Modal(document.getElementById('modalRoom')).show();
});

/* open edit room */
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

/* save room (create or update) */
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

/* delete or confirm handler */
let pendingDelete = null;
function askDelete(type, id) {
  pendingDelete = { type, id };
  const text = type === 'room' ? `Bạn có chắc muốn xóa phòng ${id}?` : `Bạn có chắc muốn xóa nhân viên ${id}?`;
  document.getElementById('confirmDeleteText').textContent = text;
  new bootstrap.Modal(document.getElementById('confirmDeleteModal')).show();
}
document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  try {
    if (type === 'room') {
      await api(`/rooms/${id}`, { method:'DELETE' });
      alert('Đã xóa phòng');
      loadRooms();
    } else if (type === 'user') {
      await api(`/users/${id}`, { method:'DELETE' });
      alert('Đã xóa nhân viên');
      loadUsers();
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    pendingDelete = null;
    bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal')).hide();
  }
});

/* ---------- USERS: load, search, filters, pagination, CRUD ---------- */
let USERS = [];
let usersState = { page: 1, perPage: 10, q: '', team:'', dept:'' };

async function loadUsers() {
  USERS = await api('/users');
  renderUsers();
  // populate filters (teams, departments)
  const teams = await loadListCached('teams', '/teams');
  fillSelect(document.getElementById('filter-team'), teams, i=>i.id, i=>i.name, true);
  fillSelect(document.getElementById('filter-dept'), await loadListCached('departments', '/departments'), i=>i.id, i=>i.name, true);
  // also fill selects in modal
  const ts = document.getElementById('user_team'); fillSelect(ts, teams, i=>i.id, i=>i.name, true);
  fillSelect(document.getElementById('user_dept'), await loadListCached('departments', '/departments'));
  fillSelect(document.getElementById('user_job'), await loadListCached('job_titles', '/job_titles'));
  fillSelect(document.getElementById('user_branch'), await loadListCached('branches', '/branches'));
}

function renderUsers() {
  const q = (document.getElementById('users-search').value || '').toLowerCase();
  usersState.q = q;
  usersState.team = document.getElementById('filter-team').value;
  usersState.dept = document.getElementById('filter-dept').value;
  usersState.perPage = parseInt(document.getElementById('users-per-page').value || 10, 10);

  let filtered = USERS.filter(u => {
    if (usersState.team && u.team !== usersState.team && u.team_id !== usersState.team) return false;
    if (usersState.dept && u.department !== usersState.dept && u.department_id !== usersState.dept) return false;
    if (!q) return true;
    return (u.id && u.id.toLowerCase().includes(q)) ||
           (u.full_name && u.full_name.toLowerCase().includes(q)) ||
           (u.email && u.email.toLowerCase().includes(q));
  });

  const p = paginate(filtered, usersState.page, usersState.perPage);
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';

  p.data.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${u.avatar_url || 'images/avatar-placeholder.png'}" class="avatar-sm" /></td>
      <td class="fw-semibold">${u.id}</td>
      <td><div class="table-avatar"><div><strong>${u.full_name||''}</strong></div></td>
      <td><div class="truncate">${u.email||''}</div></td>
      <td>${u.team||''}</td>
      <td>${u.department||''}</td>
      <td>${u.job_title||''}</td>
      <td>${u.branch_name||''}</td>
      <td>${u.role_id||'user'}</td>
      <td>
        <button class="btn btn-sm btn-outline-info me-1 edit-user" data-id="${u.id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-warning me-1 reset-user" data-id="${u.id}"><i class="bi bi-key"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-user" data-id="${u.id}"><i class="bi bi-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('users-stats').textContent = `Hiển thị ${p.data.length}/${p.total} nhân viên`;
  renderPagination(document.getElementById('users-pagination'), p.pages, p.page, (page)=>{ usersState.page = page; renderUsers(); });

  document.querySelectorAll('.edit-user').forEach(b => b.addEventListener('click', (e)=> openUserModal(e.target.closest('button').dataset.id)));
  document.querySelectorAll('.delete-user').forEach(b => b.addEventListener('click', (e)=> askDelete('user', e.target.closest('button').dataset.id)));
  document.querySelectorAll('.reset-user').forEach(b => b.addEventListener('click', (e)=> openResetModal(e.target.closest('button').dataset.id)));
}

/* open add user */
document.getElementById('btn-create-user').addEventListener('click', async ()=>{
  document.getElementById('modalUserTitle').textContent = 'Thêm nhân viên mới';
  document.getElementById('user_id').value = '';
  document.getElementById('user_code').value = '';
  document.getElementById('user_username').value = '';
  document.getElementById('user_password').value = '';
  document.getElementById('user_fullname').value = '';
  document.getElementById('user_email').value = '';
  document.getElementById('user_phone').value = '';
  document.getElementById('user_dob').value = '';
  document.getElementById('user_avatar').value = '';
  document.getElementById('user_role').value = 'user';

  // fill selects
  const teams = await loadListCached('teams', '/teams');
  fillSelect(document.getElementById('user_team'), teams);
  fillSelect(document.getElementById('user_dept'), await loadListCached('departments', '/departments'));
  fillSelect(document.getElementById('user_job'), await loadListCached('job_titles', '/job_titles'));
  fillSelect(document.getElementById('user_branch'), await loadListCached('branches', '/branches'));
  new bootstrap.Modal(document.getElementById('modalUser')).show();
});

/* open edit user */
async function openUserModal(id) {
  const u = await api(`/users/${id}`);
  document.getElementById('modalUserTitle').textContent = `Sửa nhân viên ${u.id || ''}`;
  document.getElementById('user_id').value = u.id;
  document.getElementById('user_code').value = u.id;
  document.getElementById('user_username').value = u.username || '';
  // password left empty (not returned)
  document.getElementById('user_fullname').value = u.full_name || '';
  document.getElementById('user_email').value = u.email || '';
  document.getElementById('user_phone').value = u.phone || '';
  document.getElementById('user_dob').value = u.date_of_birth ? u.date_of_birth.split('T')[0] : '';
  document.getElementById('user_avatar').value = u.avatar_url || '';
  document.getElementById('user_role').value = u.role_id || 'user';

  // fill selects then set values
  const teams = await loadListCached('teams', '/teams'); fillSelect(document.getElementById('user_team'), teams);
  fillSelect(document.getElementById('user_dept'), await loadListCached('departments', '/departments'));
  fillSelect(document.getElementById('user_job'), await loadListCached('job_titles', '/job_titles'));
  fillSelect(document.getElementById('user_branch'), await loadListCached('branches', '/branches'));

  document.getElementById('user_team').value = u.team_id || '';
  document.getElementById('user_dept').value = u.department_id || '';
  document.getElementById('user_job').value = u.job_title_id || '';
  document.getElementById('user_branch').value = u.branch_id || '';
  new bootstrap.Modal(document.getElementById('modalUser')).show();
}

/* save user */
document.getElementById('saveUser').addEventListener('click', async () => {
  const id = document.getElementById('user_id').value.trim();
  const payloadUser = {
    id: document.getElementById('user_code').value.trim(),
    username: document.getElementById('user_username').value.trim(),
    password: document.getElementById('user_password').value, // optional for create
    role_id: document.getElementById('user_role').value
  };
  const payloadProfile = {
    full_name: document.getElementById('user_fullname').value.trim(),
    email: document.getElementById('user_email').value.trim(),
    phone: document.getElementById('user_phone').value.trim(),
    avatar_url: document.getElementById('user_avatar').value.trim(),
    date_of_birth: document.getElementById('user_dob').value || null,
    branch_id: document.getElementById('user_branch').value || null
  };

  const associations = {
    department_id: document.getElementById('user_dept').value || null,
    team_id: document.getElementById('user_team').value || null,
    job_title_id: document.getElementById('user_job').value || null
  };

  try {
    if (!payloadUser.id || !payloadUser.username || !payloadProfile.full_name || !payloadProfile.email) {
      alert('Vui lòng nhập ID, username, họ tên và email');
      return;
    }

    if (id) {
      // update user (username, role) and profile & associations
      await api(`/users/${id}`, { method:'PUT', body: JSON.stringify({ user: payloadUser, profile: payloadProfile, associations }) });
      alert('Cập nhật nhân viên thành công');
    } else {
      // create: password required
      if (!payloadUser.password) { alert('Vui lòng đặt mật khẩu cho tài khoản mới'); return; }
      await api('/users', { method:'POST', body: JSON.stringify({ user: payloadUser, profile: payloadProfile, associations }) });
      alert('Tạo nhân viên thành công');
    }
    loadUsers();
    bootstrap.Modal.getInstance(document.getElementById('modalUser')).hide();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
});

/* reset password flow */
let pendingResetUserId = null;
function openResetModal(userId) {
  pendingResetUserId = userId;
  document.getElementById('resetPasswordInput').value = '';
  new bootstrap.Modal(document.getElementById('resetPassModal')).show();
}
document.getElementById('confirmResetPassBtn').addEventListener('click', async () => {
  const newPass = document.getElementById('resetPasswordInput').value.trim() || '123456';
  if (!pendingResetUserId) return;
  try {
    const res = await api(`/users/${pendingResetUserId}/reset-password`, { method:'PUT', body: JSON.stringify({ new_password: newPass }) });
    // res should return { success: true, new_password: '...' }
    alert(`Mật khẩu mới: ${res.new_password}\nHãy gửi mật khẩu này cho người dùng (hiển thị 1 lần).`);
    loadUsers();
    pendingResetUserId = null;
    bootstrap.Modal.getInstance(document.getElementById('resetPassModal')).hide();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
});

/* ---------- Event bindings: search / filters / pagination controls ---------- */
document.getElementById('rooms-search').addEventListener('input', ()=> { roomsState.page = 1; renderRooms(); });
document.getElementById('rooms-per-page').addEventListener('change', ()=> { roomsState.page = 1; renderRooms(); });

document.getElementById('users-search').addEventListener('input', ()=> { usersState.page = 1; renderUsers(); });
document.getElementById('filter-team').addEventListener('change', ()=> { usersState.page = 1; renderUsers(); });
document.getElementById('filter-dept').addEventListener('change', ()=> { usersState.page = 1; renderUsers(); });
document.getElementById('users-per-page').addEventListener('change', ()=> { usersState.page = 1; renderUsers(); });

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await Promise.all([ loadListCached('teams','/teams'), loadListCached('departments','/departments'), loadListCached('job_titles','/job_titles'), loadListCached('branches','/branches'), loadListCached('room_types','/room_types'), loadListCached('locations','/locations') ]);
  } catch(e) { /* ignore populate errors */ }
  await loadRooms();
  await loadUsers();
});
