// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Endpoint login
router.post("/login", authController.loginUser);

module.exports = router;