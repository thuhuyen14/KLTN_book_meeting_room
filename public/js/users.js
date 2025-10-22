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
                // --- Điền select phòng ban và chi nhánh ---
        const deptSelect = document.getElementById('departmentFilter');
        const branchSelect = document.getElementById('branchFilter');
        const jobSelect = document.getElementById('jobTitleFilter');

        const departments = [...new Set(users.map(u => u.department).filter(Boolean))];
        const branches = [...new Set(users.map(u => u.branch_name).filter(Boolean))];
        const jobs = [...new Set(users.map(u => u.job_title).filter(Boolean))];

        deptSelect.innerHTML = '<option value="">-- Tất cả phòng ban --</option>';
        branchSelect.innerHTML = '<option value="">-- Tất cả chi nhánh --</option>';
        jobSelect.innerHTML = '<option value="">-- Tất cả chức vụ --</option>';

        departments.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            deptSelect.appendChild(opt);
        });
        branches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            branchSelect.appendChild(opt);
        });
        jobs.forEach(j => {
            const opt = document.createElement('option');
            opt.value = j; 
            opt.textContent = j; 
            jobSelect.appendChild(opt);
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
// // Tìm kiếm người dùng (không phân biệt dấu)
// document.getElementById('searchInput').addEventListener('input', function () {
//     const filter = removeVietnameseTones(this.value.toLowerCase());  // bỏ dấu từ input
//     const rows = document.querySelectorAll('#usersTable tbody tr');

//     rows.forEach(row => {
//         const name = row.children[1].textContent;
//         const normalizedName = removeVietnameseTones(name.toLowerCase()); // bỏ dấu tên trong bảng
//         if (normalizedName.includes(filter)) {
//             row.style.display = '';
//         } else {
//             row.style.display = 'none';
//         }
//     });
// });

// // Load khi mở trang
// loadUsers();


// Tìm kiếm người dùng (không phân biệt dấu) + filter phòng ban và chi nhánh
function applyUserFilter() {
    const nameFilter = removeVietnameseTones(document.getElementById('searchInput').value.toLowerCase());
    const deptFilter = document.getElementById('departmentFilter').value;
    const branchFilter = document.getElementById('branchFilter').value;
    const jobFilter = document.getElementById('jobTitleFilter').value;
    const rows = document.querySelectorAll('#usersTable tbody tr');

    rows.forEach(row => {
        const name = removeVietnameseTones(row.children[1].textContent.toLowerCase());
        const dept = row.children[3].textContent;
        const job = row.children[4].textContent;    // thêm dòng này
        const branch = row.children[5].textContent;

        const matchName = name.includes(nameFilter);
        const matchDept = !deptFilter || dept === deptFilter;
        const matchBranch = !branchFilter || branch === branchFilter;
        const matchJob = !jobFilter || job === jobFilter;

        row.style.display = (matchName && matchDept && matchBranch && matchJob) ? '' : 'none';
    });

}

// realtime khi gõ tên, không cần ấn button Tìm kiếm
document.getElementById('searchInput').addEventListener('input', applyUserFilter);
// realtime khi thay đổi select phòng ban hoặc chi nhánh
document.getElementById('departmentFilter').addEventListener('change', applyUserFilter);
document.getElementById('branchFilter').addEventListener('change', applyUserFilter);
document.getElementById('jobTitleFilter').addEventListener('change', applyUserFilter);

// Load khi mở trang
loadUsers().then(applyUserFilter);

