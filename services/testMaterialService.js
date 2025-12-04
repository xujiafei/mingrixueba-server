const { Op } = require('sequelize');
const models = require('../models');
const { Material, Category } = models;

// 简化版测试服务，专注于修复深度查询问题
class TestMaterialService {
  // 使用非递归方式获取所有子分类ID
  static async getAllChildCategoriesRecursively(categoryId) {
    try {
      console.log('开始获取子分类ID:', categoryId);
      const allChildIds = [];
      const queue = [categoryId];
      
      while (queue.length > 0) {
        const currentId = queue.shift();
        
        // 获取当前ID的直接子分类
        const childCategories = await Category.findAll({
          where: {
            parent_id: currentId
          },
          attributes: ['id']
        });
        
        console.log(`分类${currentId}的子分类数量:`, childCategories.length);
        
        // 将子分类ID添加到结果和队列中
        for (const child of childCategories) {
          if (!allChildIds.includes(child.id)) {
            allChildIds.push(child.id);
            queue.push(child.id);
          }
        }
      }
      
      console.log('最终获取的子分类ID列表:', allChildIds);
      return allChildIds;
    } catch (error) {
      console.error('获取子分类ID失败:', error);
      return [];
    }
  }
  
  // 简化版深度查询方法
  static async getMaterialsByDepth(categoryId, params) {
    try {
      console.log('测试深度查询参数:', { categoryId, params });
      
      // 获取所有子分类ID
      const childIds = await this.getAllChildCategoriesRecursively(categoryId);
      const allCategoryIds = [categoryId, ...childIds];
      
      console.log('所有需要查询的分类ID:', allCategoryIds);
      
      // 构建基础查询条件
      const where = {
        category_id: { [Op.in]: allCategoryIds }
      };
      
      // 处理grade_level和subject参数
      if (params.grade_level) {
        where.grade_level = params.grade_level;
        console.log('添加grade_level过滤:', params.grade_level);
      }
      
      if (params.subject) {
        where.subject = params.subject;
        console.log('添加subject过滤:', params.subject);
      }
      
      console.log('最终查询条件:', where);
      
      // 查询所有符合条件的资料
      const materials = await Material.findAll({
        where: where,
        order: [['created_at', 'DESC']]
      });
      
      console.log('查询到的资料数量:', materials.length);
      materials.forEach(m => console.log(`资料ID: ${m.id}, 标题: ${m.title}, 分类ID: ${m.category_id}`));
      
      return {
        rows: materials,
        count: materials.length
      };
    } catch (error) {
      console.error('测试深度查询失败:', error);
      throw error;
    }
  }
}

module.exports = TestMaterialService;