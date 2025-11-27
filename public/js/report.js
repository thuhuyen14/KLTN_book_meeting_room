/* ===========================
   report.js (full) - Export PDF/Excel for active tab
   - Supports Vietnamese (Unicode) via NotoSans
   - Uses jsPDF + autotable and SheetJS (XLSX)
   - If global buttons #btnExportPDF/#btnExportExcel exist, they will export the active tab.
   - If per-tab buttons exist (btnRoomPDF, btnRoomExcel, ...), those are still supported.
   =========================== */

/* ---------------------------
   Helpers
--------------------------- */
function formatDateTime(dt) {
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

/* ---------------------------
   Font loader (TTF -> base64)
--------------------------- */
async function loadFontBase64(path = "fonts/NotoSans-Regular.ttf") {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error("Không tải được font: " + path);
  const buf = await resp.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/* ---------------------------
   PDF export function
   - tableEl can be <table> element or selector id
--------------------------- */
async function exportTableToPDF({ tableEl, title = "Báo cáo", creator = "Admin", logoSrc = "images/dnse_logo.png" }) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) throw new Error("jsPDF chưa được nạp");

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // 1) load font and register
  try {
    const base64 = await loadFontBase64();
    doc.addFileToVFS("NotoSans.ttf", base64);
    doc.addFont("NotoSans.ttf", "NotoSans", "normal");
    doc.addFont("NotoSans.ttf", "NotoSans", "bold");
    doc.setFont("NotoSans");
  } catch (e) {
    console.warn("Không load được font NotoSans, sẽ dùng font mặc định. Lỗi:", e);
  }

  // 2) add logo safely (wait load)
  const logoImg = new Image();
  logoImg.src = logoSrc;
  await new Promise(resolve => {
    logoImg.onload = () => resolve();
    logoImg.onerror = () => {
      console.warn("Logo không load được, bỏ qua:", logoSrc);
      resolve();
    };
  });

  // draw header
  const marginLeft = 40;
  let cursorY = 40;
  if (logoImg && logoImg.complete && logoImg.naturalWidth) {
    // scale logo to fit header
    const logoW = 80, logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW;
    try { doc.addImage(logoImg, "PNG", marginLeft, cursorY, logoW, logoH); } catch (e) { /* ignore */ }
  }
  // Title and meta
  const titleX = marginLeft + 100;
  doc.setFontSize(16);
  try { doc.setFont("NotoSans", "bold"); } catch (e) {}
  doc.text(title, titleX, cursorY + 20);
  doc.setFontSize(10);
  try { doc.setFont("NotoSans", "normal"); } catch (e) {}
  doc.text(`Người lập: ${creator}`, titleX, cursorY + 38);
  doc.text(`Giờ in: ${formatDateTime(new Date())}`, titleX, cursorY + 54);

  // 3) build table data
  const tableElement = typeof tableEl === "string" ? document.getElementById(tableEl) : tableEl;
  if (!tableElement) throw new Error("Table element không tồn tại: " + String(tableEl));

  // Use autoTable with html table (auto reads thead & tbody)
  const startY = cursorY + 80;
  doc.autoTable({
    html: tableElement,
    startY,
    theme: "striped",
    styles: {
      font: "NotoSans",
      fontSize: 10,
      cellPadding: 4,
      overflow: "linebreak", // new style usage
    },
    headStyles: { fillColor: [60,60,60], textColor: 255, fontStyle: "bold" },
    tableWidth: "auto",
    margin: { left: marginLeft, right: marginLeft }
  });

  doc.save(`${title.replace(/\s+/g,'_')}.pdf`);
}

/* ---------------------------
   Excel export (SheetJS)
   - tableEl can be table element or id
--------------------------- */
function exportTableToExcel({ tableEl, fileName = "report.xlsx" }) {
  if (!window.XLSX) throw new Error("SheetJS (XLSX) chưa được nạp");

  const tableElement = typeof tableEl === "string" ? document.getElementById(tableEl) : tableEl;
  if (!tableElement) throw new Error("Table element không tồn tại: " + String(tableEl));

  // Use table_to_book to include thead automatically
  const wb = XLSX.utils.table_to_book(tableElement, { sheet: "Report" });
  XLSX.writeFile(wb, fileName);
}

