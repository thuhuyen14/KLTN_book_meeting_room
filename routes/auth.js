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

module.exports = router;
