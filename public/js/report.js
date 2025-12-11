/* ===========================
   report.js (enhanced) - Export PDF/Excel for active tab
   - Supports Vietnamese (Unicode) via NotoSans
   - Uses jsPDF + autotable and SheetJS (XLSX)
   - Professional header with company info, body with report content, footer with creator & time
   - Includes filter information in report
   =========================== */

/* ---------------------------
   Helpers
--------------------------- */
function formatDateTime(dt) {
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatDateOnly(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

/* ---------------------------
   Get creator info from localStorage
--------------------------- */
function getCreatorInfo() {
  try {
    let userInfo = localStorage.getItem("full_name");
    if (userInfo) {
      // Try parsing as JSON first
      try {
        const user = JSON.parse(userInfo);
        return user.full_name || user.name || "Admin";
      } catch (e) {
        // If not JSON, check if it's a raw string (like "Phạm Thị Thu Huyền")
        if (userInfo && typeof userInfo === "string" && userInfo.length > 0) {
          // If it looks like a name (contains Vietnamese chars or spaces), use it directly
          if (userInfo.match(/[\p{L}\s]/u)) {
            return userInfo;
          }
        }
        throw e;
      }
    }
  } catch (e) {
    console.warn("Không parse được user_info từ localStorage:", e);
  }
  return "Admin";
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
   Get filter values from active tab
--------------------------- */
function getActiveTabFilters() {
  const activePane = document.querySelector(".tab-pane.show.active, .tab-pane.active");
  if (!activePane) return null;

  const paneId = activePane.id;
  const filters = {};

  // Map tab ID to their filter element IDs
  if (paneId === "roomReport") {
    const from = document.getElementById("room_from")?.value;
    const to = document.getElementById("room_to")?.value;
    const room = document.getElementById("room_filter")?.selectedOptions[0]?.text || "TẤT CẢ";
    const user = document.getElementById("room_user_filter")?.selectedOptions[0]?.text || "TẤT CẢ";
    filters.from = from ? formatDateOnly(from) : "TẤT CẢ";
    filters.to = to ? formatDateOnly(to) : "TẤT CẢ";
    filters.room = room;
    filters.user = user;
  // } else if (paneId === "roomLog") {
  //   const from = document.getElementById("log_from")?.value;
  //   const to = document.getElementById("log_to")?.value;
  //   const action = document.getElementById("log_action")?.value || "TẤT CẢ";
  //   filters.from = from ? formatDateOnly(from) : "TẤT CẢ";
  //   filters.to = to ? formatDateOnly(to) : "TẤT CẢ";
  //   filters.action = action;
  } else if (paneId === "signReport") {
    const from = document.getElementById("sign_from")?.value;
    const to = document.getElementById("sign_to")?.value;
    const status = document.getElementById("sign_status")?.value || "TẤT CẢ";
    filters.from = from ? formatDateOnly(from) : "TẤT CẢ";
    filters.to = to ? formatDateOnly(to) : "TẤT CẢ";
    filters.status = status;
  } else if (paneId === "userReport") {
    const dept = document.getElementById("filter_dept")?.selectedOptions[0]?.text || "TẤT CẢ";
    filters.dept = dept;
  }

  return filters;
}

/* ---------------------------
   Build filter text for report
--------------------------- */
function buildFilterText(filters) {
  if (!filters) return "";
  
  const lines = [];
  
  // Determine report type based on filters
  if (filters.room !== undefined) {
    // Room report
    lines.push(`Từ ngày: ${filters.from || "TẤT CẢ"}`);
    lines.push(`Đến ngày: ${filters.to || "TẤT CẢ"}`);
    lines.push(`Phòng họp: ${filters.room}`);
    lines.push(`Người đặt: ${filters.user}`);
  } else if (filters.action !== undefined) {
    // Room log
    lines.push(`Từ ngày: ${filters.from || "TẤT CẢ"}`);
    lines.push(`Đến ngày: ${filters.to || "TẤT CẢ"}`);
    lines.push(`Hành động: ${filters.action}`);
  } else if (filters.status !== undefined) {
    // Sign report
    lines.push(`Từ ngày: ${filters.from || "TẤT CẢ"}`);
    lines.push(`Đến ngày: ${filters.to || "TẤT CẢ"}`);
    lines.push(`Trạng thái: ${filters.status}`);
  } else if (filters.dept !== undefined) {
    // User report
    lines.push(`Bộ phận: ${filters.dept}`);
  }
  
  return lines;
}

/* ---------------------------
   PDF export function - Professional format
   - Header: Logo + Company info
   - Report title (centered)
   - Filter information
   - Body: Table
   - Creator & Date signature
   - Footer: Creator name + Print time + Page number
--------------------------- */
async function exportTableToPDF({ tableEl, title = "Báo cáo", creator = "Admin", logoSrc = "images/dnse_logo.png" }) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) throw new Error("jsPDF chưa được nạp");

  // Get creator name
  let creatorName = creator;
  if (creator === "Admin" || !creator) {
    creatorName = getCreatorInfo();
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1) Load font and register
  try {
    const base64 = await loadFontBase64();
    doc.addFileToVFS("NotoSans.ttf", base64);
    doc.addFont("NotoSans.ttf", "NotoSans", "normal");
    doc.addFont("NotoSans.ttf", "NotoSans", "bold");
    doc.setFont("NotoSans");
  } catch (e) {
    console.warn("Không load được font NotoSans, sẽ dùng font mặc định. Lỗi:", e);
  }

  // 2) Load logo
  const logoImg = new Image();
  logoImg.src = logoSrc;
  await new Promise(resolve => {
    logoImg.onload = () => resolve();
    logoImg.onerror = () => {
      console.warn("Logo không load được, bỏ qua:", logoSrc);
      resolve();
    };
  });

  // 3) Draw header section
  let cursorY = 10;
  const marginLeft = 10;
  const marginRight = 10;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // Header background (light gray)
  doc.setFillColor(240, 240, 240);
  doc.rect(marginLeft, cursorY, contentWidth, 20, "F");

  // Logo (left side)
  if (logoImg && logoImg.complete && logoImg.naturalWidth) {
    const logoW = 25;
    const logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW;
    try {
      doc.addImage(logoImg, "PNG", marginLeft + 5, cursorY + 5, logoW, logoH);
    } catch (e) {
      console.warn("Không thêm được logo vào PDF");
    }
  }

  // Company info (right of logo)
  const companyX = marginLeft + 35;
  doc.setFontSize(11);
  doc.setFont("NotoSans", "bold");
  doc.text("Công ty cổ phần chứng khoán DNSE", companyX, cursorY + 8);

  doc.setFontSize(9);
  doc.setFont("NotoSans", "normal");
  doc.text("Địa chỉ: 63-65 Ngô Thị Nhậm, Hai Bà Trưng, Hà Nội", companyX, cursorY + 14);

  cursorY += 40;

  // 4) Draw report title (centered, bold and larger)
  doc.setFontSize(16);
  doc.setFont("NotoSans", "bold");
  const titleWidth = doc.getStringUnitWidth(title) * doc.internal.getFontSize() / doc.internal.scaleFactor;
  const titleX = (pageWidth - titleWidth) / 2;
  doc.text(title, titleX, cursorY);
  cursorY += 12;

  // 5) Draw filter information
  const filters = getActiveTabFilters();
  const filterLines = buildFilterText(filters);
  
  if (filterLines.length > 0) {
    doc.setFontSize(9);
    doc.setFont("NotoSans", "normal");
    doc.setTextColor(60, 60, 60);
    
    filterLines.forEach(line => {
      doc.text(line, marginLeft + 5, cursorY);
      cursorY += 5;
    });
    
    cursorY += 3;
    doc.setTextColor(0, 0, 0);
  }

  // 6) Build and draw table
  const tableElement = typeof tableEl === "string" ? document.getElementById(tableEl) : tableEl;
  if (!tableElement) throw new Error("Table element không tồn tại: " + String(tableEl));

  const startY = cursorY;
  doc.autoTable({
    html: tableElement,
    startY: startY,
    theme: "striped",
    styles: {
      font: "NotoSans",
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10
    },
    bodyStyles: {
      textColor: 50
    },
    tableWidth: "auto",
    margin: { left: marginLeft, right: marginRight },
    didDrawPage: function(data) {
      // Footer on every page
      const footerY = pageHeight - 10;
      doc.setFontSize(8);
      doc.setFont("NotoSans", "normal");
      doc.text(`Giờ in: ${formatDateTime(new Date())}`, marginLeft + 5, footerY);
      doc.text(`Trang ${data.pageNumber}`, pageWidth - marginRight - 20, footerY);
    },
    willDrawPage: function() {
      // Reserved for future use if needed
    }
  });

  // Add signature section after table (on last page)
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 100;
  const signatureY = finalY + 10;
    
    // Date + Location
  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear();

  doc.setFontSize(9);
  doc.setFont("NotoSans", "normal");
  doc.text(`Hà Nội, ngày ${day} tháng ${month} năm ${year}`, pageWidth - marginRight - 63, signatureY);

  doc.setFontSize(9);
  doc.setFont("NotoSans", "bold");
  doc.text("Người lập báo cáo", pageWidth - marginRight - 60, signatureY + 15);
  
  doc.setFont("NotoSans", "normal");
  doc.text(creatorName, pageWidth - marginRight - 60, signatureY + 25);
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}

/* ---------------------------
   Excel export (SheetJS)
   - tableEl can be table element or id
--------------------------- */
/* ---------------------------
   Excel export (SheetJS) - Đã nâng cấp
   - Thêm Header (Công ty, Tiêu đề, Bộ lọc)
   - Thêm Footer (Ngày tháng, Người lập)
--------------------------- */
/* ---------------------------
   Excel export (Advanced Style)
   - Yêu cầu: thư viện xlsx-js-style
--------------------------- */
/* ---------------------------
   Excel export (Advanced Style) - Đã sửa lỗi căn phải Footer
--------------------------- */
function exportTableToExcel({ tableEl, fileName = "report.xlsx", title = "BÁO CÁO" }) {
  if (!window.XLSX) throw new Error("Thư viện XLSX chưa được nạp");

  const tableElement = typeof tableEl === "string" ? document.getElementById(tableEl) : tableEl;
  if (!tableElement) {
      alert("Không tìm thấy bảng dữ liệu!");
      return;
  }

  // 1. Lấy dữ liệu thô
  const wsRaw = XLSX.utils.table_to_sheet(tableElement);
  const tableData = XLSX.utils.sheet_to_json(wsRaw, { header: 1 });

  // --- TÍNH TOÁN VỊ TRÍ CỘT TRƯỚC ---
  // Tìm số cột lớn nhất trong bảng (để biết căn phải vào đâu)
  const totalCols = tableData[0] ? tableData[0].length : 5;
  const lastColIndex = totalCols - 1;
  // Vị trí bắt đầu của phần chữ ký (lùi lại 2 cột so với cột cuối)
  const footerColStart = Math.max(0, lastColIndex - 2); 
  
  // Tạo mảng các ô trống để đẩy text sang phải (Padding)
  // Ví dụ: Bảng 5 cột, footer bắt đầu từ cột 3 -> Cần 3 ô trống [null, null, null]
  const emptyPadding = new Array(footerColStart).fill(""); 

  // 2. Chuẩn bị Header/Footer
  const companyName = ["CÔNG TY CỔ PHẦN CHỨNG KHOÁN DNSE"];
  const address = ["Địa chỉ: 63-65 Ngô Thị Nhậm, Hai Bà Trưng, Hà Nội"];
  const emptyRow = [""];
  const reportTitle = [title.toUpperCase()];

  const filters = getActiveTabFilters(); 
  const filterLines = buildFilterText(filters).map(line => [line]);

  const creatorName = getCreatorInfo();
  const now = new Date();
  
  // ✅ SỬA: Thêm padding vào trước nội dung Footer để đẩy sang phải
  const dateLine = [...emptyPadding, `Hà Nội, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`];
  const signerLabel = [...emptyPadding, "Người lập báo cáo"];
  const signerName = [...emptyPadding, creatorName];

  // 3. Gộp dữ liệu
  const finalData = [
      companyName, address, emptyRow, reportTitle, emptyRow,
      ...filterLines,
      emptyRow,
      ...tableData,
      emptyRow, emptyRow,
      dateLine,     // Dòng ngày tháng (đã có padding)
      signerLabel,  // Dòng chức danh (đã có padding)
      emptyRow, emptyRow, emptyRow,
      signerName    // Dòng tên người ký (đã có padding)
  ];

  // 4. Tạo Sheet
  const ws = XLSX.utils.aoa_to_sheet(finalData);

  // 5. === STYLE & MERGES ===
  const filterCount = filterLines.length; 
  const tableStartRow = 5 + filterCount + 1;
  const tableEndRow = tableStartRow + tableData.length - 1;

  // Merge Cells
  ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } }, // Tên công ty
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIndex } }, // Địa chỉ
      { s: { r: 3, c: 0 }, e: { r: 3, c: lastColIndex } }, // Tiêu đề Báo cáo
      
      // ✅ SỬA MERGE FOOTER: Gộp từ footerColStart đến lastColIndex
      { s: { r: tableEndRow + 3, c: footerColStart }, e: { r: tableEndRow + 3, c: lastColIndex } }, // Ngày tháng
      { s: { r: tableEndRow + 4, c: footerColStart }, e: { r: tableEndRow + 4, c: lastColIndex } }, // Người lập
      { s: { r: tableEndRow + 8, c: footerColStart }, e: { r: tableEndRow + 8, c: lastColIndex } }, // Tên
  ];

  // Styles Definition
  const styleTitle = { font: { bold: true, sz: 14, color: { rgb: "4E73DF" } }, alignment: { horizontal: "center" } };
  const styleHeader = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4E73DF" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
  const styleBody = { border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, alignment: { wrapText: true } };
  const styleFooter = { alignment: { horizontal: "center" }, font: { italic: true } };
  const styleFooterBold = { alignment: { horizontal: "center" }, font: { bold: true } };

  // Apply Styles Loop
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddr]) continue;

          // Header Công ty
          if (R === 0) ws[cellAddr].s = { font: { bold: true, sz: 11 } };
          // Tiêu đề Báo cáo
          if (R === 3) ws[cellAddr].s = styleTitle;
          // Table Header
          if (R === tableStartRow) ws[cellAddr].s = styleHeader;
          // Table Body
          if (R > tableStartRow && R <= tableEndRow) {
              ws[cellAddr].s = styleBody;
              if (C === 0) ws[cellAddr].s = { ...styleBody, alignment: { horizontal: "center" } }; // STT center
          }
          
          // Footer (Sửa logic áp dụng style)
          // Vì ta đã đẩy text sang cột footerColStart, nên ta bắt style tại cột đó
          if (R > tableEndRow && C === footerColStart) {
             if (R === tableEndRow + 3) ws[cellAddr].s = styleFooter; // Ngày tháng
             if (R === tableEndRow + 4) ws[cellAddr].s = styleFooterBold; // Người lập báo cáo
             if (R === tableEndRow + 8) ws[cellAddr].s = styleFooterBold; // Tên Admin
          }
      }
  }

  // Column Widths
  const wscols = new Array(totalCols).fill({ wch: 20 });
  wscols[0] = { wch: 8 }; // STT nhỏ thôi
  ws['!cols'] = wscols;

  // Xuất file
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, fileName);
}

