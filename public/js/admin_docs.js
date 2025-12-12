let TEMPLATES = [];
let templatesState = { page: 1, perPage: 10, q: '' };
let quillDoc;

// ============================================================
// 1. INIT (KHỞI TẠO)
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1.1 Khởi tạo Quill Editor
    quillDoc = new Quill('#doc_content_editor', {
        theme: 'snow',
        placeholder: 'Nhập nội dung mẫu văn bản...',
        modules: {
            toolbar: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                ['link', 'image', 'code-block'],
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['clean']
            ]
        }
    });

    // 1.2 Xử lý đọc file Word (Mammoth)
    // Lắng nghe sự kiện ở ô chọn file (type="file")
    const fileInput = document.getElementById('doc_file_upload');
    
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Tự động điền tên file vào ô "URL/Đường dẫn" để lưu vào DB
            const pathInput = document.getElementById('doc_file_path');
            if (pathInput) pathInput.value = file.name;

            // Kiểm tra đuôi file
            if (!file.name.endsWith('.docx')) {
                alert('Chỉ hỗ trợ đọc nội dung file .docx (Word)');
                return;
            }

            // Đọc file
            const reader = new FileReader();
            reader.onload = function(loadEvent) {
                const arrayBuffer = loadEvent.target.result;
                
                // Gọi thư viện Mammoth
                if (typeof mammoth !== 'undefined') {
                    mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
                        .then(function(result) {
                            // Dán nội dung vào Quill
                            quillDoc.clipboard.dangerouslyPasteHTML(result.value);
                            console.log('Đã lấy nội dung từ file Word thành công!');
                        })
                        .catch(function(err) {
                            console.error(err);
                            alert('Lỗi khi đọc file Word. File có thể bị hỏng.');
                        });
                } else {
                    alert('Lỗi: Thư viện Mammoth chưa được tải trong file HTML.');
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // 1.3 Gán sự kiện cho các nút
    const btnCreate = document.getElementById('btn-create-doc');
    if (btnCreate) btnCreate.addEventListener('click', openCreateDocModal);

    const btnSave = document.getElementById('saveDoc');
    if (btnSave) btnSave.addEventListener('click', saveDoc);

    // 1.4 Sự kiện tìm kiếm & Phân trang
    const searchInput = document.getElementById('docs-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => { 
            templatesState.page = 1; 
            renderTemplates(); 
        });
    }

    const perPageSelect = document.getElementById('docs-per-page');
    if (perPageSelect) {
        perPageSelect.addEventListener('change', () => { 
            templatesState.page = 1; 
            renderTemplates(); 
        });
    }

    // 1.5 Tải dữ liệu lần đầu
    await loadTemplates();
});

// ============================================================
// 2. CÁC HÀM XỬ LÝ DỮ LIỆU (LOAD & RENDER)
// ============================================================

async function loadTemplates() {
    try {
        if (typeof api === 'function') {
            TEMPLATES = await api('/document_templates');
            renderTemplates();
        } else {
            console.error("Hàm api() chưa được định nghĩa (kiểm tra main.js)");
        }
    } catch (e) { 
        console.error("Lỗi tải danh sách mẫu:", e); 
    }
}

