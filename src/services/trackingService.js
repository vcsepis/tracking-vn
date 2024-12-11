const axios = require('axios');
const moment = require('moment');
const { sendDiscordNotification, sendPayloadToWebhook } = require('./notificationService');

// Hàm lấy dữ liệu mới nhất từ API bên thứ ba
const getLatestTrackingData = async (trackingId) => {
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

    // If locationTo is empty, fall back to locationFrom
    const stateName = latestEvent.locationTo && latestEvent.locationTo.trim() !== ''
      ? latestEvent.locationTo
      : latestEvent.locationFrom || 'Unknown';

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

  if (!state_name || state_name.trim() === '') {
    console.warn(`state_name bị null hoặc trống cho trackingId: ${trackingId}. Đặt giá trị mặc định.`);
    state_name = 'Unknown';
  }
  if (!moment(date, 'MMM DD, YYYY HH:mm', true).isValid()) {
    console.warn(`Ngày không hợp lệ: ${date}. Đặt giá trị mặc định.`);
    date = 'Nov 01, 1970 00:00';
  }

  const formattedDate = moment(date, 'MMM DD, YYYY HH:mm').format('YYYY-MM-DD HH:mm:ss');

  try {
    const checkQuery = `SELECT tracking_id FROM state WHERE tracking_id = ?`;
    const [rows] = await global.db.query(checkQuery, [trackingId]);

    let action;
    if (rows.length === 0) {
      const insertQuery = `
        INSERT INTO state (tracking_id, state_name, created_at)
        VALUES (?, ?, ?)
      `;
      const [insertResult] = await global.db.query(insertQuery, [trackingId, state_name, formattedDate]);
      console.log(`Tracking ID ${trackingId} đã được thêm mới.`);
      action = 'inserted';

      // Call notifications after successful insert
      await sendDiscordNotification(trackingId, state_name, formattedDate);
      await sendPayloadToWebhook(trackingId, state_name, formattedDate);
    } else {
      const updateQuery = `
        UPDATE state
        SET state_name = ?, created_at = ?
        WHERE tracking_id = ?
      `;
      const [updateResult] = await global.db.query(updateQuery, [state_name, formattedDate, trackingId]);
      console.log(`Tracking ID ${trackingId} đã được cập nhật.`);
      action = 'updated';

      // Call notifications after successful update
      await sendDiscordNotification(trackingId, state_name, formattedDate);
      await sendPayloadToWebhook(trackingId, state_name, formattedDate);
    }

    return { success: true, action };
  } catch (error) {
    console.error(`Lỗi khi chèn hoặc cập nhật trạng thái cho ${trackingId}:`, error.message);
    return { success: false, error: error.message };
  }
};
module.exports = { getLatestTrackingData, upsertTrackingData };