/* ---------------------------
   Utility: find active tab pane id and its table
--------------------------- */
function getActiveReportInfo() {
  const activePane = document.querySelector(".tab-pane.show.active, .tab-pane.active");
  if (!activePane) return null;

  const paneId = activePane.id;
  const map = {
    roomReport: { tableId: "roomReportTable", title: "Báo cáo sử dụng phòng họp", creatorId: "creator1" },
    // roomLog: { tableId: "roomLogTable", title: "Nhật ký đặt phòng", creatorId: "creator2" },
    signReport: { tableId: "signReportTable", title: "Báo cáo trình ký", creatorId: "creator3" },
    userReport: { tableId: "userReportTable", title: "Báo cáo người dùng hoạt động", creatorId: "creator4" },
    statReport: { tableId: "statReportTable", title: "Báo cáo thống kê", creatorId: "creator5" }
  };
  return map[paneId] || {
    tableId: activePane.querySelector("table")?.id,
    title: activePane.querySelector("h4")?.innerText || "Báo cáo",
    creatorId: activePane.querySelector(".creator")?.id || "creator1"
  };
}

/* ---------------------------
   Page init: load data + bind events
--------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  // set print times if elements exist
  ["printTime1", "printTime2", "printTime3", "printTime4", "printTime5"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatDateTime(new Date());
  });
  ["creator1","creator2","creator3","creator4", "creator5"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = localStorage.getItem("full_name") || "—";
  });
  /* ---------- load filters & initial data ---------- */
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
      const tbody = document.querySelector("#roomReportTable tbody");
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
    } catch (e) {
      console.warn("loadRoomReport error:", e);
    }
  }
  document.getElementById("btnRoomSearch")?.addEventListener("click", loadRoomReport);
  await loadRoomReport();


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
      const tbody = document.querySelector("#signReportTable tbody");
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
    } catch (e) {
      console.warn("loadSignReport error:", e);
    }
  }
  document.getElementById("btnSignSearch")?.addEventListener("click", loadSignReport);
  await loadSignReport();

