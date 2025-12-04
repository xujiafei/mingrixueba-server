const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categoriesController');

// 测试路由
router.post('/test-delete/:id', (req, res) => {
  console.log('TEST DELETE route hit with id:', req.params.id);
  res.json({ message: 'Test delete route working', id: req.params.id });
});

// 获取所有年级分类
router.get('/grades', categoriesController.getGrades);

// 获取指定分类下的所有子分类（支持文件夹浏览）
router.get('/children/:parentId', categoriesController.getChildrenByParentId);

// 获取分类树形结构
router.get('/tree', categoriesController.getCategoryTree);

// 根据年级获取学期（两种路径格式都支持）
router.get('/semesters/:gradeId', categoriesController.getSemestersByGrade);
router.get('/grades/:gradeId/semesters', categoriesController.getSemestersByGrade);

// 根据学期获取科目（两种路径格式都支持）
router.get('/subjects/:semesterId', categoriesController.getSubjectsBySemester);
router.get('/semesters/:semesterId/subjects', categoriesController.getSubjectsBySemester);

// 根据年级级别获取分类
router.get('/level/:level', categoriesController.getCategoriesByLevel);

// 搜索分类
router.get('/search', categoriesController.searchCategories);

// 获取热门分类
router.get('/popular', categoriesController.getPopularCategories);

// 获取分类统计信息
router.get('/stats', categoriesController.getCategoryStats);

// 获取指定分类及其所有子分类的ID列表（递归）
router.get('/:categoryId/descendants', categoriesController.getAllDescendantIds);

// 根据路径获取分类
router.get('/path', categoriesController.getCategoryByPath);

// 创建新分类
router.post('/', categoriesController.createCategory);

// 获取所有分类
router.get('/', categoriesController.getCategories);

// 删除分类（必须放在获取详情路由之前）
router.delete('/:id', (req, res) => {
  console.log('DELETE route hit with id:', req.params.id);
  res.json({ message: 'Delete route working', id: req.params.id });
});
// router.delete('/:id', categoriesController.deleteCategory);

// POST方式删除分类
router.post('/:id/delete', categoriesController.deleteCategory);

// 批量删除分类
router.post('/batch-delete', categoriesController.batchDeleteCategories);

// 根据分类ID获取分类详情
router.get('/:id', categoriesController.getCategoryDetail);

// 更新分类（移动文件夹）
router.put('/:id', categoriesController.updateCategory);

module.exports = router;