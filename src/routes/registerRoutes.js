const express = require('express');
const { registerTracking } = require('../controllers/registerController');
const router = express.Router();

router.post('/register', registerTracking);

module.exports = router;
