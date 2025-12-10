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
async function loadDocuments(){
  try{ const r = await fetch(API.documentsList); if (!r.ok) throw r; const d = await r.json(); renderDocumentsTable(d||[]); }
  catch(e){ console.error('loadDocuments', e); $('#documentsTable').html('<tr><td colspan="6" class="text-center text-muted">Không tải được danh sách văn bản</td></tr>'); }
}

// render
function renderDocumentsTable(items){
  const me = curUser();
  if (!items || !items.length) { $('#documentsTable').html('<tr><td colspan="6" class="text-center text-muted">Chưa có văn bản</td></tr>'); return; }
  const rows = items.map((d,i)=> {
    const canEdit = String(d.created_by)===String(me) && d.status==='Nháp';
    return `<tr>
      <td>${i+1}</td>
      <td><button class="btn btn-link p-0 preview-btn" data-path="${d.file_path||''}" data-id="${d.id}">${esc(d.title||'')}</button></td>
      <td>${esc(d.booking_title||'-')}</td>
      <td class="doc-status" data-id="${d.id}">${esc(d.status||'')}</td>
      <td>${esc(d.creator_name||'—')}</td>
      <td><button class="btn btn-sm btn-outline-primary view-signers-btn" data-id="${d.id}">Xem</button>${canEdit?` <button class="btn btn-sm btn-outline-warning edit-doc-btn ms-1" data-id="${d.id}"><i class="bi bi-pencil"></i> Sửa</button> <button class="btn btn-sm btn-outline-success submit-draft-btn ms-1" data-id="${d.id}"><i class="bi bi-send"></i> Trình ký</button>`:''}</td>
    </tr>`; }).join('');
  $('#documentsTable').html(rows);
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

// submit draft
$(document).on('click', '.submit-draft-btn', async function(){
  const docId = $(this).data('id'); if (!confirm('Xác nhận trình ký văn bản này? Sau khi trình ký sẽ không thể chỉnh sửa.')) return;
  try { const r = await fetch(API.submitDocument(docId), { method:'POST' }); const res = await r.json(); if (res && res.success){ alert('Trình ký thành công!'); await loadDocuments(); } else alert('Lỗi: ' + (res && res.error ? res.error : 'Không xác định')); } catch(e){ console.error('submit', e); alert('Lỗi khi trình ký'); }
});

// view signers modal (thay thế toàn bộ handler cũ)
$(document).on('click', '.view-signers-btn', async function(){
  const docId = $(this).data('id');
  const $body = $('#modal-content');
  $body.html('<div class="text-center text-muted">Đang tải...</div>');
  try {
    const r = await fetch(API.getSigners(docId));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();

    if (!data || !data.length) {
      $body.html('<div class="text-center text-muted">Chưa có người ký nào.</div>');
      new bootstrap.Modal(document.getElementById('signersModal')).show();
      return;
    }

    const me = curUser();

    // build rows safely (tính toán JS trước khi put vào template string)
    const rowsHtml = data.map(s => {
      const name = esc(s.full_name || s.signer_id);
      const status = esc(s.status || '');
      const signedAt = s.signed_at ? esc(new Date(s.signed_at).toLocaleString()) : '-';

      const isMySigner = String(s.signer_id) === String(me);
      // const isMyTurn = isMySigner && s.status === 'Đang trình ký';

      let actionCell = '-';
      if (isMySigner) {
              if (s.status === 'Đang trình ký') {
                  // Case 1: Đến lượt => Hiện nút
                  actionCell = `
                      <button class="btn btn-success btn-sm sign-btn me-1" data-id="${docId}" data-action="signed" data-signer="${s.signer_id}">Ký</button>
                      <button class="btn btn-danger btn-sm sign-btn" data-id="${docId}" data-action="rejected" data-signer="${s.signer_id}">Từ chối</button>
                  `;
              } else if (s.status === 'Đã ký') {
                  // Case 2: Đã ký xong => Hiện text xanh
                  actionCell = `<span class="text-success fw-bold"><i class="bi bi-check-circle"></i> Đã hoàn thành</span>`;
              } else if (s.status === 'Từ chối') {
                  // Case 3: Đã từ chối => Hiện text đỏ
                  actionCell = `<span class="text-danger fw-bold"><i class="bi bi-x-circle"></i> Đã từ chối</span>`;
              } else {
                  // Case 4: Chờ trình ký / Nháp => Hiện text xám
                  actionCell = `<span class="text-muted fst-italic">Chưa tới lượt</span>`;
              }
            }
      return `<tr>
        <td>${name}</td>
        <td>${status}</td>
        <td>${signedAt}</td>
        <td>${actionCell}</td>
      </tr>`;
    }).join('');

    $body.html(`<table class="table table-bordered align-middle">
      <thead class="table-light">
        <tr><th>Người ký</th><th>Trạng thái</th><th>Thời gian ký</th><th>Thao tác</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`);

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
