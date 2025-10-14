async function api(path, opts = {}) {
    const res = await fetch('/api' + path, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// Load danh sách team vào dropdown
async function loadTeams() {
    const teamSelect = document.getElementById('teamSelect');
    teamSelect.innerHTML = '<option value="">-- Không chọn --</option>';

    try {
        const teams = await api('/teams');
        teams.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            teamSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Lỗi load team', err);
    }
}

// Load users vào dropdown (userSelect cho organizer, participantsSelect cho người tham dự)
async function loadUsers() {
    const role = localStorage.getItem('role');
    const fullName = localStorage.getItem('full_name');
    const userSelect = document.getElementById('userSelect');
    const participantsSelect = document.getElementById('participantsSelect');

    userSelect.innerHTML = '';
    participantsSelect.innerHTML = '';

    try {
        const users = await api('/users');

        // Organizer (người đặt)
        if (role === 'User') {
            const opt = document.createElement('option');
            opt.value = localStorage.getItem('id');
            opt.textContent = fullName;
            userSelect.appendChild(opt);
            userSelect.disabled = true;
        } else {
            users.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.full_name} - ${u.department}`;
                userSelect.appendChild(opt);
            });
            userSelect.disabled = false;
        }

        // Participants (dùng Tom Select để search + chọn nhiều)
        users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = `${u.full_name} - ${u.department}`;
            participantsSelect.appendChild(opt);
        });

        // ✅ Khởi tạo Tom Select cho participants
        new TomSelect('#participantsSelect', {
            plugins: ['remove_button'],
            maxItems: null,
            placeholder: 'Chọn người tham dự...',
            searchField: ['text'],
            sortField: {
                field: 'text',
                direction: 'asc'
            }
        });

    } catch (err) {
        console.error('Lỗi load users', err);
    }
}

// Load phòng khả dụng dựa theo thời gian
async function loadAvailableRooms() {
    const startInput = document.getElementById('start').value;
    const endInput = document.getElementById('end').value;
    const roomSelect = document.getElementById('roomSelect');

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

// Xử lý submit form đặt phòng
async function handleBooking(e) {
    e.preventDefault();
    const room_id = document.getElementById('roomSelect').value;
    const title = document.getElementById('title').value;
    const result = document.getElementById('result');
    const role = localStorage.getItem('role');

    // Người tổ chức (organizer)
    let organizer;
    if (role === 'User') {
        organizer = localStorage.getItem('id');
    } else {
        organizer = document.getElementById('userSelect').value;
    }

    const start_time = document.getElementById('start').value;
    const end_time = document.getElementById('end').value;
    const team_id = document.getElementById('teamSelect').value;

    // Người tham dự (nhiều người)
    const participants = Array.from(document.getElementById('participantsSelect').selectedOptions)
        .map(opt => opt.value);

    if (!room_id) {
        result.innerHTML = `<div class="alert alert-warning">Vui lòng chọn phòng</div>`;
        return;
    }
    if (new Date(start_time) >= new Date(end_time)) {
        result.innerHTML = `<div class="alert alert-warning">Thời gian kết thúc phải sau thời gian bắt đầu</div>`;
        return;
    }

    try {
        const payload = { 
            room_id, 
            title, 
            user_id: organizer, 
            start_time, 
            end_time 
        };
        if (team_id) payload.team_id = team_id;
        if (participants.length > 0) payload.participants = participants;

        const res = await api('/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.success) {
            result.innerHTML = `<div class="alert alert-success">Đặt phòng thành công: ${res.booking.title}</div>`;
            document.getElementById('bookForm').reset();
            document.getElementById('roomSelect').innerHTML = '<option value="">Chọn thời gian trước để xem phòng trống</option>';
            calendar.refetchEvents();
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
                    let color = '#4e73df';
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
            new bootstrap.Tooltip(info.el, {
                title: `${info.event.title}\n - ${info.event.extendedProps.room}\n \n - ${info.event.start.toLocaleString()}\n - ${info.event.end.toLocaleString()}`,
                placement: 'top',
                trigger: 'hover',
                container: 'body'
            });
        },
        eventClick: function(info) {
            const modalEl = document.getElementById('eventModal');
            document.getElementById('modalTitle').textContent = info.event.title;
            document.getElementById('modalRoom').textContent = info.event.extendedProps.room;
            document.getElementById('modalBookedBy').textContent = info.event.extendedProps.bookedBy;
            document.getElementById('modalStart').textContent = info.event.start.toLocaleString();
            document.getElementById('modalEnd').textContent = info.event.end.toLocaleString();
            new bootstrap.Modal(modalEl).show();
        }
    });
    calendar.render();
    loadUsers();
    loadTeams();
});

// Event listeners
document.getElementById('bookForm').addEventListener('submit', handleBooking);
document.getElementById('start').addEventListener('change', loadAvailableRooms);
document.getElementById('end').addEventListener('change', loadAvailableRooms);
