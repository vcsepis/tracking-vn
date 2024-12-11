const { getLatestTrackingData, upsertTrackingData } = require('../services/trackingService');

const runCronJobLogic = async () => {
  try {
    console.log('Bắt đầu cron job...');
    const query = `
      SELECT tracking_id, state_name
      FROM state
      WHERE state_name != 'Facility warehouse has received and is processing.'
    `;
    const [rows] = await global.db.query(query);

    console.log(`Đã tìm thấy ${rows.length} hàng để xử lý.`);

    for (const row of rows) {
      const { tracking_id: trackingId, state_name: currentStateName } = row;

      try {
        console.log(`Lấy dữ liệu mới nhất cho trackingId: ${trackingId}`);
        const latestData = await getLatestTrackingData(trackingId);

        if (!latestData || !latestData.state_name || !latestData.date) {
          console.warn(`Dữ liệu trả về không hợp lệ cho trackingId: ${trackingId}`);
          continue;
        }

        console.log(`Dữ liệu mới nhất cho trackingId: ${trackingId}`, latestData);

        // Cập nhật trạng thái trong cơ sở dữ liệu
        const updated = await upsertTrackingData(trackingId, latestData);
        if (updated) {
          console.log(`Tracking ID ${trackingId} đã được cập nhật.`);
        } else {
          console.warn(`Không thể cập nhật tracking ID ${trackingId}.`);
        }
      } catch (error) {
        console.error(`Lỗi khi xử lý trackingId ${trackingId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Lỗi khi chạy cron job:', error.message);
  }
};

module.exports = { runCronJobLogic };
