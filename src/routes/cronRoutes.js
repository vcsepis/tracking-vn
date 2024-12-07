const express = require('express');
const { runCronJobLogic } = require('../jobs/cronJob'); // Import logic cron job
const router = express.Router();

router.get('/test-cron', async (req, res) => {
  try {
    console.log('Chạy thử cron job qua API...');
    await runCronJobLogic(); // Gọi logic cron job ngay lập tức
    res.status(200).json({ message: 'Cron job đã chạy thành công.' });
  } catch (error) {
    console.error('Lỗi khi chạy cron job qua API:', error.message);
    res.status(500).json({ error: 'Không thể chạy cron job.', details: error.message });
  }
});

module.exports = router;
