// Biến lưu data gốc
let allUsersData = [];

async function api(path, opts = {}) {
    const res = await fetch('/api' + path, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

function removeVietnameseTones(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function getAvatarColor(char) {
    const colors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#6f42c1', '#20c9a6'];
    return colors[char.charCodeAt(0) % colors.length];
}

// ==========================================
// 1. TẢI VÀ RENDER DỮ LIỆU
// ==========================================
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>`;

    try {
        const users = await api('/users');
        allUsersData = users; // Lưu cache
        
        tbody.innerHTML = ''; 

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Không có dữ liệu nhân viên</td></tr>`;
            document.getElementById('totalCount').textContent = 0;
            return;
        }

        document.getElementById('totalCount').textContent = users.length;

        // Populate Dropdown Options
        populateFilters(users);

        // Render Rows
        users.forEach(u => {
            const fullName = u.full_name || 'Nhân viên';
            const names = fullName.trim().split(' ');
            const initial = names[names.length - 1].charAt(0).toUpperCase();
            const avatarColor = getAvatarColor(initial);

            const tr = document.createElement('tr');
            
            // Dataset phục vụ tìm kiếm
            tr.dataset.name = removeVietnameseTones(fullName.toLowerCase());
            tr.dataset.email = (u.email || '').toLowerCase();
            tr.dataset.dept = u.department || '';
            tr.dataset.branch = u.branch_name || '';
            tr.dataset.job = u.job_title || '';
            tr.dataset.id = String(u.id || '');

            tr.innerHTML = `
                <td class="ps-4">
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle me-3 flex-shrink-0 shadow-sm" 
                             style="background-color: ${avatarColor}">
                            ${initial}
                        </div>
                        <div>
                            <div class="fw-bold text-dark mb-0" style="font-size:0.95rem">${u.full_name}</div>
                            <div class="text-muted small">
                                <i class="bi bi-envelope-at"></i> ${u.email || 'N/A'}
                            </div>
                            <div class="text-muted small mt-1">
                                <span class="badge bg-light text-secondary border fw-normal">MNV: ${u.id}</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="fw-semibold text-primary" style="font-size:0.9rem">${u.job_title || 'N/A'}</div>
                    <div class="small text-muted">${u.department || 'Chưa cập nhật'}</div>
                </td>
                <td>
                    <div class="d-flex align-items-center text-secondary small">
                        <i class="bi bi-geo-alt-fill me-1 text-danger"></i> 
                        ${u.branch_name || 'N/A'}
                    </div>
                </td>
                <td>
                    ${u.team ? `<span class="badge bg-info bg-opacity-10 text-info border border-info-subtle px-2 py-1">${u.team}</span>` : '<span class="text-muted small">-</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center py-3">Không tải được dữ liệu</td></tr>`;
    }
}

// ==========================================
// 2. HỖ TRỢ FILTER (Tạo option cho select)
// ==========================================
function populateFilters(users) {
    const deptSelect = document.getElementById('departmentFilter');
    const branchSelect = document.getElementById('branchFilter');
    const jobSelect = document.getElementById('jobTitleFilter');

    const getUnique = (key) => [...new Set(users.map(u => u[key]).filter(Boolean))].sort();

    const addOpts = (select, items) => {
        const first = select.firstElementChild; 
        select.innerHTML = ''; 
        select.appendChild(first);
        items.forEach(i => select.add(new Option(i, i)));
    };

    addOpts(deptSelect, getUnique('department'));
    addOpts(branchSelect, getUnique('branch_name'));
    addOpts(jobSelect, getUnique('job_title'));
}

// ==========================================
// 3. LOGIC LỌC (REALTIME)
// ==========================================
function applyUserFilter() {
    const search = removeVietnameseTones(document.getElementById('searchInput').value.trim().toLowerCase());
    const dept = document.getElementById('departmentFilter').value;
    const branch = document.getElementById('branchFilter').value;
    const job = document.getElementById('jobTitleFilter').value;

    const rows = document.querySelectorAll('#usersTableBody tr');
    let count = 0;

    rows.forEach(row => {
        const d = row.dataset;
        // Logic tìm kiếm
        const matchSearch = !search || d.name.includes(search) || d.email.includes(search) || d.id.includes(search);
        const matchDept = !dept || d.dept === dept;
        const matchBranch = !branch || d.branch === branch;
        const matchJob = !job || d.job === job;

        if (matchSearch && matchDept && matchBranch && matchJob) {
            row.style.display = '';
            count++;
        } else {
            row.style.display = 'none';
        }
    });
    
    document.getElementById('totalCount').textContent = count;
}

// ==========================================
// 4. EVENTS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('input', applyUserFilter);
    document.getElementById('departmentFilter').addEventListener('change', applyUserFilter);
    document.getElementById('branchFilter').addEventListener('change', applyUserFilter);
    document.getElementById('jobTitleFilter').addEventListener('change', applyUserFilter);

    loadUsers();
});