async function api(path, opts = {}) {
    const res = await fetch('/api' + path, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// Load users vào dropdown
async function loadUsers() {
    const users = await api('/users');
    const userSelect = document.getElementById('userSelect');
    users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.name; // hoặc u.id nếu muốn lưu user_id
        opt.textContent = `${u.name} - ${u.department}`;
        userSelect.appendChild(opt);
    });
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
            opt.textContent = r.name + ' (' + r.code + ') - ' + r.capacity + ' người';
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
    const organizer = document.getElementById('userSelect').value;
    const start_iso = document.getElementById('start').value;
    const end_iso = document.getElementById('end').value;
    const result = document.getElementById('result');

    if (!room_id) {
        result.innerHTML = `<div class="alert alert-warning">Vui lòng chọn phòng trống</div>`;
        return;
    }

    try {
        const res = await api('/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id, title, organizer, start_iso, end_iso })
        });
        if (res.success) {
            result.innerHTML = `<div class="alert alert-success">Đặt phòng thành công: ${res.booking.title}</div>`;
            document.getElementById('bookForm').reset();
            document.getElementById('roomSelect').innerHTML = '<option value="">Chọn thời gian trước để xem phòng trống</option>';
        } else {
            result.innerHTML = `<div class="alert alert-danger">${res.error}</div>`;
        }
    } catch (err) {
        result.innerHTML = `<div class="alert alert-danger">Lỗi server</div>`;
        console.error(err);
    }
}

// Event listeners
document.getElementById('bookForm').addEventListener('submit', handleBooking);
document.getElementById('start').addEventListener('change', loadAvailableRooms);
document.getElementById('end').addEventListener('change', loadAvailableRooms);

// Load users khi mở form
loadUsers();
