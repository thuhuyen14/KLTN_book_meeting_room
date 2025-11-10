let USERS = [];
let usersState = { page: 1, perPage: 10, q: '', team:'' };

async function loadUsers() {
  USERS = await api('/users');
  renderUsers();
  const teams = await loadListCached('teams', '/teams');
  fillSelect(document.getElementById('filter-team'), teams, i=>i.id, i=>i.name, true);
}
// function getUserAvatar(user) {
//   if (user.avatar_url) return user.avatar_url; // dùng avatar thật nếu có

//   const initial = (user.full_name || '?').trim().charAt(0).toUpperCase();

//   // SVG có chữ cái đầu
//   const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
//     <rect width="100%" height="100%" fill="#6c757d"/>
//     <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
//       font-family="Arial, sans-serif" font-size="20" fill="#fff">${initial}</text>
//   </svg>`;

//   // Chuyển SVG sang base64 an toàn cho Unicode (bỏ btoa)
//   const base64 = window.btoa(unescape(encodeURIComponent(svg)));

//   return `data:image/svg+xml;base64,${base64}`;
// }

// Hàm lấy avatar người dùng, nếu không có thì tạo avatar chữ cái đầu - version có màu ở avatar 
function getUserAvatar(user) {
  if (user.avatar_url && user.avatar_url.trim() !== '') return user.avatar_url;

  const name = user.full_name || '?';
  const initial = encodeURIComponent(name.trim()[0].toUpperCase());

  // Dùng ui-avatars.com để sinh avatar màu ngẫu nhiên
  return `https://ui-avatars.com/api/?name=${initial}&background=random&color=fff&size=40`;
}



function renderUsers() {
  const q = (document.getElementById('users-search').value || '').toLowerCase();
  usersState.q = q;
  usersState.team = document.getElementById('filter-team').value;
  usersState.perPage = parseInt(document.getElementById('users-per-page').value || 10, 10);

  let filtered = USERS.filter(u => {
    if (usersState.team && u.team !== usersState.team && u.team_id !== usersState.team) return false;
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
      <td><img src="${getUserAvatar(u)}" class="avatar-sm" /></td>
      <td class="fw-semibold">${u.id}</td>
      <td><strong>${u.full_name||''}</strong></td>
      <td>${u.email||''}</td>
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
  document.querySelectorAll('.edit-user').forEach(b =>
    b.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      const userId = btn ? btn.dataset.id : null;
      console.log('DEBUG: clicked edit user, id =', userId);
      if (!userId) {
        console.warn('User ID không hợp lệ');
        return;
      }
      openUserModal(userId).catch(err => console.error('openUserModal lỗi:', err));
    })
  );
  document.querySelectorAll('.delete-user').forEach(b => b.addEventListener('click', (e)=> askDelete('user', e.target.closest('button').dataset.id)));
  document.querySelectorAll('.reset-user').forEach(b => b.addEventListener('click', (e)=> openResetModal(e.target.closest('button').dataset.id)));
}

document.getElementById('btn-create-user').addEventListener('click', async ()=>{
  document.getElementById('modalUserTitle').textContent = 'Thêm nhân viên mới';
  ['user_id','user_code','user_username','user_password','user_fullname','user_email','user_phone','user_dob','user_avatar']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('user_role').value = 'user';
  const teams = await loadListCached('teams', '/teams');
  fillSelect(document.getElementById('user_team'), teams);
  new bootstrap.Modal(document.getElementById('modalUser')).show();
});

async function openUserModal(id) {
  const u = await api(`/users/${id}`);
  document.getElementById('modalUserTitle').textContent = `Sửa nhân viên ${u.id || ''}`;
  document.getElementById('user_id').value = u.id;
  document.getElementById('user_code').value = u.id;
  document.getElementById('user_username').value = u.username || '';
  document.getElementById('user_fullname').value = u.full_name || '';
  document.getElementById('user_email').value = u.email || '';
  document.getElementById('user_phone').value = u.phone || '';
  document.getElementById('user_dob').value = u.date_of_birth ? u.date_of_birth.split('T')[0] : '';
  document.getElementById('user_avatar').value = u.avatar_url || '';
  document.getElementById('user_role').value = u.role_id || 'user';
  const teams = await loadListCached('teams', '/teams');
  fillSelect(document.getElementById('user_team'), teams);
  document.getElementById('user_team').value = u.team_id || '';
  new bootstrap.Modal(document.getElementById('modalUser')).show();
}

document.getElementById('saveUser').addEventListener('click', async () => {
  const id = document.getElementById('user_id').value.trim();
  const payloadUser = {
    id: document.getElementById('user_code').value.trim(),
    username: document.getElementById('user_username').value.trim(),
    password: document.getElementById('user_password').value,
    role_id: document.getElementById('user_role').value
  };
  const payloadProfile = {
    full_name: document.getElementById('user_fullname').value.trim(),
    email: document.getElementById('user_email').value.trim(),
    phone: document.getElementById('user_phone').value.trim(),
    avatar_url: document.getElementById('user_avatar').value.trim(),
    date_of_birth: document.getElementById('user_dob').value || null
  };
  const associations = { team_id: document.getElementById('user_team').value || null };

  try {
    if (!payloadUser.id || !payloadUser.username || !payloadProfile.full_name || !payloadProfile.email) {
      alert('Vui lòng nhập ID, username, họ tên và email');
      return;
    }

    if (id) {
      await api(`/users/${id}`, { method:'PUT', body: JSON.stringify({ user: payloadUser, profile: payloadProfile, associations }) });
      alert('Cập nhật nhân viên thành công');
    } else {
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

/* reset password */
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
    alert(`Mật khẩu mới: ${res.new_password}\nHãy gửi mật khẩu này cho người dùng.`);
    loadUsers();
    pendingResetUserId = null;
    bootstrap.Modal.getInstance(document.getElementById('resetPassModal')).hide();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
});

document.getElementById('users-search').addEventListener('input', ()=> { usersState.page = 1; renderUsers(); });
document.getElementById('filter-team').addEventListener('change', ()=> { usersState.page = 1; renderUsers(); });
document.getElementById('users-per-page').addEventListener('change', ()=> { usersState.page = 1; renderUsers(); });

document.addEventListener('DOMContentLoaded', loadUsers);
