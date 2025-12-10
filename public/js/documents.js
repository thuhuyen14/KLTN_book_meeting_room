// js/documents.js (compact refactor)
// Giữ nguyên contract API như cũ.

const API = {
  bookingsList: '/api/bookings/list',
  users: '/api/users',
  templatesList: '/api/document_templates',
  templateById: id => `/api/document_templates/${id}`,
  createDocument: '/api/documents',
  submitDocument: id => `/api/documents/${id}/submit`,
  documentsList: '/api/documents',
  documentById: id => `/api/documents/${id}`,
  documentSign: id => `/api/documents/${id}/sign`,
  getSigners: id => `/api/documents/${id}/signers`,
  updateDocument: id => `/api/documents/${id}`
};

const curUser = () => localStorage.getItem('id') || null;
const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

let quill = null;
$(async function () {
  quill = new Quill('#docBody', { theme:'snow', placeholder:'Nhập nội dung...', modules:{ toolbar:[[{header:[1,2,3,false]}],['bold','italic','underline'],[{list:'ordered'},{list:'bullet'}],['link','image'],['clean']] } });

  // ensure preview containers
  if (!$('#signersListPreview').length) $('#signers').after('<div id="signersListPreview" class="mt-2"></div>');
  if (!$('#editSignersListPreview').length) $('#editSigners').after('<div id="editSignersListPreview" class="mt-2"></div>');

  const s2 = (sel, ph, parent) => $(sel).select2({ placeholder:ph, allowClear:true, width:'100%', dropdownParent: parent ? $(parent) : undefined });
  s2('#bookingId','-- Chọn cuộc họp --','#createDocModal'); s2('#signers','-- Chọn người ký --','#createDocModal'); s2('#templateId','-- Chọn mẫu --','#createDocModal');
  s2('#editBookingId','-- Chọn cuộc họp --','#editDocModal'); s2('#editSigners','-- Chọn người ký --','#editDocModal');

  $('#signers').on('change', ()=> renderSignersPreview('#signers','#signersListPreview'));
  $('#editSigners').on('change', ()=> renderSignersPreview('#editSigners','#editSignersListPreview'));

  $('#templateId').on('change', async function(){
    const id = $(this).val();
    if (!id) { quill.setContents([{insert:'\n'}]); $('#templateEditorWrapper').hide(); $('#fileUploadWrapper').show(); $('#docFile').prop('required', true); return; }
    try { const r = await fetch(API.templateById(id)); if (!r.ok) throw r; const t = await r.json(); quill.root.innerHTML = t.content || ''; $('#templateEditorWrapper').show(); $('#fileUploadWrapper').hide(); $('#docFile').prop('required', false); }
    catch (e){ console.error(e); alert('Không tải được mẫu'); }
  });

  $('#saveDraftBtn').on('click', ()=> handleCreateDocument(false));
  $('#submitBtn').on('click', ()=> handleCreateDocument(true));

  await Promise.all([loadBookings(), loadSigners(), loadTemplates()]);
  await loadDocuments();
  handleOpenFromBooking(); // xử lý mở modal tạo văn bản từ cuộc họp
});

// preview helper
function renderSignersPreview(selectSel, previewSel) {
  const arr = $(selectSel).val() || [];
  const $p = $(previewSel); $p.empty();
  arr.forEach((id, i) => {
    const label = $(`${selectSel} option[value="${id}"]`).text() || id;
    $p.append(`<div class="d-flex align-items-center gap-2 mb-1 signer-row" data-uid="${id}" data-step="${i+1}"><span class="badge bg-secondary">${i+1}</span><div class="flex-grow-1">${esc(label)}</div><button class="btn btn-sm btn-outline-danger remove-signer">Xóa</button></div>`);
  });
}
$(document).on('click', '.remove-signer', function(){
  const uid = $(this).closest('.signer-row').data('uid');
  const $sel = $(this).closest('.modal-body').find('select[multiple]').first();
  if ($sel.length){ let v = $sel.val()||[]; v = v.filter(x=>String(x)!==String(uid)); $sel.val(v).trigger('change'); }
});

