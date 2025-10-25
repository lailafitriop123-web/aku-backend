const db = require('../config/db');

// ===============================
// Rekam absensi masuk/keluar RFID
// ===============================
exports.recordAttendance = async (req, res) => {
  try {
    const { rfid_uid } = req.body;
    if (!rfid_uid) return res.status(400).json({ error: "RFID UID tidak boleh kosong." });

    const [studentRows] = await db.query("SELECT * FROM students WHERE rfid_uid = ?", [rfid_uid]);
    const student = studentRows[0];
    if (!student) return res.status(404).json({ message: "Kartu RFID tidak terdaftar." });

    const today = new Date().toISOString().slice(0, 10);
    const [lastAttendanceRows] = await db.query(
      `SELECT status FROM attendance 
       WHERE student_id = ? 
         AND DATE(timestamp) = ? 
       ORDER BY timestamp DESC LIMIT 1`,
      [student.id, today]
    );
    const lastAttendance = lastAttendanceRows[0];
    const newStatus = lastAttendance && lastAttendance.status === "masuk" ? "keluar" : "masuk";

    const message = newStatus === "masuk"
      ? `✅ Absen MASUK berhasil! Selamat datang, ${student.name}!`
      : `🚪 Absen KELUAR berhasil! Sampai jumpa, ${student.name}!`;

    await db.query("INSERT INTO attendance (student_id, status) VALUES (?, ?)", [student.id, newStatus]);
    res.status(201).json({ message, status: newStatus });
  } catch (err) {
    console.error("❌ Error recordAttendance:", err);
    res.status(500).json({ error: "Server error saat mencatat absensi." });
  }
};

// ===============================
// Ambil absensi milik sendiri
// ===============================
exports.getMyAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const sql = `
      SELECT id, student_id, timestamp, status, approved
      FROM attendance
      WHERE student_id = ?
      ORDER BY timestamp DESC
    `;
    const [rows] = await db.query(sql, [studentId]);
    res.json({ attendance: rows });
  } catch (err) {
    console.error("❌ getMyAttendance error:", err);
    res.status(500).json({ error: "Gagal mengambil data absensi Anda." });
  }
};

// ===============================
// Request izin/sakit
// ===============================
exports.requestAbsence = async (req, res) => {
  try {
    const { student_id, rfid_uid, status } = req.body;
    if (!["izin", "sakit"].includes(status)) {
      return res.status(400).json({ error: "Status harus 'izin' atau 'sakit'." });
    }

    let student;
    if (student_id) {
      [student] = (await db.query("SELECT id, name FROM students WHERE id = ?", [student_id]))[0];
    } else if (rfid_uid) {
      [student] = (await db.query("SELECT id, name FROM students WHERE rfid_uid = ?", [rfid_uid]))[0];
    }

    if (!student) return res.status(404).json({ error: "Murid tidak ditemukan." });

    // insert ke attendance
    const [result] = await db.query(
      "INSERT INTO attendance (student_id, status, approved) VALUES (?, ?, NULL)",
      [student.id, status]
    );

    // insert ke notifications
    await db.query(
      "INSERT INTO notifications (student_id, attendance_id) VALUES (?, ?)",
      [student.id, result.insertId]
    );

    res.status(201).json({
      message: `Request ${status.toUpperCase()} berhasil diajukan, menunggu persetujuan admin.`,
    });
  } catch (err) {
    console.error("❌ requestAbsence error:", err);
    res.status(500).json({ error: "Gagal mengajukan izin/absen." });
  }
};

// ===============================
// Notifikasi admin
// ===============================
exports.getPendingRequests = async (req, res) => {
  try {
    const sql = `
      SELECT a.id, s.name, s.nis, a.status, a.timestamp, a.is_read, a.approved
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE a.status IN ('izin','sakit') AND a.is_read = 0
      ORDER BY a.timestamp DESC
    `;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("❌ getPendingRequests error:", err);
    res.status(500).json({ error: "Gagal mengambil notifikasi." });
  }
};



exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
    res.json({ message: "Notifikasi ditandai terbaca." });
  } catch (err) {
    console.error("❌ markAsRead error:", err);
    res.status(500).json({ error: "Gagal menandai notifikasi." });
  }
};

// Tandai semua request sebagai sudah dibaca
exports.markAllRead = async (req, res) => {
  try {
    await db.query("UPDATE attendance SET is_read = 1 WHERE is_read = 0 AND status IN ('izin','sakit')");
    res.json({ message: "Semua notifikasi ditandai terbaca." });
  } catch (err) {
    console.error("❌ markAllRead error:", err);
    res.status(500).json({ error: "Gagal menandai semua notifikasi." });
  }
};

// Hapus semua request izin/sakit yang sudah terbaca
// Hapus semua request izin/sakit yang sudah terbaca dari NOTIFIKASI,
// tapi JANGAN hapus dari absensi.
exports.deleteReadRequests = async (req, res) => {
  try {
    await db.query(
      "UPDATE attendance SET is_read = 2 WHERE is_read = 1 AND status IN ('izin','sakit')"
    );
    res.json({ message: "Semua notifikasi terbaca berhasil dihapus dari daftar notifikasi." });
  } catch (err) {
    console.error("❌ deleteReadRequests error:", err);
    res.status(500).json({ error: "Gagal menghapus notifikasi terbaca." });
  }
};



