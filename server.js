const express = require('express');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const db = new Database(path.join(__dirname, 'booking.db'));

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB
const initSQL = `
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 4,
  location TEXT,
  description TEXT,
  image TEXT
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  organizer TEXT NOT NULL,
  start_iso TEXT NOT NULL,
  end_iso TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(room_id) REFERENCES rooms(id)
);
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT,
    job_title TEXT
);

`;
db.exec(initSQL);

// Seed rooms with images if empty
const countRooms = db.prepare('SELECT COUNT(*) AS c FROM rooms').get().c;
if (countRooms === 0) {
  const insert = db.prepare('INSERT INTO rooms (code, name, capacity, location, description, image) VALUES (?, ?, ?, ?, ?, ?)');
  insert.run('R1', 'Phòng họp A', 8, 'Tầng 3', 'Phòng nhỏ phù hợp 6-8 người, có TV & wifi.', 'images/small_room.jpg');
  insert.run('R2', 'Phòng họp B', 12, 'Tầng 2', 'Phòng trung, có máy chiếu, bảng viết.', 'images/medium_room.jpg');
  insert.run('R3', 'Phòng họp C', 25, 'Tầng 5', 'Phòng lớn cho hội thảo, hỗ trợ video conference.', 'images/big_room.png');
}

// API: rooms
app.get('/api/rooms', (req, res) => {
  const rows = db.prepare('SELECT * FROM rooms ORDER BY id').all();
  res.json(rows);
});

// User
const countUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
// if (countUsers === 0) {
//   const insert = db.prepare('INSERT INTO users (employee_id, name, email, department) VALUES (?, ?, ?, ?)');
//   insert.run('E001', 'Nguyễn Mỹ Hương', 'huong.nguyen@dnse.com', 'Customer Service');
//   insert.run('E002', 'Trần Hoàng Nam', 'nam.tran@dnse.com', 'Techies');
//   insert.run('E003', 'Lê Ánh Tuyết', 'tuyet.le@dnse.com', 'HR');
// }
// API: users
app.get('/api/users', (req, res) => {
    const rows = db.prepare('SELECT * FROM users ORDER BY name').all();
    res.json(rows);
});



// API: bookings (filter by room/date)
app.get('/api/bookings', (req, res) => {
  const room_id = req.query.room_id;
  const date = req.query.date;
  let rows;
  if (room_id && date) {
    const start = date + 'T00:00:00';
    const end = date + 'T23:59:59';
    rows = db.prepare('SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.room_id = ? AND b.start_iso <= ? AND b.end_iso >= ? ORDER BY b.start_iso').all(room_id, end, start);
  } else if (room_id) {
    rows = db.prepare('SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.room_id = ? ORDER BY b.start_iso').all(room_id);
  } else if (date) {
    const start = date + 'T00:00:00';
    const end = date + 'T23:59:59';
    rows = db.prepare('SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE NOT (b.end_iso <= ? OR b.start_iso >= ?) ORDER BY b.start_iso').all(start, end);
  } else {
    rows = db.prepare('SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON r.id = b.room_id ORDER BY b.start_iso').all();
  }
  res.json(rows);
});

// Create booking (with conflict check)
app.post('/api/book', (req, res) => {
  try {
    const { room_id, title, organizer, start_iso, end_iso } = req.body;
    if (!room_id || !title || !organizer || !start_iso || !end_iso) {
      return res.status(400).json({ error: 'Thiếu thông tin' });
    }
    const s = new Date(start_iso);
    const e = new Date(end_iso);
    if (isNaN(s) || isNaN(e) || s >= e) {
      return res.status(400).json({ error: 'Thời gian không hợp lệ' });
    }
    const conflict = db.prepare('SELECT * FROM bookings WHERE room_id = ? AND NOT (end_iso <= ? OR start_iso >= ?)').get(room_id, start_iso, end_iso);
    if (conflict) {
      return res.status(409).json({ error: 'Xung đột lịch với booking hiện tại', conflict });
    }
    const stmt = db.prepare('INSERT INTO bookings (room_id, title, organizer, start_iso, end_iso) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(room_id, title, organizer, start_iso, end_iso);
    const booking = db.prepare('SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.id = ?').get(info.lastInsertRowid);
    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Delete booking
app.delete('/api/bookings/:id', (req, res) => {
  const id = req.params.id;
  const info = db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Không tìm thấy booking' });
  res.json({ success: true });
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