// loaders
async function loadBookings(){
  try{
    const r = await fetch(API.bookingsList); if (!r.ok) throw r; const d = await r.json();
    const $c = $('#bookingId'), $e = $('#editBookingId'); $c.empty().append('<option></option>'); $e.empty().append('<option value="">-- Không chọn --</option>');
    d.forEach(b=> { const label = `${b.title} (${new Date(b.start_time).toLocaleString()})`; $c.append(new Option(label,b.id)); $e.append(new Option(label,b.id)); });
    $c.trigger('change'); $e.trigger('change');
  } catch(e){ console.error('loadBookings', e); }
}
async function loadSigners(){
  try{
    const r = await fetch(API.users); if (!r.ok) throw r; const d = await r.json();
    const $c = $('#signers'), $e = $('#editSigners'); $c.empty(); $e.empty();
    d.forEach(u=>{ const name = u.full_name||u.username||'(Không tên)'; $c.append(new Option(name,u.id)); $e.append(new Option(name,u.id)); });
    $c.trigger('change'); $e.trigger('change');
  } catch(e){ console.error('loadSigners', e); }
}
async function loadTemplates(){
  try{ const r = await fetch(API.templatesList); if (!r.ok) throw r; const d = await r.json(); const $t = $('#templateId'); $t.empty().append('<option value="">-- Không dùng mẫu --</option>'); d.forEach(t=> $t.append(new Option(t.name,t.id))); $t.trigger('change'); }
  catch(e){ console.error('loadTemplates', e); }
}
// js/documents.js

async function loadDocuments(){
  try{ 
    const me = curUser(); // Lấy ID user từ localStorage
    if (!me) { 
        console.warn("Chưa đăng nhập, không thể tải văn bản."); 
        return; 
    }

    // ✅ QUAN TRỌNG: Phải truyền user_id lên để Server biết đường mà lọc
    const url = `${API.documentsList}?user_id=${me}`;
    
    const r = await fetch(url); 
    if (!r.ok) throw r; 
    const d = await r.json(); 
    
    renderDocumentsTable(d||[]); 
  }
  catch(e){ 
    console.error('loadDocuments', e); 
    $('#documentsTable').html('<tr><td colspan="6" class="text-center text-muted">Không thể tải danh sách văn bản</td></tr>'); 
  }
}

// render
// Helper render status
function getStatusBadge(status) {
    let cls = 'status-draft';
    let icon = 'bi-circle';
    if (status === 'Đang trình ký') { cls = 'status-processing'; icon = 'bi-hourglass-split'; }
    else if (status === 'Đã duyệt') { cls = 'status-approved'; icon = 'bi-check-circle-fill'; }
    else if (status === 'Từ chối') { cls = 'status-rejected'; icon = 'bi-x-circle-fill'; }
    else if (status === 'Chờ trình ký') { cls = 'status-pending'; icon = 'bi-clock'; }
    return `<span class="badge badge-status ${cls}"><i class="bi ${icon}"></i> ${esc(status)}</span>`;
}

