// Khởi tạo Quill editor
let quill;
$(document).ready(function() {
quill = new Quill('#docBody', {
  theme: 'snow',
  placeholder: 'Nhập nội dung văn bản...',
  modules: {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean']
    ]
  }
});
});

// 📅 LOAD DANH SÁCH CUỘC HỌP
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

// 👤 LOAD DANH SÁCH NGƯỜI KÝ
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

async function loadTemplates() {
  const select = $('#templateId');
  select.empty().append('<option value="">-- Không dùng mẫu --</option>');

  try {
    const res = await fetch('/api/document_templates');
    const data = await res.json();

    data.forEach(t => {
      select.append(new Option(t.name, t.id));
    });

    select.trigger('change');
  } catch (err) {
    console.error('Không load được templates', err);
  }
}

$("#templateId").on("change", async function () {
  const id = $(this).val();

  if (!id) {
    quill.setContents([{ insert: '\n' }]);
    $("#templateEditorWrapper").hide();
    $("#fileUploadWrapper").show();
    $("#docFile").prop('required', true);
    return;
  }

  try {
    const res = await fetch(`/api/document_templates/${id}`);
    const t = await res.json();

    quill.root.innerHTML = t.content || "";

    $("#templateEditorWrapper").show();
    $("#fileUploadWrapper").hide();
    $("#docFile").prop('required', false);
  } catch (err) {
    console.error("Không load được template", err);
  }
});

// ⚙️ KHỞI TẠO SELECT2
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

  $('#editBookingId').select2({
    placeholder: '-- Chọn cuộc họp --',
    allowClear: true,
    width: '100%',
    dropdownParent: $('#editDocModal')
  });

  $('#editSigners').select2({
    placeholder: '-- Chọn người ký --',
    allowClear: true,
    width: '100%',
    dropdownParent: $('#editDocModal')
  });

  loadBookings();
  loadSigners();
  loadDocuments();
  loadTemplates();
});

// ✅ HÀM CHUNG ĐỂ TẠO VĂN BẢN (dùng cho cả Lưu nháp và Lưu & trình ký)
async function createDocument(shouldSubmit = false) {
  const form = document.getElementById('createDocForm');
  const formData = new FormData(form);
  const userId = localStorage.getItem("id");

  const templateId = $("#templateId").val();
  const docBodyHtml = quill.root.innerHTML;
  const fileInput = $("#docFile")[0].files[0];

  formData.set("created_by", userId);
  formData.delete("signers");
  formData.append("signers", JSON.stringify($('#signers').val() || []));

  if (templateId) {
    formData.delete("file");
    formData.set("generated_body", docBodyHtml || "");
  } else {
    if (!fileInput) {
      alert("Vui lòng tải lên file văn bản hoặc chọn một mẫu.");
      return;
    }
    formData.delete("generated_body");
  }

  try {
    // Bước 1: Tạo văn bản (luôn là Nháp trước)
    const res = await fetch("/api/documents", {
      method: "POST",
      body: formData
    });

    const result = await res.json();

    if (!result.success) {
      alert('Lỗi: ' + result.error);
      return;
    }

    const docId = result.id;

    // Bước 2: Nếu là "Lưu và trình ký" → gọi API submit
    if (shouldSubmit) {
      const submitRes = await fetch(`/api/documents/${docId}/submit`, {
        method: "POST"
      });

      const submitResult = await submitRes.json();

      if (!submitResult.success) {
        alert('Lỗi khi trình ký: ' + submitResult.error);
        return;
      }

      alert('Tạo văn bản và trình ký thành công!');
    } else {
      alert('Lưu nháp thành công!');
    }

    // Reset form
    form.reset();
    quill.setContents([{ insert: '\n' }]);
    
    $("#templateEditorWrapper").hide();
    $("#fileUploadWrapper").show();
    $("#docFile").prop('required', true);

    bootstrap.Modal.getInstance(document.getElementById('createDocModal')).hide();
    loadDocuments();

  } catch (err) {
    console.error('Error:', err);
    alert('Lỗi: ' + err.message);
  }
}

// 📝 NÚT "Lưu nháp"
$('#saveDraftBtn').on('click', function() {
  createDocument(false); // ✅ Không submit, chỉ lưu nháp
});

// 📨 NÚT "Lưu và trình ký"
$('#submitBtn').on('click', function() {
  createDocument(true); // ✅ Lưu và submit luôn
});

