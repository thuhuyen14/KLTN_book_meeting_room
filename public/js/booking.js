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
let allUsers = []; // 👉 lưu lại để lọc theo team sau
async function loadUsers() {
    const role = localStorage.getItem('role');
    const fullName = localStorage.getItem('full_name');
    const userSelect = document.getElementById('userSelect');
    const participantsSelect = document.getElementById('participantsSelect');

    userSelect.innerHTML = '';
    participantsSelect.innerHTML = '';

    try {
        allUsers = await api('/users');

        // Organizer (người đặt)
        if (role === 'User') {
            const opt = document.createElement('option');
            opt.value = localStorage.getItem('id');
            opt.textContent = fullName;
            userSelect.appendChild(opt);
            userSelect.disabled = true;
        } else {
            allUsers.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.full_name} - ${u.department}`;
                userSelect.appendChild(opt);
            });
            userSelect.disabled = false;
        }

        // Participants (ban đầu load tất cả để TomSelect sẵn)
        allUsers.forEach(u => {
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

// Load phòng khả dụng dựa theo thời gian + lọc theo chi nhánh
async function loadAvailableRooms() {
    const startInput = document.getElementById('start').value;
    const endInput = document.getElementById('end').value;
    const roomSelect = document.getElementById('roomSelect');
    const userBranch = localStorage.getItem('branch_id'); // 👈 chi nhánh user

    if (!startInput || !endInput) {
        roomSelect.innerHTML = '<option value="">Chọn thời gian trước để xem phòng trống</option>';
        return;
    }

    try {
        const res = await fetch(`/api/available?start=${encodeURIComponent(startInput)}&end=${encodeURIComponent(endInput)}`);
        if (!res.ok) throw new Error('Lỗi tải phòng trống');
        const rooms = await res.json();

        // ✅ Chỉ lấy phòng cùng chi nhánh
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
            roomSelect.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
        roomSelect.innerHTML = '<option value="">Không tải được danh sách phòng trống</option>';
    }
}

// Lọc người tham dự khi chọn team
document.getElementById('teamSelect').addEventListener('change', (e) => {
    const selectedTeamId = e.target.value;
    const participantsSelect = document.getElementById('participantsSelect').tomselect;
    const userBranch = localStorage.getItem('branch_id');

    participantsSelect.clearOptions();

    if (!selectedTeamId) {
        // Nếu bỏ chọn team thì load lại tất cả
        allUsers.forEach(u => {
            participantsSelect.addOption({ value: u.id, text: `${u.full_name} - ${u.department}` });
        });
        participantsSelect.refreshOptions(false);
        return;
    }

    // ✅ Chỉ lọc người cùng team + cùng chi nhánh
    const filtered = allUsers.filter(u =>
        String(u.team_id) === String(selectedTeamId) &&
        String(u.branch_id) === String(userBranch)
    );

    filtered.forEach(u => {
        participantsSelect.addOption({ value: u.id, text: `${u.full_name} - ${u.department}` });
    });
    participantsSelect.refreshOptions(false);
});

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
                const events = data.map(b => ({
                    title: b.title,
                    start: b.start_time,
                    end: b.end_time,
                    backgroundColor: '#4e73df',
                    borderColor: '#4e73df',
                    extendedProps: {
                        room: b.room_name,
                        bookedBy: b.booked_by
                    }
                }));
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
// document.getElementById('start').addEventListener('change', loadAvailableRooms);
// document.getElementById('end').addEventListener('change', loadAvailableRooms);
// Khi người dùng chọn thời gian bắt đầu, tự động set thời gian kết thúc cùng ngày (+1 giờ)
document.getElementById('start').addEventListener('change', () => {
    const startInput = document.getElementById('start');
    const endInput = document.getElementById('end');

    if (!startInput.value) return;

    const startTime = new Date(startInput.value);

    // Nếu chưa chọn kết thúc hoặc khác ngày thì auto set cùng ngày, +1 giờ
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // +1 giờ
    const isoLocal = endTime.getFullYear() + '-' +
        String(endTime.getMonth() + 1).padStart(2, '0') + '-' +
        String(endTime.getDate()).padStart(2, '0') + 'T' +
        String(endTime.getHours()).padStart(2, '0') + ':' +
        String(endTime.getMinutes()).padStart(2, '0');

        endInput.value = isoLocal;

    endInput.value = iso;

    // Chuyển con trỏ focus sang ô kết thúc để tiện chỉnh lại giờ
    endInput.focus();
});
