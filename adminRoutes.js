// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

console.log("AdminController keys:", Object.keys(adminController));

/* ==================== 👩‍🎓 CRUD Murid ==================== */
router.get("/students", adminController.getAllStudents);
router.post("/students", adminController.createNewStudent);
router.put("/students/:id", adminController.updateStudent);
router.delete("/students/:id", adminController.deleteStudent);

/* ==================== 📅 Absensi ==================== */
router.get("/attendance", adminController.getAttendanceByDate);
router.get("/attendance/summary", adminController.getMonthlySummary);

/* ==================== 🔔 Notifikasi izin/sakit ==================== */
router.get("/attendance/pending", adminController.getPendingRequests);
router.put("/attendance/approve/:id", adminController.approveRequest);
router.put("/attendance/reject/:id", adminController.rejectRequest);

/* ==================== 📩 Notifikasi read/clear ==================== */
router.put("/attendance/read/:id", adminController.markAsRead);
router.put("/attendance/read-all", adminController.markAllRead);
router.delete("/attendance/read-all", adminController.deleteReadRequests);

/* ==================== 🔧 Alias lama ==================== */
router.get("/users", adminController.getUsers);
router.post("/users", adminController.createUser);

module.exports = router;
