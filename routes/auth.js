const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db"); // file db.js bạn đã tạo
const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;


  try {
    const [rows] = await db.query(
      `
      SELECT 
        u.id,
        u.username,
        u.password_hash,
        r.name AS role,
        p.full_name,
        p.branch_id as branch_id
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.username = ?
      `,
      [username]
    );
    if (rows.length === 0) {
      return res.json({ success: false, error: "User không tồn tại" });
    }

    const user = rows[0];
        // debug: in ra server console để kiểm tra dữ liệu trả về
    // console.log('LOGIN ROW:', user);  
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.json({ success: false, error: "Sai mật khẩu" });
    }

    // OK -> trả token (giả sử simple token), role
res.json({
  success: true,
  token: "some-token",   // hoặc JWT thật nếu bạn đã cấu hình
  role: user.role,
  id: user.id,
  username: user.username,
  full_name: user.full_name || null,
  branch_id: user.branch_id || null
});
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: "Lỗi server" });
  }
});

// PUT đổi mật khẩu
router.put("/change-password/:id", async (req, res) => {
  const userId = req.params.id;
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin" });
  }

  try {
    // 1️⃣ Lấy password hiện tại của user
    const [rows] = await db.query(
      `SELECT password_hash FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "User không tồn tại" });

    const currentHash = rows[0].password_hash;

    // 2️⃣ So sánh password cũ
    const match = await bcrypt.compare(old_password, currentHash);
    if (!match) {
      return res.status(400).json({ error: "Mật khẩu cũ không đúng" });
    }

    // 3️⃣ Hash mật khẩu mới
    const saltRounds = 10;
    const newHash = await bcrypt.hash(new_password, saltRounds);

    // 4️⃣ Lưu vào database
    await db.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, userId]);

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});
module.exports = router;
