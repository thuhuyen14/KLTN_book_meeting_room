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
        b.id AS branch_id,
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
  // Frontend gửi lên: name, description, content, file_path, created_by
  const { name, description, content, file_path, created_by } = req.body;
  
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Kiểm tra xem User 'created_by' có tồn tại chưa (Để tránh lỗi Foreign Key)
    const [userCheck] = await conn.query('SELECT id FROM users WHERE id = ?', [created_by]);
    if (userCheck.length === 0) {
      throw new Error(`User ID '${created_by}' không tồn tại trong bảng users. Vui lòng tạo nhân viên này trước.`);
    }

    // 2. Thêm vào bảng
    const [result] = await conn.query(`
      INSERT INTO document_templates
        (name, description, content, file_path, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      name,
      description || null,
      content || null,
      file_path || null,
      created_by 
    ]);

    const newId = result.insertId;

    // 3. Audit log
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
    console.error("Lỗi API POST document_templates:", err);
    // Trả về đúng message lỗi để Frontend alert ra
    res.status(500).send(err.message); 
  } finally {
    conn.release();
  }
});

// ------------------------
// CẬP NHẬT (PUT) - Sửa lỗi biến updated_by
// ------------------------
app.put('/api/document_templates/:id', async (req, res) => {
  const { id } = req.params;
  
  // Frontend gửi 'created_by' (ID người đang login), ta dùng nó làm người sửa (updater)
  const { name, description, content, file_path, created_by } = req.body;
  
  // Gán updater chính là người đang thao tác
  const updater = created_by; 

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Lấy dữ liệu cũ
    const [oldRows] = await conn.query(
      `SELECT * FROM document_templates WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!oldRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Template not found' });
    }
    const oldData = oldRows[0];

    // 2. Update
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

    // 3. Audit log (Sửa lỗi: dùng biến updater thay vì updated_by bị undefined)
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
        updater // Dùng biến này mới có dữ liệu
      ]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error("Lỗi API PUT document_templates:", err);
    res.status(500).send(err.message);
  } finally {
    conn.release();
  }
});
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
// XÓA (DELETE) Document Template
// ------------------------
app.delete('/api/document_templates/:id', async (req, res) => {
  const { id } = req.params;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    // 1. (Tuỳ chọn) Lấy thông tin cũ để ghi log trước khi xóa
    const [oldRows] = await conn.query('SELECT * FROM document_templates WHERE id = ?', [id]);
    const oldData = oldRows[0] || null;

    // 2. Xóa trong bảng document_templates
    const [result] = await conn.query('DELETE FROM document_templates WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy mẫu văn bản để xóa' });
    }

    // 3. Ghi Audit Log (nếu cần)
    // Lưu ý: api DELETE thường không có body nên không biết ai xóa (updated_by), 
    // trừ khi bạn gửi user id qua query param hoặc token. Tạm thời để null hoặc 'system'.
    if (oldData) {
        await conn.query(`
          INSERT INTO audit_log
            (entity_type, entity_id, action, old_data, new_data, updated_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          'document_template',
          id,
          'delete',
          JSON.stringify(oldData),
          null,
          'admin' // Hoặc lấy từ req.user.id nếu có middleware xác thực
        ]);
    }

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
// Chuyển Set allUserIds thành mảng để query
    const listUserCheck = Array.from(allUserIds);

    if (listUserCheck.length > 0) {
      // Tìm xem trong đám người này, có ai đang kẹt trong một cuộc họp KHÁC không
      const [busyUsers] = await conn.query(`
        SELECT DISTINCT up.full_name
        FROM participants p
        JOIN bookings b ON p.booking_id = b.id
        JOIN users u ON p.user_id = u.id
        JOIN user_profiles up ON u.id = up.user_id
        WHERE 
          p.user_id IN (?)              
          AND b.id != ?               
          AND NOT (b.end_time <= ? OR b.start_time >= ?)
      `, [listUserCheck, bookingId, start_time, end_time]);

      if (busyUsers.length > 0) {
        // Nếu có người bận -> Hủy kèo, Rollback lại toàn bộ
        await conn.rollback();
        const names = busyUsers.map(u => u.full_name).join(', ');
        return res.status(409).json({ 
          error: `Không thể đặt lịch! Các nhân viên sau đang bận trong khung giờ này: ${names}` 
        });
      }
    }
    // ========================================================================
    // 🛑 END: KẾT THÚC ĐOẠN KIỂM TRA
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
// PUT đánh dấu đã đọc
app.put('/api/notifications/read/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
    res.json({ success: true });
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
    const { start, end, branch_id } = req.query;

    if (!start || !end || !branch_id) {
        return res.status(400).json({ error: 'Thiếu tham số start/end/branch_id' });
    }

    try {
        const [rooms] = await db.query(`
          SELECT 
            r.id,
            r.name,
            r.image,
            rt.description AS room_description,
            rt.default_capacity AS capacity,
            CONCAT('Tầng ', l.floor, ' - ', br.name) AS location_name,
            br.id AS branch_id
          FROM rooms r
          LEFT JOIN room_types rt ON r.room_type_id = rt.id
          LEFT JOIN locations l ON r.location_id = l.id
          LEFT JOIN branches br ON l.branch_id = br.id
          WHERE br.id = ?
          ORDER BY r.id
      `, [branch_id]);

        const [booked] = await db.query(
            'SELECT room_id FROM bookings WHERE NOT (end_time <= ? OR start_time >= ?)',
            [start, end]
        );

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
    // 1. Lấy ID người dùng hiện tại
    // (Trong thực tế nên lấy từ req.session hoặc JWT token. 
    // Ở đây mình lấy từ query param để khớp với frontend hiện tại của bạn)
    const currentUserId = req.query.user_id; 

    if (!currentUserId) {
        return res.status(400).json({ error: "Thiếu thông tin người dùng (user_id)" });
    }

    // 2. Câu lệnh SQL lọc quyền xem
    // Logic: Xem được nếu (Là người tạo) HOẶC (Là người ký) HOẶC (Là người tham gia cuộc họp)
    const sql = `
      SELECT DISTINCT 
        d.id, 
        d.title, 
        d.status, 
        d.created_at, 
        d.file_path, 
        d.booking_id, 
        d.created_by,
        up.full_name AS creator_name,
        b.title AS booking_title
      FROM documents d
      -- Lấy tên người tạo
      LEFT JOIN user_profiles up ON d.created_by = up.user_id
      -- Lấy tên cuộc họp
      LEFT JOIN bookings b ON d.booking_id = b.id
      -- Join để check xem có phải người ký không
      LEFT JOIN document_signers ds ON d.id = ds.document_id
      -- Join để check xem có tham gia cuộc họp không (BẢNG participants)
      LEFT JOIN participants p ON d.booking_id = p.booking_id
      
      WHERE 
         d.created_by = ?        -- Điều kiện 1: Chính chủ tạo
         OR ds.signer_id = ?     -- Điều kiện 2: Có tên trong danh sách ký
         OR p.user_id = ?        -- Điều kiện 3: Có tham gia cuộc họp đó
         
      ORDER BY d.created_at DESC
    `;

    // 3. Thực thi query
    // Truyền currentUserId vào 3 dấu hỏi (?) tương ứng với 3 điều kiện trên
    const [rows] = await db.query(sql, [currentUserId, currentUserId, currentUserId]);

    res.json(rows);

  } catch (err) {
    console.error('Get Documents Error:', err);
    res.status(500).json({ error: 'Lỗi tải danh sách văn bản' });
  }
});
/*
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
*/
// API: Xử lý Ký hoặc Từ chối văn bản (Có chặn ký trước giờ họp)
app.post('/api/documents/:id/sign', async (req, res) => {
  const { signer_id, action } = req.body;
  const docId = req.params.id;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // ==================================================================
    // 🛑 1. KIỂM TRA LOGIC NGHIỆP VỤ: CHẶN KÝ TRƯỚC GIỜ HỌP
    // ==================================================================
    
    // Lấy thông tin cuộc họp liên kết với văn bản này (nếu có)
    const [[bookingCheck]] = await conn.query(`
        SELECT b.start_time, b.title as booking_title
        FROM documents d
        JOIN bookings b ON d.booking_id = b.id
        WHERE d.id = ?
    `, [docId]);

    // Nếu văn bản có gắn với một cuộc họp
    if (bookingCheck) {
        const now = new Date(); // Thời gian thực tế hiện tại
        const meetingTime = new Date(bookingCheck.start_time); // Thời gian bắt đầu họp

        // Nếu hiện tại SỚM HƠN giờ họp -> CHẶN NGAY
        if (now < meetingTime) {
            await conn.rollback();
            // Format giờ cho đẹp (VD: 09:30 20/12/2025)
            const timeStr = meetingTime.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
            
            return res.status(400).json({ 
                error: `Chưa đến giờ họp! Cuộc họp "${bookingCheck.booking_title}" bắt đầu lúc ${timeStr}. Bạn chưa thể ký văn bản này.` 
            });
        }
    }
    // ==================================================================
    // HẾT PHẦN KIỂM TRA, BẮT ĐẦU XỬ LÝ KÝ
    // ==================================================================


    // 0. Lấy thông tin Văn bản + Người tạo + Tên người đang thao tác ký
    // (Cần join bảng user_profiles để lấy full_name hiển thị thông báo)
    const [[docInfo]] = await conn.query(`
        SELECT d.title, d.created_by, u.full_name as signer_name
        FROM documents d
        LEFT JOIN user_profiles u ON u.user_id = ? 
        WHERE d.id = ?
    `, [signer_id, docId]);

    if (!docInfo) {
        await conn.rollback();
        return res.status(404).json({ error: "Không tìm thấy thông tin văn bản" });
    }

    // 1. Kiểm tra trạng thái người ký hiện tại trong luồng
    const [[current]] = await conn.query(`
      SELECT status, step 
      FROM document_signers
      WHERE document_id = ? AND signer_id = ?
    `, [docId, signer_id]);

    if (!current) {
        await conn.rollback();
        return res.status(404).json({ error: "Bạn không có quyền ký văn bản này (không có trong luồng ký)" });
    }
    
    if (current.status !== 'Đang trình ký') {
        await conn.rollback();
        return res.status(400).json({ error: "Chưa tới lượt bạn ký hoặc bạn đã xử lý rồi" });
    }

    const newStatus = action === 'signed' ? 'Đã ký' : 'Từ chối';

    // 2. Cập nhật trạng thái người ký
    await conn.query(`
      UPDATE document_signers
      SET status = ?, signed_at = NOW()
      WHERE document_id = ? AND signer_id = ?
    `, [newStatus, docId, signer_id]);

    // ==================================================
    // TRƯỜNG HỢP A: TỪ CHỐI
    // ==================================================
    if (newStatus === 'Từ chối') {
      await conn.query(`UPDATE documents SET status = 'Từ chối' WHERE id = ?`, [docId]);
      
      // 🔥 THÔNG BÁO: Báo cho người tạo biết bị từ chối
      await conn.query(`
        INSERT INTO notifications (user_id, message) 
        VALUES (?, ?)
      `, [docInfo.created_by, `Văn bản "${docInfo.title}" đã bị TỪ CHỐI bởi ${docInfo.signer_name}.`]);

      await conn.commit();
      return res.json({ success: true });
    }

    // ==================================================
    // TRƯỜNG HỢP B: ĐỒNG Ý (KÝ)
    // ==================================================
    
    // Tìm người tiếp theo (Step kế tiếp)
    const [[next]] = await conn.query(`
      SELECT signer_id FROM document_signers
      WHERE document_id = ? AND step = ?
    `, [docId, current.step + 1]);

    if (!next) {
      // ---> KHÔNG CÒN AI KÝ NỮA (HOÀN THÀNH)
      await conn.query(`UPDATE documents SET status = 'Đã duyệt' WHERE id = ?`, [docId]);
      
      // 🔥 THÔNG BÁO: Báo cho người tạo biết đã xong
      await conn.query(`
        INSERT INTO notifications (user_id, message) 
        VALUES (?, ?)
      `, [docInfo.created_by, `Tin vui: Văn bản "${docInfo.title}" đã được DUYỆT hoàn tất!`]);

    } else {
      // ---> CÒN NGƯỜI TIẾP THEO
      await conn.query(`
        UPDATE document_signers
        SET status = 'Đang trình ký'
        WHERE document_id = ? AND step = ?
      `, [docId, current.step + 1]);

      // 🔥 THÔNG BÁO 1: Báo cho người tiếp theo biết đến lượt họ
      await conn.query(`
        INSERT INTO notifications (user_id, message) 
        VALUES (?, ?)
      `, [next.signer_id, `Đến lượt bạn ký duyệt văn bản: "${docInfo.title}"`]);

      // 🔥 THÔNG BÁO 2 (Optional): Báo tiến độ cho người tạo đỡ sốt ruột
      await conn.query(`
        INSERT INTO notifications (user_id, message) 
        VALUES (?, ?)
      `, [docInfo.created_by, `${docInfo.signer_name} đã ký văn bản "${docInfo.title}". Đang chuyển người tiếp theo.`]);
    }

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    console.error("Lỗi xử lý ký văn bản:", err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// mới thêm cột step nên tạo api mới
app.post('/api/documents/:id/signers', async (req, res) => {
  const docId = req.params.id;
  const { signer_id, step } = req.body;

  const conn = await db.getConnection();
  
  try {
    // Lấy tên văn bản để thông báo cho rõ nghĩa
    const [[doc]] = await conn.query('SELECT title FROM documents WHERE id = ?', [docId]);
    const docTitle = doc ? doc.title : 'văn bản mới';

    // Insert người ký
    await conn.query(`
      INSERT INTO document_signers (document_id, signer_id, step, status)
      VALUES (?, ?, ?, 'Chờ trình ký')
    `, [docId, signer_id, step]);

    // 🔥 THÔNG BÁO: Báo cho người vừa được add biết
    await conn.query(`
        INSERT INTO notifications (user_id, message)
        VALUES (?, ?)
    `, [signer_id, `Bạn đã được thêm vào luồng ký của văn bản: "${docTitle}"`]);

    res.json({ message: 'Đã thêm người ký vào luồng' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể thêm người ký' });
  } finally {
    conn.release();
  }
});
app.get('/api/documents/:id/signers', async (req, res) => {
  const docId = req.params.id;

  try {
    const [rows] = await db.query(`
      SELECT ds.id, ds.signer_id, ds.status, ds.signed_at, ds.step,
             up.full_name
      FROM document_signers ds
      LEFT JOIN user_profiles up ON ds.signer_id = up.user_id
      WHERE ds.document_id = ?
      ORDER BY ds.step ASC
    `, [docId]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể tải luồng ký' });
  }
});
app.put('/api/documents/:id/signers/:signerId/approve', async (req, res) => {
  const docId = req.params.id;
  const signerId = req.params.signerId;

  try {
    // 1. cập nhật signer hiện tại
    await db.query(`
      UPDATE document_signers
      SET status = 'Đã ký', signed_at = NOW()
      WHERE document_id = ? AND signer_id = ?
    `, [docId, signerId]);


    // 2. lấy step hiện tại
    const [[currentStep]] = await db.query(`
      SELECT step FROM document_signers
      WHERE document_id = ? AND signer_id = ?
    `, [docId, signerId]);


    if (!currentStep) {
      return res.status(404).json({ error: 'Signer không tồn tại' });
    }

    // 3. mở khóa bước kế tiếp
    const [next] = await db.query(`
      UPDATE document_signers
      SET status = 'Đang trình ký'
      WHERE document_id = ? AND step = ? AND status = 'Chờ trình ký'
    `, [docId, currentStep.step + 1]);


    // 4. nếu không còn bước nào -> tài liệu duyệt xong
    if (next.affectedRows === 0) {
      await db.query(`
        UPDATE documents
        SET status = 'Đã duyệt'
        WHERE id = ?
      `, [docId]);
    }

    res.json({ message: 'Đã ký thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không thể ký duyệt' });
  }
});


// ============================================
// 1️⃣ TẠO VĂN BẢN MỚI (luôn là Nháp)
app.post("/api/documents", upload.single("file"), async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { title, description, booking_id, created_by, signers, generated_body, template_id } = req.body;
    // Nếu upload file thì lấy đường dẫn, nếu không thì null
    const filePath = req.file ? `/demo_doc/${req.file.filename}` : null;
    
    // Parse danh sách người ký từ JSON string
    let parsedSigners = [];
    try {
        parsedSigners = JSON.parse(signers || "[]");
    } catch (e) {
        parsedSigners = [];
    }

    await conn.beginTransaction();

    // 1. Insert thông tin văn bản
    const [result] = await conn.query(
      `INSERT INTO documents 
        (title, description, file_path, generated_body, template_id, booking_id, created_by, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Nháp')`,
      [title, description || null, filePath, generated_body || null, template_id || null, booking_id || null, created_by]
    );
    const documentId = result.insertId;

    // 2. Insert người ký (CÓ TÍNH STEP)
    if (parsedSigners.length > 0) {
      // Map thêm index+1 để làm step
      const signerValues = parsedSigners.map((id, index) => [
          documentId, 
          id, 
          index + 1,        // Step 1, 2, 3...
          'Chờ trình ký'
      ]);

      await conn.query(
        `INSERT INTO document_signers (document_id, signer_id, step, status) VALUES ?`, 
        [signerValues]
      );
    }

    await conn.commit();
    res.json({ success: true, id: documentId });

  } catch (err) {
    await conn.rollback();
    console.error("Lỗi tạo văn bản:", err);
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

    // 1. Kiểm tra văn bản
    const [docs] = await conn.query(`SELECT * FROM documents WHERE id = ?`, [docId]);
    if (docs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: "Không tìm thấy văn bản" });
    }
    const doc = docs[0];

    if (doc.status !== 'Nháp') {
      await conn.rollback();
      return res.status(400).json({ success: false, error: "Chỉ văn bản nháp mới có thể trình ký" });
    }

    // 2. Kiểm tra có người ký chưa
    const [[countResult]] = await conn.query(
      `SELECT COUNT(*) as count FROM document_signers WHERE document_id = ?`,
      [docId]
    );
    if (countResult.count === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: "Vui lòng thêm người ký trước khi trình ký" });
    }

    // 3. Cập nhật trạng thái Document
    await conn.query(`UPDATE documents SET status = 'Đang trình ký' WHERE id = ?`, [docId]);

    // 4. Kích hoạt người ký Bước 1 (Step = 1)
    const [updateResult] = await conn.query(
      `UPDATE document_signers 
       SET status = 'Đang trình ký' 
       WHERE document_id = ? AND step = 1`,
      [docId]
    );

    // 5. 🔥 BẮN THÔNG BÁO CHO NGƯỜI KÝ BƯỚC 1
    // Lấy ID người ký bước 1 để gửi thông báo
    const [[firstSigner]] = await conn.query(
        `SELECT signer_id FROM document_signers WHERE document_id = ? AND step = 1`, 
        [docId]
    );

    if (firstSigner) {
        await conn.query(
            `INSERT INTO notifications (user_id, message) VALUES (?, ?)`,
            [firstSigner.signer_id, `Bạn có văn bản cần ký duyệt: "${doc.title}"`]
        );
    }
    
    // Thông báo cho người tạo là đã gửi thành công
    await conn.query(
        `INSERT INTO notifications (user_id, message) VALUES (?, ?)`,
        [doc.created_by, `Văn bản "${doc.title}" đã được trình ký thành công.`]
    );

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    console.error("Lỗi trình ký:", err);
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
    
    // signers gửi lên từ client thường là mảng ID: [1, 5, 3]
    const parsedSigners = Array.isArray(signers) ? signers : [];

    await conn.beginTransaction();

    // 1. Kiểm tra quyền sửa (Chỉ sửa khi còn là Nháp)
    const [doc] = await conn.query(`SELECT status FROM documents WHERE id = ?`, [docId]);
    if (!doc.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: "Không tìm thấy văn bản" });
    }
    if (doc[0].status !== 'Nháp') {
      await conn.rollback();
      return res.status(400).json({ success: false, error: "Chỉ văn bản nháp mới có thể chỉnh sửa" });
    }
    
    // 2. Update thông tin chính
    await conn.query(`
      UPDATE documents 
      SET title = ?, description = ?, booking_id = ?
      WHERE id = ?
    `, [title, description || null, booking_id || null, docId]);
    
    // 3. Cập nhật người ký (Xóa cũ -> Thêm mới)
    await conn.query(`DELETE FROM document_signers WHERE document_id = ?`, [docId]);
    
    if (parsedSigners.length > 0) {
      // ⚠️ QUAN TRỌNG: Phải có index + 1 làm step
      const signerValues = parsedSigners.map((id, index) => [
          docId, 
          id, 
          index + 1, // Step mới
          'Chờ trình ký'
      ]);

      await conn.query(`
        INSERT INTO document_signers (document_id, signer_id, step, status) 
        VALUES ?
      `, [signerValues]);
    }
    
    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    await conn.rollback();
    console.error("Lỗi cập nhật văn bản:", err);
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