// Hàm render chính (Đã tích hợp DataTable)
function renderDocumentsTable(items){
  const me = curUser();
  const $table = $('#documentsTable').closest('table'); // Tìm thẻ <table> chứa tbody

  // 1. Hủy DataTable cũ nếu đã tồn tại (để tránh lỗi khi reload dữ liệu)
  if ($.fn.DataTable.isDataTable($table)) {
      $table.DataTable().destroy();
  }

  // 2. Kiểm tra dữ liệu
  if (!items || !items.length) { 
      $('#documentsTable').html(''); // Xóa trắng body
      // Dù không có dữ liệu vẫn phải khởi tạo DataTable để nó hiện dòng "No data available" chuẩn
      $table.DataTable({ 
          "language": { "url": "//cdn.datatables.net/plug-ins/1.13.6/i18n/vi.json" },
          "searching": false, "paging": false, "info": false
      });
      return; 
  }

  // 3. Render HTML (Logic hiển thị đẹp)
  const rows = items.map((d,i)=> {
    const canEdit = String(d.created_by)===String(me) && d.status==='Nháp';
    const statusBadge = getStatusBadge(d.status);
    
    // Xử lý hiển thị cuộc họp
    // Tìm đoạn bookingHtml cũ và thay bằng đoạn này
    let bookingHtml = '<span class="text-muted small">Không gắn cuộc họp</span>';
    if(d.booking_title) {
        bookingHtml = `
            <div class="d-flex align-items-center">
                <div class="bg-light rounded p-2 me-2 text-primary">
                    <i class="bi bi-calendar-event"></i>
                </div>
                <div>
                    <a href="javascript:void(0)" class="fw-bold small text-decoration-none view-booking-btn" data-id="${d.booking_id}">
                        ${esc(d.booking_title)}
                    </a>
                    <div class="text-muted smaller" style="font-size:11px">
                        <i class="bi bi-info-circle"></i> Bấm để xem chi tiết
                    </div>
                </div>
            </div>`;
    }
    // Các nút thao tác
    let actions = `<button class="btn btn-sm btn-outline-secondary view-signers-btn" data-id="${d.id}" title="Xem luồng ký"><i class="bi bi-diagram-3"></i></button>`;
    
    if (canEdit) {
        actions += `
            <button class="btn btn-sm btn-outline-warning edit-doc-btn ms-1" data-id="${d.id}" title="Sửa"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-primary submit-draft-btn ms-1" data-id="${d.id}" title="Trình ký ngay"><i class="bi bi-send"></i></button>
        `;
    }

    // Tiêu đề
    const titleHtml = `<a href="javascript:void(0)" class="fw-bold text-decoration-none preview-btn" data-path="${d.file_path||''}" data-id="${d.id}">${esc(d.title||'Không tiêu đề')}</a>`;

    // Trả về row HTML
    return `<tr>
      <td class="text-center">${i+1}</td>
      <td>${titleHtml}</td>
      <td>${bookingHtml}</td>
      <td class="text-center">${statusBadge}</td>
      <td><small>${esc(d.creator_name||'—')}</small></td>
      <td class="text-nowrap">${actions}</td>
    </tr>`; 
  }).join('');
  
  // 4. Đẩy HTML vào bảng
  $('#documentsTable').html(rows);

  // 5. KÍCH HOẠT DATATABLE
  $table.DataTable({
      "language": {
            "url": "//cdn.datatables.net/plug-ins/1.13.6/i18n/vi.json"
      },
      "pageLength": 10,
      "lengthMenu": [[5, 10, 25, 50, -1], [5, 10, 25, 50, "Tất cả"]],
      "ordering": false, // Tắt tự sắp xếp của JS để tôn trọng thứ tự từ SQL (Mới nhất lên đầu)
      "destroy": true,   // Đảm bảo không lỗi nếu init lại
      "autoWidth": false // Để Bootstrap tự căn chỉnh cột
  });
}
// create document
async function handleCreateDocument(shouldSubmit=false){
  const form = $('#createDocForm')[0]; const fd = new FormData(form);
  const userId = curUser();
  const templateId = $('#templateId').val(); const signers = $('#signers').val()||[]; const bodyHtml = quill.root.innerHTML;
  fd.set('created_by', userId||''); fd.delete('signers'); fd.append('signers', JSON.stringify(signers));
  if (templateId){ fd.delete('file'); fd.set('generated_body', bodyHtml||''); } else { if (shouldSubmit){ const f = $('#docFile')[0].files[0]; if (!f){ alert('Khi trình ký, vui lòng tải lên file hoặc chọn mẫu.'); return; } } }
  fd.set('status','Nháp');
  try {
    const r = await fetch(API.createDocument, { method:'POST', body: fd }); if (!r.ok) throw r; const res = await r.json();
    if (!res || !res.success){ alert('Lỗi: ' + (res && res.error ? res.error : 'Tạo văn bản thất bại')); return; }
    const docId = res.id;
    if (!docId){ alert('Không nhận được id văn bản'); return; }
    if (shouldSubmit){
      const s = await fetch(API.submitDocument(docId), { method:'POST' }); const sres = await s.json();
      if (!sres || !sres.success){ alert('Lỗi khi trình ký: ' + (sres && sres.error ? sres.error : 'Không xác định')); return; }
      alert('Tạo văn bản và trình ký thành công!');
    } else alert('Lưu nháp thành công!');
    form.reset(); quill.setContents([{insert:'\n'}]); $('#templateEditorWrapper').hide(); $('#fileUploadWrapper').show(); $('#docFile').prop('required', true);
    bootstrap.Modal.getInstance(document.getElementById('createDocModal'))?.hide();
    await loadDocuments();
  } catch(e){ console.error('createDocument', e); alert('Lỗi khi tạo văn bản: '+(e.message||e)); }
}
// ✅ HÀM MỚI: Xử lý khi được chuyển từ trang Booking sang
function handleOpenFromBooking() {
    // Lấy tham số trên URL (ví dụ: ?create_from_booking=105)
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('create_from_booking');

    if (bookingId) {
        console.log("Phát hiện yêu cầu tạo văn bản từ cuộc họp ID:", bookingId);

        const $bookingSelect = $('#bookingId'); // Dropdown chọn cuộc họp

        // Kiểm tra xem ID cuộc họp có tồn tại trong danh sách vừa tải không
        if ($bookingSelect.find(`option[value="${bookingId}"]`).length) {
            
            // 1. Set giá trị cho Select2
            $bookingSelect.val(bookingId).trigger('change');

            // 2. Mở Modal "Tạo mới văn bản"
            const modal = new bootstrap.Modal(document.getElementById('createDocModal'));
            modal.show();

            // 3. (Tùy chọn) Xóa tham số trên URL đi cho đẹp (để F5 không bị mở lại)
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            
        } else {
            alert('Cuộc họp này không hợp lệ hoặc đã quá hạn để lập văn bản.');
        }
    }
}
// submit draft
$(document).on('click', '.submit-draft-btn', async function(){
  const docId = $(this).data('id'); if (!confirm('Xác nhận trình ký văn bản này? Sau khi trình ký sẽ không thể chỉnh sửa.')) return;
  try { const r = await fetch(API.submitDocument(docId), { method:'POST' }); const res = await r.json(); if (res && res.success){ alert('Trình ký thành công!'); await loadDocuments(); } else alert('Lỗi: ' + (res && res.error ? res.error : 'Không xác định')); } catch(e){ console.error('submit', e); alert('Lỗi khi trình ký'); }
});