/* ---------------------------
   USER ACTIVITY + SORT
---------------------------- */

let userRowsCache = [];
let sortDir = 1;

function renderUserTable(rows) {
  const tbody = document.querySelector("#userReportTable tbody");
  tbody.innerHTML = "";
  rows.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.full_name}</td>
      <td>${u.department}</td>
      <td>${u.booking_count}</td>
      <td>${u.document_count}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadUserActivity() {
  try {
    const dept = document.getElementById("filter_dept")?.value || "";
    const params = dept ? `?dept=${encodeURIComponent(dept)}` : "";

    const rows = await fetchJSON(`/api/report/users${params}`);

    userRowsCache = rows.slice();
    renderUserTable(userRowsCache);
  } catch (e) {
    console.warn("loadUserActivity error:", e);
  }
}

/* --- SORT WITH ARROWS --- */
document.querySelectorAll("thead th.sortable").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.dataset.key;

    // reset arrow icons
    document.querySelectorAll("thead th.sortable")
      .forEach(h => h.classList.remove("sorted-asc", "sorted-desc"));

    sortDir *= -1;

    if (sortDir === 1) th.classList.add("sorted-asc");
    else th.classList.add("sorted-desc");

    userRowsCache.sort((a, b) => {
      if (!isNaN(Number(a[key]))) {
        return (Number(a[key]) - Number(b[key])) * sortDir;
      }
      return a[key].localeCompare(b[key]) * sortDir;
    });

    renderUserTable(userRowsCache);
  });
});