/* ---------------------------
   Utility: find active tab pane id and its table
   - Assumes each tab pane has table <tbody id="..."> and <table id="...Table"> or known ids:
     roomReport -> roomReportTable, roomLog -> roomLogTable, signReport -> signReportTable, userReport -> userReportTable
--------------------------- */
function getActiveReportInfo() {
  // tab pane that is currently shown
  const activePane = document.querySelector(".tab-pane.show.active, .tab-pane.active");
  if (!activePane) return null;

  const paneId = activePane.id; // e.g. "roomReport"
  // heuristic mapping pane -> table id & title & creatorId
  const map = {
    roomReport: { tableId: "roomReportTable", title: "Báo cáo sử dụng phòng họp", creatorId: "creator1" },
    roomLog: { tableId: "roomLogTable", title: "Nhật ký đặt phòng", creatorId: "creator2" },
    signReport: { tableId: "signReportTable", title: "Báo cáo trình ký", creatorId: "creator3" },
    userReport: { tableId: "userReportTable", title: "Báo cáo người dùng hoạt động", creatorId: "creator4" }
  };
  return map[paneId] || { tableId: activePane.querySelector("table")?.id, title: activePane.querySelector("h4")?.innerText || "Báo cáo", creatorId: activePane.querySelector(".creator")?.id || "creator1" };
}