// 📄 LOAD DANH SÁCH VĂN BẢN
async function loadDocuments() {
  const res = await fetch('/api/documents');
  const data = await res.json();
  const table = document.getElementById('documentsTable');
  const currentUser = localStorage.getItem('id');

  table.innerHTML = data.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <button class="btn btn-link p-0 preview-btn" 
                data-path="${d.file_path || ''}" 
                data-id="${d.id}">
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
        ${d.created_by === currentUser && d.status === 'Nháp' 
          ? `
            <button class="btn btn-sm btn-outline-warning edit-doc-btn ms-1" data-id="${d.id}">
              <i class="bi bi-pencil"></i> Sửa
            </button>
            <button class="btn btn-sm btn-outline-success submit-draft-btn ms-1" data-id="${d.id}">
              <i class="bi bi-send"></i> Trình ký
            </button>
          `
          : ''}
      </td>
    </tr>
  `).join('');
}

// ✅ NÚT TRÌNH KÝ TỪ BẢNG (Nháp → Đang trình ký)
$(document).on('click', '.submit-draft-btn', async function() {
  const docId = $(this).data('id');
  
  if (!confirm('Xác nhận trình ký văn bản này? Sau khi trình ký sẽ không thể chỉnh sửa.')) return;
  
  try {
    const res = await fetch(`/api/documents/${docId}/submit`, {
      method: 'POST'
    });
    
    const result = await res.json();
    
    if (result.success) {
      alert('Trình ký thành công!');
      loadDocuments();
    } else {
      alert('Lỗi: ' + result.error);
    }
  } catch (err) {
    console.error('Error:', err);
    alert('Lỗi khi trình ký văn bản');
  }
});

// 👁️ XEM DANH SÁCH NGƯỜI KÝ
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

// ✍️ HÀNH ĐỘNG KÝ / TỪ CHỐI
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
    $(`.view-signers-btn[data-id="${docId}"]`).trigger('click');
    
    const resStatus = await fetch(`/api/documents/${docId}`);
    const docData = await resStatus.json();
    $(`.doc-status[data-id="${docId}"]`).text(docData.status);
  } else {
    alert('Lỗi: ' + result.error);
  }
});

// // ✅ EDIT DOCUMENT
// $(document).on('click', '.edit-doc-btn', async function() {
//   const docId = $(this).data('id');
  
//   try {
//     const resDoc = await fetch(`/api/documents/${docId}`);
//     const doc = await resDoc.json();
    
//     const resSigners = await fetch(`/api/documents/${docId}/signers`);
//     const signers = await resSigners.json();
    
//     $('#editDocId').val(doc.id);
//     $('#editDocTitle').val(doc.title);
//     $('#editDocDescription').val(doc.description || '');
    
//     if ($('#editBookingId option').length === 0) {
//       await loadBookingsForEdit();
//     }
//     $('#editBookingId').val(doc.booking_id).trigger('change');
    
//     if ($('#editSigners option').length === 0) {
//       await loadSignersForEdit();
//     }
    
//     const currentSignerIds = signers.map(s => s.signer_id);
//     $('#editSigners').val(currentSignerIds).trigger('change');
    
//     new bootstrap.Modal(document.getElementById('editDocModal')).show();
    
//   } catch (err) {
//     console.error('Error loading document:', err);
//     alert('Lỗi khi tải thông tin văn bản');
//   }
// });

// async function loadBookingsForEdit() {
//   const res = await fetch('/api/bookings/list');
//   const data = await res.json();
//   const select = $('#editBookingId');
//   select.empty().append('<option value="">-- Không chọn --</option>');
  
//   data.forEach(b => {
//     const opt = new Option(`${b.title} (${new Date(b.start_time).toLocaleString()})`, b.id);
//     select.append(opt);
//   });
// }

// async function loadSignersForEdit() {
//   const res = await fetch('/api/users');
//   const data = await res.json();
//   const select = $('#editSigners');
//   select.empty();
  
//   data.forEach(u => {
//     const name = u.full_name || u.username || '(Không tên)';
//     select.append(new Option(name, u.id));
//   });
// }
// 1. Hàm tải danh sách cuộc họp cho Modal Sửa
async function loadBookingsForEdit() {
  try {
    const res = await fetch('/api/bookings/list');
    const data = await res.json();
    const select = $('#editBookingId');
    
    // Reset và thêm option mặc định
    select.empty().append('<option value="">-- Không chọn --</option>');
    
    data.forEach(b => {
      // Tạo option hiển thị Tên cuộc họp + Thời gian
      const time = new Date(b.start_time).toLocaleString('vi-VN');
      const opt = new Option(`${b.title} (${time})`, b.id);
      select.append(opt);
    });
  } catch (err) {
    console.error("Lỗi load bookings edit:", err);
  }
}

// 2. Hàm tải danh sách người dùng cho Modal Sửa
async function loadSignersForEdit() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    const select = $('#editSigners');
    
    select.empty();
    
    data.forEach(u => {
      // Ưu tiên hiển thị Fullname, nếu không có thì lấy Username
      const name = u.full_name || u.username || '(Không tên)';
      select.append(new Option(name, u.id));
    });
  } catch (err) {
    console.error("Lỗi load signers edit:", err);
  }
}
// ✅ EDIT DOCUMENT (Đã chỉnh sửa logic nhận dữ liệu)
$(document).on('click', '.edit-doc-btn', async function() {
  const docId = $(this).data('id');
  
  try {
    // 1. Reset form cũ
    $('#editDocForm')[0].reset();
    $('#editBookingId').val(null).trigger('change');
    $('#editSigners').val(null).trigger('change');

    // 2. Gọi API lấy chi tiết (API này giờ trả về cả info lẫn signers)
    const res = await fetch(`/api/documents/${docId}`);
    const data = await res.json(); // { document: {...}, signers: [1, 5] }

    // Tách dữ liệu ra
    const doc = data.document;
    const signerIds = data.signers;

    // 3. Đổ dữ liệu vào Form
    $('#editDocId').val(doc.id);
    $('#editDocTitle').val(doc.title);
    $('#editDocDescription').val(doc.description || '');

    // 4. Load danh sách Booking vào Select nếu chưa có
    if ($('#editBookingId option').length <= 1) {
      await loadBookingsForEdit();
    }
    $('#editBookingId').val(doc.booking_id).trigger('change');

    // 5. Load danh sách User vào Select nếu chưa có
    if ($('#editSigners option').length === 0) {
      await loadSignersForEdit();
    }

    // 6. Chọn đúng những người ký cũ (Select2 Multiple)
    $('#editSigners').val(signerIds).trigger('change');

    // 7. Hiện Modal
    new bootstrap.Modal(document.getElementById('editDocModal')).show();

  } catch (err) {
    console.error('Error loading document:', err);
    alert('Lỗi khi tải thông tin văn bản: ' + err.message);
  }
});
//---------------
$('#editDocForm').on('submit', async function(e) {
  e.preventDefault();
  
  const docId = $('#editDocId').val();
  const title = $('#editDocTitle').val();
  const description = $('#editDocDescription').val();
  const booking_id = $('#editBookingId').val();
  const signers = $('#editSigners').val() || [];
  
  try {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        booking_id: booking_id || null,
        signers
      })
    });
    
    const result = await res.json();
    
    if (result.success) {
      alert('Cập nhật văn bản thành công!');
      bootstrap.Modal.getInstance(document.getElementById('editDocModal')).hide();
      loadDocuments();
    } else {
      alert('Lỗi: ' + result.error);
    }
  } catch (err) {
    console.error('Error updating document:', err);
    alert('Lỗi khi cập nhật văn bản');
  }
});

// 📄 PREVIEW
$(document).on('click', '.preview-btn', function () {
  const filePath = $(this).data('path');
  const docId = $(this).data('id');
  
  $('#docPreviewFrame').hide().attr('src', '');
  $('#docGeneratedContent').hide().html('');
  
  if (!filePath || filePath === 'null' || filePath === '') {
    showGeneratedContent(docId);
    return;
  }
  
  const absoluteUrl = location.origin + filePath;
  
  if (filePath.endsWith('.pdf')) {
    $('#docPreviewFrame').attr('src', absoluteUrl).show();
    $('#docGeneratedContent').hide();
    new bootstrap.Modal(document.getElementById('docPreviewModal')).show();
  } else {
    window.open(absoluteUrl, '_blank');
  }
});
async function showGeneratedContent(docId) {
  try {
    const res = await fetch(`/api/documents/${docId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // Xử lý nếu API trả về object { document, signers }
    const doc = data.document || data; 

    if (doc.generated_body) {
      $('#docPreviewFrame').hide().attr('src', '');
      $('#docGeneratedContent').html(doc.generated_body).show();
      new bootstrap.Modal(document.getElementById('docPreviewModal')).show();
    } else {
      alert('Không có nội dung để hiển thị');
    }
  } catch (err) {
    console.error('Error:', err);
    alert('Lỗi khi tải nội dung văn bản: ' + err.message);
  }
}

$('#docPreviewModal').on('hidden.bs.modal', function () {
  $('#docPreviewFrame').attr('src', '').hide();
  $('#docGeneratedContent').html('').hide();
});