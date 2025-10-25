const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,   // mencegah ETIMEDOUT
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
}).promise();

pool.getConnection()
  .then(conn => {
    console.log("✅ Database connected as ID:", conn.threadId);
    conn.release();
  })
  .catch(err => {
    console.error("❌ Database connection failed:", err.code, err.message);
  });

module.exports = pool;