/* ---------------------------
   Page init: load data + bind events
--------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  // set print times if elements exist
  ["printTime1","printTime2","printTime3","printTime4"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatDateTime(new Date());
  });

  /* ---------- load filters & initial data (same as your existing functions) ---------- */
  // LOAD ROOM FILTERS
  async function loadRoomFilters() {
    try {
      const rooms = await fetchJSON("/api/rooms");
      const users = await fetchJSON("/api/users");
      const roomSel = document.getElementById("room_filter");
      const userSel = document.getElementById("room_user_filter");
      if (roomSel) rooms.forEach(r => roomSel.appendChild(new Option(r.name, r.id)));
      if (userSel) users.forEach(u => userSel.appendChild(new Option(u.full_name, u.id)));
    } catch (e) {
      console.warn("loadRoomFilters error:", e);
    }
  }
  await loadRoomFilters();

  // ROOM REPORT
  async function loadRoomReport() {
    try {
      const from = document.getElementById("room_from")?.value;
      const to = document.getElementById("room_to")?.value;
      const room_id = document.getElementById("room_filter")?.value;
      const user_id = document.getElementById("room_user_filter")?.value;
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      if (room_id) params.append("room_id", room_id);
      if (user_id) params.append("user_id", user_id);
      const data = await fetchJSON(`/api/report/rooms?${params.toString()}`);
      const tbody = document.getElementById("roomReportTable");
      if (!tbody) return;
      tbody.innerHTML = "";
      data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.day}</td>
          <td>${row.room_name}</td>
          <td>${row.time_range}</td>
          <td>${row.user_name}</td>
          <td>${row.purpose ?? ""}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) { console.warn("loadRoomReport error:", e); }
  }
  document.getElementById("btnRoomSearch")?.addEventListener("click", loadRoomReport);
  await loadRoomReport();

  // ROOM LOG
  async function loadRoomLog() {
    try {
      const from = document.getElementById("log_from")?.value;
      const to = document.getElementById("log_to")?.value;
      const action = document.getElementById("log_action")?.value;
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      if (action) params.append("action", action);
      const rows = await fetchJSON(`/api/report/room-log?${params.toString()}`);
      const tbody = document.getElementById("roomLogTable");
      if (!tbody) return;
      tbody.innerHTML = "";
      rows.forEach(l => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${formatDateTime(l.created_at)}</td>
          <td>${l.room_name}</td>
          <td>${l.action}</td>
          <td>${l.actor}</td>
          <td>${l.detail}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) { console.warn("loadRoomLog error:", e); }
  }
  document.getElementById("btnLogSearch")?.addEventListener("click", loadRoomLog);
  await loadRoomLog();

  // SIGN REPORT
  async function loadSignReport() {
    try {
      const from = document.getElementById("sign_from")?.value;
      const to = document.getElementById("sign_to")?.value;
      const status = document.getElementById("sign_status")?.value;
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      if (status) params.append("status", status);
      const rows = await fetchJSON(`/api/report/sign?${params.toString()}`);
      const tbody = document.getElementById("signReportTable");
      if (!tbody) return;
      tbody.innerHTML = "";
      rows.forEach(d => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.document_id}</td>
          <td>${d.sender}</td>
          <td>${d.signer}</td>
          <td>${formatDateTime(d.created_at)}</td>
          <td>${d.status}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) { console.warn("loadSignReport error:", e); }
  }
  document.getElementById("btnSignSearch")?.addEventListener("click", loadSignReport);
  await loadSignReport();

  // USER ACTIVITY
  async function loadUserActivity() {
    try {
      const dept = document.getElementById("filter_dept")?.value;
      const params = dept ? `?dept=${dept}` : "";
      const rows = await fetchJSON(`/api/report/users${params}`);
      const tbody = document.getElementById("userReportTable");
      if (!tbody) return;
      tbody.innerHTML = "";
      rows.forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.full_name}</td>
          <td>${u.department}</td>
          <td>${u.login_count}</td>
          <td>${u.booking_count}</td>
          <td>${u.document_count}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) { console.warn("loadUserActivity error:", e); }
  }
  document.getElementById("btnUserSearch")?.addEventListener("click", loadUserActivity);
  await loadUserActivity();

  /* ---------- BIND EXPORT BUTTONS ----------
     - Prefer global buttons (#btnExportPDF/#btnExportExcel)
     - Fallback to per-tab buttons if present (btnRoomPDF, btnRoomExcel, ...)
  */

  // helper to export the currently active tab
  async function exportActiveTabPDF() {
    const info = getActiveReportInfo();
    if (!info || !info.tableId) return alert("Không tìm thấy bảng để xuất.");
    const creatorId = info.creatorId || "creator1";
    const creatorName = document.getElementById(creatorId)?.textContent || "Admin";
    await exportTableToPDF({ tableEl: info.tableId, title: info.title, creator: creatorName, logoSrc: "images/dnse_logo.png" });
  }

  function exportActiveTabExcel() {
    const info = getActiveReportInfo();
    if (!info || !info.tableId) return alert("Không tìm thấy bảng để xuất.");
    exportTableToExcel({ tableEl: info.tableId, fileName: `${info.title.replace(/\s+/g,'_')}.xlsx` });
  }

  // Global buttons
  const btnExportPDF = document.getElementById("btnExportPDF");
  const btnExportExcel = document.getElementById("btnExportExcel");
  if (btnExportPDF) btnExportPDF.addEventListener("click", exportActiveTabPDF);
  if (btnExportExcel) btnExportExcel.addEventListener("click", exportActiveTabExcel);

  // Per-tab individual buttons (backwards compatible)
  document.getElementById("btnRoomPDF")?.addEventListener("click", () => exportTableToPDF({ tableEl: "roomReportTable", title: "Báo cáo sử dụng phòng họp", creator: document.getElementById("creator1")?.textContent || "Admin", logoSrc: "images/dnse_logo.png" }));
  document.getElementById("btnRoomExcel")?.addEventListener("click", () => exportTableToExcel({ tableEl: "roomReportTable", fileName: "BaoCao_SuDungPhongHop.xlsx" }));

  document.getElementById("btnLogPDF")?.addEventListener("click", () => exportTableToPDF({ tableEl: "roomLogTable", title: "Nhật ký đặt phòng", creator: document.getElementById("creator2")?.textContent || "Admin", logoSrc: "images/dnse_logo.png" }));
  document.getElementById("btnLogExcel")?.addEventListener("click", () => exportTableToExcel({ tableEl: "roomLogTable", fileName: "NhatKy_DatPhong.xlsx" }));

  document.getElementById("btnSignPDF")?.addEventListener("click", () => exportTableToPDF({ tableEl: "signReportTable", title: "Báo cáo trình ký", creator: document.getElementById("creator3")?.textContent || "Admin", logoSrc: "images/dnse_logo.png" }));
  document.getElementById("btnSignExcel")?.addEventListener("click", () => exportTableToExcel({ tableEl: "signReportTable", fileName: "BaoCao_TrinhKy.xlsx" }));

  document.getElementById("btnUserPDF")?.addEventListener("click", () => exportTableToPDF({ tableEl: "userReportTable", title: "Báo cáo người dùng hoạt động", creator: document.getElementById("creator4")?.textContent || "Admin", logoSrc: "images/dnse_logo.png" }));
  document.getElementById("btnUserExcel")?.addEventListener("click", () => exportTableToExcel({ tableEl: "userReportTable", fileName: "BaoCao_NguoiDung.xlsx" }));
});
