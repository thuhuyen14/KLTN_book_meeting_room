require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const authRoutes = require("./routes/auth"); 
const db = require('./db');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', authRoutes);

// API login (MySQL)
// === Thay đoạn API login cũ bằng đoạn này ===
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcrypt');

// app.post('/api/login', async (req, res) => {
//   const { username, password } = req.body;
//   if (!username || !password) {
//     return res.status(400).json({ success:false, error: 'Thiếu username hoặc password' });
//   }

//   try {
//     // Chỉ lấy những cột cần thiết (đảm bảo tên cột khớp với DB của bạn)
//     const [rows] = await db.query(
//       'SELECT id, username, password_hash, role, full_name FROM users WHERE username = ? LIMIT 1',
//       [username]
//     );

//     if (!rows || rows.length === 0) {
//       console.log('Login attempt - user not found:', username);
//       return res.status(401).json({ success:false, error: 'Sai username hoặc password' });
//     }

//     const user = rows[0];
//     console.log('User from DB:', user);

//     // So khớp password (dùng await)
//     const match = await bcrypt.compare(password, user.password_hash);
//     if (!match) {
//       console.log('Login attempt - wrong password for:', username);
//       return res.status(401).json({ success:false, error: 'Sai username hoặc password' });
//     }

//     // Tạo JWT token
//     const token = jwt.sign(
//       { id: user.id, username: user.username, role: user.role },
//       process.env.JWT_SECRET || 'SECRET_KEY', // nếu chưa có .env, fallback tạm
//       { expiresIn: '2h' }
//     );

//     // TRẢ VỀ ĐÚNG TRƯỜNG FRONTEND CẦN
//     res.json({
//       success: true,
//       token,
//       role: user.role,
//       id: user.id,               // numeric id (rất quan trọng)
//       username: user.username,
//       full_name: user.full_name || null
//     });
//   } catch (err) {
//     console.error('Login error:', err);
//     res.status(500).json({ success:false, error: 'Lỗi server' });
//   }
// });

// API: rooms (MySQL)
app.get('/api/rooms', async (req, res) => {
  try {
    const [rows] = await db.query
    (`      
      SELECT 
        r.id,
        r.name,
        r.image,
        rt.description AS room_description,
        rt.default_capacity AS capacity,
        CONCAT('Tầng ', l.floor, ' - ', l.branch) AS location_name
      FROM rooms r
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN locations l ON r.location_id = l.id
      ORDER BY r.id;
      `
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: users (MySQL)
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings', async (req, res) => {
  const room_id = req.query.room_id;
  const date = req.query.date;
  let sql, params = [];

  if (room_id && date) {
    sql = `
      SELECT b.*, r.name AS room_name, u.full_name AS booked_by
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      JOIN users u ON u.id = b.user_id
      WHERE b.room_id = ?
        AND DATE(b.start_iso) <= ?
        AND DATE(b.end_iso) >= ?
      ORDER BY b.start_iso
    `;
    params = [room_id, date, date];
  } else if (room_id) {
    sql = `
      SELECT b.*, r.name AS room_name, u.full_name AS booked_by
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      JOIN users u ON u.id = b.user_id
      WHERE b.room_id = ?
      ORDER BY b.start_iso
    `;
    params = [room_id];
  } else if (date) {
    sql = `
      SELECT b.*, r.name AS room_name, u.full_name AS booked_by
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      JOIN users u ON u.id = b.user_id
      WHERE DATE(b.start_iso) <= ?
        AND DATE(b.end_iso) >= ?
      ORDER BY b.start_iso
    `;
    params = [date, date];
  } else {
    sql = `
      SELECT b.*, r.name AS room_name, u.full_name AS booked_by
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      JOIN users u ON u.id = b.user_id
      ORDER BY b.start_iso
    `;
  }

  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create booking (with conflict check) (MySQL)
app.post('/api/book', async (req, res) => {
  try {
    const { room_id, title, user_id, start_iso, end_iso } = req.body;
    if (!room_id || !title || !user_id || !start_iso || !end_iso) {
      return res.status(400).json({ error: 'Thiếu thông tin' });
    }
    const s = new Date(start_iso);
    const e = new Date(end_iso);
    if (isNaN(s) || isNaN(e) || s >= e) {
      return res.status(400).json({ error: 'Thời gian không hợp lệ' });
    }
    // Check conflict
    const [conflicts] = await db.query('SELECT * FROM bookings WHERE room_id = ? AND NOT (end_iso <= ? OR start_iso >= ?)', [room_id, start_iso, end_iso]);
    if (conflicts.length > 0) {
      return res.status(409).json({ error: 'Xung đột lịch với booking hiện tại', conflict: conflicts[0] });
    }
    // Insert booking
    const [result] = await db.query('INSERT INTO bookings (room_id, title, user_id, start_iso, end_iso) VALUES (?, ?, ?, ?, ?)', [room_id, title, user_id, start_iso, end_iso]);
    const [rows] = await db.query('SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.id = ?', [result.insertId]);
    res.json({ success: true, booking: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Delete booking (MySQL)
app.delete('/api/bookings/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const [result] = await db.query('DELETE FROM bookings WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy booking' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route check phòng trống (MySQL)
app.get('/api/available', async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
        return res.status(400).json({ error: 'Thiếu tham số thời gian' });
    }
    try {
        const [rooms] = await db.query(`
          SELECT 
            r.id,
            r.name,
            r.image,
            rt.description AS room_description,
            rt.default_capacity AS capacity,
            CONCAT('Tầng ', l.floor, ' - ', l.branch) AS location_name
          FROM rooms r
          LEFT JOIN room_types rt ON r.room_type_id = rt.id
          LEFT JOIN locations l ON r.location_id = l.id
          `);
        const [booked] = await db.query('SELECT room_id FROM bookings WHERE NOT (end_iso <= ? OR start_iso >= ?)', [start, end]);
        const bookedIds = booked.map(b => b.room_id);
        const available = rooms.filter(r => !bookedIds.includes(r.id));
        res.json(available);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Phòng nào được book nhiều nhất (MySQL)
app.get('/api/report/rooms', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.name, COUNT(b.id) as count
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      GROUP BY r.id
      ORDER BY count DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ngày nào được book nhiều nhất (MySQL)
app.get('/api/report/days', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE(start_iso) as day, COUNT(id) as count
      FROM bookings
      GROUP BY day
      ORDER BY count DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Người/phòng ban nào đặt nhiều (MySQL)
app.get('/api/report/users', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.full_name, u.department, COUNT(b.id) as count
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      GROUP BY u.id
      ORDER BY count DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Serve index.html for any other route (SPA fallback)
app.get('*', (req, res) => {
  const p = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(p)) {
    res.sendFile(p);
  } else {
    res.status(404).send('Not found');
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server started on port', PORT));
