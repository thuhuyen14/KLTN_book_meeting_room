
// seed_admin.js
require("dotenv").config();
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");

const db = new Database("booking.db");

// 1. Tạo bảng auth_users nếu chưa có
db.prepare(`
  CREATE TABLE IF NOT EXISTS auth_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
  )
`).run();

// 2. Hash mật khẩu admin mặc định
const adminUsername = "admin";
const adminPassword = "123456"; // có thể đổi trong DB sau
const passwordHash = bcrypt.hashSync(adminPassword, 10);

// 3. Insert hoặc update admin
try {
  const existing = db.prepare(`SELECT * FROM auth_users WHERE username = ?`).get(adminUsername);

  if (existing) {
    db.prepare(`UPDATE auth_users SET password_hash = ?, role = ? WHERE username = ?`)
      .run(passwordHash, "admin", adminUsername);
    console.log("Cập nhật tài khoản admin");
  } else {
    db.prepare(`INSERT INTO auth_users (username, password_hash, role) VALUES (?, ?, ?)`)
      .run(adminUsername, passwordHash, "admin");
    console.log(" Tạo tài khoản admin thành công");
  }
} catch (err) {
  console.error("Lỗi khi seed admin:", err.message);
}

db.close();