/* Load departments (dropdown) */
async function loadDepartments() {
  try {
    const list = await fetchJSON("/api/departments");
    const select = document.getElementById("filter_dept");
    if (!select) return;

    select.innerHTML = `<option value="">Tất cả</option>`;

    list.forEach(dep => {
      const opt = document.createElement("option");
      opt.value = dep.name;
      opt.textContent = dep.name;
      select.appendChild(opt);
    });
  } catch (e) {
    console.warn("loadDepartments error:", e);
  }
}

/* --- BIND EVENTS --- */
// document.getElementById("filter_dept")?.addEventListener("change", loadUserActivity);
document.getElementById("btnUserSearch")?.addEventListener("click", loadUserActivity);

/* Init */
await loadDepartments();
await loadUserActivity();

  /* ---------- BIND EXPORT BUTTONS ---------- */

  async function exportActiveTabPDF() {
    const info = getActiveReportInfo();
    if (!info || !info.tableId) return alert("Không tìm thấy bảng để xuất.");
    const creatorName = getCreatorInfo();
    await exportTableToPDF({
      tableEl: info.tableId,
      title: info.title,
      creator: creatorName,
      logoSrc: "images/dnse_logo.png"
    });
  }

  function exportActiveTabExcel() {
    const info = getActiveReportInfo();
    if (!info || !info.tableId) return alert("Không tìm thấy bảng để xuất.");
    exportTableToExcel({
      tableEl: info.tableId,
      fileName: `${info.title.replace(/\s+/g, '_')}.xlsx`,
      title: info.title // <--- Thêm dòng này
    });
  }

  // Global buttons
  const btnExportPDF = document.getElementById("btnExportPDF");
  const btnExportExcel = document.getElementById("btnExportExcel");
  if (btnExportPDF) btnExportPDF.addEventListener("click", exportActiveTabPDF);
  if (btnExportExcel) btnExportExcel.addEventListener("click", exportActiveTabExcel);

  // Per-tab individual buttons (backwards compatible)
  document.getElementById("btnRoomPDF")?.addEventListener("click", () =>
    exportTableToPDF({
      tableEl: "roomReportTable",
      title: "Báo cáo sử dụng phòng họp",
      creator: getCreatorInfo(),
      logoSrc: "images/dnse_logo.png"
    })
  );
  document.getElementById("btnRoomExcel")?.addEventListener("click", () =>
    exportTableToExcel({
      tableEl: "roomReportTable",
      fileName: "BaoCao_SuDungPhongHop.xlsx",
      title: "Báo cáo sử dụng phòng họp" // <--- Thêm dòng này
    })
  );
  document.getElementById("btnSignPDF")?.addEventListener("click", () =>
    exportTableToPDF({
      tableEl: "signReportTable",
      title: "Báo cáo trình ký",
      creator: getCreatorInfo(),
      logoSrc: "images/dnse_logo.png"
    })
  );
  document.getElementById("btnSignExcel")?.addEventListener("click", () =>
    exportTableToExcel({
      tableEl: "signReportTable",
      title: "Báo cáo trình ký",
      fileName: "BaoCao_TrinhKy.xlsx"
    })
  );

  document.getElementById("btnUserPDF")?.addEventListener("click", () =>
    exportTableToPDF({
      tableEl: "userReportTable",
      title: "Báo cáo người dùng hoạt động",
      creator: getCreatorInfo(),
      logoSrc: "images/dnse_logo.png"
    })
  );
  document.getElementById("btnUserExcel")?.addEventListener("click", () =>
    exportTableToExcel({
      tableEl: "userReportTable",
      title: "Báo cáo người dùng hoạt động",
      fileName: "BaoCao_NguoiDung.xlsx"
    })
  );
