const express = require('express');
const { connectToDatabase } = require('./services/dbService');
const cronRoutes = require('./routes/cronRoutes'); // Import route test cron job
const { scheduleCronJob } = require('./jobs/cronJob');
const registerRoutes = require('./routes/registerRoutes');
const app = express();
app.use(express.json());

// Kết nối cơ sở dữ liệu
(async () => {
  try {
    const db = await connectToDatabase();
    global.db = db; // Lưu kết nối Promise-based
    console.log('Cơ sở dữ liệu đã sẵn sàng.');
  } catch (err) {
    console.error('Không thể kết nối cơ sở dữ liệu:', err.message);
    process.exit(1); // Thoát nếu kết nối thất bại
  }
})();

// Thêm route test cron job
app.use('/api', cronRoutes);
app.use('/api', registerRoutes);
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

// Lên lịch cron job tự động
scheduleCronJob;
