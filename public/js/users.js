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
                <td>${u.id}</td>
                <td>${u.full_name || ''}</td>
                <td>${u.email || ''}</td>
                <td>${u.department || ''}</td>
                <td>${u.job_title || ''}</td>
                <td>${u.branch_name || ''}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Lỗi load users:', err);
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Không tải được dữ liệu</td></tr>`;
    }
}
// Hàm bỏ dấu tiếng Việt
function removeVietnameseTones(str) {
    return str
        .normalize('NFD')                     // tách dấu khỏi ký tự
        .replace(/[\u0300-\u036f]/g, '')      // xóa dấu
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}
// Tìm kiếm người dùng (không phân biệt dấu)
document.getElementById('searchInput').addEventListener('input', function () {
    const filter = removeVietnameseTones(this.value.toLowerCase());  // bỏ dấu từ input
    const rows = document.querySelectorAll('#usersTable tbody tr');

    rows.forEach(row => {
        const name = row.children[1].textContent;
        const normalizedName = removeVietnameseTones(name.toLowerCase()); // bỏ dấu tên trong bảng
        if (normalizedName.includes(filter)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});

// Load khi mở trang
loadUsers();
