const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const { uploadConfig, uploadMultiple, handleSingleImageUpload, upload } = bannerController;

// 公开接口

// 获取激活状态的banner列表（用于前端展示）
router.get('/active', bannerController.getActiveBanners);

// 获取激活状态的公告列表（用于小程序滚动显示）
router.get('/notices/active', bannerController.getActiveNotices);

// 图片上传接口 - 暂时不需要认证，便于开发和测试
router.post('/upload', uploadConfig.single('file'), handleSingleImageUpload);

// 所有接口都无需认证（私人使用系统）

// 批量保存Banner和Notice接口
router.post('/save-all', bannerController.uploadMultiple.array('images'), bannerController.saveAll);

// Banner 管理接口
router.get('/', bannerController.getAllBanners);
router.get('/:id', bannerController.getBannerById);
router.post('/', upload.single('image'), bannerController.createBanner);
router.put('/:id', upload.single('image'), bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);
router.patch('/:id/status', bannerController.toggleBannerStatus);

// Notice 管理接口
router.get('/notices', bannerController.getAllNotices);
router.get('/notices/:id', bannerController.getNoticeById);
router.post('/notices', bannerController.createNotice);
router.put('/notices/:id', bannerController.updateNotice);
router.delete('/notices/:id', bannerController.deleteNotice);
router.patch('/notices/:id/toggle', bannerController.toggleNoticeStatus);

module.exports = router;