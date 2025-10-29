require('dotenv').config();
process.env.TZ = 'Asia/Ho_Chi_Minh';
function formatVietnamTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}
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

app.use('/api', authRoutes); // lấy api login từ đây


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
        CONCAT('Tầng ', l.floor, ' - ', b.name) AS location_name
      FROM rooms r
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN locations l ON r.location_id = l.id
      LEFT JOIN branches b ON l.branch_id = b.id
      ORDER BY r.id;
      `
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API cập nhật thông tin phòng
app.put('/api/rooms/:id', async (req, res) => {
  const roomId = req.params.id;
  const { name, room_type_id, location_id, image } = req.body;

  try {
    // Lấy dữ liệu cũ để ghi log
    const [oldRows] = await db.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (oldRows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy phòng' });
    }
    const oldData = oldRows[0];

    // Cập nhật phòng
    await db.query(
      `UPDATE rooms 
       SET name = ?, room_type_id = ?, location_id = ?, image = ?
       WHERE id = ?`,
      [name, room_type_id, location_id, image, roomId]
    );

    // Ghi log
    await db.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, old_data, new_data, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'room',
        roomId,
        'update',
        JSON.stringify(oldData),
        JSON.stringify({ name, room_type_id, location_id, image }),
        req.user?.email || 'admin_demo'
      ]
    );

    res.json({ success: true, message: 'Cập nhật phòng thành công!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi cập nhật phòng' });
  }
});
// API thêm phòng
app.post('/api/rooms', async (req, res) => {
  const { id, name, room_type_id, location_id, image } = req.body;

  try {
    // Thêm phòng vào DB
    await db.query(
      `INSERT INTO rooms (id, name, room_type_id, location_id, image)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, room_type_id, location_id, image]
    );

    // Ghi log
    await db.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, old_data, new_data, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'room',
        id,
        'insert',
        null,
        JSON.stringify({ id, name, room_type_id, location_id, image }),
        req.user?.email || 'admin_demo'
      ]
    );

    res.json({ success: true, message: 'Thêm phòng thành công!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi thêm phòng' });
  }
});
// API xóa phòng
app.delete('/api/rooms/:id', async (req, res) => {
  const roomId = req.params.id;

  try {
    // Lấy dữ liệu cũ để ghi log
    const [oldRows] = await db.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (oldRows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy phòng' });
    }
    const oldData = oldRows[0];

    // Xóa phòng
    await db.query('DELETE FROM rooms WHERE id = ?', [roomId]);

    // Ghi log
    await db.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, old_data, new_data, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'room',
        roomId,
        'delete',
        JSON.stringify(oldData),
        null,
        req.user?.email || 'admin_demo'
      ]
    );

    res.json({ success: true, message: 'Xóa phòng thành công!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi xóa phòng' });
  }
});
app.get('/api/room_types', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, description FROM room_types ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/locations', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.id, l.floor, b.name AS branch_name
      FROM locations l
      LEFT JOIN branches b ON l.branch_id = b.id
      ORDER BY l.floor, b.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// API: users (MySQL)
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id,
      up.full_name, 
      up.email,
      d.name AS department,
      j.name AS job_title,
      t.name AS team,
      b.id AS branch_id,
      b.name AS branch_name
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN teams t ON u.team_id = t.id
      LEFT JOIN job_titles j ON u.job_title_id = j.id
      LEFT JOIN branches b ON up.branch_id = b.id
      ORDER BY u.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// API: lấy danh sách team
app.get('/api/teams', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT t.id, t.name
      FROM teams t
      ORDER BY t.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: lấy users theo team
app.get('/api/teams/:teamId/users', async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const [rows] = await db.query(`
      SELECT u.id, up.full_name, d.name AS department
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.team_id = ?
    `, [teamId]);
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
      SELECT b.*, r.name AS room_name, up.full_name AS booked_by
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      JOIN users u ON u.id = b.user_id
      JOIN user_profiles up ON u.id = up.user_id  -- Thêm JOIN với bảng user_profiles
      WHERE b.room_id = ?
        AND DATE(b.start_time) <= ?
        AND DATE(b.end_time) >= ?
      ORDER BY b.start_time
    `;
    params = [room_id, date, date];
  } else if (room_id) {
    sql = `
      SELECT b.*, r.name AS room_name, up.full_name AS booked_by
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      JOIN users u ON u.id = b.user_id
      JOIN user_profiles up ON u.id = up.user_id  -- Thêm JOIN với bảng user_profiles
      WHERE b.room_id = ?
      ORDER BY b.start_time
    `;
    params = [room_id];
  } else if (date) {
    sql = `
      SELECT b.*, r.name AS room_name, up.full_name AS booked_by
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      JOIN users u ON u.id = b.user_id
      JOIN user_profiles up ON u.id = up.user_id  -- Thêm JOIN với bảng user_profiles
      WHERE DATE(b.start_time) <= ?
        AND DATE(b.end_time) >= ?
      ORDER BY b.start_time
    `;
    params = [date, date];
  } else {
    sql = `
      SELECT b.*, r.name AS room_name, up.full_name AS booked_by
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      JOIN users u ON u.id = b.user_id
      JOIN user_profiles up ON u.id = up.user_id
      ORDER BY b.start_time
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

// 📌 API: Tạo booking (có check trùng lịch + thêm người tham dự theo team)
// 📌 API: Tạo booking (có check trùng lịch + thêm người tham dự theo team + người lẻ)
app.post('/api/book', async (req, res) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    const { room_id, title, user_id, start_time, end_time, team_ids, participants } = req.body;

    // 1️⃣ Validate input
    if (!room_id || !title || !user_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'Thiếu thông tin' });
    }
    const s = new Date(start_time);
    const e = new Date(end_time);
    if (isNaN(s) || isNaN(e) || s >= e) {
      return res.status(400).json({ error: 'Thời gian không hợp lệ' });
    }

    // 2️⃣ Kiểm tra xung đột phòng họp
    const [conflicts] = await conn.query(
      'SELECT * FROM bookings WHERE room_id = ? AND NOT (end_time <= ? OR start_time >= ?)',
      [room_id, start_time, end_time]
    );
    if (conflicts.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Xung đột lịch với booking hiện tại', conflict: conflicts[0] });
    }

    // 3️⃣ Thêm bản ghi booking
    const [result] = await conn.query(
      'INSERT INTO bookings (room_id, title, user_id, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      [room_id, title, user_id, start_time, end_time]
    );
    const bookingId = result.insertId;

    // 4️⃣ Lấy chi nhánh của organizer
    const [creatorInfo] = await conn.query(
      `SELECT u.id, up.branch_id
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.id = ?`,
      [user_id]
    );
    const userBranchId = creatorInfo[0]?.branch_id;

    // 5️⃣ Gộp tất cả user: members của team + participant lẻ + organizer
    let allUserIds = new Set();

    // ✅ Thêm members từ team_ids
    if (Array.isArray(team_ids) && team_ids.length > 0) {
      const [members] = await conn.query(
        `SELECT u.id, u.team_id
         FROM users u
         LEFT JOIN user_profiles up ON u.id = up.user_id
         WHERE u.team_id IN (?) AND up.branch_id = ?`,
        [team_ids, userBranchId]
      );
      members.forEach(m => allUserIds.add(m.id));
      // Thêm vào bảng participants với team_id
      const memberValues = members.map(m => [bookingId, m.id, m.team_id]);
      if (memberValues.length > 0) {
        await conn.query(
          'INSERT INTO participants (booking_id, user_id, team_id) VALUES ? ON DUPLICATE KEY UPDATE booking_id=booking_id',
          [memberValues]
        );
        // Gửi notification cho members
        const notifValues = members.map(m => [m.id, `Bạn đã được thêm vào cuộc họp: "${title}" lúc ${formatVietnamTime(start_time)}`]);
        if (notifValues.length > 0) {
          await conn.query(
            'INSERT INTO notifications (user_id, message) VALUES ?',
            [notifValues]
          );
        }
      }
    }

    // ✅ Thêm participant lẻ
    if (Array.isArray(participants) && participants.length > 0) {
      participants.forEach(uid => allUserIds.add(uid));
      const participantValues = participants.map(uid => [bookingId, uid, null]);
      await conn.query(
        'INSERT INTO participants (booking_id, user_id, team_id) VALUES ? ON DUPLICATE KEY UPDATE booking_id=booking_id',
        [participantValues]
      );
      const notifValues = participants.map(uid => [uid, `Bạn đã được thêm vào cuộc họp: "${title}" lúc ${formatVietnamTime(start_time)}`]);
      if (notifValues.length > 0) {
        await conn.query(
          'INSERT INTO notifications (user_id, message) VALUES ?',
          [notifValues]
        );
      }
    }

    // ✅ Thêm organizer
    allUserIds.add(user_id);
    await conn.query(
      'INSERT INTO participants (booking_id, user_id, team_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE booking_id=booking_id',
      [bookingId, user_id, null]
    );
    await conn.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [user_id, `Bạn đã tạo cuộc họp: "${title}" lúc ${formatVietnamTime(start_time)}`]
    );

    // 6️⃣ Trả về booking vừa tạo
    const [rows] = await conn.query(
      'SELECT b.*, r.name AS room_name FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.id = ?',
      [bookingId]
    );

    await conn.commit();
    res.json({ success: true, booking: rows[0] });

  } catch (err) {
    await conn.rollback();
    console.error('❌ Lỗi tạo booking:', err);
    res.status(500).json({ error: 'Lỗi server' });
  } finally {
    conn.release();
  }
});


