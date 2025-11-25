async function api(path, opts = {}) {
    const res = await fetch('/api' + path, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ===== Load Teams =====
let allTeams = [];
async function loadTeams() {
    const teamSelect = document.getElementById('teamSelect');
    teamSelect.innerHTML = '';

    try {
        const teams = await api('/teams');
        allTeams = teams; // lưu ra biến toàn cục để loadUsers dùng
        teams.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            teamSelect.appendChild(opt);
        });

        // TomSelect multi-team
        new TomSelect('#teamSelect', {
            plugins: ['remove_button'],
            maxItems: null,
            placeholder: 'Chọn 1 hoặc nhiều team...',
            searchField: ['text']
        });
    } catch (err) {
        console.error('Lỗi load team', err);
    }
}

// ===== Load Users =====
let allUsers = [];
async function loadUsers() {
    const role = localStorage.getItem('role');
    const fullName = localStorage.getItem('full_name');
    const userSelect = document.getElementById('userSelect');
    const participantsSelect = document.getElementById('participantsSelect');

    userSelect.innerHTML = '';
    participantsSelect.innerHTML = '';

    try {
        allUsers = await api('/users');

        // Organizer
        if (role === 'User') {
            const userId = localStorage.getItem('id'); // khai báo userId ở đây
            const opt = document.createElement('option');
            const user = allUsers.find(u => String(u.id) === String(userId));

            const teamName = user?.team || 'N/A';
            const department = user?.department || 'N/A';
            opt.value = userId;
            opt.textContent = `${user?.full_name || 'N/A'} (${teamName}) - ${department}`;
            userSelect.appendChild(opt);
            userSelect.disabled = true;
        } else {
            allUsers.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.full_name} (${u.team}) - ${u.department}`;
                userSelect.appendChild(opt);
            });
            userSelect.disabled = false;
        }

        // Participants
        allUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = `${u.full_name} - ${u.department}`;
            participantsSelect.appendChild(opt);
        });

        // TomSelect participants
        new TomSelect('#participantsSelect', {
            plugins: ['remove_button'],
            maxItems: null,
            placeholder: 'Chọn người tham dự...',
            searchField: ['text'],
            sortField: { field: 'text', direction: 'asc' }
        });

    } catch (err) {
        console.error('Lỗi load users', err);
    }
}

// ===== Load Available Rooms =====
async function loadAvailableRooms(selectedRoomId = null) {
    const startInput = document.getElementById('start').value;
    const endInput = document.getElementById('end').value;
    const roomSelect = document.getElementById('roomSelect');
    const userBranch = localStorage.getItem('branch_id');

    if (!startInput || !endInput) {
        roomSelect.innerHTML = '<option value="">Chọn thời gian trước để xem phòng trống</option>';
        return;
    }

    try {
        const res = await fetch(`/api/available?start=${encodeURIComponent(startInput)}&end=${encodeURIComponent(endInput)}`);
        if (!res.ok) throw new Error('Lỗi tải phòng trống');
        const rooms = await res.json();

        const filteredRooms = rooms.filter(r => String(r.branch_id) === String(userBranch));
        roomSelect.innerHTML = '';
        if (filteredRooms.length === 0) {
            roomSelect.innerHTML = '<option value="">Không còn phòng trống tại chi nhánh của bạn</option>';
            return;
        }

        filteredRooms.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = `${r.name} - ${r.location_name} - ${r.capacity} người`;
            if (selectedRoomId && String(r.id) === String(selectedRoomId)) {
                opt.selected = true;
            }
            roomSelect.appendChild(opt);
        });

        if (selectedRoomId && !filteredRooms.some(r => String(r.id) === String(selectedRoomId))) {
            const result = document.getElementById('result');
            result.innerHTML = `<div class="alert alert-warning">Phòng đã chọn không trống vào thời gian này</div>`;
        }

    } catch (err) {
        console.error(err);
        roomSelect.innerHTML = '<option value="">Không tải được danh sách phòng trống</option>';
    }
}

// ===== Handle Booking Submit =====
async function handleBooking(e) {
    e.preventDefault();
    const room_id = document.getElementById('roomSelect').value;
    const title = document.getElementById('title').value;
    const result = document.getElementById('result');
    const role = localStorage.getItem('role');

    let organizer = role === 'User' ? localStorage.getItem('id') : document.getElementById('userSelect').value;
    const start_time = document.getElementById('start').value;
    const end_time = document.getElementById('end').value;
    const team_ids = Array.from(document.getElementById('teamSelect').selectedOptions).map(o => o.value);
    const participants = Array.from(document.getElementById('participantsSelect').selectedOptions).map(o => o.value);

    const now = Date.now();
    const start = new Date(start_time).getTime();
    const end = new Date(end_time).getTime();
    const safeNow = now - 60 * 1000;

    if (start <= safeNow) {
        result.innerHTML = `<div class="alert alert-warning">Không thể đặt lịch trong quá khứ</div>`;
        return;
    }
    if (!room_id) {
        result.innerHTML = `<div class="alert alert-warning">Vui lòng chọn phòng</div>`;
        return;
    }
    if (start >= end) {
        result.innerHTML = `<div class="alert alert-warning">Thời gian kết thúc phải sau thời gian bắt đầu</div>`;
        return;
    }

    try {
        const payload = { room_id, title, user_id: organizer, start_time, end_time };
        if (team_ids.length) payload.team_ids = team_ids;
        if (participants.length) payload.participants = participants;

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

// ===== Calendar Init =====
let calendar;
document.addEventListener('DOMContentLoaded', async () => {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'vi',
        height: 600,
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
        events: async (info, successCallback, failureCallback) => {
            try {
                const res = await fetch('/api/bookings');
                if (!res.ok) throw new Error('Không tải được lịch');
                const data = await res.json();
                const events = data.map(b => ({
                    title: b.title,
                    start: b.start_time,
                    end: b.end_time,
                    backgroundColor: '#4e73df',
                    borderColor: '#4e73df',
                    extendedProps: { room: b.room_name, bookedBy: b.booked_by }
                }));
                successCallback(events);
            } catch (err) {
                console.error(err);
                failureCallback(err);
            }
        },
        eventDidMount: info => {
            new bootstrap.Tooltip(info.el, {
                title: `${info.event.title}\n - ${info.event.extendedProps.room}\n\n - ${info.event.start.toLocaleString()}\n - ${info.event.end.toLocaleString()}`,
                placement: 'top', trigger: 'hover', container: 'body'
            });
        },
        eventClick: info => {
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

    const params = new URLSearchParams(window.location.search);
    const roomIdFromURL = params.get('room_id');
    const roomNameFromURL = params.get('room_name');

    if (roomIdFromURL && roomNameFromURL) {
        const roomSelect = document.getElementById('roomSelect');
        roomSelect.innerHTML = `<option value="${roomIdFromURL}" selected>${decodeURIComponent(roomNameFromURL)}</option>`;
    }

});

document.getElementById('bookForm').addEventListener('submit', handleBooking);

document.getElementById('start').addEventListener('change', () => {
    const startInput = document.getElementById('start');
    const endInput = document.getElementById('end');

    if (!startInput.value) return;

    const startTime = new Date(startInput.value);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const isoLocal = endTime.getFullYear() + '-' +
        String(endTime.getMonth() + 1).padStart(2, '0') + '-' +
        String(endTime.getDate()).padStart(2, '0') + 'T' +
        String(endTime.getHours()).padStart(2, '0') + ':' +
        String(endTime.getMinutes()).padStart(2, '0');

    endInput.value = isoLocal;
    endInput.focus();

    const roomSelect = document.getElementById('roomSelect');
    const selectedRoomId = roomSelect.value || null;
    loadAvailableRooms(selectedRoomId);
});