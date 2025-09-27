async function api(path, opts = {}) {
    const res = await fetch('/api' + path, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function loadUsers() {
    try {
        const users = await api('/users');
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.employee_id}</td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.department}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Lỗi load users:', err);
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = `<tr><td colspan="4" class="text-danger">Không tải được dữ liệu</td></tr>`;
    }
}

// Load khi mở trang
loadUsers();