function renderTemplates() {
    const searchEl = document.getElementById('docs-search');
    const perPageEl = document.getElementById('docs-per-page');
    const tbody = document.querySelector('#docsTable tbody');
    const statsEl = document.getElementById('docs-stats');
    const pagEl = document.getElementById('docs-pagination');

    if (!tbody) return;

    // Lấy tham số filter
    const q = (searchEl ? searchEl.value : '').toLowerCase();
    templatesState.q = q;
    templatesState.perPage = parseInt(perPageEl ? perPageEl.value : 10, 10);

    // Filter dữ liệu
    const filtered = TEMPLATES.filter(t => {
        if (!q) return true;
        return (t.id && t.id.toString().includes(q)) ||
               (t.name && t.name.toLowerCase().includes(q)) ||
               (t.description && t.description.toLowerCase().includes(q));
    });

    // Phân trang (Sử dụng hàm paginate từ main.js nếu có)
    let pData = filtered;
    let pTotal = filtered.length;
    let pPages = 1;

    if (typeof paginate === 'function') {
        const p = paginate(filtered, templatesState.page, templatesState.perPage);
        pData = p.data;
        pTotal = p.total;
        pPages = p.pages;
    }

    // Render HTML
    tbody.innerHTML = '';
    pData.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-semibold text-center">${t.id}</td>
            <td><span class="fw-medium text-dark">${t.name || ''}</span></td>
            <td><span class="truncate text-muted" style="max-width:250px">${t.description || ''}</span></td>
            <td><span class="badge bg-light text-dark border">${t.created_by_name || t.created_by || '---'}</span></td>
            <td class="small text-muted">${t.created_at ? new Date(t.created_at).toLocaleDateString('vi-VN') : ''}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary me-1 view-doc" data-id="${t.id}" title="Xem">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-info me-1 edit-doc" data-id="${t.id}" title="Sửa">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-doc" data-id="${t.id}" title="Xóa">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Cập nhật thông tin phân trang
    if (statsEl) statsEl.textContent = `Hiển thị ${pData.length}/${pTotal} mẫu`;
    
    if (pagEl && typeof renderPagination === 'function') {
        renderPagination(pagEl, pPages, templatesState.page, (page) => {
            templatesState.page = page;
            renderTemplates();
        });
    }

    // Gán sự kiện click cho các nút trong bảng
    document.querySelectorAll('.view-doc').forEach(btn =>
        btn.addEventListener('click', e => openViewDocModal(e.target.closest('button').dataset.id))
    );

    document.querySelectorAll('.edit-doc').forEach(btn =>
        btn.addEventListener('click', e => openDocModal(e.target.closest('button').dataset.id))
    );

    document.querySelectorAll('.delete-doc').forEach(btn =>
        btn.addEventListener('click', e => askDelete('document_templates', e.target.closest('button').dataset.id))
    );
}

// ============================================================
// 3. CÁC MODAL (VIEW, CREATE, EDIT)
// ============================================================

async function openViewDocModal(id) {
    try {
        const res = await fetch(`/api/document_templates/${id}`);
        const tpl = await res.json();

        document.getElementById('viewDocTitle').textContent = tpl.name;

        // Xử lý nội dung hiển thị
        let finalContent = tpl.content || '';
        if (finalContent === '<p><br></p>') finalContent = '';

        // Nếu có file đính kèm, hiển thị nút tải về
        if (tpl.file_path) {
            finalContent += `
                <div class="mt-4 pt-3 border-top">
                    <p class="fw-bold mb-2 small text-uppercase text-muted"><i class="bi bi-paperclip"></i> Tài liệu gốc / Đường dẫn:</p>
                    <div class="alert alert-light border d-flex align-items-center justify-content-between">
                        <span class="text-truncate me-3 text-primary">
                            <i class="bi bi-file-earmark-word me-2"></i>${tpl.file_path}
                        </span>
                        <a href="${tpl.file_path}" target="_blank" class="btn btn-sm btn-outline-primary text-nowrap">
                            <i class="bi bi-download"></i> Tải về / Xem
                        </a>
                    </div>
                </div>
            `;
        }

        if (!finalContent) {
            finalContent = '<div class="text-center py-5 text-muted"><i class="bi bi-inbox display-4 d-block mb-3"></i>Không có nội dung hiển thị</div>';
        }

        document.getElementById('viewDocContent').innerHTML = finalContent;
        new bootstrap.Modal('#modalViewDoc').show();

    } catch (err) {
        console.error(err);
        alert('Lỗi tải nội dung mẫu');
    }
}

