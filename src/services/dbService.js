const mysql = require('mysql2/promise');
const dbConfig = require('../../config/dbConfig');

// Hàm kết nối đến cơ sở dữ liệu
const connectToDatabase = async () => {
  try {
    const dbConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      port: dbConfig.port,
      connectionLimit: 5,
      ssl: dbConfig.ssl,
    });
    console.log('Kết nối MySQL thành công.');
    return dbConnection;
  } catch (err) {
    console.error('Lỗi kết nối MySQL:', err.message);
    throw err;
  }
};

module.exports = { connectToDatabase };