// ===============================
// Admin approve / reject izin/sakit
// ===============================
exports.approveAbsence = async (req, res) => {
  try {
    const { id } = req.params; // sekarang ini attendance_id
    const { approved } = req.body; // 1 = approve, 0 = tolak

    if (![0, 1].includes(approved)) {
      return res
        .status(400)
        .json({ error: "Nilai approved harus 0 (tolak) atau 1 (setuju)." });
    }

    const [rows] = await db.query("SELECT * FROM attendance WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: `Absensi dengan id=${id} tidak ditemukan.` });
    }

    const record = rows[0];

    if (!["izin", "sakit"].includes(record.status)) {
      return res
        .status(400)
        .json({ error: "Hanya data izin/sakit yang bisa diproses." });
    }

    if (approved === 0) {
      await db.query(
        "UPDATE attendance SET approved = 0, status = 'tidak hadir' WHERE id = ?",
        [id]
      );
    } else {
      await db.query("UPDATE attendance SET approved = 1 WHERE id = ?", [id]);
    }

    res.json({
      message: approved
        ? "Izin/Sakit disetujui."
        : "Izin/Sakit ditolak → dianggap Tidak Hadir.",
      id,
      approved,
    });
  } catch (err) {
    console.error("❌ approveAbsence error:", err);
    res.status(500).json({ error: "Gagal memproses persetujuan." });
  }
};

// ===============================
// Rekap bulanan
// ===============================
exports.getMonthlySummary = async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const sql = `
    SELECT 
      s.id AS student_id,
      s.nis,
      s.name,
      COALESCE(SUM(CASE WHEN a.status = 'masuk' THEN 1 ELSE 0 END), 0) AS total_masuk,
      COALESCE(SUM(CASE WHEN a.status = 'izin' AND a.approved = 1 THEN 1 ELSE 0 END), 0) AS total_izin,
      COALESCE(SUM(CASE WHEN a.status = 'sakit' AND a.approved = 1 THEN 1 ELSE 0 END), 0) AS total_sakit,
      COALESCE(SUM(CASE WHEN a.status = 'tidak hadir' THEN 1 ELSE 0 END), 0) AS total_tidak_hadir
    FROM students s
    LEFT JOIN attendance a 
      ON s.id = a.student_id 
     AND MONTH(a.timestamp) = ? 
     AND YEAR(a.timestamp) = ?
    GROUP BY s.id, s.nis, s.name
    ORDER BY s.name ASC
  `;
  const [rows] = await db.query(sql, [month, year]);
    res.json(rows);
  } catch (err) {
    console.error("❌ getMonthlySummary error:", err);
    res.status(500).json({ error: "Gagal mengambil rekap bulanan" });
  }
};



// ===============================
// Trend bulanan (Bar Chart)
// ===============================
exports.getMonthlyTrend = async (req, res) => {
  try {
    const months = Math.max(1, parseInt(req.query.months || "6", 10));
    const studentId = req.query.student_id ? parseInt(req.query.student_id, 10) : null;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;

    let sql = `
      SELECT YEAR(timestamp) AS yr, MONTH(timestamp) AS mon,
        SUM(CASE WHEN status = 'masuk' THEN 1 ELSE 0 END) AS masuk,
        SUM(CASE WHEN status = 'izin' AND approved = 1 THEN 1 ELSE 0 END) AS izin,
        SUM(CASE WHEN status = 'sakit' AND approved = 1 THEN 1 ELSE 0 END) AS sakit,
        SUM(CASE WHEN status = 'tidak hadir' THEN 1 ELSE 0 END) AS tidak_hadir
      FROM attendance
      WHERE DATE(timestamp) >= ?
    `;
    const params = [startStr];
    if (studentId) {
      sql += " AND student_id = ?";
      params.push(studentId);
    }
    sql += " GROUP BY yr, mon ORDER BY yr, mon";

    const [rows] = await db.query(sql, params);

    const map = {};
    rows.forEach((r) => {
      const key = `${r.yr}-${String(r.mon).padStart(2, "0")}`;
      map[key] = {
        masuk: Number(r.masuk || 0),
        izin: Number(r.izin || 0),
        sakit: Number(r.sakit || 0),
        tidak_hadir: Number(r.tidak_hadir || 0),
      };
    });

    const result = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const yr = d.getFullYear();
      const mon = d.getMonth() + 1;
      const key = `${yr}-${String(mon).padStart(2, "0")}`;
      const label = d.toLocaleString("id-ID", { month: "short", year: "numeric" });
      const counts = map[key] || { masuk: 0, izin: 0, sakit: 0, tidak_hadir: 0 };
      result.push({ month: key, label, ...counts });
    }

    res.json(result);
  } catch (err) {
    console.error("❌ getMonthlyTrend error:", err);
    res.status(500).json({ error: "Gagal mengambil trend bulanan." });
  }
};
