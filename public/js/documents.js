async function loadBookings() {
  const res = await fetch('/api/bookings/list');
  const data = await res.json();
  const select = $('#bookingId');
  select.empty().append('<option></option>'); // cần để placeholder hoạt động
  data.forEach(b => {
    const opt = new Option(`${b.title} (${new Date(b.start_time).toLocaleString()})`, b.id, false, false);
    select.append(opt);
  });
  select.trigger('change'); // cập nhật lại Select2
}

$(document).ready(function () {
  $('#bookingId').select2({
    placeholder: '-- Chọn cuộc họp --',
    allowClear: true,
    width: '100%',
    dropdownParent: $('#createDocModal'),
    language: { noResults: () => 'Không tìm thấy cuộc họp nào' }
  });

  loadBookings();
});


// 📄 submit form tạo văn bản
document.getElementById('createDocForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
    formData.append("created_by", localStorage.getItem("id"));
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

// 📄 load danh sách văn bản
async function loadDocuments() {
  const res = await fetch('/api/documents');
  const data = await res.json();
  const table = document.getElementById('documentsTable');
  table.innerHTML = data.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><a href="${d.file_path}" target="_blank">${d.title}</a></td>
      <td>${d.booking_title || '-'}</td>
      <td>${d.status}</td>
      <td>${d.creator_name || '—'}</td>
      <td><button class="btn btn-sm btn-outline-primary">Xem</button></td>
    </tr>
  `).join('');
}
// khởi động
loadBookings();
loadDocuments();
