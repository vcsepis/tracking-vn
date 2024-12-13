const axios = require('axios');
const moment = require('moment');
const { sendDiscordNotification, sendPayloadToWebhook } = require('./notificationService');

// Hàm lấy dữ liệu mới nhất từ API bên thứ ba
const getLatestTrackingData = async (trackingId) => {
  try {
    const response = await axios.get(
      `https://avn-tracking.myepis.cloud/tracking?trackingId=${trackingId}`
    );

    console.log(`Dữ liệu trả về từ API cho trackingId ${trackingId}:`, JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.history || !Array.isArray(response.data.history)) {
      console.error(`Không tìm thấy hoặc history không hợp lệ cho trackingId: ${trackingId}`);
      return { history: [], state_name: 'Unknown', date: '', timeAndEvent: '', locationTo: '', locationFrom: '' };
    }

    const history = response.data.history;
    const latestEvent = history.reduce((latest, current) => {
      const latestDateTime = new Date(`${latest.date} ${latest.timeAndEvent.split(' ')[0]}`);
      const currentDateTime = new Date(`${current.date} ${current.timeAndEvent.split(' ')[0]}`);
      return currentDateTime > latestDateTime ? current : latest;
    });

    // Tách phần văn bản từ timeAndEvent
    const eventText = latestEvent.timeAndEvent.split(' ').slice(1).join(' ');

    const locationTo = latestEvent.locationTo && latestEvent.locationTo.trim() !== '' 
      ? latestEvent.locationTo 
      : latestEvent.locationFrom || 'Unknown';

    const components = [
      eventText.trim(),
      locationTo.trim(),
    ];

    // Loại bỏ giá trị trùng lặp trong state_name
    const uniqueComponents = [...new Set(components.filter((c) => c && c !== 'Unknown'))];
    const stateName = uniqueComponents.join(' - ');

    const eventDateTime = `${latestEvent.date} ${latestEvent.timeAndEvent.split(' ')[0]}`;
    if (!moment(eventDateTime, 'MMM DD, YYYY HH:mm', true).isValid()) {
      console.warn(`Ngày không hợp lệ: ${eventDateTime} cho trackingId ${trackingId}.`);
      throw new Error('Invalid date format from API.');
    }

    return {
      state_name: stateName,
      date: eventDateTime,
      timeAndEvent: eventText,
      locationTo: locationTo,
      locationFrom: latestEvent.locationFrom,
    };
  } catch (error) {
    console.error(`Lỗi khi gọi API bên thứ ba cho trackingId ${trackingId}:`, error.message);
    throw error;
  }
};



// Hàm lưu hoặc cập nhật trạng thái vào cơ sở dữ liệu

const upsertTrackingData = async (trackingId, latestData) => {
  let { date, timeAndEvent, locationTo, locationFrom } = latestData;

  // Xây dựng state_name từ timeAndEvent, locationTo và locationFrom
  const components = [
    timeAndEvent.trim(),
    locationTo && locationTo.trim() !== '' ? locationTo.trim() : locationFrom.trim(),
  ];

  // Loại bỏ giá trị trùng lặp
  const uniqueComponents = [...new Set(components.filter((c) => c && c !== 'Unknown'))];
  const state_name = uniqueComponents.join(' - ');

  // Kiểm tra giá trị hợp lệ
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
    // Kiểm tra nếu tracking_id đã tồn tại
    const checkQuery = `SELECT state_name FROM state WHERE tracking_id = ?`;
    const [rows] = await global.db.query(checkQuery, [trackingId]);

    if (rows.length > 0) {
      // Nếu tồn tại, kiểm tra state_name
      const currentStateName = rows[0].state_name;
      if (currentStateName === state_name) {
        console.log(`state_name không thay đổi cho trackingId: ${trackingId}. Không thực hiện cập nhật hoặc gửi thông báo.`);
        return { success: true, action: 'no_change' };
      }

      // Nếu state_name thay đổi, thực hiện UPDATE
      const updateQuery = `
        UPDATE state
        SET state_name = ?, created_at = ?
        WHERE tracking_id = ?
      `;
      const [updateResult] = await global.db.query(updateQuery, [state_name, formattedDate, trackingId]);
      console.log(`Tracking ID ${trackingId} đã được cập nhật.`);

      // Gửi thông báo sau khi UPDATE thành công
      await sendDiscordNotification(trackingId, state_name, formattedDate);
      await sendPayloadToWebhook(trackingId, state_name, formattedDate);

      return { success: true, action: 'updated' };
    } else {
      // Nếu không tồn tại, thực hiện INSERT
      const insertQuery = `
        INSERT INTO state (tracking_id, state_name, created_at)
        VALUES (?, ?, ?)
      `;
      const [insertResult] = await global.db.query(insertQuery, [trackingId, state_name, formattedDate]);
      console.log(`Tracking ID ${trackingId} đã được thêm mới.`);

      // Gửi thông báo sau khi INSERT thành công
      await sendDiscordNotification(trackingId, state_name, formattedDate);
      await sendPayloadToWebhook(trackingId, state_name, formattedDate);

      return { success: true, action: 'inserted' };
    }
  } catch (error) {
    console.error(`Lỗi khi xử lý trạng thái cho ${trackingId}:`, error.message);
    return { success: false, error: error.message };
  }
};





module.exports = { getLatestTrackingData, upsertTrackingData };
