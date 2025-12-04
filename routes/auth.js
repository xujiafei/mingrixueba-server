const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 微信小程序登录 - 无需认证
router.post('/login', authController.wxLogin);

// 客服登录 - 无需认证
router.post('/cslogin', authController.csLogin);

// 刷新token - 无需认证
router.post('/refreshToken', authController.refreshToken);

// 退出登录 - 无需认证
router.post('/logout', authController.logout);

module.exports = router;