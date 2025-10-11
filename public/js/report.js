async function fetchData(url) {
  const res = await fetch(url);
  return res.json();
}

document.addEventListener('DOMContentLoaded', async () => {
  // Thống kê phòng
  const rooms = await fetchData('/api/report/rooms');
  new Chart(document.getElementById('roomChart'), {
    type: 'bar',
    data: {
      labels: rooms.map(r => r.name),
      datasets: [{ label: 'Số lần đặt', data: rooms.map(r => r.count) }]
    }
  });

  // Thống kê ngày
  const days = await fetchData('/api/report/days');
  new Chart(document.getElementById('dayChart'), {
    type: 'line',
    data: {
      labels: days.map(d => d.day),
      datasets: [{ label: 'Số lần đặt', data: days.map(d => d.count) }]
    }
  });

  // Thống kê người/phòng ban
  const users = await fetchData('/api/report/users');
  new Chart(document.getElementById('userChart'), {
    type: 'bar',
    data: {
      labels: users.map(u => `${u.full_name} (${u.name})`),
      datasets: [{ label: 'Số lần đặt', data: users.map(u => u.count) }]
    }
  });
});
