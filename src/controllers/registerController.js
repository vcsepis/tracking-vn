const { getLatestTrackingData, upsertTrackingData } = require('../services/trackingService');

exports.registerTracking = async (req, res) => {
  const { trackingId } = req.body;

  if (!trackingId) {
    return res.status(400).json({ error: 'Thiếu trackingId trong payload.' });
  }

  try {
    // Lấy dữ liệu mới nhất từ API bên thứ ba
    const latestData = await getLatestTrackingData(trackingId);

    // Lưu hoặc cập nhật dữ liệu vào cơ sở dữ liệu
    upsertTrackingData(trackingId, latestData);

    // Trả phản hồi cho client
    res.status(200).json({
      message: 'Đã đăng ký và cập nhật trạng thái thành công.',
      trackingId,
      latest: latestData,
    });
  } catch (error) {
    console.error('Lỗi trong quá trình xử lý:', error.message);
    res.status(500).json({ error: 'Không thể xử lý yêu cầu.', details: error.message });
  }
};
