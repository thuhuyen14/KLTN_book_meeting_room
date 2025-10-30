// 🌐 Hàm gọi API chung (dùng cho endpoints có prefix '/api')
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// 🏁 Hàm load ban đầu
async function load() {
  const rooms = await api('/rooms');
  const roomFilter = document.getElementById('roomFilter');
  roomFilter.innerHTML = '<option value="">-- Tất cả phòng --</option>';
  rooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = String(r.id);
    opt.textContent = r.name;
    roomFilter.appendChild(opt);
  });

  // Fill cho modal chỉnh sửa
  const editRoomSelect = document.getElementById('editRoom');
  if (editRoomSelect) {
    editRoomSelect.innerHTML = '';
    rooms.forEach(r => {
      const opt = document.createElement('option');
      opt.value = String(r.id);
      opt.textContent = r.name;
      editRoomSelect.appendChild(opt);
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('viewDate').value = today;

  await renderBookings();
  await renderWeeklySchedule();
}

// 🌐 Biến toàn cục
let allTeams = [];
let allParticipants = [];
let teamSelectTom, participantSelectTom;

// 🧠 Hàm load team và user
async function loadTeamsAndParticipants() {
  try {
    const teams = await api('/teams');
    allTeams = teams || [];

    const users = await api('/users');
    // chuẩn hóa cấu trúc user để client dễ dùng
    allParticipants = (users || []).map(u => ({
      id: String(u.id ?? u.user_id ?? u.userId),
      name: u.full_name || u.name || u.fullName || u.email || ('User ' + (u.id ?? ''))
    }));

    if (!teamSelectTom) {
      teamSelectTom = new TomSelect('#editTeamSelect', { plugins: ['remove_button'] });
    }
    if (!participantSelectTom) {
      participantSelectTom = new TomSelect('#editParticipantsSelect', { plugins: ['remove_button'] });
    }
  } catch (err) {
    console.error('Lỗi load teams/users:', err);
  }
}

// 🧠 Format datetime an toàn (chấp nhận Date, ISO, hoặc MySQL "YYYY-MM-DD HH:mm:ss")
function formatLocalDatetime(dt) {
  if (!dt) return '';
  let dateObj;
  try {
    if (dt instanceof Date) {
      dateObj = dt;
    } else if (typeof dt === 'string') {
      // nếu chuỗi có format "YYYY-MM-DD HH:mm:ss" -> chuyển thành ISO-like "YYYY-MM-DDTHH:mm:ss"
      // nếu đã là ISO thì replace sẽ vẫn hợp lý
      const s = dt.includes(' ') && !dt.includes('T') ? dt.replace(' ', 'T') : dt;
      dateObj = new Date(s);
    } else {
      dateObj = new Date(dt);
    }
  } catch (e) {
    return '';
  }

  if (isNaN(dateObj.getTime())) return '';

  // convert to local "YYYY-MM-DDTHH:mm" for <input type=datetime-local>
  const tzOffset = dateObj.getTimezoneOffset();
  const local = new Date(dateObj.getTime() - tzOffset * 60000);
  return local.toISOString().slice(0, 16);
}

// 🧠 Parse datetime từ input (để gửi lên server nếu cần)
function parseInputDatetimeToUTCString(localValue) {
  // localValue is "YYYY-MM-DDTHH:mm"
  if (!localValue) return null;
  const date = new Date(localValue);
  if (isNaN(date.getTime())) return null;
  // convert back to ISO (server side should handle)
  return date.toISOString();
}

// 🧠 Mở modal sửa (nhận bookingId)
async function openEditModal(bookingId) {
  if (!teamSelectTom || !participantSelectTom) {
    alert("Dữ liệu chưa tải xong, thử lại sau.");
    return;
  }

  try {
    // fetch chi tiết booking
    const res = await fetch(`/api/bookings/${bookingId}/detail`);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Server trả lỗi ${res.status}: ${txt}`);
    }
    const booking = await res.json();

    if (!booking || booking.error) {
      throw new Error(booking?.error || 'Không lấy được booking');
    }

    // debug (giúp nếu server trả format lạ)
    console.log('Booking raw:', booking);
    console.log('start_time raw:', booking.start_time, typeof booking.start_time);
    console.log('participants raw:', booking.participants);
    console.log('teams raw:', booking.teams);

    document.getElementById('editBookingId').value = booking.id;
    document.getElementById('editTitle').value = booking.title || '';
    document.getElementById('editRoom').value = String(booking.room_id ?? '');

    document.getElementById('editStart').value = formatLocalDatetime(booking.start_time);
    document.getElementById('editEnd').value = formatLocalDatetime(booking.end_time);

    // Fill Team TomSelect (options)
    teamSelectTom.clearOptions();
    allTeams.forEach(t => teamSelectTom.addOption({ value: String(t.id), text: t.name || t.title || t.id }));
    teamSelectTom.clear(); // clear selection
    // booking.teams có thể là array id hoặc array object {id,name}
    if (Array.isArray(booking.teams) && booking.teams.length > 0) {
      const teamIds = booking.teams.map(t => String((typeof t === 'object') ? (t.id ?? t.team_id) : t));
      teamSelectTom.setValue(teamIds);
    }

    // Fill Participant TomSelect (options)
    participantSelectTom.clearOptions();
    allParticipants.forEach(p => participantSelectTom.addOption({ value: String(p.id), text: p.name }));
    participantSelectTom.clear();
    if (Array.isArray(booking.participants) && booking.participants.length > 0) {
      // booking.participants items may be { user_id, team_id, full_name } or simple ids
      const participantIds = booking.participants.map(p => {
        if (typeof p === 'object') return String(p.user_id ?? p.id ?? p.userId);
        return String(p);
      });
      participantSelectTom.setValue(participantIds);
    }

    new bootstrap.Modal(document.getElementById('editBookingModal')).show();
  } catch (err) {
    console.error('Lỗi khi mở modal chỉnh sửa:', err);
    alert('Không tải được dữ liệu lịch họp. Kiểm tra console để biết chi tiết.');
  }
}

// 🧠 Submit form sửa
document.getElementById('editBookingForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('editBookingId').value;
  const title = document.getElementById('editTitle').value.trim();
  const room_id = document.getElementById('editRoom').value;
  const start_time_local = document.getElementById('editStart').value;
  const end_time_local = document.getElementById('editEnd').value;

  const selectedTeams = teamSelectTom.getValue() || [];
  const selectedParticipants = participantSelectTom.getValue() || [];

  if (!title || !room_id || !start_time_local || !end_time_local) {
    alert('Vui lòng nhập đầy đủ thông tin!');
    return;
  }

  const start_time = parseInputDatetimeToUTCString(start_time_local);
  const end_time = parseInputDatetimeToUTCString(end_time_local);
  if (!start_time || !end_time) {
    alert('Thời gian không hợp lệ');
    return;
  }

  try {
    await api(`/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        room_id,
        start_time,
        end_time,
        teams: selectedTeams,
        participants: selectedParticipants
      })
    });

    alert('✅ Cập nhật thành công!');
    const modal = bootstrap.Modal.getInstance(document.getElementById('editBookingModal'));
    modal.hide();

    await renderBookings();
    await renderWeeklySchedule();
  } catch (err) {
    alert('❌ Lỗi khi cập nhật: ' + (err.message || err));
  }
});

