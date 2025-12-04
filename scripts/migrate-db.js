const { sequelize } = require('../config/database');
const { User, PointTransaction } = require('../models');

// 数据库迁移脚本
async function migrateDatabase() {
  try {
    console.log('开始数据库迁移...');
    
    // 自动同步模型到数据库（会创建新表，添加新字段，但不会删除现有字段）
    await sequelize.sync({
      alter: true, // 谨慎使用，会修改现有表结构
      logging: console.log
    });
    
    console.log('数据库迁移完成！');
    console.log('已添加的更新：');
    console.log('1. users表：添加role、password_hash字段，修改openid为可为空');
    console.log('2. 创建point_transactions表');
    
  } catch (error) {
    console.error('数据库迁移失败:', error);
    console.error('如果迁移失败，您可能需要手动修改数据库表结构：');
    console.error('1. ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT "user"');
    console.error('2. ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)');
    console.error('3. ALTER TABLE users MODIFY COLUMN openid VARCHAR(64) NULL');
    console.error('4. 创建point_transactions表');
  } finally {
    await sequelize.close();
  }
}

// 执行迁移
migrateDatabase();