// view signers modal (thay thế toàn bộ handler cũ)
$(document).on('click', '.view-signers-btn', async function(){
  const docId = $(this).data('id');
  const $body = $('#modal-content');
  $body.html('<div class="d-flex justify-content-center py-4"><div class="spinner-border text-primary" role="status"></div></div>');
  
  try {
    const r = await fetch(API.getSigners(docId));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();

    if (!data || !data.length) {
      $body.html('<div class="text-center text-muted py-4"><i class="bi bi-people fs-1 d-block mb-2"></i>Chưa thiết lập người ký.</div>');
      new bootstrap.Modal(document.getElementById('signersModal')).show();
      return;
    }

    const me = curUser();
    let timelineHtml = '<div class="timeline">';

    data.forEach(s => {
      const name = esc(s.full_name || s.signer_id);
      const isMySigner = String(s.signer_id) === String(me);
      
      let markerClass = 'waiting';
      let statusText = 'Chờ xử lý';
      let statusColor = 'text-muted';
      let actionHtml = '';

      // Xác định trạng thái để tô màu marker và text
      if (s.status === 'Đang trình ký') {
        markerClass = 'active'; // Màu xanh dương nhấp nháy
        statusText = 'Đang chờ ký...';
        statusColor = 'text-primary fw-bold';
      } else if (s.status === 'Đã ký') {
        markerClass = 'success'; // Màu xanh lá
        statusText = 'Đã ký duyệt';
        statusColor = 'text-success';
      } else if (s.status === 'Từ chối') {
        markerClass = 'danger'; // Màu đỏ
        statusText = 'Đã từ chối';
        statusColor = 'text-danger';
      }

      // Nếu là lượt của mình và đang trình ký -> Hiện nút hành động NGAY TRONG TIMELINE
      if (isMySigner && s.status === 'Đang trình ký') {
          actionHtml = `
            <div class="mt-2 pt-2 border-top">
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-success flex-grow-1 sign-btn" data-id="${docId}" data-action="signed" data-signer="${s.signer_id}">
                        <i class="bi bi-pen"></i> Ký duyệt ngay
                    </button>
                    <button class="btn btn-sm btn-outline-danger flex-grow-1 sign-btn" data-id="${docId}" data-action="rejected" data-signer="${s.signer_id}">
                        <i class="bi bi-x-circle"></i> Từ chối
                    </button>
                </div>
            </div>
          `;
      }
      
      // Hiển thị thời gian
      const timeHtml = s.signed_at 
        ? `<small class="text-muted"><i class="bi bi-clock-history"></i> ${new Date(s.signed_at).toLocaleString()}</small>` 
        : '';

      timelineHtml += `
        <div class="timeline-item">
            <div class="timeline-marker ${markerClass}"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <h6 class="timeline-title">
                        Bước ${s.step}: ${name} 
                        ${isMySigner ? '<span class="badge bg-warning text-dark ms-1" style="font-size:10px">Bạn</span>' : ''}
                    </h6>
                    ${timeHtml}
                </div>
                <div class="timeline-status ${statusColor}">
                    ${statusText}
                </div>
                ${actionHtml}
            </div>
        </div>
      `;
    });
    timelineHtml += '</div>';

    // Thêm một chút thông tin tổng quan ở trên đầu modal
    const headerInfo = `<div class="alert alert-light border-0 bg-light mb-3">
        <small class="text-muted">Danh sách người ký theo thứ tự ưu tiên từ trên xuống dưới.</small>
    </div>`;

    $body.html(headerInfo + timelineHtml);
    new bootstrap.Modal(document.getElementById('signersModal')).show();

  } catch (e) {
    console.error('viewSigners', e);
    $body.html('<div class="text-center text-danger">Lỗi khi tải luồng ký</div>');
  }
});