// 📅 Render danh sách lịch
async function renderBookings() {
  const date = document.getElementById('viewDate').value;
  const room_id = document.getElementById('roomFilter').value;
  const q = new URLSearchParams();
  if (room_id) q.set('room_id', room_id);
  if (date) q.set('date', date);

  const rows = await api('/bookings?' + q.toString());
  const div = document.getElementById('bookings');
  div.innerHTML = '';

  if (!rows || rows.length === 0) {
    div.innerHTML = '<div class="alert alert-info">Không có lịch</div>';
    return;
  }

  const currentUser = localStorage.getItem('id');

  rows.forEach(b => {
    const card = document.createElement('div');
    card.className = 'card mb-2 p-2';

    // hiển thị thời gian an toàn (nếu format MySQL, convert sang Date hợp lệ)
    const startLabel = formatLocalDatetime(b.start_time) ? new Date(formatLocalDatetime(b.start_time)).toLocaleString() : (b.start_time || '');
    const endLabel = formatLocalDatetime(b.end_time) ? new Date(formatLocalDatetime(b.end_time)).toLocaleString() : (b.end_time || '');

    card.innerHTML = `
      <strong>${b.title}</strong>
      <div class="text-muted">
        ${b.room_name || ''} — ${startLabel} → ${endLabel} — ${b.booked_by || ''}
      </div>
    `;

    const btnGroup = document.createElement('div');
    btnGroup.className = 'mt-2';

    if (String(b.user_id) === String(currentUser)) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-outline-primary me-2';
      editBtn.textContent = 'Sửa';
      // === Sửa chỗ quan trọng: truyền ID chứ không phải object ===
      editBtn.onclick = () => openEditModal(b.id);
      btnGroup.appendChild(editBtn);
    }

    const del = document.createElement('button');
    del.className = 'btn btn-sm btn-outline-danger';
    del.textContent = 'Xóa';
    del.onclick = async () => {
      if (!confirm('Xác nhận xóa?')) return;
      await fetch('/api/bookings/' + b.id, { method: 'DELETE' });
      await renderBookings();
      await renderWeeklySchedule();
    };

    btnGroup.appendChild(del);
    card.appendChild(btnGroup);
    div.appendChild(card);
  });
}

