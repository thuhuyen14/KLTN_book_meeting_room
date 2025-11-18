async function fetchData(url) {
  const res = await fetch(url);
  return res.json();
}

/* ------------------------------
   Format ngày ISO sang dd/mm/yyyy
------------------------------ */
function formatDateLabel(isoString) {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/* ------------------------------
   Render biểu đồ với title
------------------------------ */
function renderChart(canvasId, type, labels, data, label, title) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  return new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: type === 'pie' ? [
          '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b'
        ] : '#4e73df',
        borderColor: type === 'pie' ? '#fff' : '#4e73df',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 18 }
        },
        legend: {
          display: type === 'pie'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.dataset.label) {
                return `${context.dataset.label}: ${context.raw}`;
              }
              return context.raw;
            }
          }
        }
      },
      scales: type !== 'pie' ? {
        x: {
          ticks: {
            callback: function(value, index) {
              return labels[index]; // dùng nhãn đã format
            }
          }
        },
        y: { beginAtZero: true }
      } : {}
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {

  /* ===========================
       TAB: ĐẶT PHÒNG HỌP
     =========================== */

  const rooms = await fetchData('/api/report/rooms');
  renderChart(
    'roomChart',
    'bar',
    rooms.map(r => r.name),
    rooms.map(r => r.count),
    'Số lần đặt',
    'Thống kê số lần đặt phòng họp'
  );

  const days = await fetchData('/api/report/days');
  renderChart(
    'dayChart',
    'line',
    days.map(d => formatDateLabel(d.day)),
    days.map(d => d.count),
    'Số lần đặt',
    'Lượt đặt theo ngày'
  );
  // Khung giờ được đặt nhiều nhất
  const bookingHours = await fetchData('/api/report/rooms/hours');
  renderChart(
    'hourChart',
    'bar',
    bookingHours.map(b => `${b.hour}:00 - ${b.hour}:59`),
    bookingHours.map(b => b.count),
    'Số lần đặt',
    'Khung giờ được đặt nhiều nhất'
  );


  const users = await fetchData('/api/report/users');
  renderChart(
    'userChart',
    'bar',
    users.map(u => `${u.full_name} (${u.name})`),
    users.map(u => u.count),
    'Số lần đặt',
    'Số lượt đặt theo người dùng / phòng ban'
  );

  /* ===========================
       TAB: TRÌNH KÝ
     =========================== */

  const docStatus = await fetchData('/api/report/docs/status');
  renderChart(
    'signStatusChart',
    'pie',
    docStatus.map(d => d.status),
    docStatus.map(d => d.count),
    'Số lượng',
    'Thống kê hồ sơ theo trạng thái'
  );

  const signerStats = await fetchData('/api/report/docs/signers');
  renderChart(
    'signerChart',
    'bar',
    signerStats.map(s => s.full_name),
    signerStats.map(s => s.count),
    'Số hồ sơ',
    'Số hồ sơ mỗi người ký'
  );

  const signDays = await fetchData('/api/report/docs/days');
  renderChart(
    'signDayChart',
    'line',
    signDays.map(d => formatDateLabel(d.day)),
    signDays.map(d => d.count),
    'Số hồ sơ trình ký',
    'Số hồ sơ trình ký theo ngày'
  );

  /* ===========================
       TAB: TỔNG QUAN
     =========================== */

  const overview = await fetchData('/api/report/overview');

  document.getElementById('kpiMeetings').textContent = overview.totalMeetings || 0;
  document.getElementById('kpiDocs').textContent = overview.totalDocuments || 0;
  document.getElementById('kpiUsers').textContent = overview.activeUsers || 0;

  renderChart(
    'systemActivityChart',
    'line',
    overview.activity.map(a => a.day ? formatDateLabel(a.day) : ''),
    overview.activity.map(a => a.count),
    'Hoạt động hệ thống',
    'Hoạt động hệ thống theo ngày'
  );
});
