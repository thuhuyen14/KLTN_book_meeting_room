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
        allTeams = teams;
        teams.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            teamSelect.appendChild(opt);
        });

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
    const userSelect = document.getElementById('userSelect');
    const participantsSelect = document.getElementById('participantsSelect');

    userSelect.innerHTML = '';
    participantsSelect.innerHTML = '';

    try {
        allUsers = await api('/users');

if (role === 'Admin') {
            // === Dành cho Admin: Load full danh sách để chọn ===
            allUsers.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.full_name} (${u.team}) - ${u.department}`;
                userSelect.appendChild(opt);
            });
            userSelect.disabled = false; // Mở khóa
        } else {
            // === Dành cho User & Manager: Chỉ hiện tên mình và Khóa lại ===
            const userId = localStorage.getItem('id');
            const user = allUsers.find(u => String(u.id) === String(userId));
            const opt = document.createElement('option');
            
            const teamName = user?.team || 'N/A';
            const department = user?.department || 'N/A';
            
            opt.value = userId;
            opt.textContent = `${user?.full_name || 'N/A'} (${teamName}) - ${department}`;
            opt.selected = true;
            
            userSelect.appendChild(opt);
            userSelect.disabled = true; // Khóa chặt
        }

        allUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = `${u.full_name} - ${u.department}`;
            participantsSelect.appendChild(opt);
        });

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

    if (!startInput || !endInput) {
        roomSelect.innerHTML = '<option value="">Chọn thời gian trước để xem phòng trống</option>';
        return;
    }

    const organizerId = document.getElementById('userSelect')?.value || localStorage.getItem('id');
    let organizerBranch = localStorage.getItem('branch_id');

    if (organizerId && allUsers.length > 0) {
        const organizer = allUsers.find(u => String(u.id) === String(organizerId));
        if (organizer) organizerBranch = organizer.branch_id;
    }

    try {
        const res = await fetch(`/api/available?start=${startInput}&end=${endInput}&branch_id=${organizerBranch}`);
        if (!res.ok) throw new Error('Lỗi tải phòng trống');
        const rooms = await res.json();

        roomSelect.innerHTML = '';
        if (rooms.length === 0) {
            roomSelect.innerHTML = '<option value="">Không còn phòng trống tại chi nhánh này</option>';
            return;
        }

        rooms.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = `${r.name} - ${r.location_name} - ${r.capacity} người`;
            if (selectedRoomId && String(r.id) === String(selectedRoomId)) opt.selected = true;
            roomSelect.appendChild(opt);
        });

        if (selectedRoomId && !rooms.some(r => String(r.id) === String(selectedRoomId))) {
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

    const organizer = role === 'User' ? localStorage.getItem('id') : document.getElementById('userSelect').value;
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
                const currentUserId = localStorage.getItem('id'); // Lấy ID của bạn
                
                const res = await fetch('/api/bookings');
                if (!res.ok) throw new Error('Không tải được lịch');
                const data = await res.json();
                
                const events = data.map(b => {
                    // Kiểm tra xem đây có phải lịch của mình không
                    const isMine = String(b.user_id) === String(currentUserId);
                    
                    // Cấu hình màu sắc
                    // Của mình: Màu xanh dương (#4e73df)
                    // Của người khác: Màu xám (#858796)
                    const color = isMine ? '#4e73df' : '#858796';
                    
                    return {
                        id: b.id,
                        title: b.title,
                        start: b.start_time,
                        end: b.end_time,
                        backgroundColor: color, 
                        borderColor: color,
                        // Thêm class để CSS thêm nếu cần
                        classNames: isMine ? ['my-event'] : ['other-event'], 
                        extendedProps: { 
                            room: b.room_name, 
                            bookedBy: b.booked_by,
                            isMine: isMine // Lưu lại để dùng cho Tooltip
                        }
                    };
                });
                successCallback(events);
            } catch (err) {
                console.error(err);
                failureCallback(err);
            }
        },

            eventDidMount: info => {
                // Tùy chỉnh Tooltip thông minh hơn
                const props = info.event.extendedProps;
                const ownerText = props.isMine ? '(Của bạn)' : `(Bởi: ${props.bookedBy})`;
                
                // Thêm icon người nếu là của mình (Visual cue)
                if (props.isMine) {
                    const icon = document.createElement('i');
                    icon.className = 'bi bi-person-fill me-1 text-success';
                    info.el.querySelector('.fc-event-title').prepend(icon);
                }

                new bootstrap.Tooltip(info.el, {
                    title: `${info.event.title} ${props.isMine ? '⭐' : ''}\n Phòng: ${props.room}\n ${ownerText}\n ${info.event.start.toLocaleTimeString().slice(0,5)} - ${info.event.end.toLocaleTimeString().slice(0,5)}`,
                    placement: 'top', 
                    trigger: 'hover', 
                    container: 'body'
                });
            },
            eventClick: async (info) => {
            const modalEl = new bootstrap.Modal(document.getElementById('eventModal'));
            const $body = document.getElementById('modalBodyContent'); // Dùng getElementById cho thuần
            const btnCreateDoc = document.getElementById('btnCreateDocFromBooking');

            // 1. Reset giao diện về trạng thái "Đang tải"
            $body.innerHTML = '<div class="d-flex justify-content-center align-items-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div> Đang tải chi tiết...</div>';
            btnCreateDoc.style.display = 'none'; // Ẩn nút trước
            modalEl.show(); // Hiện modal ngay để người dùng thấy

            try {
                const bookingId = info.event.id;
                
                // 2. Gọi API lấy chi tiết (Để lấy Teams & Participants)
                const res = await fetch(`/api/bookings/${bookingId}/detail`);
                if (!res.ok) throw new Error('Không tải được chi tiết');
                const b = await res.json();

                // 3. Format dữ liệu hiển thị
                const dateStr = new Date(b.start_time).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
                const timeStr = `${new Date(b.start_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})} - ${new Date(b.end_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}`;
                
                // Xử lý hiển thị danh sách người tham gia
                let participantsHtml = '';
                
                // Teams (Hiển thị dạng Badge màu xanh nhạt)
                if (b.teams && b.teams.length) {
                    participantsHtml += b.teams.map(t => 
                        `<span class="badge bg-info text-dark me-1 mb-1 border border-info-subtle"><i class="bi bi-people-fill"></i> ${t.name}</span>`
                    ).join(' ');
                }
                
                // Users (Hiển thị text thường)
                if (b.participants && b.participants.length) {
                    const names = b.participants.map(p => p.full_name).join(', ');
                    if (participantsHtml) participantsHtml += '<div class="mb-1"></div>'; // Xuống dòng nếu có cả team
                    participantsHtml += `<small class="text-dark"><i class="bi bi-person"></i> ${names}</small>`;
                }
                
                if (!participantsHtml) participantsHtml = '<span class="text-muted fst-italic small">Chưa cập nhật người tham dự</span>';

                // 4. Render HTML đẹp vào Modal Body
                const htmlContent = `
                    <div class="list-group list-group-flush">
                        <div class="list-group-item py-3">
                            <small class="text-uppercase text-muted fw-bold" style="font-size:0.7rem">Chủ đề</small>
                            <h5 class="mb-0 text-primary fw-bold mt-1">${b.title}</h5>
                        </div>

                        <div class="list-group-item py-3">
                            <div class="row g-3">
                                <div class="col-6">
                                    <small class="text-muted d-block mb-1"><i class="bi bi-calendar3"></i> Thời gian</small>
                                    <div class="fw-medium">${dateStr}</div>
                                    <div class="text-primary fw-bold fs-5">${timeStr}</div>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted d-block mb-1"><i class="bi bi-geo-alt-fill text-danger"></i> Phòng họp</small>
                                    <div class="fw-bold fs-6">${b.room_name || 'Chưa xác định'}</div>
                                </div>
                            </div>
                        </div>

                        <div class="list-group-item py-3">
                            <div class="d-flex align-items-center">
                                <div class="bg-light rounded-circle p-2 me-3 text-primary border">
                                    <i class="bi bi-person-workspace fs-4"></i>
                                </div>
                                <div>
                                    <small class="text-muted d-block">Người tổ chức</small>
                                    <div class="fw-bold text-dark">${b.booked_by || 'Admin'}</div>
                                </div>
                            </div>
                        </div>

                        <div class="list-group-item py-3 bg-light bg-opacity-25">
                            <small class="text-muted fw-bold mb-2 d-block text-uppercase" style="font-size:0.7rem">Thành phần tham dự</small>
                            <div>${participantsHtml}</div>
                        </div>
                    </div>
                `;
                
                $body.innerHTML = htmlContent;

                // 5. Logic hiện nút "Lập văn bản" (Giữ nguyên logic cũ của bạn)
                const startTime = new Date(b.start_time);
                const now = new Date();
                const diffDays = Math.ceil((startTime - now) / (1000 * 60 * 60 * 24));

                // Chỉ hiện nếu trong vòng 14 ngày (như code bạn gửi)
                if (diffDays >= -14 && diffDays <= 14) {
                    btnCreateDoc.style.display = 'inline-block';
                    btnCreateDoc.href = `documents.html?create_from_booking=${b.id}`;
                } else {
                    btnCreateDoc.style.display = 'none';
                }

            } catch (e) {
                console.error(e);
                $body.innerHTML = `<div class="alert alert-danger m-3 border-0">❌ Lỗi tải thông tin chi tiết: ${e.message}</div>`;
            }
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

// ===== Event Listeners =====
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

// **Load lại phòng khi admin đổi organizer**
document.getElementById('userSelect').addEventListener('change', () => {
    const roomSelect = document.getElementById('roomSelect');
    const selectedRoomId = roomSelect.value || null;
    loadAvailableRooms(selectedRoomId);
});
