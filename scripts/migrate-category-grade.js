const { sequelize } = require('../config/database');
const { Category } = require('../models');

// category表添加grade字段的迁移脚本
async function migrateCategoryGrade() {
  try {
    console.log('开始迁移category表添加grade字段...');
    
    // 1. 添加grade字段到categories表
    await sequelize.query(`
      ALTER TABLE categories 
      ADD COLUMN grade INTEGER NULL COMMENT '年级，0-9，其中0代表幼升小';
    `);
    console.log('已添加grade字段');
    
    // 2. 将一级分类的level值迁移到grade字段
    await sequelize.query(`
      UPDATE categories 
      SET grade = level - 1 
      WHERE parent_id IS NULL OR parent_id = 0;
    `);
    console.log('已将一级分类的level值迁移到grade字段');
    
    // 3. 使用递归方式更新level字段为层级值（1-4级）
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
    console.log('已更新level字段为层级值（1-4级）');
    
    console.log('Category表grade字段迁移完成！');
    
  } catch (error) {
    console.error('Category表迁移失败:', error);
    console.error('如果迁移失败，您可以尝试手动执行以下SQL命令：');
    console.error('1. ALTER TABLE categories ADD COLUMN grade INTEGER NULL COMMENT "年级，0-9，其中0代表幼升小";');
    console.error('2. UPDATE categories SET grade = level - 1 WHERE parent_id IS NULL OR parent_id = 0;');
    console.error('3. 然后使用递归更新设置level为层级值');
  } finally {
    await sequelize.close();
  }
}

// 执行迁移
migrateCategoryGrade();