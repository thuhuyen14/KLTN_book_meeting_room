async function api(path, opts = {}) {
    const res = await fetch('/api' + path, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
async function renderRooms() {
    const rooms = await api('/rooms');
    const container = document.getElementById('roomsGrid');
    container.innerHTML = '';
    rooms.forEach(r => {
        const col = document.createElement('div');
        col.className = 'col-md-4';
        col.innerHTML = `
  <div class="card shadow-sm">
    <img src="${r.image}?v=${Date.now()}" class="card-img-top" alt="${r.name}">
    <div class="card-body">
      <h5 class="card-title">${r.name}</h5>
      <p class="card-text">${r.room_description || ''}</p>
      <p><strong>Sức chứa:</strong> ${r.capacity} người</p>
      ${r.location_name ? `<p><strong>Vị trí:</strong> ${r.location_name}</p>` : ''}
      <a href="booking.html" class="btn btn-sm btn-primary">Đặt phòng</a>
    </div>
  </div>`;
        container.appendChild(col);
    });
}
renderRooms();