// sign / reject
// CLICK SIGN BUTTON
$(document).on('click', '.sign-btn', async function () {
  const docId = $(this).data('id');
  const action = $(this).data('action');
  const userId = curUser();

  try {
    // --- 1) LẤY THÔNG TIN LUỒNG KÝ ĐỂ KIỂM TRA ---
  const signerRes = await fetch(API.getSigners(docId));
  if (!signerRes.ok) throw new Error("Không lấy được thông tin luồng ký");

  const signerData = await signerRes.json();
  const myStep = signerData.find(s => String(s.signer_id) === String(userId));

  if (!myStep) {
    alert("Bạn không nằm trong luồng ký của văn bản này.");
    return;
  }

  if (myStep.status !== 'Đang trình ký') {
    alert("Hiện tại chưa tới lượt ký của bạn (Trạng thái: " + myStep.status + ")");
    return;
  }


    // --- 2) CONFIRM ---
    if (!confirm(
      action === 'signed'
        ? 'Xác nhận ký văn bản này?'
        : 'Bạn chắc chắn muốn từ chối ký văn bản này?'
    )) return;

    // --- 3) GỌI API KÝ ---
  const r = await fetch(API.documentSign(docId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signer_id: userId, action }) // dùng signer_id
  });


    if (!r.ok) throw r;

    const res = await r.json();

    if (res && res.success) {
      alert('Cập nhật trạng thái thành công.');

      // Reload danh sách người ký
      $(`.view-signers-btn[data-id="${docId}"]`).trigger('click');

      // Cập nhật trạng thái văn bản
      const st = await (await fetch(API.documentById(docId))).json();
      $(`.doc-status[data-id="${docId}"]`).text(st.status);
    } else {
      alert('Lỗi: ' + (res && res.error ? res.error : 'Không xác định'));
    }

  } catch (e) {
    console.error('sign', e);
    alert('Lỗi khi cập nhật trạng thái');
  }
});


