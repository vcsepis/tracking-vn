const axios = require('axios');
const moment = require('moment');

// Hàm lấy dữ liệu mới nhất từ API bên thứ ba
const getLatestTrackingData = async trackingId => {
  try {
    const response = await axios.get(
      `https://avn-tracking.myepis.cloud/tracking?trackingId=${trackingId}`
    );

    // Log chi tiết dữ liệu trả về từ API
    console.log(`Dữ liệu trả về từ API cho trackingId ${trackingId}:`, JSON.stringify(response.data, null, 2));

    if (!response.data) {
      console.error(`Không nhận được dữ liệu trả về cho trackingId: ${trackingId}`);
      return { history: [], state_name: 'Unknown' };
    }

    if (!response.data.history || !Array.isArray(response.data.history)) {
      console.error(`Không tìm thấy hoặc history không hợp lệ cho trackingId: ${trackingId}`);
      return { history: [], state_name: response.data.state_name || 'Unknown' };
    }

    const history = response.data.history;
    const latestEvent = history.reduce((latest, current) => {
      const latestDateTime = new Date(`${latest.date} ${latest.timeAndEvent.split(' ')[0]}`);
      const currentDateTime = new Date(`${current.date} ${current.timeAndEvent.split(' ')[0]}`);
      return currentDateTime > latestDateTime ? current : latest;
    });

    // Sử dụng locationTo làm state_name
    const stateName = latestEvent.locationTo || 'Unknown';

    // Kết hợp date và timeAndEvent để tạo timestamp
    const eventDateTime = `${latestEvent.date} ${latestEvent.timeAndEvent.split(' ')[0]}`;
    if (!moment(eventDateTime, 'MMM DD, YYYY HH:mm', true).isValid()) {
      console.warn(`Ngày không hợp lệ: ${eventDateTime} cho trackingId ${trackingId}.`);
      throw new Error('Invalid date format from API.');
    }

    return {
      state_name: stateName,
      date: eventDateTime,
    };
  } catch (error) {
    console.error(`Lỗi khi gọi API bên thứ ba cho trackingId ${trackingId}:`, error.message);
    throw error;
  }
};

// Hàm lưu hoặc cập nhật trạng thái vào cơ sở dữ liệu
const upsertTrackingData = async (trackingId, latestData) => {
    let { date, state_name } = latestData;
  
    // Nếu `state_name` hoặc `date` không hợp lệ
    if (!state_name || state_name.trim() === '') {
      console.warn(`state_name bị null hoặc trống cho trackingId: ${trackingId}. Đặt giá trị mặc định.`);
      state_name = 'Unknown';
    }
    if (!moment(date, 'MMM DD, YYYY HH:mm', true).isValid()) {
      console.warn(`Ngày không hợp lệ: ${date}. Đặt giá trị mặc định.`);
      date = 'Nov 01, 1970 00:00'; // Giá trị mặc định
    }
  
    // Chuyển đổi định dạng ngày sang `YYYY-MM-DD HH:mm:ss`
    const formattedDate = moment(date, 'MMM DD, YYYY HH:mm').format('YYYY-MM-DD HH:mm:ss');
  
    try {
      // Kiểm tra xem `tracking_id` có tồn tại không
      const checkQuery = `SELECT tracking_id FROM state WHERE tracking_id = ?`;
      const [rows] = await global.db.query(checkQuery, [trackingId]);
  
      if (rows.length === 0) {
        // Nếu không tồn tại, thực hiện INSERT
        const insertQuery = `
          INSERT INTO state (tracking_id, state_name, created_at)
          VALUES (?, ?, ?)
        `;
        const [insertResult] = await global.db.query(insertQuery, [trackingId, state_name, formattedDate]);
        console.log(`Tracking ID ${trackingId} đã được thêm mới.`);
        return insertResult.affectedRows > 0;
      } else {
        // Nếu tồn tại, thực hiện UPDATE
        const updateQuery = `
          UPDATE state
          SET state_name = ?, created_at = ?
          WHERE tracking_id = ?
        `;
        const [updateResult] = await global.db.query(updateQuery, [state_name, formattedDate, trackingId]);
        console.log(`Tracking ID ${trackingId} đã được cập nhật.`);
        return updateResult.affectedRows > 0;
      }
    } catch (error) {
      console.error(`Lỗi khi chèn hoặc cập nhật trạng thái cho ${trackingId}:`, error.message);
      return false;
    }
  };
module.exports = { getLatestTrackingData, upsertTrackingData };
