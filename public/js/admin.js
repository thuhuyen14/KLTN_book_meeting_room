// --- Hàm fetch API ---
async function api(path, opts = {}) {
    const res = await fetch('/api' + path, opts);
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
                <img src="${r.image}" class="img-fluid"/>
                <h5>${r.name}</h5>
                <p>${r.room_description}</p>
                <button class="btn btn-sm btn-warning mt-2 edit-room-btn" data-id="${r.id}">Sửa</button>
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

    // tạo table
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

// --- Nút thêm phòng (demo) ---
document.getElementById('addRoomBtn').addEventListener('click', () => {
    alert('Chức năng thêm phòng sẽ mở rộng backend sau.');
});

// --- Load dữ liệu khi mở trang ---
document.addEventListener('DOMContentLoaded', () => {
    loadRooms();
    loadUsers();
});