// Phòng nào được book nhiều nhất (MySQL)  -- bỏ, lấy api dưới đã lọc ngày
// app.get('/api/analytic/rooms', async (req, res) => {
//   try {
//     const [rows] = await db.query(`
//       SELECT r.name, COUNT(b.id) as count
//       FROM bookings b
//       JOIN rooms r ON b.room_id = r.id
//       GROUP BY r.id
//       ORDER BY count DESC
//     `);
//     res.json(rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
//  Tính Công Suất Sử Dụng (Occupancy) - ĐÃ FIX
app.get('/api/analytic/vacancy', async (req, res) => {
  try {
    const { start, end } = req.query;

    // 1. Xác định khoảng thời gian (Start -> End)
    let startDate, endDate;
    
    if (start && end) {
        // Parse ngày từ chuỗi 'YYYY-MM-DD'
        startDate = new Date(start); 
        endDate = new Date(end);
    } else {
        // Mặc định: Tháng hiện tại
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // 2. Xử lý "Ngày kết thúc" cho chuẩn SQL (Lấy hết 23:59:59 của ngày cuối)
    // Thay vì dùng SQL INTERVAL, ta cộng ngày ngay tại JS cho an toàn
    // Tạo bản sao của endDate để cộng thêm 1 ngày
    const queryEndDate = new Date(endDate); 
    queryEndDate.setDate(queryEndDate.getDate() + 1); 

    // Format sang chuỗi chuẩn YYYY-MM-DD để gửi vào SQL
    const startSql = startDate.toISOString().slice(0, 10);
    const endSql = queryEndDate.toISOString().slice(0, 10);

    // Tính số ngày chênh lệch để tính Capacity (Công suất tối đa)
    // (endDate gốc - startDate)
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // Cộng 1 để tính cả ngày bắt đầu

    // 3. Query DB
    // a) Tổng số phòng
    const [roomsResult] = await db.query("SELECT COUNT(*) as total FROM rooms");
    const totalRooms = roomsResult[0]?.total || 0;

    if (totalRooms === 0) {
        return res.json({ vacancy: 0, occupancy: 0 });
    }

    // b) Tổng giờ đã đặt
    // Dùng startSql và endSql đã tính sẵn ở trên
    const sqlBooked = `
        SELECT SUM(TIMESTAMPDIFF(MINUTE, start_time, end_time)) / 60 as totalHours
        FROM bookings
        WHERE start_time >= ? AND start_time < ?
    `;
    const [bookedResult] = await db.query(sqlBooked, [startSql, endSql]);
    const bookedHours = Number(bookedResult[0]?.totalHours || 0);

    // 4. Tính toán tỷ lệ
    // Công suất tối đa = Số phòng * 8 tiếng * Số ngày
    const capacityHours = totalRooms * 8 * daysDiff; 

    let occupancyRate = 0;
    if (capacityHours > 0) {
        occupancyRate = (bookedHours / capacityHours) * 100;
    }
    
    // Cap lại giới hạn (nếu book ngoài giờ hành chính có thể > 100%)
    if (occupancyRate > 100) occupancyRate = 100;

    // Làm tròn 1 chữ số thập phân
    const finalOccupancy = occupancyRate.toFixed(1);
    const finalVacancy = (100 - occupancyRate).toFixed(1);

    console.log(`📊 Vacancy Debug: ${startSql} -> ${endSql} | Booked: ${bookedHours}h / Cap: ${capacityHours}h (${daysDiff} days) = ${finalOccupancy}%`);

    res.json({ 
        vacancy: finalVacancy, 
        occupancy: finalOccupancy 
    });

  } catch (err) {
    console.error("❌ Vacancy Error:", err);
    // Trả về 0 để frontend không bị lỗi NaN
    res.json({ vacancy: 0, occupancy: 0 });
  }
});
// 1. THỐNG KÊ ĐẶT PHÒNG (Có lọc ngày)
// ============================================================

// Phòng nào được book nhiều nhất
app.get('/api/analytic/rooms', async (req, res) => {
  try {
    const { start, end } = req.query;
    let timeFilter = "";
    let params = [];

    // Nếu có lọc ngày
    if (start && end) {
        timeFilter = "AND b.start_time BETWEEN ? AND ? + INTERVAL 1 DAY";
        params = [start, end];
    }

    const [rows] = await db.query(`
      SELECT r.name, COUNT(b.id) as count
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE 1=1 ${timeFilter}
      GROUP BY r.id
      ORDER BY count DESC
    `, params);
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Số lượng đặt theo ngày
app.get('/api/analytic/days', async (req, res) => {
  try {
    const { start, end } = req.query;
    let whereClause = "";
    let params = [];

    if (start && end) {
        whereClause = "WHERE start_time BETWEEN ? AND ? + INTERVAL 1 DAY";
        params = [start, end];
    }

    const [rows] = await db.query(`
      SELECT DATE(start_time) as day, COUNT(id) as count
      FROM bookings
      ${whereClause}
      GROUP BY day
      ORDER BY day ASC
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Khung giờ cao điểm
app.get('/api/analytic/rooms/hours', async (req, res) => {
  try {
    const { start, end } = req.query;
    let whereClause = "";
    let params = [];

    if (start && end) {
        whereClause = "WHERE start_time BETWEEN ? AND ? + INTERVAL 1 DAY";
        params = [start, end];
    }

    const [rows] = await db.query(`
      SELECT HOUR(start_time) AS hour, COUNT(id) AS count
      FROM bookings
      ${whereClause}
      GROUP BY hour
      ORDER BY hour ASC
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Người/phòng ban nào đặt nhiều
app.get('/api/analytic/users', async (req, res) => {
  try {
    const { start, end } = req.query;
    let timeFilter = "";
    let params = [];

    if (start && end) {
        timeFilter = "AND b.start_time BETWEEN ? AND ? + INTERVAL 1 DAY";
        params = [start, end];
    }

    const [rows] = await db.query(`
      SELECT up.full_name, d.name, COUNT(b.id) as count
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1=1 ${timeFilter}
      GROUP BY u.id
      ORDER BY count DESC
      LIMIT 10
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 2. THỐNG KÊ TRÌNH KÝ (Có lọc ngày)
// ============================================================

// Trạng thái văn bản
app.get("/api/analytic/docs/status", async (req, res) => {
  try {
    const { start, end } = req.query;
    let whereClause = "";
    let params = [];

    if (start && end) {
        whereClause = "WHERE created_at BETWEEN ? AND ? + INTERVAL 1 DAY";
        params = [start, end];
    }

    const [rows] = await db.query(`
      SELECT status, COUNT(*) AS count
      FROM documents
      ${whereClause}
      GROUP BY status
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Top người ký nhiều nhất (Dựa trên thời gian tạo văn bản hoặc thời gian ký)
// Ở đây ta lọc theo thời gian văn bản được tạo để đồng bộ
app.get("/api/analytic/docs/signers", async (req, res) => {
  try {
    const { start, end } = req.query;
    let timeFilter = "";
    let params = [];

    if (start && end) {
        // Lọc dựa trên bảng document_signers (ví dụ: ngày ký signed_at)
        // Hoặc join với documents để lấy ngày tạo. Ở đây dùng ngày ký cho chính xác.
        timeFilter = "WHERE ds.signed_at BETWEEN ? AND ? + INTERVAL 1 DAY";
        params = [start, end];
    }

    const [rows] = await db.query(`
      SELECT up.full_name, COUNT(ds.document_id) AS count
      FROM document_signers ds
      JOIN users u ON ds.signer_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      ${timeFilter}
      AND ds.status = 'Đã ký' -- Chỉ đếm những cái đã ký
      GROUP BY ds.signer_id
      ORDER BY count DESC
      LIMIT 10
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xu hướng trình ký theo ngày
app.get("/api/analytic/docs/days", async (req, res) => {
  try {
    const { start, end } = req.query;
    let whereClause = "";
    let params = [];

    if (start && end) {
        whereClause = "WHERE created_at BETWEEN ? AND ? + INTERVAL 1 DAY";
        params = [start, end];
    }

    const [rows] = await db.query(`
      SELECT DATE(created_at) AS day, COUNT(*) AS count
      FROM documents
      ${whereClause}
      GROUP BY day
      ORDER BY day ASC
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 3. TỔNG QUAN (KPI & CHART CHUNG)
// ============================================================

app.get("/api/analytic/overview", async (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Tạo 2 bộ lọc riêng cho 2 bảng khác nhau
    let whereBooking = "";
    let whereDoc = "";
    let paramsBooking = [];
    let paramsDoc = [];

    if (start && end) {
        whereBooking = "WHERE start_time BETWEEN ? AND ? + INTERVAL 1 DAY";
        paramsBooking = [start, end];

        whereDoc = "WHERE created_at BETWEEN ? AND ? + INTERVAL 1 DAY";
        paramsDoc = [start, end];
    }

    // 1. KPI Số liệu
    const [[meetings]] = await db.query(`SELECT COUNT(*) AS total FROM bookings ${whereBooking}`, paramsBooking);
    const [[docs]] = await db.query(`SELECT COUNT(*) AS total FROM documents ${whereDoc}`, paramsDoc);
    
    // User active thì thường tính toàn bộ, không lọc theo ngày (hoặc lọc theo last_login nếu có)
    const [[users]] = await db.query(`SELECT COUNT(*) AS total FROM users`);

    // 2. Biểu đồ hoạt động (UNION 2 bảng)
    // Cần inject tham số vào cả 2 câu query con
    const sqlActivity = `
      SELECT day, SUM(count) AS count FROM (
        SELECT DATE(start_time) AS day, COUNT(*) AS count
        FROM bookings
        ${whereBooking}
        GROUP BY day
        
        UNION ALL
        
        SELECT DATE(created_at) AS day, COUNT(*) AS count
        FROM documents
        ${whereDoc}
        GROUP BY day
      ) AS t
      GROUP BY day
      ORDER BY day ASC
    `;
    
    // Params phải khớp thứ tự: [start, end] của booking + [start, end] của doc
    const chartParams = [...paramsBooking, ...paramsDoc];
    
    const [activity] = await db.query(sqlActivity, chartParams);

    res.json({
      totalMeetings: meetings.total,
      totalDocuments: docs.total,
      activeUsers: users.total,
      activity
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// 1️⃣ Báo cáo sử dụng phòng họp
app.get('/api/report/rooms', async (req, res) => {
  try {
    const { from, to, room_id, user_id } = req.query;

    let sql = `
      SELECT
        DATE(b.start_time) AS day,
        r.name AS room_name,
        CONCAT(DATE_FORMAT(b.start_time, '%H:%i'), ' - ', DATE_FORMAT(b.end_time, '%H:%i')) AS time_range,
        up.full_name AS user_name,
        b.title AS purpose
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    if (from) { sql += " AND DATE(b.start_time) >= ?"; params.push(from); }
    if (to) { sql += " AND DATE(b.start_time) <= ?"; params.push(to); }
    if (room_id) { sql += " AND b.room_id = ?"; params.push(room_id); }
    if (user_id) { sql += " AND b.user_id = ?"; params.push(user_id); }

    sql += " ORDER BY b.start_time ASC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2️⃣ Báo cáo thay đổi phòng/hệ thống (trước là room-log)
app.get('/api/report/room-log', async (req, res) => {
  try {
    const { from, to, action } = req.query;

    let sql = `
      SELECT
        l.updated_at AS created_at,
        r.name AS room_name,
        l.action,
        l.updated_by AS actor,
        JSON_UNQUOTE(JSON_EXTRACT(l.new_data, '$.title')) AS detail
      FROM booking_change_log l
      LEFT JOIN rooms r ON l.entity_type='room' AND l.entity_id = r.id
      WHERE 1=1
    `;

    const params = [];
    if (from) { sql += " AND DATE(l.updated_at) >= ?"; params.push(from); }
    if (to) { sql += " AND DATE(l.updated_at) <= ?"; params.push(to); }
    if (action) { sql += " AND l.action = ?"; params.push(action); }

    sql += " ORDER BY l.updated_at DESC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3️⃣ Báo cáo trình ký
app.get('/api/report/sign', async (req, res) => {
  try {
    const { from, to, status } = req.query;

    let sql = `
      SELECT
        d.id AS document_id,
        d.title,
        up_sender.full_name AS sender,
        GROUP_CONCAT(up_signer.full_name SEPARATOR ', ') AS signers,
        d.created_at,
        d.status
      FROM documents d
      LEFT JOIN users u_sender ON d.created_by = u_sender.id
      LEFT JOIN user_profiles up_sender ON up_sender.user_id = u_sender.id
      LEFT JOIN document_signers ds ON ds.document_id = d.id
      LEFT JOIN users u_signer ON ds.signer_id = u_signer.id
      LEFT JOIN user_profiles up_signer ON up_signer.user_id = u_signer.id
      WHERE 1=1
      GROUP BY d.id, d.title, up_sender.full_name, d.created_at, d.status
    `;

    const params = [];
    if (from) { sql += " AND DATE(d.created_at) >= ?"; params.push(from); }
    if (to) { sql += " AND DATE(d.created_at) <= ?"; params.push(to); }
    if (status) { sql += " AND d.status = ?"; params.push(status); }

    sql += " ORDER BY d.created_at DESC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//4️⃣ Báo cáo người dùng (với filter phòng ban & người dùng)
app.get('/api/report/users', async (req, res) => {
    try {
        const { dept, from, to } = req.query;

        // 1. Chuẩn bị điều kiện cho Sub-query (Đếm Booking & Document)
        let dateCondition = "";
        const subQueryParams = [];

        if (from) {
            dateCondition += " AND created_at >= ? ";
            subQueryParams.push(from);
        }
        if (to) {
            // Lưu ý: Nếu muốn lấy hết ngày "to", nên thêm thời gian cuối ngày hoặc dùng < ngày hôm sau
            dateCondition += " AND created_at <= ? "; 
            subQueryParams.push(to + ' 23:59:59'); // Mẹo nhỏ để lấy hết ngày cuối
        }

        // 2. Chuẩn bị điều kiện cho Main Query (Lọc User theo phòng)
        let mainCondition = "";
        const mainQueryParams = [];

        if (dept && dept !== 'Tất cả') {
            mainCondition += " AND d.name = ? ";
            mainQueryParams.push(dept);
        }

        // 3. Ghép câu SQL hoàn chỉnh
        // Lưu ý: Chúng ta nhúng biến dateCondition vào thẳng chuỗi SQL
        const sql = `
            SELECT
                u.id,
                up.full_name,
                d.name AS department,
                
                (SELECT COUNT(*) 
                 FROM bookings b 
                 WHERE b.user_id = u.id ${dateCondition}
                ) AS booking_count,

                (SELECT COUNT(*) 
                 FROM documents doc 
                 WHERE doc.created_by = u.id ${dateCondition}
                ) AS document_count

            FROM users u
            LEFT JOIN user_profiles up ON up.user_id = u.id
            LEFT JOIN departments d ON u.department_id = d.id
            
            WHERE 1=1 ${mainCondition}
            ORDER BY booking_count DESC, document_count DESC
        `;

        // 4. Gộp tham số theo đúng thứ tự xuất hiện của dấu ?
        // Thứ tự trong SQL: SubQuery Booking -> SubQuery Doc -> Main Where
        const finalParams = [
            ...subQueryParams, // Tham số cho Booking (from, to)
            ...subQueryParams, // Tham số cho Document (from, to) - Lặp lại vì dùng 2 sub-query
            ...mainQueryParams // Tham số cho Department
        ];

        // 5. Thực thi
        const [rows] = await db.execute(sql, finalParams);
        res.json(rows);

    } catch (error) {
        console.error("Lỗi API Report:", error);
        res.status(500).json({ message: "Lỗi server khi tải báo cáo" });
    }
});
// ==========================================
// 5️⃣ CÁC API THỐNG KÊ (DASHBOARD)
// ==========================================

// 5.1 Top 5 Phòng được đặt nhiều nhất
app.get('/api/stats/top-rooms', async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];

    let sql = `
      SELECT 
        r.name AS room_name,
        COUNT(b.id) AS count,
        ROUND(SUM(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time)) / 60, 1) AS total_hours
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE 1=1
    `;

    if (from) { sql += " AND DATE(b.start_time) >= ?"; params.push(from); }
    if (to) { sql += " AND DATE(b.start_time) <= ?"; params.push(to); }

    sql += `
      GROUP BY r.id, r.name
      ORDER BY count DESC
      LIMIT 5
    `;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5.2 Top 5 Khung giờ cao điểm (theo giờ bắt đầu)
app.get('/api/stats/top-hours', async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];

    let sql = `
      SELECT 
        CONCAT(DATE_FORMAT(b.start_time, '%H:00'), ' - ', DATE_FORMAT(DATE_ADD(b.start_time, INTERVAL 1 HOUR), '%H:00')) AS time_frame,
        COUNT(b.id) AS count
      FROM bookings b
      WHERE 1=1
    `;

    if (from) { sql += " AND DATE(b.start_time) >= ?"; params.push(from); }
    if (to) { sql += " AND DATE(b.start_time) <= ?"; params.push(to); }

    sql += `
      GROUP BY time_frame
      ORDER BY count DESC
      LIMIT 5
    `;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5.3 Top 5 Người ký nhiều nhất (Tính trên các hồ sơ ĐÃ ký)
app.get('/api/stats/top-signers', async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];

    // Logic: Đếm số lượng hồ sơ mà người dùng đóng vai trò là 'signer' và trạng thái hồ sơ là 'signed'
    // Lưu ý: Tùy logic DB của bạn, nếu bảng document_signers có cột status riêng (đã ký/chưa ký) thì sửa WHERE d.status thành ds.status
    let sql = `
      SELECT 
        up.full_name,
        COUNT(ds.document_id) AS signed_count
      FROM document_signers ds
      JOIN documents d ON ds.document_id = d.id
      JOIN users u ON ds.signer_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE d.status = 'Đã duyệt'
    `;

    if (from) { sql += " AND DATE(d.created_at) >= ?"; params.push(from); }
    if (to) { sql += " AND DATE(d.created_at) <= ?"; params.push(to); }

    sql += `
      GROUP BY u.id, up.full_name
      ORDER BY signed_count DESC
      LIMIT 5
    `;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5.4 Top 5 Người đặt phòng nhiều nhất
app.get('/api/stats/top-bookers', async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];

    let sql = `
      SELECT 
        up.full_name,
        COUNT(b.id) AS booking_count
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE 1=1
    `;

    if (from) { sql += " AND DATE(b.start_time) >= ?"; params.push(from); }
    if (to) { sql += " AND DATE(b.start_time) <= ?"; params.push(to); }

    sql += `
      GROUP BY u.id, up.full_name
      ORDER BY booking_count DESC
      LIMIT 5
    `;

    const [rows] = await db.query(sql, params);
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
