const { sequelize } = require('../config/database');
const { Category } = require('../models');

// category表数据迁移脚本（假设grade字段已存在）
async function updateCategoryData() {
  try {
    console.log('开始更新category表数据...');
    
    // 1. 将一级分类的level值迁移到grade字段
    await sequelize.query(`
      UPDATE categories 
      SET grade = level - 1 
      WHERE (parent_id IS NULL OR parent_id = 0) AND grade IS NULL;
    `);
    console.log('已将一级分类的level值迁移到grade字段');
    
    // 2. 使用逐步更新的方式设置level为层级值（1-4级）
    // 先设置一级分类的level为1
    await sequelize.query(`
      UPDATE categories 
      SET level = 1 
      WHERE parent_id IS NULL OR parent_id = 0;
    `);
    console.log('已设置一级分类level为1');
    
    // 设置二级分类的level为2
    await sequelize.query(`
      UPDATE categories c2 
      JOIN categories c1 ON c2.parent_id = c1.id 
      SET c2.level = 2 
      WHERE c1.level = 1;
    `);
    console.log('已设置二级分类level为2');
    
    // 设置三级分类的level为3
    await sequelize.query(`
      UPDATE categories c3 
      JOIN categories c2 ON c3.parent_id = c2.id 
      SET c3.level = 3 
      WHERE c2.level = 2;
    `);
    console.log('已设置三级分类level为3');
    
    // 设置四级分类的level为4
    await sequelize.query(`
      UPDATE categories c4 
      JOIN categories c3 ON c4.parent_id = c3.id 
      SET c4.level = 4 
      WHERE c3.level = 3;
    `);
    console.log('已设置四级分类level为4');
    
    console.log('Category表数据更新完成！');
    
  } catch (error) {
    console.error('Category表数据更新失败:', error);
  } finally {
    await sequelize.close();
  }
}

// 执行数据更新
updateCategoryData();