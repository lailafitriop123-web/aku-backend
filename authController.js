// controllers/authController.js
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-12345";

// ✅ Controller Login
async function loginUser(req, res) {
  try {
    const { nis, password } = req.body;

    if (!nis || !password) {
      return res.status(400).json({ error: "NIS dan password harus diisi." });
    }

    // Cari user di DB
    const [rows] = await db.query("SELECT * FROM students WHERE nis = ?", [nis]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: "NIS tidak ditemukan." });
    }

    // Cek password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Password salah." });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, nis: user.nis, role: user.role },
      JWT_SECRET,
      { expiresIn: "3d" }
    );

    res.json({
      message: "Login berhasil!",
      token,
      student: {
        id: user.id,
        name: user.name,
        nis: user.nis,
        student_class: user.student_class,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("SERVER ERROR SAAT LOGIN:", err);
    res.status(500).json({ error: "Server error saat login." });
  }
}

// ✅ Export function dengan benar
module.exports = { loginUser };
