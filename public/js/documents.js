// -----------------------------
// 📅 LOAD DANH SÁCH CUỘC HỌP
// -----------------------------
async function loadBookings() {
  const res = await fetch('/api/bookings/list');
  const data = await res.json();
  const select = $('#bookingId');
  select.empty().append('<option></option>'); // để placeholder hoạt động

  data.forEach(b => {
    const opt = new Option(`${b.title} (${new Date(b.start_time).toLocaleString()})`, b.id, false, false);
    select.append(opt);
  });

  select.trigger('change');
}

// -----------------------------
// 👤 LOAD DANH SÁCH NGƯỜI KÝ
// -----------------------------
async function loadSigners() {
  const res = await fetch('/api/users'); // sửa từ /api/users/list thành /api/users
  const data = await res.json();
  const select = $('#signers');
  select.empty();

  data.forEach(u => {
    const name = u.full_name || u.username || '(Không tên)';
    const opt = new Option(name, u.id, false, false);
    select.append(opt);
  });

  select.trigger('change');
}


// -----------------------------
// ⚙️ KHỞI TẠO CÁC SELECT2
// -----------------------------
$(document).ready(function () {
  $('#bookingId').select2({
    placeholder: '-- Chọn cuộc họp --',
    allowClear: true,
    width: '100%',
    dropdownParent: $('#createDocModal'),
    language: { noResults: () => 'Không tìm thấy cuộc họp nào' }
  });

  $('#signers').select2({
    placeholder: '-- Chọn người ký --',
    allowClear: true,
    width: '100%',
    dropdownParent: $('#createDocModal'),
    language: { noResults: () => 'Không tìm thấy nhân viên nào' }
  });

  loadBookings();
  loadSigners();
  loadDocuments();
});

// -----------------------------
// 🧾 GỬI FORM TẠO VĂN BẢN
// -----------------------------
document.getElementById('createDocForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const userId = localStorage.getItem("id");
  formData.set("created_by", userId); // set sẽ ghi đè nếu có

  // đảm bảo key 'signers' chỉ có 1 giá trị duy nhất
  formData.delete("signers"); 
  const signers = $('#signers').val() || [];
  formData.append("signers", JSON.stringify(signers));

  // Gửi request tạo văn bản
  const res = await fetch("/api/documents/upload", {
    method: "POST",
    body: formData
  });

  const result = await res.json();
  if (result.success) {
    alert('Tạo văn bản thành công!');
    e.target.reset();
    bootstrap.Modal.getInstance(document.getElementById('createDocModal')).hide();
    loadDocuments();
  } else {
    alert('Lỗi: ' + result.error);
  }
});

// -----------------------------
// 📄 LOAD DANH SÁCH VĂN BẢN
// -----------------------------
async function loadDocuments() {
  const res = await fetch('/api/documents');
  const data = await res.json();
  const table = document.getElementById('documentsTable');
  if (!Array.isArray(data)) {
    console.error("API /api/documents không trả về mảng:", data);
    return;
  }

  table.innerHTML = data.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><a href="${d.file_path}" target="_blank">${d.title}</a></td>
      <td>${d.booking_title || '-'}</td>
      <td>${d.status}</td>
      <td>${d.creator_name || '—'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary view-signers-btn" data-id="${d.id}">
          Xem
        </button>
      </td>
    </tr>
  `).join('');
}

// -----------------------------
// 👁️ XEM DANH SÁCH NGƯỜI KÝ
// -----------------------------
$(document).on('click', '.view-signers-btn', async function () {
  const docId = $(this).data('id');
  const modalBody = $('#modal-content');
  modalBody.html('<div class="text-center text-muted">Đang tải...</div>');

  const res = await fetch(`/api/documents/${docId}/signers`);
  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    modalBody.html('<div class="text-center text-muted">Chưa có người ký nào.</div>');
    new bootstrap.Modal(document.getElementById('signersModal')).show();
    return;
  }

  const currentUser = localStorage.getItem('id');

  const html = `
    <table class="table table-bordered align-middle">
      <thead class="table-light">
        <tr>
          <th>Người ký</th>
          <th>Trạng thái</th>
          <th>Thời gian ký</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(s => `
          <tr>
            <td>${s.full_name || s.signer_id}</td>
            <td>${s.status}</td>
            <td>${s.signed_at ? new Date(s.signed_at).toLocaleString() : '-'}</td>
            <td>
              ${s.signer_id == currentUser && s.status === 'Đang trình ký'
                ? `
                  <button class="btn btn-success btn-sm sign-btn" data-id="${docId}" data-action="signed">Ký</button>
                  <button class="btn btn-danger btn-sm sign-btn" data-id="${docId}" data-action="rejected">Từ chối</button>
                `
                : '-'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  modalBody.html(html);
  new bootstrap.Modal(document.getElementById('signersModal')).show();
});

// -----------------------------
// ✍️ HÀNH ĐỘNG KÝ HOẶC TỪ CHỐI
// -----------------------------
$(document).on('click', '.sign-btn', async function () {
  const docId = $(this).data('id');
  const action = $(this).data('action');
  const signerId = localStorage.getItem('id');

  if (!signerId) {
    alert('Thiếu thông tin người dùng (localStorage.id)');
    return;
  }

  const res = await fetch(`/api/documents/${docId}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signer_id: signerId, action })
  });

  const result = await res.json();
  if (res.ok) {
    alert(result.message);
    $('#signersModal').modal('hide');
    loadDocuments();
  } else {
    alert('Lỗi: ' + result.error);
  }
});

// khởi động
loadBookings();
loadDocuments();
