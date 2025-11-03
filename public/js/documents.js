// -----------------------------
// 📅 LOAD DANH SÁCH CUỘC HỌP
// -----------------------------
async function loadBookings() {
  const res = await fetch('/api/bookings/list');
  const data = await res.json();
  const select = $('#bookingId');
  select.empty().append('<option></option>');

  data.forEach(b => {
    const opt = new Option(`${b.title} (${new Date(b.start_time).toLocaleString()})`, b.id);
    select.append(opt);
  });

  select.trigger('change');
}

// -----------------------------
// 👤 LOAD DANH SÁCH NGƯỜI KÝ
// -----------------------------
async function loadSigners() {
  const res = await fetch('/api/users');
  const data = await res.json();
  const select = $('#signers');
  select.empty();

  data.forEach(u => {
    const name = u.full_name || u.username || '(Không tên)';
    select.append(new Option(name, u.id));
  });

  select.trigger('change');
}

// -----------------------------
// ⚙️ KHỞI TẠO SELECT2
// -----------------------------
$(document).ready(function () {
  $('#bookingId').select2({
    placeholder: '-- Chọn cuộc họp --',
    allowClear: true,
    width: '100%',
    dropdownParent: $('#createDocModal')
  });

  $('#signers').select2({
    placeholder: '-- Chọn người ký --',
    allowClear: true,
    width: '100%',
    dropdownParent: $('#createDocModal')
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

  formData.set("created_by", userId);
  formData.delete("signers");
  formData.append("signers", JSON.stringify($('#signers').val() || []));

  const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
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

  table.innerHTML = data.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <button class="btn btn-link p-0 preview-btn" data-path="${d.file_path}">
          ${d.title}
        </button>
      </td>
      <td>${d.booking_title || '-'}</td>
      <td class="doc-status" data-id="${d.id}">${d.status}</td>
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

  if (!data.length) {
    modalBody.html('<div class="text-center text-muted">Chưa có người ký nào.</div>');
  } else {
    const currentUser = localStorage.getItem('id');

    const rows = data.map(s => `
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
    `).join('');

    modalBody.html(`
      <table class="table table-bordered align-middle">
        <thead class="table-light">
          <tr>
            <th>Người ký</th>
            <th>Trạng thái</th>
            <th>Thời gian ký</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `);
  }

  new bootstrap.Modal(document.getElementById('signersModal')).show();
});

// -----------------------------
// ✍️ HÀNH ĐỘNG KÝ / TỪ CHỐI
// -----------------------------
$(document).on('click', '.sign-btn', async function () {
  const docId = $(this).data('id');
  const action = $(this).data('action');
  const userId = localStorage.getItem('id');

  if (!confirm(action === 'signed'
      ? 'Xác nhận ký văn bản này?'
      : 'Bạn chắc chắn muốn từ chối ký văn bản này?')) return;

  const res = await fetch(`/api/documents/${docId}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, action })
  });

  const result = await res.json();
  if (result.success) {
    alert('Cập nhật trạng thái thành công.');

    // 1️⃣ reload modal danh sách người ký
    $(`.view-signers-btn[data-id="${docId}"]`).trigger('click');

    // 2️⃣ Cập nhật trạng thái tổng thể ngay lập tức
    // Lấy status mới từ server (trạng thái tổng thể văn bản)
    const resStatus = await fetch(`/api/documents/${docId}`);
    const docData = await resStatus.json();
    $(`.doc-status[data-id="${docId}"]`).text(docData.status);
  } else {
    alert('Lỗi: ' + result.error);
  }
});

// -----------------------------
// 📄 PREVIEW PDF
// -----------------------------
$(document).on('click', '.preview-btn', function () {
  const filePath = $(this).data('path');   // /demo_doc/xxx.pdf hoặc xxx.docx
  const absoluteUrl = location.origin + filePath;

  if (filePath.endsWith('.pdf')) {
    // Hiển thị modal
    $('#docPreviewFrame').attr('src', absoluteUrl);
    new bootstrap.Modal(document.getElementById('docPreviewModal')).show();
  } else {
    // Tải file xuống luôn
    window.open(absoluteUrl, '_blank');
  }
});


// -----------------------------
// ✅ KHỞI ĐỘNG
// -----------------------------
loadBookings();
loadDocuments();