// preview
$(document).on('click', '.preview-btn', function(){
  const filePath = $(this).data('path'); const docId = $(this).data('id');
  $('#docPreviewFrame').hide().attr('src',''); $('#docGeneratedContent').hide().html('');
  if (!filePath || filePath==='null' || filePath===''){ showGeneratedContent(docId); return; }
  const url = location.origin + filePath;
  if (filePath.toLowerCase().endsWith('.pdf')){ $('#docPreviewFrame').attr('src',url).show(); $('#docGeneratedContent').hide(); new bootstrap.Modal(document.getElementById('docPreviewModal')).show(); }
  else window.open(url,'_blank');
});
async function showGeneratedContent(docId){
  try {
    const r = await fetch(API.documentById(docId)); if (!r.ok) throw r; const data = await r.json(); const doc = data.document||data;
    if (doc.generated_body){ $('#docGeneratedContent').html(doc.generated_body).show(); new bootstrap.Modal(document.getElementById('docPreviewModal')).show(); } else alert('Không có nội dung để hiển thị');
  } catch(e){ console.error('showGeneratedContent', e); alert('Lỗi khi tải nội dung văn bản'); }
}
$('#docPreviewModal').on('hidden.bs.modal', ()=>{ $('#docPreviewFrame').attr('src','').hide(); $('#docGeneratedContent').html('').hide(); });

