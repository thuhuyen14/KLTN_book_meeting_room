async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || 'API error');
  }
  return res.json();
}

/* ---------- Utility: pagination & render helpers ---------- */
function paginate(items, page = 1, perPage = 10) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const offset = (page - 1) * perPage;
  return { page, perPage, total, pages, data: items.slice(offset, offset + perPage) };
}

function renderPagination(containerEl, pages, current, onClick) {
  containerEl.innerHTML = '';
  if (pages <= 1) return;
  for (let i = 1; i <= pages; i++) {
    const li = document.createElement('li');
    li.className = 'page-item' + (i === current ? ' active' : '');
    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    li.addEventListener('click', (e) => { e.preventDefault(); onClick(i); });
    containerEl.appendChild(li);
  }
}

/* ---------- Load supporting lists ---------- */
let CACHE = {};
async function loadListCached(key, path) {
  if (CACHE[key]) return CACHE[key];
  const list = await api(path);
  CACHE[key] = list;
  return list;
}

function fillSelect(selectEl, list, valueFn = (x)=>x.id, labelFn = (x)=>x.name, includeEmpty=true) {
  selectEl.innerHTML = includeEmpty ? `<option value="">-- Chọn --</option>` : '';
  list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = valueFn(item);
    opt.textContent = labelFn(item);
    selectEl.appendChild(opt);
  });
}

/* ---------- Common Delete ---------- */
let pendingDelete = null;
function askDelete(type, id) {
  pendingDelete = { type, id };
  const text = type === 'room' ? `Bạn có chắc muốn xóa phòng ${id}?` : `Bạn có chắc muốn xóa nhân viên ${id}?`;
  document.getElementById('confirmDeleteText').textContent = text;
  new bootstrap.Modal(document.getElementById('confirmDeleteModal')).show();
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  try {
    if (type === 'room') {
      await api(`/rooms/${id}`, { method:'DELETE' });
      alert('Đã xóa phòng');
      if (typeof loadRooms === 'function') loadRooms();
    } else if (type === 'user') {
      await api(`/users/${id}`, { method:'DELETE' });
      alert('Đã xóa nhân viên');
      if (typeof loadUsers === 'function') loadUsers();
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    pendingDelete = null;
    bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal')).hide();
  }
});
