document.addEventListener('DOMContentLoaded', () => {
    // 1. Tải danh sách
    loadTemplates();

    // 2. Tính năng tìm kiếm nhanh (Client-side)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            const keyword = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#templatesTable tr');
            
            let visibleCount = 0;
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                if(text.includes(keyword)) {
                    row.style.display = '';
                    visibleCount++;
                } else {
                    row.style.display = 'none';
                }
            });
            
            const totalEl = document.getElementById('totalRecords');
            if(totalEl) totalEl.textContent = `Tìm thấy ${visibleCount} kết quả`;
        });
    }
});

// Hàm tải danh sách (Dùng fetch chuẩn)
async function loadTemplates() {
    const tbody = document.getElementById('templatesTable');
    if (!tbody) return;

    // Loading...
    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="text-center py-5 text-muted">
                <div class="spinner-border spinner-border-sm mb-2"></div>
                <div>Đang tải dữ liệu...</div>
            </td>
        </tr>
    `;

    try {
        // --- SỬA LẠI DÙNG FETCH CHUẨN (KHÔNG DÙNG HÀM api()) ---
        const res = await fetch('/api/document_templates');
        if (!res.ok) throw new Error('Lỗi kết nối API: ' + res.status);
        const data = await res.json();
        // -------------------------------------------------------

        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-5">
                        <i class="bi bi-inbox fs-1 text-muted opacity-50 mb-3 d-block"></i>
                        <span class="text-muted">Chưa có mẫu văn bản nào.</span>
                    </td>
                </tr>`;
            return;
        }

        // Render giao diện đẹp
        data.forEach((t, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 fw-bold text-muted text-center">${index + 1}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="bg-primary bg-opacity-10 text-primary rounded p-2 me-3 d-flex align-items-center justify-content-center" style="width:40px; height:40px;">
                            <i class="bi bi-file-earmark-text fs-5"></i>
                        </div>
                        <span class="doc-name fw-bold text-dark">${t.name}</span>
                    </div>
                </td>
                <td>
                    <div class="desc-truncate text-secondary" style="max-width: 400px;" title="${t.description || ''}">
                        ${t.description || '<span class="small fst-italic text-muted">Không có mô tả</span>'}
                    </div>
                </td>
                <td class="text-center px-4">
                    <button class="btn btn-sm btn-outline-primary shadow-sm" onclick="openViewModal(${t.id})">
                        <i class="bi bi-eye me-1"></i> Xem & Tải
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        const totalEl = document.getElementById('totalRecords');
        if(totalEl) totalEl.textContent = `Tổng cộng: ${data.length} mẫu văn bản`;

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

// Hàm xem chi tiết (Dùng fetch chuẩn)
async function openViewModal(id) {
    try {
        // --- SỬA LẠI DÙNG FETCH CHUẨN ---
        const res = await fetch(`/api/document_templates/${id}`);
        if (!res.ok) throw new Error('Không tìm thấy mẫu');
        const tpl = await res.json();
        // --------------------------------

        const modalBody = document.getElementById('templateContent');
        if (!modalBody) return;

        let contentHtml = '';

        // 1. Phần hiển thị File (Nếu có)
        if(tpl.file_path) {
            // Sửa đường dẫn nếu cần thiết (bỏ dấu / đầu nếu thừa)
            const safePath = tpl.file_path.startsWith('/') ? tpl.file_path : '/' + tpl.file_path;
            
            contentHtml += `
                <div class="alert alert-light border d-flex align-items-center shadow-sm mb-4">
                    <div class="bg-white p-2 rounded border me-3">
                        <i class="bi bi-paperclip fs-3 text-primary"></i>
                    </div>
                    <div class="flex-grow-1">
                        <strong class="d-block text-dark">Tài liệu đính kèm</strong>
                        <small class="text-muted text-truncate d-block" style="max-width: 350px;">${tpl.file_path}</small>
                    </div>
                    <a href="${safePath}" target="_blank" class="btn btn-primary btn-sm fw-medium px-3">
                        <i class="bi bi-download me-1"></i> Tải về
                    </a>
                </div>
            `;
        }

        // 2. Phần nội dung HTML
        contentHtml += `
            <div class="card border shadow-none bg-light">
                <div class="card-header bg-white border-bottom py-3">
                    <h5 class="text-center text-uppercase fw-bold mb-0 text-primary">${tpl.name}</h5>
                </div>
                <div class="card-body bg-white p-4" style="min-height: 400px; overflow-y: auto;">
                    <div class="document-body text-dark">
                        ${tpl.content || '<div class="text-center text-muted py-5"><i class="bi bi-file-earmark-x display-4 d-block mb-3 opacity-25"></i>Nội dung hiển thị trống</div>'}
                    </div>
                </div>
            </div>
        `;

        modalBody.innerHTML = contentHtml;
        new bootstrap.Modal(document.getElementById('viewModal')).show();

    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}