/* ===========================================================
     TAB 5: THỐNG KÊ (STATS)
     Các hàm tải dữ liệu và export cho tab Thống kê
     =========================================================== */

  // Hàm render chung cho bảng thống kê để đỡ lặp code
  function renderStatsTable(tableId, data, columns) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = "";
    
    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${columns.length + 1}" class="text-center text-muted">Không có dữ liệu</td></tr>`;
      return;
    }

    data.forEach((item, index) => {
      const tr = document.createElement("tr");
      // Cột đầu tiên luôn là STT
      let html = `<td>${index + 1}</td>`;
      // Map các cột còn lại theo key truyền vào
      columns.forEach(key => {
        html += `<td>${item[key] !== undefined ? item[key] : "-"}</td>`;
      });
      tr.innerHTML = html;
      tbody.appendChild(tr);
    });
  }

  // Hàm chính: Gọi API và hiển thị dữ liệu
  async function loadStatsReport() {
    const from = document.getElementById("stats_from")?.value;
    const to = document.getElementById("stats_to")?.value;
    
    // Tạo query string
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    const queryString = params.toString();

    // 1. Top 5 Phòng họp
    try {
      // Backend api dự kiến: /api/stats/top-rooms
      const dataRooms = await fetchJSON(`/api/stats/top-rooms?${queryString}`);
      // Mapping key: room_name, count, total_hours
      renderStatsTable("topRoomTable", dataRooms, ["room_name", "count", "total_hours"]);
    } catch (e) {
      console.warn("Lỗi tải Top Rooms:", e);
    }

    // 2. Top 5 Khung giờ
    try {
      // Backend api dự kiến: /api/stats/top-hours
      const dataHours = await fetchJSON(`/api/stats/top-hours?${queryString}`);
      // Mapping key: time_frame, count
      renderStatsTable("topHourTable", dataHours, ["time_frame", "count"]);
    } catch (e) {
      console.warn("Lỗi tải Top Hours:", e);
    }

    // 3. Top 5 Người ký
    try {
      // Backend api dự kiến: /api/stats/top-signers
      const dataSigners = await fetchJSON(`/api/stats/top-signers?${queryString}`);
      // Mapping key: full_name, signed_count
      renderStatsTable("topSignerTable", dataSigners, ["full_name", "signed_count"]);
    } catch (e) {
      console.warn("Lỗi tải Top Signers:", e);
    }

    // 4. Top 5 Người đặt phòng
    try {
      // Backend api dự kiến: /api/stats/top-bookers
      const dataBookers = await fetchJSON(`/api/stats/top-bookers?${queryString}`);
      // Mapping key: full_name, booking_count
      renderStatsTable("topBookerTable", dataBookers, ["full_name", "booking_count"]);
    } catch (e) {
      console.warn("Lỗi tải Top Bookers:", e);
    }
  }

  // Gắn sự kiện nút Tìm kiếm
  document.getElementById("btnStatsSearch")?.addEventListener("click", loadStatsReport);

  // --- GẮN SỰ KIỆN EXPORT RIÊNG CHO TỪNG BẢNG THỐNG KÊ ---

  // 1. Export Top Phòng
  document.getElementById("btnTopRoomPDF")?.addEventListener("click", () => 
    exportTableToPDF({ 
      tableEl: "topRoomTable", 
      title: "Thống kê Top 5 Phòng họp", 
      creator: getCreatorInfo(), logoSrc: "images/dnse_logo.png" 
    })
  );
  document.getElementById("btnTopRoomExcel")?.addEventListener("click", () => 
    exportTableToExcel({ tableEl: "topRoomTable",
      title: "Thống kê Top 5 Phòng họp",  fileName: "ThongKe_TopPhong.xlsx" })
  );

  // 2. Export Top Khung giờ
  document.getElementById("btnTopHourPDF")?.addEventListener("click", () => 
    exportTableToPDF({ 
      tableEl: "topHourTable", 
      title: "Thống kê Top 5 Khung giờ cao điểm", 
      creator: getCreatorInfo(), logoSrc: "images/dnse_logo.png" 
    })
  );
  document.getElementById("btnTopHourExcel")?.addEventListener("click", () => 
    exportTableToExcel({ tableEl: "topHourTable",
      title: "Thống kê Top 5 Khung giờ cao điểm",  fileName: "ThongKe_TopKhungGio.xlsx" })
  );

  // 3. Export Top Người ký
  document.getElementById("btnTopSignerPDF")?.addEventListener("click", () => 
    exportTableToPDF({ 
      tableEl: "topSignerTable", 
      title: "Thống kê Top 5 Người ký nhiều nhất", 
      creator: getCreatorInfo(), logoSrc: "images/dnse_logo.png" 
    })
  );
  document.getElementById("btnTopSignerExcel")?.addEventListener("click", () => 
    exportTableToExcel({ tableEl: "topSignerTable",
      title: "Thống kê Top 5 Người ký nhiều nhất",  fileName: "ThongKe_TopNguoiKy.xlsx" })
  );

  // 4. Export Top Người đặt
  document.getElementById("btnTopBookerPDF")?.addEventListener("click", () => 
    exportTableToPDF({ 
      tableEl: "topBookerTable", 
      title: "Thống kê Top 5 Người đặt phòng", 
      creator: getCreatorInfo(), logoSrc: "images/dnse_logo.png" 
    })
  );
  document.getElementById("btnTopBookerExcel")?.addEventListener("click", () => 
    exportTableToExcel({ tableEl: "topBookerTable", 
      title: "Thống kê Top 5 Người đặt phòng", fileName: "ThongKe_TopNguoiDat.xlsx" })
  );

  // Tải dữ liệu mặc định khi mới vào trang (nếu muốn)
  // await loadStatsReport();
});