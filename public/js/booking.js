async function api(path, opts = {}) {
    const res = await fetch('/api' + path, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// Load users vào dropdown
async function loadUsers() {
    const role = localStorage.getItem('role');
    const fullName = localStorage.getItem('full_name');
    const username = localStorage.getItem('username');
    const userSelect = document.getElementById('userSelect');

    // Nếu là user thường -> không cần fetch toàn bộ
    if (role === 'user') {
        // Tạo option duy nhất là chính user đó
        const opt = document.createElement('option');
        opt.value = localStorage.getItem('id');   // dùng id
        opt.textContent = fullName;
        userSelect.appendChild(opt);
        userSelect.disabled = true; // không cho sửa
        return;
    }

    // Nếu là admin -> load toàn bộ user từ API
    const users = await api('/users');
    users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id; // dùng id
        opt.textContent = `${u.name} - ${u.department}`;
        userSelect.appendChild(opt);
    });
    userSelect.disabled = false;
}


// Load phòng khả dụng dựa theo thời gian
async function loadAvailableRooms() {
    const startInput = document.getElementById('start').value;
    const endInput = document.getElementById('end').value;
    const roomSelect = document.getElementById('roomSelect');

    // Chỉ gọi API khi cả start và end đã nhập đầy đủ
    if (!startInput || !endInput) {
        roomSelect.innerHTML = '<option value="">Chọn thời gian trước để xem phòng trống</option>';
        return;
    }

    try {
        const res = await fetch(`/api/available?start=${encodeURIComponent(startInput)}&end=${encodeURIComponent(endInput)}`);
        if (!res.ok) throw new Error('Lỗi tải phòng trống');
        const rooms = await res.json();
        roomSelect.innerHTML = '';
        if (rooms.length === 0) {
            roomSelect.innerHTML = '<option value="">Không còn phòng trống</option>';
            return;
        }
        rooms.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name + ' (' + r.id + ') - ' + r.capacity + ' người';
            roomSelect.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
        roomSelect.innerHTML = '<option value="">Không tải được danh sách phòng trống</option>';
    }
}

// Handle submit form
async function handleBooking(e) {
    e.preventDefault();
    const room_id = document.getElementById('roomSelect').value;
    const title = document.getElementById('title').value;
    // const organizer = document.getElementById('userSelect').value;
    // const start_iso = document.getElementById('start').value;
    // const end_iso = document.getElementById('end').value;
    const result = document.getElementById('result');
    
    const role = localStorage.getItem('role');
    // 👉 Xác định organizer tùy theo role
    let organizer;
    if (role === 'user') {
        // Lấy id của người đăng nhập hiện tại
        organizer = localStorage.getItem('id');
    } else {
        organizer = document.getElementById('userSelect').value;
    }

    const start_iso = document.getElementById('start').value;
    const end_iso = document.getElementById('end').value;
    
    if (!organizer) {
    result.innerHTML = `<div class="alert alert-danger">Không xác định được người đặt phòng</div>`;
    return;
    }

    if (!room_id) {
        result.innerHTML = `<div class="alert alert-warning">Vui lòng chọn phòng trống</div>`;
        return;
    }
    // Validate thời gian
    if (new Date(start_iso) >= new Date(end_iso)) {
        result.innerHTML = `<div class="alert alert-warning">Thời gian kết thúc phải sau thời gian bắt đầu</div>`;
        return;
    }
    try {
        const res = await api('/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id, title, user_id: organizer, start_iso, end_iso })
        });
        if (res.success) {
            result.innerHTML = `<div class="https://www.facebook.com/messages/e2ee/t/7067015006693727/alert alert-success">Đặt phòng thành công: ${res.booking.title}</div>`;
            document.getElementById('bookForm').reset();
            document.getElementById('roomSelect').innerHTML = '<option value="">Chọn thời gian trước để xem phòng trống</option>';
        } else {
            result.innerHTML = `<div class="alert alert-danger">${res.error}</div>`;
        }
    } catch (err) {
        result.innerHTML =  `<div class="alert alert-danger">Lỗi server: ${err.message}</div>`;
        console.error(err);
    }
}

// Event listeners
document.getElementById('bookForm').addEventListener('submit', handleBooking);
document.getElementById('start').addEventListener('change', loadAvailableRooms);
document.getElementById('end').addEventListener('change', loadAvailableRooms);

// Load users khi mở form
loadUsers();
