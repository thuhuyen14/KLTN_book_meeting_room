const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const path = require('path');

const db = new Database(path.join(__dirname, 'booking.db'));

// Tạo bảng nếu chưa có
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT,
    job_title TEXT
);
`);

// Xóa dữ liệu cũ
db.prepare('DELETE FROM users').run();

// Đọc file Excel
const workbook = XLSX.readFile(path.join(__dirname, 'users.xlsx'));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const users = XLSX.utils.sheet_to_json(sheet);

// Chèn dữ liệu
const insert = db.prepare('INSERT INTO users (employee_id, name, email, department, job_title) VALUES (?, ?, ?, ?, ?)');
users.forEach(u => insert.run(u.employee_id, u.name, u.email, u.department, u.job_title));

console.log(`Đã thêm ${users.length} user vào database.`);