// 📆 Render lịch cá nhân (giữ gần như cũ nhưng an toàn hơn khi parse thời gian)
async function renderWeeklySchedule() {
  const userId = localStorage.getItem('id');
  if (!userId) return;

  const container = document.getElementById("personalSchedule");
  if (!container) return;

  container.innerHTML = '';

  try {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const bookings = await api(`/bookings/personal/${userId}?start=${start.toISOString()}&end=${end.toISOString()}`);

    const dayStart = 8;
    const dayEnd = 18;
    const containerHeight = 500;
    const hourHeight = containerHeight / (dayEnd - dayStart);

    container.style.overflowX = "auto";
    container.style.whiteSpace = "nowrap";
    container.style.position = "relative";
    container.style.height = containerHeight + "px";
    container.style.border = "1px solid #ccc";
    container.style.display = "flex";
    container.style.background = "#fff";

    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayDiv = document.createElement("div");
      dayDiv.className = "day-column";
      dayDiv.style.flex = "0 0 150px";
      dayDiv.style.borderRight = "1px solid #eee";
      dayDiv.style.position = "relative";
      dayDiv.style.height = "100%";
      dayDiv.style.boxSizing = "border-box";
      dayDiv.style.padding = "2px";
      dayDiv.innerHTML = `
        <div class="text-center fw-bold border-bottom small" style="background:#f8f9fa">
          ${d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
        </div>
      `;
      days.push({ date: new Date(d), element: dayDiv });
      container.appendChild(dayDiv);
    }

    const hourLabels = document.createElement("div");
    hourLabels.style.position = "absolute";
    hourLabels.style.left = "0";
    hourLabels.style.top = "0";
    hourLabels.style.height = "100%";
    hourLabels.style.width = "50px";
    hourLabels.style.background = "#f9f9f9";
    hourLabels.style.borderRight = "1px solid #ddd";
    hourLabels.style.zIndex = "10";

    for (let h = dayStart; h <= dayEnd; h++) {
      const label = document.createElement("div");
      label.style.position = "absolute";
      label.style.top = (h - dayStart) * hourHeight - 6 + "px";
      label.style.fontSize = "0.75rem";
      label.style.color = "#555";
      label.textContent = `${h}:00`;
      hourLabels.appendChild(label);
    }

    container.prepend(hourLabels);

    bookings.forEach(b => {
      const startTime = new Date(b.start_time.includes(' ') && !b.start_time.includes('T') ? b.start_time.replace(' ', 'T') : b.start_time);
      const endTime = new Date(b.end_time.includes(' ') && !b.end_time.includes('T') ? b.end_time.replace(' ', 'T') : b.end_time);
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return;

      const eventDay = days.find(d => {
        const dayLocal = d.date.toLocaleDateString('vi-VN');
        const eventLocal = startTime.toLocaleDateString('vi-VN');
        return dayLocal === eventLocal;
      });
      if (!eventDay) return;

      const startHour = startTime.getHours() + startTime.getMinutes() / 60;
      const endHour = endTime.getHours() + endTime.getMinutes() / 60;
      const eventDiv = document.createElement("div");
      eventDiv.className = "personal-event";
      eventDiv.style.position = "absolute";
      eventDiv.style.top = (startHour - dayStart) * hourHeight + "px";
      eventDiv.style.height = (endHour - startHour) * hourHeight + "px";
      eventDiv.style.left = "5px";
      eventDiv.style.right = "5px";
      eventDiv.style.width = "calc(100% - 10px)";
      eventDiv.style.backgroundColor = "#0d6efd";
      eventDiv.style.color = "white";
      eventDiv.style.borderRadius = "4px";
      eventDiv.style.fontSize = "0.8rem";
      eventDiv.style.padding = "2px 5px";
      eventDiv.style.whiteSpace = "normal";
      eventDiv.style.wordBreak = "break-word";

      new bootstrap.Tooltip(eventDiv, {
        title: `
          <strong>${b.title}</strong><br>
          Phòng: ${b.room_name}<br>
          Thời gian: ${startTime.toLocaleTimeString()} → ${endTime.toLocaleTimeString()}
        `,
        placement: 'top',
        trigger: 'hover',
        container: 'body',
        html: true
      });

      eventDiv.textContent = `${b.title}\n - ${b.room_name}`;
      eventDay.element.appendChild(eventDiv);
    });
  } catch (err) {
    console.error("❌ Lỗi load lịch cá nhân:", err);
  }
}

// ⏰ Sự kiện thay đổi
document.getElementById('viewDate').addEventListener('change', async () => {
  await renderBookings();
  await renderWeeklySchedule();
});
document.getElementById('roomFilter').addEventListener('change', renderBookings);

// 🏁 Khởi chạy
(async () => {
  await loadTeamsAndParticipants();
  await load();
  await renderWeeklySchedule();
})();
