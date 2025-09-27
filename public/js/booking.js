async function api(path, opts = {}) {
    const res = await fetch('/api' + path, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
async function loadRooms() {
    const rooms = await api('/rooms');
    const sel = document.getElementById('roomSelect');
    sel.innerHTML = '';
    rooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name + ' (' + r.code + ') - ' + r.capacity + ' người';
        sel.appendChild(opt);
    });
}
// Load users vào dropdown
async function loadUsers() {
    const users = await api('/users');
    const userSelect = document.getElementById('userSelect');
    users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.name; // hoặc u.id nếu bạn muốn lưu user_id
        opt.textContent = `${u.name} - ${u.department}`;
        userSelect.appendChild(opt);
    });
}
async function handleBooking(e) {
    e.preventDefault();
    const room_id = document.getElementById('roomSelect').value;
    const title = document.getElementById('title').value;
    const organizer = document.getElementById('userSelect').value;
    const start_iso = document.getElementById('start').value;
    const end_iso = document.getElementById('end').value;
    const result = document.getElementById('result');

    try {
        const res = await api('/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id, title, organizer, start_iso, end_iso })
        });
        if (res.success) {
            result.innerHTML = `<div class="alert alert-success">Đặt phòng thành công: ${res.booking.title}</div>`;
        } else {
            result.innerHTML = `<div class="alert alert-danger">${res.error}</div>`;
        }
    } catch (err) {
        result.innerHTML = `<div class="alert alert-danger">Lỗi server</div>`;
        console.error(err);
    }
}

document.getElementById('bookForm').addEventListener('submit', handleBooking);

// Load dữ liệu khi mở form
loadRooms();
loadUsers();