// edit
$(document).on('click', '.edit-doc-btn', async function(){
  const docId = $(this).data('id');
  try {
    $('#editDocForm')[0].reset(); $('#editBookingId').val(null).trigger('change'); $('#editSigners').val(null).trigger('change');
    if ($('#editBookingId option').length<=1) await loadBookings();
    if ($('#editSigners option').length===0) await loadSigners();
    const r = await fetch(API.documentById(docId)); if (!r.ok) throw r; const data = await r.json();
    const doc = data.document||data; const signers = data.signers || (data.signers_list||[]).map(s=>s.signer_id) || [];
    $('#editDocId').val(doc.id); $('#editDocTitle').val(doc.title||''); $('#editDocDescription').val(doc.description||''); $('#editBookingId').val(doc.booking_id||'').trigger('change'); $('#editSigners').val(signers).trigger('change');
    new bootstrap.Modal(document.getElementById('editDocModal')).show();
  } catch(e){ console.error('edit open', e); alert('Lỗi khi tải thông tin văn bản'); }
});
$('#editDocForm').on('submit', async function(e){
  e.preventDefault();
  const docId = $('#editDocId').val(); const title = $('#editDocTitle').val(); const description = $('#editDocDescription').val(); const booking_id = $('#editBookingId').val(); const signers = $('#editSigners').val()||[];
  try {
    const r = await fetch(API.updateDocument(docId), { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title, description, booking_id: booking_id||null, signers }) });
    if (!r.ok) throw r; const res = await r.json();
    if (res && res.success){ alert('Cập nhật văn bản thành công!'); bootstrap.Modal.getInstance(document.getElementById('editDocModal'))?.hide(); await loadDocuments(); } else alert('Lỗi: ' + (res && res.error ? res.error : 'Không xác định'));
  } catch(e){ console.error('update', e); alert('Lỗi khi cập nhật văn bản'); }
});
// Xử lý khi bấm vào tên cuộc họp trong bảng văn bản
$(document).on('click', '.view-booking-btn', async function(){
    const bookingId = $(this).data('id');
    const $modal = new bootstrap.Modal(document.getElementById('linkedBookingModal'));
    const $content = $('#linkedBookingContent');
    
    $modal.show();
    $content.html('<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>');

    try {
        // ✅ 1. Gọi API có sẵn của bạn: /detail
        const r = await fetch(`/api/bookings/${bookingId}/detail`);
        
        if(!r.ok) throw new Error('Không tìm thấy thông tin cuộc họp');
        const b = await r.json();

        // Xử lý hiển thị thời gian
        const timeStr = `${new Date(b.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(b.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        const dateStr = new Date(b.start_time).toLocaleDateString('vi-VN');

        // ✅ 2. Xử lý hiển thị danh sách người tham gia (Dữ liệu API bạn trả về rất đầy đủ)
        let participantsHtml = '';
        
        // Hiển thị Team
        if (b.teams && b.teams.length > 0) {
            const teamNames = b.teams.map(t => `<span class="badge bg-primary me-1">${esc(t.name)}</span>`).join('');
            participantsHtml += `<div class="mb-1"><small class="text-muted fw-bold">Team:</small> ${teamNames}</div>`;
        }
        
        // Hiển thị Cá nhân
        if (b.participants && b.participants.length > 0) {
            const userNames = b.participants.map(p => esc(p.full_name)).join(', ');
            participantsHtml += `<div><small class="text-muted fw-bold">Thành viên:</small> <span class="text-dark small">${userNames}</span></div>`;
        }
        
        if (!participantsHtml) participantsHtml = '<span class="text-muted fst-italic small">Không có người tham dự</span>';

        // ✅ 3. Render HTML (Khớp với các trường: booked_by, room_name...)
        const html = `
            <div class="list-group list-group-flush">
                <div class="list-group-item bg-light">
                    <small class="text-uppercase text-muted fw-bold" style="font-size: 0.75rem;">Chủ đề cuộc họp</small>
                    <div class="fw-bold fs-5 text-primary mt-1">${esc(b.title)}</div>
                </div>

                <div class="list-group-item">
                    <div class="row g-2">
                        <div class="col-6">
                            <small class="text-muted"><i class="bi bi-calendar3"></i> Ngày họp</small>
                            <div class="fw-medium">${dateStr}</div>
                        </div>
                        <div class="col-6">
                            <small class="text-muted"><i class="bi bi-clock"></i> Thời gian</small>
                            <div class="fw-medium">${timeStr}</div>
                        </div>
                    </div>
                </div>

                <div class="list-group-item">
                    <div class="row g-2">
                         <div class="col-6">
                             <small class="text-muted"><i class="bi bi-geo-alt-fill text-danger"></i> Phòng họp</small>
                             <div class="fw-medium">${esc(b.room_name || 'Chưa xác định')}</div>
                         </div>
                         <div class="col-6">
                             <small class="text-muted"><i class="bi bi-person-badge-fill text-info"></i> Người đặt</small>
                             <div class="fw-medium">${esc(b.booked_by || 'Admin')}</div>
                        </div>
                    </div>
                </div>

                <div class="list-group-item">
                     <small class="text-muted mb-1 d-block"><i class="bi bi-people-fill"></i> Thành phần tham dự</small>
                     ${participantsHtml}
                </div>

                <div class="list-group-item">
                     <small class="text-muted">Mô tả / Nội dung</small>
                     <div class="fst-italic bg-body-secondary p-2 rounded mt-1 small">${esc(b.description || 'Không có mô tả chi tiết')}</div>
                </div>
            </div>
        `;
        $content.html(html);

    } catch (e) {
        console.error(e);
        $content.html(`
            <div class="alert alert-warning border-0 d-flex align-items-center" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <div>
                    Không thể tải thông tin cuộc họp.<br>
                    <small class="text-muted">Có thể cuộc họp này đã bị xóa hoặc bạn không có quyền xem.</small>
                </div>
            </div>
        `);
    }
});