function openCreateDocModal() {
    document.getElementById('modalDocTitle').textContent = 'Thêm mẫu văn bản';
    
    // Reset form
    ['doc_id', 'doc_name', 'doc_description', 'doc_file_path', 'doc_file_upload'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    quillDoc.setText('');
    quillDoc.enable(true);
    document.getElementById('saveDoc').style.display = '';

    new bootstrap.Modal(document.getElementById('modalDoc')).show();
}

async function openDocModal(id) {
    try {
        const t = await api(`/document_templates/${id}`);

        document.getElementById('modalDocTitle').textContent = `Sửa mẫu #${t.id}`;
        document.getElementById('doc_id').value = t.id;
        document.getElementById('doc_name').value = t.name || '';
        document.getElementById('doc_description').value = t.description || '';
        document.getElementById('doc_file_path').value = t.file_path || '';
        
        // Reset ô chọn file
        const fileUpload = document.getElementById('doc_file_upload');
        if (fileUpload) fileUpload.value = '';

        quillDoc.setContents(quillDoc.clipboard.convert(t.content || ''));
        quillDoc.enable(true);
        document.getElementById('saveDoc').style.display = '';

        new bootstrap.Modal(document.getElementById('modalDoc')).show();
    } catch (e) {
        console.error(e);
        alert("Không tải được dữ liệu mẫu.");
    }
}

// ============================================================
// 4. HÀM LƯU (SAVE) - QUAN TRỌNG
// ============================================================
// ------------------ 4. HÀM LƯU (SAVE) - FINAL FIX ------------------
async function saveDoc() {
    // 1. KHAI BÁO BIẾN "id" NGAY DÒNG ĐẦU TIÊN (Để không bao giờ bị lỗi undefined)
    const id = document.getElementById('doc_id').value.trim(); 

    // 2. Lấy User ID từ localStorage
    // Chú ý: Cú pháp đúng là localStorage.getItem('id') - có ngoặc tròn
    const currentUserId = localStorage.getItem('id'); 
    
    console.log("--- DEBUG SAVE ---");
    console.log("ID văn bản (id):", id);
    console.log("ID người tạo (currentUserId):", currentUserId);

    // Kiểm tra đăng nhập
    if (!currentUserId) {
        alert("Lỗi: Không tìm thấy ID người dùng (Bạn chưa đăng nhập hoặc đã mất phiên).");
        return;
    }

    const payload = {
        name: document.getElementById('doc_name').value.trim(),
        description: document.getElementById('doc_description').value.trim(),
        content: quillDoc.root.innerHTML,
        file_path: document.getElementById('doc_file_path').value.trim(),
        
        // 3. Gửi nguyên chuỗi ID lấy từ localStorage (Ví dụ: "E000")
        created_by: currentUserId 
    };

    if (!payload.name) { alert('Vui lòng nhập tên mẫu!'); return; }

    try {
        const btnSave = document.getElementById('saveDoc');
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang lưu...';

        // 4. LOGIC XỬ LÝ (Dùng biến "id" đã khai báo ở dòng 1)
        if (id) {
            // Nếu có id -> Là Cập nhật (PUT)
            await api(`/document_templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            alert('Cập nhật mẫu thành công!');
        } else {
            // Nếu không có id -> Là Thêm mới (POST)
            await api('/document_templates', { method: 'POST', body: JSON.stringify(payload) });
            alert('Thêm mới mẫu thành công!');
        }

        loadTemplates();
        
        // Đóng modal
        const modalEl = document.getElementById('modalDoc');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();

    } catch (err) {
        console.error(err);
        // Bắt lỗi Foreign Key cụ thể để báo cho dễ hiểu
        if (err.message && err.message.includes("foreign key constraint fails")) {
            alert(`Lỗi Dữ Liệu: Mã nhân viên "${currentUserId}" chưa có trong danh sách Nhân sự.\nVui lòng vào tab Nhân sự tạo mã "${currentUserId}" trước.`);
        } else {
            alert('Lỗi: ' + err.message);
        }
    } finally {
        const btnSave = document.getElementById('saveDoc');
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = 'Lưu mẫu';
        }
    }
}