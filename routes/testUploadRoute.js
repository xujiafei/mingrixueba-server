const express = require('express');
const router = express.Router();
const materialsUploadController = require('../controllers/materialsUploadController');

// 测试文档上传路由 - 不需要身份验证
router.post('/test-upload', (req, res) => {
  // 直接调用上传处理函数
  materialsUploadController.uploadMaterial(req, res);
});

// 测试批量上传路由 - 不需要身份验证
router.post('/test-upload-multiple', (req, res) => {
  // 直接调用批量上传处理函数
  materialsUploadController.uploadMultipleMaterials(req, res);
});

module.exports = router;
