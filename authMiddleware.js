const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-12345";

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      let [rows] = await db.query(
        "SELECT id, nis, name, student_class, 'student' as role FROM students WHERE id = ?",
        [decoded.id]
      );

      if (!rows.length) {
        [rows] = await db.query(
          "SELECT id, username as name, 'admin' as role FROM admin WHERE id = ?",
          [decoded.id]
        );
      }

      if (!rows.length) {
        return res.status(401).json({ message: "User tidak ditemukan" });
      }

      req.user = rows[0];
      next();
    } catch (err) {
      console.error("Auth error:", err);
      return res.status(401).json({ message: "Token tidak valid" });
    }
  } else {
    return res.status(401).json({ message: "Tidak ada token" });
  }
};

module.exports = { protect };
