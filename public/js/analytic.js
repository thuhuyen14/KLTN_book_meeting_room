// Biến lưu trữ biểu đồ
let chartInstances = {};

async function fetchData(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (e) {
    console.error("Lỗi tải dữ liệu:", url, e);
    return [];
  }
}

// Format ngày hiển thị lên biểu đồ (dd/mm)
function formatDateLabel(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

// Render Chart
function renderChart(canvasId, type, labels, data, label, title, colors = null) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  const defaultColors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796'];
  const bgColors = colors || (['pie', 'doughnut'].includes(type) ? defaultColors : '#4e73df');

  chartInstances[canvasId] = new Chart(ctx, {
    type: type,
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: bgColors,
        borderColor: type === 'line' ? '#4e73df' : '#fff',
        borderWidth: 1,
        tension: 0.3, 
        fill: false // Tắt tô màu
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        title: { display: false },
        legend: { display: ['pie', 'doughnut'].includes(type), position: 'bottom' }
      },
      scales: ['pie', 'doughnut'].includes(type) ? {} : {
        y: { beginAtZero: true },
        x: { grid: { display: false } }
      }
    }
  });
}

// =========================================
// 🚀 LOGIC CHÍNH
// =========================================

async function loadAllCharts(startDate = null, endDate = null) {
  let query = '';
  if(startDate && endDate) query = `?start=${startDate}&end=${endDate}`;
  console.log("Loading data:", query);
// ... Trong hàm loadAllCharts ...

  // 1. CẬP NHẬT CÔNG SUẤT PHÒNG
  const vacancyData = await fetchData('/api/analytic/vacancy' + query); 
  // Kết quả backend trả về: { vacancy: "99.4", occupancy: "0.6" }
  
  const occRate = parseFloat(vacancyData.occupancy || 0);
  
  // ✅ SỬA: Lấy bằng ID cho chính xác
  const vacText = document.getElementById('kpiOccupancy');
  const progressBar = document.getElementById('kpiOccupancyBar');
  
  if (vacText) {
      vacText.textContent = occRate + '%';
  }
  
  if (progressBar) {
      progressBar.style.width = occRate + '%';
      
      // Logic màu sắc
      if(occRate < 30) {
          progressBar.className = 'progress-bar bg-info'; // Thấp - Xanh nhạt
      } else if(occRate < 70) {
          progressBar.className = 'progress-bar bg-success'; // Ổn - Xanh lá
      } else {
          progressBar.className = 'progress-bar bg-danger'; // Cao - Đỏ
      }
  }

  // 2. KPI TỔNG QUAN
  const overview = await fetchData('/api/analytic/overview' + query);
  updateText('kpiMeetings', overview.totalMeetings || 0);
  updateText('kpiDocs', overview.totalDocuments || 0);
  updateText('kpiUsers', overview.activeUsers || 0);

  renderChart('systemActivityChart', 'line',
    overview.activity.map(a => a.day ? formatDateLabel(a.day) : ''),
    overview.activity.map(a => a.count),
    'Hoạt động', 'Hoạt động hệ thống'
  );

  // 3. CÁC BIỂU ĐỒ KHÁC
  const rooms = await fetchData('/api/analytic/rooms' + query);
  renderChart('roomChart', 'bar', rooms.map(r => r.name), rooms.map(r => r.count), 'Lượt đặt');

  const days = await fetchData('/api/analytic/days' + query);
  renderChart('dayChart', 'line', days.map(d => formatDateLabel(d.day)), days.map(d => d.count), 'Lượt đặt');

  const bookingHours = await fetchData('/api/analytic/rooms/hours' + query);
  renderChart('hourChart', 'bar', bookingHours.map(b => `${b.hour}:00`), bookingHours.map(b => b.count), 'Lượt đặt');

  const users = await fetchData('/api/analytic/users' + query);
  renderChart('userChart', 'bar', users.map(u => u.full_name), users.map(u => u.count), 'Lượt đặt');

  const docStatus = await fetchData('/api/analytic/docs/status' + query);
  renderChart('signStatusChart', 'pie', docStatus.map(d => d.status), docStatus.map(d => d.count), 'Số lượng');

  const signerStats = await fetchData('/api/analytic/docs/signers' + query);
  renderChart('signerChart', 'bar', signerStats.map(s => s.full_name), signerStats.map(s => s.count), 'Đã ký');

  const signDays = await fetchData('/api/analytic/docs/days' + query);
  renderChart('signDayChart', 'line', signDays.map(d => formatDateLabel(d.day)), signDays.map(d => d.count), 'Văn bản');
}

function updateText(id, val) {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
}

// =========================================
// 📅 XỬ LÝ SỰ KIỆN LỌC (KHÔNG DÙNG FLATPICKR)
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Set mặc định 30 ngày qua
    const today = new Date();
    const last30 = new Date();
    last30.setDate(today.getDate() - 30);

    const dateStartInput = document.getElementById('startDate');
    const dateEndInput = document.getElementById('endDate');

    // toISOString() trả về: 2025-12-10T... -> cắt lấy 10 ký tự đầu
    dateStartInput.value = last30.toISOString().slice(0, 10);
    dateEndInput.value = today.toISOString().slice(0, 10);

    // 2. Load lần đầu
    loadAllCharts(dateStartInput.value, dateEndInput.value);

    // 3. Sự kiện nút LỌC
    document.getElementById('btnFilter').addEventListener('click', () => {
        const start = dateStartInput.value;
        const end = dateEndInput.value;
        
        if(!start || !end) {
            alert('Vui lòng chọn ngày'); return;
        }

        const btn = document.getElementById('btnFilter');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        btn.disabled = true;

        loadAllCharts(start, end).then(() => {
            btn.innerHTML = oldText;
            btn.disabled = false;
        });
    });

    // 4. Sự kiện CHỌN NHANH (Native JS)
    window.quickFilter = function(type) {
        const now = new Date();
        let start = new Date();

        if (type === '7days') {
            start.setDate(now.getDate() - 7);
        } else if (type === 'thisMonth') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (type === 'lastMonth') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            now.setDate(0); // Ngày cuối của tháng trước
        }

        dateStartInput.value = start.toISOString().slice(0, 10);
        dateEndInput.value = now.toISOString().slice(0, 10);

        // Auto click lọc
        document.getElementById('btnFilter').click();
    };
});
document.addEventListener('DOMContentLoaded', function () {
    // Kích hoạt toàn bộ tooltip trên trang
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});