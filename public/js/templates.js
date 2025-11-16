async function loadTemplates() {
  const tbody = document.getElementById('templatesTable');
  tbody.innerHTML = `
    <tr><td colspan="4" class="text-center text-muted">Đang tải...</td></tr>
  `;

  try {
    const res = await fetch('/api/document_templates');
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();

    tbody.innerHTML = '';

    data.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.id}</td>
        <td>${t.name}</td>
        <td>${t.description || ''}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1 btn-view" data-id="${t.id}">
            Xem
          </button>
          <button class="btn btn-sm btn-outline-success btn-download" data-id="${t.id}">
            Tải xuống
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (!data.length) {
      tbody.innerHTML = `
        <tr><td colspan="4" class="text-center text-muted">Không có mẫu nào.</td></tr>
      `;
    }

    // gắn event cho nút
    bindTemplateEvents();

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr><td colspan="4" class="text-danger text-center">Lỗi tải dữ liệu</td></tr>
    `;
  }
}

function bindTemplateEvents() {
  // Nút Xem
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;

      try {
        const res = await fetch(`/api/document_templates/${id}`);
        if (!res.ok) throw new Error('API error');
        const tpl = await res.json();

        const contentDiv = document.getElementById('templateContent');

        if (tpl.content) {
          contentDiv.innerHTML = tpl.content || '(Không có nội dung)';
        } else if (tpl.file_path) {
          contentDiv.innerHTML = `
            <p>Đây là file đính kèm.</p>
            <a href="/${tpl.file_path}" class="btn btn-primary" target="_blank">
              Mở file
            </a>
          `;
        } else {
          contentDiv.textContent = '(Không có nội dung)';
        }

        const modal = new bootstrap.Modal(document.getElementById('viewModal'));
        modal.show();

      } catch (e) {
        alert('Không tải được mẫu');
        console.error(e);
      }
    });
  });

  // Nút Tải xuống
  document.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;

      try {
        const res = await fetch(`/api/document_templates/${id}`);
        if (!res.ok) throw new Error('API error');
        const tpl = await res.json();

        if (!tpl.file_path) {
          alert('Mẫu này không có file để tải');
          return;
        }

        window.location.href = '/' + tpl.file_path;
      } catch (e) {
        alert('Không tải được file');
        console.error(e);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', loadTemplates);
