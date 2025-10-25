// controllers/adminController.js
const db = require("../config/db");
const bcrypt = require("bcryptjs");

/* ==================== 👩‍🎓 CRUD Murid ==================== */
exports.getAllStudents = async (req, res) => {
  try {
    const sql = "SELECT id, rfid_uid, nis, name, student_class, role FROM students ORDER BY name";
    const [results] = await db.query(sql);
    res.json(results);
  } catch (err) {
    console.error("getAllStudents error:", err);
    res.status(500).json({ error: "Gagal mengambil data murid." });
  }
};

exports.createNewStudent = async (req, res) => {
  try {
    const { rfid_uid, nis, name, student_class, password, role } = req.body;
    if (!rfid_uid || !nis || !name || !student_class || !password) {
      return res.status(400).json({ error: "Data tidak lengkap." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `INSERT INTO students (rfid_uid, nis, name, student_class, password, role) VALUES (?, ?, ?, ?, ?, ?)`;
    const [result] = await db.query(sql, [
      rfid_uid,
      nis,
      name,
      student_class,
      hashedPassword,
      role || "student",
    ]);
    res.status(201).json({ message: "Murid berhasil dibuat", id: result.insertId });
  } catch (err) {
    console.error("createNewStudent error:", err);
    res.status(500).json({ error: "Gagal membuat murid baru." });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { nis, name, student_class, role, password } = req.body;
    const { id } = req.params;

    let sql = "UPDATE students SET nis = ?, name = ?, student_class = ?, role = ?";
    let params = [nis, name, student_class, role];

    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      sql += ", password = ?";
      params.push(hashedPassword);
    }

    sql += " WHERE id = ?";
    params.push(id);

    const [result] = await db.query(sql, params);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Murid tidak ditemukan." });
    res.json({ message: "Data murid berhasil diupdate." });
  } catch (err) {
    console.error("updateStudent error:", err);
    res.status(500).json({ error: "Gagal mengupdate murid." });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "DELETE FROM students WHERE id = ?";
    const [result] = await db.query(sql, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Murid tidak ditemukan." });
    res.json({ message: "Murid berhasil dihapus." });
  } catch (err) {
    console.error("deleteStudent error:", err);
    res.status(500).json({ error: "Gagal menghapus murid." });
  }
};

/* ==================== 📅 Absensi ==================== */
exports.getAttendanceByDate = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const sql = `
      SELECT a.id, s.name, s.nis, s.student_class, a.timestamp, a.status, a.approved
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE DATE(a.timestamp) = ?
      ORDER BY a.timestamp DESC
    `;
    const [results] = await db.query(sql, [date]);
    res.json(results);
  } catch (err) {
    console.error("getAttendanceByDate error:", err);
    res.status(500).json({ error: "Gagal mengambil data absensi." });
  }
};

// Rekap absensi bulanan per murid
exports.getMonthlySummary = async (req, res) => {
  try {
    const { month, year } = req.query;

    // default bulan & tahun = sekarang
    const now = new Date();
    const selectedMonth = month || now.getMonth() + 1; // Januari = 0
    const selectedYear = year || now.getFullYear();

    const sql = `
      SELECT s.id AS student_id, s.name, s.nis,
        SUM(CASE WHEN a.status = 'masuk' THEN 1 ELSE 0 END) AS total_masuk,
        SUM(CASE WHEN a.status = 'izin' AND a.approved = 1 THEN 1 ELSE 0 END) AS total_izin,
        SUM(CASE WHEN a.status = 'sakit' AND a.approved = 1 THEN 1 ELSE 0 END) AS total_sakit,
        SUM(CASE WHEN a.status = 'tidak hadir' OR (a.status IN ('izin','sakit') AND a.approved = 0) THEN 1 ELSE 0 END) AS total_tidak_hadir
      FROM students s
      LEFT JOIN attendance a 
        ON s.id = a.student_id 
        AND MONTH(a.timestamp) = ? 
        AND YEAR(a.timestamp) = ?
      GROUP BY s.id, s.name, s.nis
      ORDER BY s.name ASC
    `;

    const [rows] = await db.query(sql, [selectedMonth, selectedYear]);
    res.json(rows);
  } catch (err) {
    console.error("getMonthlySummary error:", err);
    res.status(500).json({ error: "Gagal mengambil rekap absensi." });
  }
};


/* ==================== 🔔 Notifikasi Izin/Sakit ==================== */
exports.getPendingRequests = async (req, res) => {
  try {
    const sql = `
      SELECT a.id, s.name, s.nis, s.student_class, a.status, a.timestamp, a.approved
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE a.approved = 0
      ORDER BY a.timestamp DESC
    `;
    const [results] = await db.query(sql);
    res.json(results);
  } catch (err) {
    console.error("getPendingRequests error:", err);
    res.status(500).json({ error: "Gagal mengambil data pending." });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "UPDATE attendance SET approved = 1 WHERE id = ?";
    const [result] = await db.query(sql, [id]);

    if (result.affectedRows === 0) return res.status(404).json({ error: "Data absensi tidak ditemukan." });
    res.json({ message: "Izin disetujui.", id, approved: 1 });
  } catch (err) {
    console.error("approveRequest error:", err);
    res.status(500).json({ error: "Gagal menyetujui izin." });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "UPDATE attendance SET approved = -1 WHERE id = ?";
    const [result] = await db.query(sql, [id]);

    if (result.affectedRows === 0) return res.status(404).json({ error: "Data absensi tidak ditemukan." });
    res.json({ message: "Izin ditolak.", id, approved: -1 });
  } catch (err) {
    console.error("rejectRequest error:", err);
    res.status(500).json({ error: "Gagal menolak izin." });
  }
};

/* ==================== 📩 Read / Notifikasi ==================== */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "UPDATE attendance SET read = 1 WHERE id = ?";
    await db.query(sql, [id]);
    res.json({ message: "Notifikasi ditandai terbaca.", id });
  } catch (err) {
    console.error("markAsRead error:", err);
    res.status(500).json({ error: "Gagal menandai terbaca." });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const sql = "UPDATE attendance SET read = 1 WHERE approved = 0";
    await db.query(sql);
    res.json({ message: "Semua notifikasi ditandai terbaca." });
  } catch (err) {
    console.error("markAllRead error:", err);
    res.status(500).json({ error: "Gagal menandai semua notifikasi." });
  }
};

exports.deleteReadRequests = async (req, res) => {
  try {
    const sql = "DELETE FROM attendance WHERE read = 1 AND approved != 0";
    await db.query(sql);
    res.json({ message: "Semua notifikasi terbaca dihapus." });
  } catch (err) {
    console.error("deleteReadRequests error:", err);
    res.status(500).json({ error: "Gagal menghapus notifikasi terbaca." });
  }
};

/* ==================== 🔧 Alias Lama ==================== */
exports.getUsers = async (req, res) => {
  res.json({ message: "Endpoint getUsers (alias) masih ada untuk kompatibilitas." });
};
exports.createUser = async (req, res) => {
  res.json({ message: "Endpoint createUser (alias) masih ada untuk kompatibilitas." });
};
