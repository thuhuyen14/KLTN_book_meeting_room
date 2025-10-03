const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db"); // file db.js bạn đã tạo
const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
    if (rows.length === 0) {
      return res.json({ success: false, error: "User không tồn tại" });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.json({ success: false, error: "Sai mật khẩu" });
    }

    // OK -> trả token (giả sử simple token), role
    res.json({
      success: true,
      token: "some-token",
      role: user.role,
      full_name: user.full_name
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: "Lỗi server" });
  }
});

module.exports = router;
