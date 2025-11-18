const dotenv = require("dotenv");
dotenv.config();
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
const formatMySQLDate = (isoString) => {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // chuyển UTC -> local
  return d.toISOString().slice(0, 19).replace('T', ' ');
};


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
app.use('/images', express.static(path.join(__dirname, 'public/images')));

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
// API chi tiết phòng + thiết bị
app.get('/api/rooms/:id', async (req, res) => {
  const roomId = req.params.id;

  try {
    // Lấy thông tin phòng
    const [roomRows] = await db.query(`
      SELECT 
        r.id, r.name, r.image, rt.description AS room_description, rt.default_capacity AS capacity,
        r.location_id,                
        rt.id AS room_type_id, CONCAT('Tầng ', l.floor, ' - ', b.name) AS location_name,
        rt.type_name AS room_type
      FROM rooms r
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN locations l ON r.location_id = l.id
      LEFT JOIN branches b ON l.branch_id = b.id
      WHERE r.id = ?
    `, [roomId]);

    if (roomRows.length === 0) return res.status(404).json({ error: 'Không tìm thấy phòng' });

    const room = roomRows[0];

    // Lấy danh sách thiết bị của loại phòng
    const [equipments] = await db.query(`
      SELECT e.name, e.description, rte.quantity
      FROM room_type_equipment rte
      JOIN equipments e ON rte.equipment_id = e.id
      WHERE rte.room_type_id = ?
    `, [room.room_type_id]);

    // Trả về JSON
    res.json({ ...room, equipment: equipments });

  } catch (err) {
    console.error(err);
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
    const [rows] = await db.query('SELECT id, type_name, description, default_capacity FROM room_types ORDER BY id');
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
      u.username,
      u.role_id,
      up.full_name, 
      up.email,
      d.id AS department_id,
      d.name AS department,
      j.id AS job_title_id,
      j.name AS job_title,
      t.id AS team_id,
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

// GET user chi tiết theo ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.query(`
      SELECT u.id, u.username, u.role_id, u.department_id, u.team_id, u.job_title_id,
             up.full_name, up.email, up.phone, up.avatar_url, up.date_of_birth, up.branch_id,
             d.name AS department, t.name AS team, j.name AS job_title, b.name AS branch_name
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN teams t ON u.team_id = t.id
      LEFT JOIN job_titles j ON u.job_title_id = j.id
      LEFT JOIN branches b ON up.branch_id = b.id
      WHERE u.id = ?
      LIMIT 1
    `, [id]);

    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy user' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// users-api.js
const bcrypt = require('bcrypt');
module.exports = function(app, db) {
  // GET single user (detailed)
  app.get('/api/users/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const [rows] = await db.query(`
        SELECT u.id, u.username, u.role_id, u.department_id, u.team_id, u.job_title_id,
               up.full_name, up.email, up.phone, up.avatar_url, up.date_of_birth, up.branch_id,
               d.name AS department, t.name AS team, j.name AS job_title, b.name AS branch_name
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN teams t ON u.team_id = t.id
        LEFT JOIN job_titles j ON u.job_title_id = j.id
        LEFT JOIN branches b ON up.branch_id = b.id
        WHERE u.id = ?
        LIMIT 1
      `, [id]);
      if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy user' });
      res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST create user
  // app.post('/api/users', async (req, res) => {
  //   const { user, profile, associations } = req.body;
  //   const conn = await db.getConnection();
  //   try {
  //     await conn.beginTransaction();

  //     // check id unique
  //     const [exists] = await conn.query('SELECT 1 FROM users WHERE id = ?', [user.id]);
  //     if (exists.length) {
  //       await conn.rollback();
  //       return res.status(400).json({ error: 'ID đã tồn tại' });
  //     }

  //     const password = user.password || '123456';
  //     const hash = await bcrypt.hash(password, 10);

  //     await conn.query(`INSERT INTO users (id, username, password_hash, role_id, department_id, team_id, job_title_id, created_at)
  //                       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
  //                       [user.id, user.username, hash, user.role_id || 'user', associations.department_id || null, associations.team_id || null, associations.job_title_id || null]);

  //     await conn.query(`INSERT INTO user_profiles (user_id, full_name, email, phone, avatar_url, date_of_birth, branch_id)
  //                       VALUES (?, ?, ?, ?, ?, ?, ?)`,
  //                       [user.id, profile.full_name, profile.email, profile.phone || null, profile.avatar_url || null, profile.date_of_birth || null, profile.branch_id || null]);

  //     await conn.commit();
  //     res.json({ success: true });
  //   } catch (err) {
  //     await conn.rollback();
  //     console.error(err);
  //     res.status(500).json({ error: err.message });
  //   } finally { conn.release(); }
  // });

  // PUT update user (user data + profile + associations)
  // app.put('/api/users/:id', async (req, res) => {
  //   const id = req.params.id;
  //   const { user, profile, associations } = req.body;
  //   const conn = await db.getConnection();
  //   try {
  //     await conn.beginTransaction();

  //     // update users table (username, role)
  //     await conn.query(`UPDATE users SET username = ?, role_id = ?, department_id = ?, team_id = ?, job_title_id = ? WHERE id = ?`,
  //                      [user.username, user.role_id || 'user', associations.department_id || null, associations.team_id || null, associations.job_title_id || null, id]);

  //     // update profile (insert if not exists)
  //     const [rows] = await conn.query('SELECT 1 FROM user_profiles WHERE user_id = ? LIMIT 1', [id]);
  //     if (rows.length) {
  //       await conn.query(`UPDATE user_profiles SET full_name = ?, email = ?, phone = ?, avatar_url = ?, date_of_birth = ?, branch_id = ? WHERE user_id = ?`,
  //                        [profile.full_name, profile.email, profile.phone || null, profile.avatar_url || null, profile.date_of_birth || null, profile.branch_id || null, id]);
  //     } else {
  //       await conn.query(`INSERT INTO user_profiles (user_id, full_name, email, phone, avatar_url, date_of_birth, branch_id)
  //                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
  //                         [id, profile.full_name, profile.email, profile.phone || null, profile.avatar_url || null, profile.date_of_birth || null, profile.branch_id || null]);
  //     }

  //     // optionally update password if provided
  //     if (user.password && user.password.length) {
  //       const hash = await bcrypt.hash(user.password, 10);
  //       await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  //     }

  //     await conn.commit();
  //     res.json({ success: true });
  //   } catch (err) {
  //     await conn.rollback();
  //     console.error(err);
  //     res.status(500).json({ error: err.message });
  //   } finally { conn.release(); }
  // });

  // DELETE user
  // app.delete('/api/users/:id', async (req, res) => {
  //   const id = req.params.id;
  //   const conn = await db.getConnection();
  //   try {
  //     await conn.beginTransaction();
  //     await conn.query('DELETE FROM user_profiles WHERE user_id = ?', [id]);
  //     await conn.query('DELETE FROM users WHERE id = ?', [id]);
  //     await conn.commit();
  //     res.json({ success: true });
  //   } catch (err) {
  //     await conn.rollback();
  //     console.error(err);
  //     res.status(500).json({ error: err.message });
  //   } finally { conn.release(); }
  // });

  // // RESET password
  // app.put('/api/users/:id/reset-password', async (req, res) => {
  //   const id = req.params.id;
  //   let newPass = (req.body && req.body.new_password) ? req.body.new_password : '123456';
  //   try {
  //     const hash = await bcrypt.hash(newPass, 10);
  //     await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  //     // return the new password in response (admin will communicate to user)
  //     res.json({ success: true, new_password: newPass });
  //   } catch (err) {
  //     console.error(err);
  //     res.status(500).json({ error: err.message });
  //   }
  // });
};

// DELETE user
app.delete('/api/users/:id', async (req, res) => {
  const id = req.params.id;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Lấy dữ liệu cũ để log
    const [oldRows] = await conn.query(`
      SELECT u.*, p.full_name, p.email, p.phone
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `, [id]);

    if (!oldRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy nhân viên để xóa' });
    }

    const oldData = oldRows[0];

    await conn.query('DELETE FROM user_profiles WHERE user_id = ?', [id]);
    await conn.query('DELETE FROM users WHERE id = ?', [id]);

    // Ghi audit log
    await conn.query(`
      INSERT INTO audit_log (entity_type, entity_id, action, old_data, new_data, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'user',
      id,
      'delete',
      JSON.stringify(oldData),
      null,
      req.user?.email || 'admin_demo'
    ]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

// RESET password
app.put('/api/users/:id/reset-password', async (req, res) => {
  const id = req.params.id;
  const newPass = (req.body && req.body.new_password) ? req.body.new_password : '123456';
  try {
    const hash = await bcrypt.hash(newPass, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);

    await db.query(`
      INSERT INTO audit_log (entity_type, entity_id, action, old_data, new_data, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'user',
      id,
      'reset_password',
      null,
      JSON.stringify({ new_password: newPass }),
      req.user?.email || 'admin_demo'
    ]);

    res.json({ success: true, new_password: newPass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/users', async (req, res) => {
  const { user = {}, profile = {}, associations = {} } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Tạo ID mới kiểu E001, E002...
    const [rows] = await conn.query(`SELECT id FROM users ORDER BY id DESC LIMIT 1`);
    let newId = 'E001';
    if (rows.length) {
      const last = rows[0].id;
      const num = parseInt(last.replace('E', ''), 10) + 1;
      newId = 'E' + num.toString().padStart(3, '0');
    }

    const password = user.password || '123456';
    const hash = await bcrypt.hash(password, 10);

    await conn.query(`
      INSERT INTO users (id, username, password_hash, role_id, department_id, team_id, job_title_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      newId,
      user.username,
      hash,
      user.role_id || 'user',
      associations.department_id || null,
      associations.team_id || null,
      associations.job_title_id || null
    ]);

    await conn.query(`
      INSERT INTO user_profiles (user_id, full_name, email, phone, avatar_url, date_of_birth, branch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      newId,
      profile.full_name,
      profile.email,
      profile.phone || null,
      profile.avatar_url || null,
      profile.date_of_birth || null,
      associations.branch_id || null
    ]);

    // Ghi audit log
    await conn.query(`
      INSERT INTO audit_log (entity_type, entity_id, action, old_data, new_data, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'user',
      newId,
      'insert',
      null,
      JSON.stringify({ user, profile, associations }),
      req.user?.email || 'admin_demo'
    ]);

    await conn.commit();
    res.json({ success: true, id: newId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});


app.put('/api/users/:id', async (req, res) => {
  const id = req.params.id;
  const { user = {}, profile = {}, associations = {} } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    // 1. Lấy dữ liệu cũ
    const [oldRows] = await conn.query(
      `SELECT u.*, p.* 
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ?`,
      [id]
    );
    if (oldRows.length === 0) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    const oldData = oldRows[0];

    // 2. Cập nhật dữ liệu users
    await conn.query(`
      UPDATE users
      SET username = ?, role_id = ?, department_id = ?, team_id = ?, job_title_id = ?
      WHERE id = ?`,
      [
        user.username,
        user.role_id || 'user',
        associations.department_id || null,
        associations.team_id || null,
        associations.job_title_id || null,
        id
      ]
    );

    const [rows] = await conn.query('SELECT 1 FROM user_profiles WHERE user_id = ? LIMIT 1', [id]);
    if (rows.length) {
      await conn.query(`
        UPDATE user_profiles
        SET full_name = ?, email = ?, phone = ?, avatar_url = ?, date_of_birth = ?, branch_id = ?
        WHERE user_id = ?`,
        [
          profile.full_name,
          profile.email,
          profile.phone || null,
          profile.avatar_url || null,
          profile.date_of_birth || null,
          associations.branch_id || null,
          id
        ]
      );
    } else {
      await conn.query(`
        INSERT INTO user_profiles (user_id, full_name, email, phone, avatar_url, date_of_birth, branch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          profile.full_name,
          profile.email,
          profile.phone || null,
          profile.avatar_url || null,
          profile.date_of_birth || null,
          associations.branch_id || null
        ]
      );
    }

    if (user.password && user.password.length) {
      const hash = await bcrypt.hash(user.password, 10);
      await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    }
        // 4. Ghi log vào audit_log
    await conn.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, old_data, new_data, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'user',
        id,
        'update',
        JSON.stringify(oldData),
        JSON.stringify({ user, profile, associations }),
        req.user?.email || 'admin_demo'
      ]
    );


    await conn.commit();
    res.json({ success: true, message: `User ${id} updated successfully` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});
// ------------------------
// CREATE template (POST)
// ------------------------
app.post('/api/document_templates', async (req, res) => {
  const { name, description, content, file_path, created_by } = req.body;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // --- Thêm vào bảng ---
    const [result] = await conn.query(`
      INSERT INTO document_templates
        (name, description, content, file_path, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      name,
      description || null,
      content || null,
      file_path || null,
      created_by // phải là ID hợp lệ trong bảng users
    ]);

    const newId = result.insertId; // id tự tăng

    // --- Audit log ---
    await conn.query(`
      INSERT INTO audit_log
        (entity_type, entity_id, action, old_data, new_data, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'document_template',
      newId,
      'create',
      null,
      JSON.stringify({ name, description, content, file_path }),
      created_by
    ]);

    await conn.commit();
    res.json({ success: true, id: newId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ------------------------
// GET all document templates
// ------------------------
app.get('/api/document_templates', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(`
      SELECT dt.id, dt.name, dt.description, dt.content, dt.file_path,
             dt.created_by, up.full_name AS created_by_name, dt.created_at
      FROM document_templates dt
      LEFT JOIN user_profiles up ON dt.created_by = up.user_id
      ORDER BY dt.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.get('/api/document_templates/:id', async (req, res) => {
  const { id } = req.params;
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(`
      SELECT dt.id, dt.name, dt.description, dt.content, dt.file_path,
             dt.created_by, up.full_name AS created_by_name, dt.created_at
      FROM document_templates dt
      LEFT JOIN user_profiles up ON dt.created_by = up.user_id
      WHERE dt.id = ?
      LIMIT 1
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ------------------------
// UPDATE document template
// ------------------------
app.put('/api/document_templates/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, content, file_path, updated_by } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Lấy dữ liệu cũ để ghi audit
    const [oldRows] = await conn.query(
      `SELECT * FROM document_templates WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!oldRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Template not found' });
    }
    const oldData = oldRows[0];

    // Update
    await conn.query(
      `
      UPDATE document_templates
      SET name = ?, description = ?, content = ?, file_path = ?
      WHERE id = ?
      `,
      [
        name,
        description || null,
        content || null,
        file_path || null,
        id
      ]
    );

    // Audit log
    await conn.query(
      `
      INSERT INTO audit_log
        (entity_type, entity_id, action, old_data, new_data, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        'document_template',
        id,
        'update',
        JSON.stringify(oldData),
        JSON.stringify({ name, description, content, file_path }),
        updated_by
      ]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});


// Danh sách phòng ban
app.get('/api/departments', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT id, name FROM departments ORDER BY name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Danh sách chức vụ
app.get('/api/job_titles', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT id, name FROM job_titles ORDER BY name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Danh sách chi nhánh
app.get('/api/branches', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT id, name FROM branches ORDER BY name`);
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

    // 🔹 Chuẩn hóa danh sách team_id từ client (tránh undefined)
    const selectedTeamIds = (Array.isArray(team_ids) ? team_ids : []).map(String);

    // ✅ Thêm members từ team_ids (chỉ members cùng branch)
    if (selectedTeamIds.length > 0) {
      const [members] = await conn.query(
        `SELECT u.id, u.team_id
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.team_id IN (?) AND up.branch_id = ?`,
        [selectedTeamIds, userBranchId]
      );

      members.forEach(m => allUserIds.add(m.id));

      const memberValues = members.map(m => [bookingId, m.id, m.team_id]);
      if (memberValues.length > 0) {
        await conn.query(
          'INSERT INTO participants (booking_id, user_id, team_id) VALUES ? ON DUPLICATE KEY UPDATE team_id = VALUES(team_id)',
          [memberValues]
        );

        // Thông báo cho members
        const notifValues = members.map(m => [
          m.id,
          `Bạn đã được thêm vào cuộc họp: "${title}" lúc ${formatVietnamTime(start_time)}`
        ]);
        if (notifValues.length > 0) {
          await conn.query('INSERT INTO notifications (user_id, message) VALUES ?', [notifValues]);
        }
      }
    }

    // ✅ Thêm organizer (chỉ gán team_id nếu thuộc team được chọn)
    let organizerTeamId = null;
    const [organizerInfo] = await conn.query('SELECT team_id FROM users WHERE id = ?', [user_id]);
    const userTeamId = organizerInfo[0]?.team_id ?? null;
    console.log('🔍 Debug team check:', {
      selectedTeamIds,
      typeofSelectedTeamIds: typeof selectedTeamIds,
      userTeamId,
      userTeamIdType: typeof userTeamId
    });

    if (userTeamId && selectedTeamIds.includes(String(userTeamId))) {
      organizerTeamId = userTeamId;
    }
    console.log('🧩 Organizer debug:', { user_id, team_id: organizerTeamId });
    allUserIds.add(user_id);

    // Chèn organizer TRƯỚC participant lẻ (để không bị ghi đè team_id=null)
    await conn.query(
      'INSERT INTO participants (booking_id, user_id, team_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE team_id = VALUES(team_id)',
      [bookingId, user_id, organizerTeamId]
    );

    // Thông báo cho organizer
    await conn.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [user_id, `Bạn đã tạo cuộc họp: "${title}" lúc ${formatVietnamTime(start_time)}`]
    );

    // ✅ Thêm participant lẻ (loại organizer ra)
    if (Array.isArray(participants) && participants.length > 0) {
      const filteredParticipants = participants.filter(uid => String(uid) !== String(user_id));
      filteredParticipants.forEach(uid => allUserIds.add(uid));

      if (filteredParticipants.length > 0) {
        const participantValues = filteredParticipants.map(uid => [bookingId, uid, null]);
        await conn.query(
          'INSERT INTO participants (booking_id, user_id, team_id) VALUES ? ON DUPLICATE KEY UPDATE team_id = COALESCE(participants.team_id, VALUES(team_id))',
          [participantValues]
        );

        const notifValues = filteredParticipants.map(uid => [
          uid,
          `Bạn đã được thêm vào cuộc họp: "${title}" lúc ${formatVietnamTime(start_time)}`
        ]);
        if (notifValues.length > 0) {
          await conn.query('INSERT INTO notifications (user_id, message) VALUES ?', [notifValues]);
        }
      }
    }

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
    // Lấy tất cả người tham dự
    const [participantsAll] = await db.query(`
      SELECT p.user_id, p.team_id, up.full_name
      FROM participants p
      JOIN users u ON u.id = p.user_id
      JOIN user_profiles up ON u.id = up.user_id
      WHERE p.booking_id = ?
    `, [bookingId]);

    // Người thuộc team
    const teamIds = [...new Set(participantsAll.filter(p => p.team_id).map(p => p.team_id))];
    const [teams] = teamIds.length > 0
      ? await db.query('SELECT id, name FROM teams WHERE id IN (?)', [teamIds])
      : [ [] ];

    // Người tham dự lẻ (không thuộc team)
    const soloParticipants = participantsAll.filter(p => !p.team_id);

    res.json({
      ...booking,
      teams,
      participants: soloParticipants
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
    const { title, room_id, start_time, end_time, teams = [], participants = [] } = req.body;

    // 1️⃣ Lấy dữ liệu cũ
    const [oldRows] = await conn.query('SELECT * FROM bookings WHERE id=?', [id]);
    if (!oldRows.length) return res.status(404).json({ error: 'Không tìm thấy booking' });
    const oldData = oldRows[0];

    // 2️⃣ Kiểm tra xung đột lịch
    const [conflicts] = await conn.query(
      `SELECT * FROM bookings 
       WHERE room_id=? AND id!=? AND NOT (end_time<=? OR start_time>=?)`,
      [room_id, id, start_time, end_time]
    );
    if (conflicts.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'Xung đột lịch', conflict: conflicts[0] });
    }
    
    const start_time_sql = formatMySQLDate(start_time);
    const end_time_sql = formatMySQLDate(end_time);

    // 3️⃣ Update booking chính
    await conn.query(
      'UPDATE bookings SET title=?, room_id=?, start_time=?, end_time=? WHERE id=?',
      [title, room_id, start_time_sql, end_time_sql, id]
    );

    // 4️⃣ Cập nhật participants
    await conn.query('DELETE FROM participants WHERE booking_id=?', [id]);
    // for (const userId of participants || []) {
    //   await conn.query('INSERT INTO participants (booking_id, user_id) VALUES (?, ?)', [id, userId]);
    // }
        // 👉 Thêm lại từ team (nếu có)
    if (Array.isArray(teams) && teams.length > 0) {
      const [teamMembers] = await conn.query(
        'SELECT id, team_id FROM users WHERE team_id IN (?)',
        [teams]
      );
      if (teamMembers.length > 0) {
        const teamValues = teamMembers.map(m => [id, m.id, m.team_id]);
        await conn.query(
          'INSERT INTO participants (booking_id, user_id, team_id) VALUES ?',
          [teamValues]
        );
      }
    }
    // 👉 Thêm participant lẻ (tránh trùng)
    if (Array.isArray(participants) && participants.length > 0) {
      const participantValues = participants.map(uid => [id, uid, null]);
      await conn.query(
        'INSERT INTO participants (booking_id, user_id, team_id) VALUES ? ON DUPLICATE KEY UPDATE booking_id=booking_id',
        [participantValues]
      );
    }


    // 5️⃣ Log thay đổi
    const [newRows] = await conn.query('SELECT * FROM bookings WHERE id=?', [id]);
    const newData = newRows[0];
    await conn.query(
      `INSERT INTO booking_change_log (entity_type, entity_id, action, old_data, new_data, updated_by)
       VALUES ('booking', ?, 'update', ?, ?, ?)`,
      [id, JSON.stringify(oldData), JSON.stringify(newData), req.user?.email || 'admin_demo']
    );

    await conn.commit();
    res.json({ success: true, message: 'Cập nhật thành công!', booking: newData });
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
// =======================
// API: Documents (Trình ký văn bản)
// =======================
// Lấy danh sách cuộc họp để chọn khi tạo văn bản
app.get('/api/bookings/list', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, title, start_time, end_time
      FROM bookings
      WHERE start_time BETWEEN NOW() - INTERVAL 30 DAY AND NOW() + INTERVAL 7 DAY
      ORDER BY start_time DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- Xử lý upload file thật ---
const multer = require("multer");

// Tạo thư mục lưu file nếu chưa có
const uploadDir = path.join(process.cwd(), "public/demo_doc");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Cấu hình multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });  // đây là biến upload doc cho nghiệp vụ Trình ký, tạm thời để tên này, chưa thay đổi vội tránh lỗi, biến upload ảnh để sau

// Lấy danh sách văn bản
app.get('/api/documents', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        d.id,
        d.title,
        d.file_path,
        d.status,
        b.title AS booking_title,
        up.full_name AS creator_name,
        d.created_at,
        d.created_by
      FROM documents d
      LEFT JOIN bookings b ON d.booking_id = b.id
      LEFT JOIN user_profiles up ON d.created_by = up.user_id
      ORDER BY d.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/documents/:id/signers', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ds.signer_id, up.full_name, ds.status, ds.signed_at
      FROM document_signers ds
      LEFT JOIN user_profiles up ON ds.signer_id = up.user_id
      WHERE ds.document_id = ?
      ORDER BY ds.id
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:id/sign', async (req, res) => {
  const { user_id, action } = req.body;
  try {
    const status = action === 'signed' ? 'Đã ký' : 'Từ chối';
    await db.query(`
      UPDATE document_signers 
      SET status = ?, signed_at = NOW() 
      WHERE document_id = ? AND signer_id = ?
    `, [status, req.params.id, user_id]);

    // Nếu tất cả đã ký => cập nhật document thành "Hoàn tất"
    if (action === 'signed') {
      const [remaining] = await db.query(`
        SELECT COUNT(*) AS c FROM document_signers 
        WHERE document_id = ? AND status = 'Đang trình ký'
      `, [req.params.id]);

      if (remaining[0].c === 0) {
        await db.query(`UPDATE documents SET status = 'Đã duyệt' WHERE id = ?`, [req.params.id]);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// ============================================
// 1️⃣ TẠO VĂN BẢN MỚI (luôn là Nháp)
// ============================================
app.post("/api/documents", upload.single("file"), async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { title, description, booking_id, created_by, signers, generated_body, template_id } = req.body;
    const filePath = req.file ? `/demo_doc/${req.file.filename}` : null;
    const parsedSigners = JSON.parse(signers || "[]");

    await conn.beginTransaction();

    // ✅ Luôn tạo với status = 'Nháp'
    const [result] = await conn.query(
      `INSERT INTO documents 
       (title, description, file_path, generated_body, template_id, booking_id, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Nháp')`,
      [title, description || null, filePath, generated_body || null, template_id || null, booking_id || null, created_by]
    );
    const documentId = result.insertId;

    // ✅ Lưu người ký với status = 'Chờ trình ký' (chưa gửi)
    if (parsedSigners.length > 0) {
      const signerValues = parsedSigners.map(id => [documentId, id, 'Chờ trình ký']);
      await conn.query(
        `INSERT INTO document_signers (document_id, signer_id, status) VALUES ?`,
        [signerValues]
      );
    }

    await conn.commit();
    res.json({ success: true, id: documentId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// ============================================
// 2️⃣ TRÌNH KÝ VĂN BẢN (Nháp → Đang trình ký)
// ============================================
app.post("/api/documents/:id/submit", async (req, res) => {
  const conn = await db.getConnection();
  try {
    const docId = req.params.id;

    await conn.beginTransaction();

    // Kiểm tra văn bản tồn tại và là Nháp
    const [doc] = await conn.query(`SELECT * FROM documents WHERE id = ?`, [docId]);
    if (!doc.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: "Không tìm thấy văn bản" });
    }
    
    if (doc[0].status !== 'Nháp') {
      await conn.rollback();
      return res.status(400).json({ success: false, error: "Chỉ văn bản nháp mới có thể trình ký" });
    }

    // Kiểm tra có người ký không
    const [signers] = await conn.query(
      `SELECT COUNT(*) as count FROM document_signers WHERE document_id = ?`,
      [docId]
    );

    if (signers[0].count === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: "Vui lòng thêm người ký trước khi trình ký" });
    }

    // ✅ Cập nhật status văn bản
    await conn.query(`UPDATE documents SET status = 'Đang trình ký' WHERE id = ?`, [docId]);

    // ✅ Cập nhật status tất cả người ký: Chờ trình ký → Đang trình ký
    await conn.query(
      `UPDATE document_signers SET status = 'Đang trình ký' WHERE document_id = ? AND status = 'Chờ trình ký'`,
      [docId]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// ============================================
// 3️⃣ CẬP NHẬT VĂN BẢN (chỉ cho Nháp)
// ============================================
app.put('/api/documents/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { title, description, booking_id, signers } = req.body;
    const docId = req.params.id;
    
    await conn.beginTransaction();

    // ✅ Kiểm tra chỉ cho phép sửa Nháp
    const [doc] = await conn.query(`SELECT status FROM documents WHERE id = ?`, [docId]);
    if (!doc.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: "Không tìm thấy văn bản" });
    }

    if (doc[0].status !== 'Nháp') {
      await conn.rollback();
      return res.status(400).json({ success: false, error: "Chỉ văn bản nháp mới có thể chỉnh sửa" });
    }
    
    // Update thông tin văn bản
    await conn.query(`
      UPDATE documents 
      SET title = ?, description = ?, booking_id = ?
      WHERE id = ?
    `, [title, description || null, booking_id || null, docId]);
    
    // Xóa người ký cũ
    await conn.query(`DELETE FROM document_signers WHERE document_id = ?`, [docId]);
    
    // ✅ Thêm người ký mới với status = 'Chờ trình ký'
    if (signers && signers.length > 0) {
      const signerValues = signers.map(id => [docId, id, 'Chờ trình ký']);
      await conn.query(`
        INSERT INTO document_signers (document_id, signer_id, status) VALUES ?
      `, [signerValues]);
    }
    
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});


app.get('/api/documents/file/:filename', (req, res) => {
  const filePath = path.join(process.cwd(), 'public', 'demo_doc', req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File không tồn tại.');
  }

  // LẤY MIME TYPE CHUẨN
  const mime = req.params.filename.endsWith('.pdf')
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', 'inline'); // << CHỈ ĐỂ INLINE, KHÔNG ĐỂ FILENAME
  res.sendFile(filePath);
});

// ✅update GET /api/documents/:id
app.get('/api/documents/:id', async (req, res) => {
  const conn = await db.getConnection(); // Lấy connection từ pool
  try {
    const docId = req.params.id;
    // 1. Lấy thông tin văn bản (Query của bạn)
    const [rows] = await conn.query(`
      SELECT 
        d.*,
        up.full_name as creator_name,
        b.title as booking_title
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN bookings b ON d.booking_id = b.id
      WHERE d.id = ?
    `, [docId]);
    if (rows.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Không tìm thấy văn bản' });
    }
    const document = rows[0]; // Thông tin văn bản
    // 2. Lấy danh sách ID người ký
    const [signerRows] = await conn.query(`
      SELECT signer_id FROM document_signers WHERE document_id = ?
    `, [docId]);
    // Biến mảng [ {signer_id: 2}, {signer_id: 5} ] thành [2, 5]
    const signers = signerRows.map(row => row.signer_id);
    // 3. Trả về cả hai trong một object
    res.json({
      document: document,
      signers: signers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release(); // Luôn giải phóng connection
  }
});

// // API: Cập nhật văn bản
// app.put('/api/documents/:id', async (req, res) => {
//   const conn = await db.getConnection();
//   try {
//     const { title, description, booking_id, signers } = req.body;
//     const docId = req.params.id;
    
//     await conn.beginTransaction();
    
//     // Update thông tin văn bản
//     await conn.query(`
//       UPDATE documents 
//       SET title = ?, description = ?, booking_id = ?
//       WHERE id = ?
//     `, [title, description || null, booking_id || null, docId]);
    
//     // Xóa người ký cũ
//     await conn.query(`DELETE FROM document_signers WHERE document_id = ?`, [docId]);
    
//     // Thêm người ký mới
//     if (signers && signers.length > 0) {
//       const signerValues = signers.map(id => [docId, id, 'Đang trình ký']);
//       await conn.query(`
//         INSERT INTO document_signers (document_id, signer_id, status) VALUES ?
//       `, [signerValues]);
      
//       // Cập nhật status văn bản
//       await conn.query(`
//         UPDATE documents SET status = 'Đang trình ký' WHERE id = ?
//       `, [docId]);
//     } else {
//       // Không có người ký → về Nháp
//       await conn.query(`
//         UPDATE documents SET status = 'Nháp' WHERE id = ?
//       `, [docId]);
//     }
    
//     await conn.commit();
//     res.json({ success: true });
//   } catch (err) {
//     await conn.rollback();
//     console.error(err);
//     res.status(500).json({ success: false, error: err.message });
//   } finally {
//     conn.release();
//   }
// });
// ==== UPLOAD ẢNH PHÒNG HỌP ====

// Tạo thư mục public/images nếu chưa có
const roomImageDir = path.join(process.cwd(), "public/images");
if (!fs.existsSync(roomImageDir)) fs.mkdirSync(roomImageDir, { recursive: true });

const storageRoomImages = multer.diskStorage({
  destination: (req, file, cb) => cb(null, roomImageDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const uploadRoomImage = multer({ storage: storageRoomImages });

// api image upload
app.post('/api/upload_image', uploadRoomImage.single('image'), (req, res) => {
  res.json({ url: '/images/' + req.file.filename });
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

app.get("/api/report/docs/status", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT status, COUNT(*) AS count
      FROM documents
      GROUP BY status
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/report/docs/signers", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT up.full_name, COUNT(ds.document_id) AS count
      FROM document_signers ds
      JOIN users u ON ds.signer_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      GROUP BY ds.signer_id
      ORDER BY count DESC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/report/docs/days", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE(created_at) AS day, COUNT(*) AS count
      FROM documents
      GROUP BY day
      ORDER BY day ASC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/report/overview", async (req, res) => {
  try {
    // Tổng số cuộc họp
    const [meetings] = await db.query(`SELECT COUNT(*) AS total FROM bookings`);

    // Tổng số văn bản
    const [docs] = await db.query(`SELECT COUNT(*) AS total FROM documents`);

    // Số user đang hoạt động
    const [users] = await db.query(`SELECT COUNT(*) AS total FROM users`);

    // Biểu đồ hoạt động hệ thống (cuộc họp + trình ký theo ngày)
    const [activity] = await db.query(`
      SELECT day, SUM(count) AS count FROM (
        SELECT DATE(start_time) AS day, COUNT(*) AS count
        FROM bookings
        GROUP BY day
        
        UNION ALL
        
        SELECT DATE(created_at) AS day, COUNT(*) AS count
        FROM documents
        GROUP BY day
      ) AS t
      GROUP BY day
      ORDER BY day ASC
    `);

    res.json({
      totalMeetings: meetings[0].total,
      totalDocuments: docs[0].total,
      activeUsers: users[0].total,
      activity
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/report/rooms/hours', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT HOUR(start_time) AS hour, COUNT(id) AS count
      FROM bookings
      GROUP BY hour
      ORDER BY hour
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
