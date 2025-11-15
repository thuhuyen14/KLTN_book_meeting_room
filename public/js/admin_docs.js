let TEMPLATES = [];
let templatesState = { page: 1, perPage: 10, q: '' };
let quillDoc;

// ------------------ INIT ------------------
document.addEventListener('DOMContentLoaded', async () => {
  quillDoc = new Quill('#doc_content_editor', {
    theme: 'snow',
    placeholder: 'Nhập nội dung mẫu văn bản...',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        ['link', 'image', 'code-block'],
        [{ list: 'ordered'}, { list: 'bullet' }],
        ['clean']
      ]
    }
  });

  await loadTemplates();

  document.getElementById('btn-create-doc').addEventListener('click', openCreateDocModal);
  document.getElementById('saveDoc').addEventListener('click', saveDoc);

  document.getElementById('docs-search').addEventListener('input', () => { templatesState.page = 1; renderTemplates(); });
  document.getElementById('docs-per-page').addEventListener('change', () => { templatesState.page = 1; renderTemplates(); });
});

// ------------------ LOAD DATA ------------------
async function loadTemplates() {
  TEMPLATES = await api('/document_templates');
  renderTemplates();
}

// ------------------ RENDER LIST ------------------
function renderTemplates() {
  const q = (document.getElementById('docs-search').value || '').toLowerCase();
  templatesState.q = q;
  templatesState.perPage = parseInt(document.getElementById('docs-per-page').value || 10, 10);

  const filtered = TEMPLATES.filter(t => {
    if (!q) return true;
    return (t.id && t.id.toString().includes(q)) ||
           (t.name && t.name.toLowerCase().includes(q)) ||
           (t.description && t.description.toLowerCase().includes(q));
  });

  const p = paginate(filtered, templatesState.page, templatesState.perPage);
  const tbody = document.querySelector('#docsTable tbody');
  tbody.innerHTML = '';

  p.data.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-semibold">${t.id}</td>
      <td>${t.name || ''}</td>
      <td class="truncate">${t.description || ''}</td>
      <td>${t.created_by_name || t.created_by || '---'}</td>
      <td>${t.created_at ? new Date(t.created_at).toLocaleString() : ''}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1 view-doc" data-id="${t.id}">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-outline-info me-1 edit-doc" data-id="${t.id}">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger delete-doc" data-id="${t.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('docs-stats').textContent = `Hiển thị ${p.data.length}/${p.total} mẫu`;
  renderPagination(document.getElementById('docs-pagination'), p.pages, p.page, (page) => {
    templatesState.page = page;
    renderTemplates();
  });

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

// ------------------ VIEW MODE ------------------
// async function openViewDocModal(id) {
//   const t = await api(`/document_templates/${id}`);

//   document.getElementById('modalDocTitle').textContent = `Xem mẫu ${t.id}`;

//   document.getElementById('doc_id').value = t.id;
//   document.getElementById('doc_name').value = t.name || '';
//   document.getElementById('doc_description').value = t.description || '';
//   document.getElementById('doc_file_path').value = t.file_path || '';

//   quillDoc.setContents(quillDoc.clipboard.convert(t.content || ''));
//   quillDoc.enable(false);

//   document.getElementById('saveDoc').style.display = 'none';

//   new bootstrap.Modal(document.getElementById('modalDoc')).show();
// }
async function openViewDocModal(id) {
  try {
    const res = await fetch(`/api/document_templates/${id}`);
    const tpl = await res.json();

    document.getElementById('viewDocTitle').textContent = tpl.name;
    document.getElementById('viewDocContent').innerHTML = tpl.content || '(Không có nội dung)';

    new bootstrap.Modal('#modalViewDoc').show();

  } catch (err) {
    console.error(err);
    alert('Lỗi tải nội dung mẫu');
  }
}


// ------------------ CREATE ------------------
function openCreateDocModal() {
  document.getElementById('modalDocTitle').textContent = 'Thêm mẫu văn bản';

  ['doc_id','doc_name','doc_description','doc_file_path'].forEach(id =>
    document.getElementById(id).value = ''
  );

  quillDoc.setText('');
  quillDoc.enable(true);
  document.getElementById('saveDoc').style.display = '';

  new bootstrap.Modal(document.getElementById('modalDoc')).show();
}

// ------------------ EDIT ------------------
async function openDocModal(id) {
  const t = await api(`/document_templates/${id}`);

  document.getElementById('modalDocTitle').textContent = `Sửa mẫu ${t.id}`;
  document.getElementById('doc_id').value = t.id;
  document.getElementById('doc_name').value = t.name || '';
  document.getElementById('doc_description').value = t.description || '';
  document.getElementById('doc_file_path').value = t.file_path || '';

  quillDoc.setContents(quillDoc.clipboard.convert(t.content || ''));
  quillDoc.enable(true);
  document.getElementById('saveDoc').style.display = '';

  new bootstrap.Modal(document.getElementById('modalDoc')).show();
}

// ------------------ SAVE ------------------
async function saveDoc() {
  const id = document.getElementById('doc_id').value.trim();

  const payload = {
    name: document.getElementById('doc_name').value.trim(),
    description: document.getElementById('doc_description').value.trim(),
    content: quillDoc.root.innerHTML,
    file_path: document.getElementById('doc_file_path').value.trim(),
    created_by: localStorage.getItem('id') || 'admin_demo'
  };

  if (!payload.name) { alert('Tên mẫu bắt buộc'); return; }

  try {
    if (id) {
      await api(`/document_templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      alert('Cập nhật mẫu thành công');
    } else {
      await api('/document_templates', { method: 'POST', body: JSON.stringify(payload) });
      alert('Thêm mẫu thành công');
    }

    loadTemplates();

    bootstrap.Modal.getInstance(document.getElementById('modalDoc')).hide();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}
