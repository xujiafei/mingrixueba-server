const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');
const materialsUploadController = require('../controllers/materialsUploadController');

// 公开接口
router.get('/', materialController.getMaterials);
router.get('/categories', materialController.getCategories);
router.get('/search', materialController.searchMaterials);
router.get('/popular', materialController.getPopularMaterials);
router.get('/home', materialController.getHomeMaterials); // 新增首页资料列表接口
// 根据分类ID获取材料列表（用于文件夹浏览）
router.get('/category/:categoryId', materialController.getMaterialsByCategory);
// 深度查询接口（跳过版本层级，支持版本过滤）
router.get('/category/:categoryId/depth-search', materialController.getMaterialsByDepth);
// 小程序兼容深度查询接口
router.get('/depth-search/:id', (req, res, next) => {
  // 将id参数映射到categoryId，保持与现有接口一致
  req.params.categoryId = req.params.id;
  materialController.getMaterialsByDepth(req, res, next);
});
// 资料详情接口 - 公开访问
router.get('/:id', materialController.getMaterialDetail);

// 所有接口都无需认证（私人使用系统）
router.post('/upload', materialsUploadController.uploadMaterial);
router.post('/upload-multiple', materialsUploadController.uploadMultipleMaterials);
router.post('/batch-delete', materialController.batchDeleteMaterials);
router.post('/:id/purchase', materialController.purchaseMaterial);
router.get('/:id/download', materialController.downloadMaterial);
router.delete('/:id', materialController.deleteMaterial);
// 重命名和移动功能
router.put('/:id/rename', materialController.renameMaterial);
router.put('/:id/rename-file', materialController.renameMaterialFile);
router.put('/:id/move', materialController.moveMaterial);

module.exports = router;