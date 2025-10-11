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
        opt.textContent = `${r.name} - ${r.location_name} - ${r.capacity} người`;
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

    const start_time = document.getElementById('start').value;
    const end_time = document.getElementById('end').value;

    if (!room_id) {
        result.innerHTML = `<div class="alert alert-warning">Vui lòng chọn phòng trống</div>`;
        return;
    }
    // Validate thời gian
    if (new Date(start_time) >= new Date(end_time)) {
        result.innerHTML = `<div class="alert alert-warning">Thời gian kết thúc phải sau thời gian bắt đầu</div>`;
        return;
    }
    try {
        const res = await api('/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id, title, user_id: organizer, start_time, end_time })
        });
        if (res.success) {
            result.innerHTML = `<div class="alert-success">Đặt phòng thành công: ${res.booking.title}</div>`;
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
// ===== INIT CALENDAR =====
let calendar;
document.addEventListener('DOMContentLoaded', async () => {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'vi',
        height: 600,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        events: async (info, successCallback, failureCallback) => {
            try {
                const res = await fetch('/api/bookings');
                if (!res.ok) throw new Error('Không tải được lịch');
                const data = await res.json();
                const events = data.map(b => {
                    let color = '#4e73df'; // default
                    if (b.room_id === 'R002') color = '#1cc88a';
                    else if (b.room_id === 'R003') color = '#36b9cc';
                    return {
                        title: b.title,
                        start: b.start_time,
                        end: b.end_time,
                        backgroundColor: color,
                        borderColor: color,
                        extendedProps: {
                            room: b.room_name,
                            bookedBy: b.booked_by
                        }
                    };
                });
                successCallback(events);
            } catch (err) {
                console.error(err);
                failureCallback(err);
            }
        },
        eventDidMount: function(info) {
            // Thêm tooltip Bootstrap
            const tooltip = new bootstrap.Tooltip(info.el, {
                title: `${info.event.title}\n - ${info.event.extendedProps.room}\n \n - ${info.event.start.toLocaleString()}\n - ${info.event.end.toLocaleString()}`,
                placement: 'top',
                trigger: 'hover',
                container: 'body'
            });
        },
        eventClick: function(info) {
            // Mở modal chi tiết thay vì alert
            const modalEl = document.getElementById('eventModal');
            document.getElementById('modalTitle').textContent = info.event.title;
            document.getElementById('modalRoom').textContent = info.event.extendedProps.room;
            document.getElementById('modalBookedBy').textContent = info.event.extendedProps.bookedBy;
            document.getElementById('modalStart').textContent = info.event.start.toLocaleString();
            document.getElementById('modalEnd').textContent = info.event.end.toLocaleString();
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    });
    calendar.render();
});


// Event listeners
document.getElementById('bookForm').addEventListener('submit', handleBooking);
document.getElementById('start').addEventListener('change', loadAvailableRooms);
document.getElementById('end').addEventListener('change', loadAvailableRooms);

loadUsers();
