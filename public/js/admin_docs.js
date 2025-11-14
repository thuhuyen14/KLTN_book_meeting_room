let TEMPLATES = [];
let templatesState = { page: 1, perPage: 10, q: '' };

// ------------------ INIT ------------------
document.addEventListener('DOMContentLoaded', async () => {
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

// ------------------ RENDER ------------------
function renderTemplates() {
  const q = (document.getElementById('docs-search').value || '').toLowerCase();
  templatesState.q = q;
  templatesState.perPage = parseInt(document.getElementById('docs-per-page').value || 10, 10);

  const filtered = TEMPLATES.filter(t => {
    if (!q) return true;
    return (t.id && t.id.toLowerCase().includes(q)) ||
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
      <td><a href="${t.file_url || '#'}" target="_blank">${t.file_url || ''}</a></td>
      <td>
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

  document.querySelectorAll('.edit-doc').forEach(btn =>
    btn.addEventListener('click', e => openDocModal(e.target.closest('button').dataset.id))
  );
  document.querySelectorAll('.delete-doc').forEach(btn =>
    btn.addEventListener('click', e => askDelete('document_templates', e.target.closest('button').dataset.id))
  );
}

// ------------------ CREATE / EDIT MODAL ------------------
function openCreateDocModal() {
  document.getElementById('modalDocTitle').textContent = 'Thêm mẫu văn bản';

  ['doc_id','doc_name','doc_description','doc_content','doc_file_url']
    .forEach(id => document.getElementById(id).value = '');

  new bootstrap.Modal(document.getElementById('modalDoc')).show();
}

async function openDocModal(id) {
  const t = await api(`/document_templates/${id}`);

  document.getElementById('modalDocTitle').textContent = `Sửa mẫu ${t.id}`;
  document.getElementById('doc_id').value = t.id;
  document.getElementById('doc_name').value = t.name || '';
  document.getElementById('doc_description').value = t.description || '';
  document.getElementById('doc_content').value = t.content || '';
  document.getElementById('doc_file_url').value = t.file_url || '';

  new bootstrap.Modal(document.getElementById('modalDoc')).show();
}

// ------------------ SAVE TEMPLATE ------------------
async function saveDoc() {
  const id = document.getElementById('doc_id').value.trim();

  const payload = {
    name: document.getElementById('doc_name').value.trim(),
    description: document.getElementById('doc_description').value.trim(),
    content: document.getElementById('doc_content').value.trim(),
    file_url: document.getElementById('doc_file_url').value.trim()
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
