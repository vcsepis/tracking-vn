const mysql = require('mysql2/promise');
const dbConfig = require('../../config/dbConfig');

const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  port: dbConfig.port,
  connectionLimit: 5, // This is now valid for a connection pool
  ssl: dbConfig.ssl,
});

const connectToDatabase = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Kết nối MySQL thành công.');
    connection.release(); // Release the connection back to the pool
    return pool; // Return the pool for future queries
  } catch (err) {
    console.error('Lỗi kết nối MySQL:', err.message);
    throw err;
  }
};

module.exports = { connectToDatabase, pool };