// Lấy thông báo cho user (MySQL)
app.get('/api/notifications/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings/:id/detail', async (req, res) => {
  const bookingId = req.params.id;

  try {
    // Lấy thông tin cơ bản của booking
    const [bookings] = await db.query(`
      SELECT b.*, r.name AS room_name, up.full_name AS booked_by
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      JOIN users u ON u.id = b.user_id
      JOIN user_profiles up ON u.id = up.user_id
      WHERE b.id = ?
    `, [bookingId]);

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy booking' });
    }

    const booking = bookings[0];

    // Lấy người tham dự
    const [participants] = await db.query(`
      SELECT p.user_id, p.team_id, up.full_name
      FROM participants p
      JOIN users u ON u.id = p.user_id
      JOIN user_profiles up ON u.id = up.user_id
      WHERE p.booking_id = ?
    `, [bookingId]);

    // Lấy danh sách team (chỉ những team có mặt)
    const teamIds = [...new Set(participants.filter(p => p.team_id).map(p => p.team_id))];
    const [teams] = teamIds.length > 0
      ? await db.query('SELECT id, name FROM teams WHERE id IN (?)', [teamIds])
      : [ [] ];

    res.json({
      ...booking,
      participants,
      teams
    });
  } catch (err) {
    console.error('❌ Lỗi khi lấy chi tiết booking:', err);
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

app.put('/api/bookings/:id', async (req, res) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    const id = req.params.id;
    const { title, room_id, start_time, end_time, teams, participants } = req.body;

    // 1️⃣ Lấy dữ liệu cũ
    const [oldRows] = await conn.query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (oldRows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy booking' });
    }
    const oldData = oldRows[0];

    // 2️⃣ Kiểm tra xung đột lịch với các booking khác
    const [conflicts] = await conn.query(
      `SELECT * FROM bookings 
       WHERE room_id = ? AND id != ? AND NOT (end_time <= ? OR start_time >= ?)`,
      [room_id, id, start_time, end_time]
    );
    if (conflicts.length > 0) {
      await conn.rollback();
      return res.status(409).json({ 
        error: 'Xung đột lịch với booking hiện tại', 
        conflict: conflicts[0] 
      });
    }

    // 3️⃣ Cập nhật booking (thêm teams + participants)
    await conn.query(
      'UPDATE bookings SET title = ?, room_id = ?, start_time = ?, end_time = ?, teams = ?, participants = ? WHERE id = ?',
      [
        title,
        room_id,
        start_time,
        end_time,
        JSON.stringify(teams || []),
        JSON.stringify(participants || []),
        id
      ]
    );

    // 4️⃣ Lấy dữ liệu mới để log
    const [newRows] = await conn.query('SELECT * FROM bookings WHERE id = ?', [id]);
    const newData = newRows[0];

    // 5️⃣ Ghi log vào booking_change_log
    await conn.query(
      `INSERT INTO booking_change_log (entity_type, entity_id, action, old_data, new_data, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'booking',
        id,
        'update',
        JSON.stringify(oldData),
        JSON.stringify(newData),
        req.user?.email || 'admin_demo'
      ]
    );

    await conn.commit();
    res.json({ success: true, message: 'Cập nhật booking thành công!', booking: newData });

  } catch (err) {
    await conn.rollback();
    console.error('❌ Lỗi khi update booking:', err);
    res.status(500).json({ error: 'Lỗi server' });
  } finally {
    conn.release();
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
            CONCAT('Tầng ', l.floor, ' - ', b.name) AS location_name,
            b.id AS branch_id
          FROM rooms r
          LEFT JOIN room_types rt ON r.room_type_id = rt.id
          LEFT JOIN locations l ON r.location_id = l.id
          LEFT JOIN branches b ON l.branch_id = b.id
          ORDER BY r.id;
          `);
        const [booked] = await db.query('SELECT room_id FROM bookings WHERE NOT (end_time <= ? OR start_time >= ?)', [start, end]);
        const bookedIds = booked.map(b => b.room_id);
        const available = rooms.filter(r => !bookedIds.includes(r.id));
        res.json(available);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});
app.get('/api/bookings/personal/:userId', async (req, res) => {
  // console.log("📥 personal bookings called:", req.params, req.query);
  const userId = req.params.userId;
  const { start, end } = req.query;

  try {
    // 👉 Chuyển ISO UTC (có Z) sang múi giờ Việt Nam rồi lấy ngày chính xác
    const startVN = new Date(start);
    const endVN = new Date(end);

    // cộng thêm 7 tiếng để từ UTC → GMT+7
    startVN.setHours(startVN.getHours() + 7);
    endVN.setHours(endVN.getHours() + 7);

    const startDateStr = startVN.toISOString().split('T')[0];
    const endDateStr = endVN.toISOString().split('T')[0];

    const startDatetime = `${startDateStr} 00:00:00`;
    const endDatetime = `${endDateStr} 23:59:59`;

    // console.log("🕓 Converted range:", { startDatetime, endDatetime });

    const [rows] = await db.query(
      `SELECT DISTINCT b.*, r.name AS room_name
       FROM bookings b
       LEFT JOIN participants p ON p.booking_id = b.id
       LEFT JOIN rooms r ON b.room_id = r.id
       WHERE (b.user_id = ? OR p.user_id = ?)
         AND NOT (b.end_time < ? OR b.start_time > ?)
       ORDER BY b.start_time`,
      [userId, userId, startDatetime, endDatetime]
    );

    // console.log(`✅ Found ${rows.length} bookings`);
    res.json(rows);
  } catch (err) {
    console.error('❌ Lỗi lấy bookings personal:', err);
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
      SELECT DATE(start_time) as day, COUNT(id) as count
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
      SELECT up.full_name, d.name, COUNT(b.id) as count
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN departments d ON u.department_id = d.id
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
