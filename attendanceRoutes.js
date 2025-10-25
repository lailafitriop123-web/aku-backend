// routes/attendanceRoutes.js
const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const { protect } = require("../middleware/authMiddleware");

// Absensi masuk/keluar pakai RFID
router.post("/", attendanceController.recordAttendance);

// Lihat absensi milik sendiri
router.get("/me", protect, attendanceController.getMyAttendance);

// Ajukan izin/sakit
router.post("/request", protect, attendanceController.requestAbsence);

// Rekap & laporan
router.get("/summary", protect, attendanceController.getMonthlySummary);
router.get("/monthly-trend", protect, attendanceController.getMonthlyTrend);

// Notifikasi izin/sakit
router.get("/pending", protect, attendanceController.getPendingRequests);
router.patch("/requests/:id/read", protect, attendanceController.markAsRead);
router.patch("/requests/read-all", protect, attendanceController.markAllRead);
router.delete("/requests/read-all", protect, attendanceController.deleteReadRequests);

// Approve / tolak izin/sakit
router.put("/requests/:id/approve", protect, attendanceController.approveAbsence);

module.exports = router;
