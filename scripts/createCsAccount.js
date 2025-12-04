const bcrypt = require('bcrypt');
const { sequelize } = require('../config/database');
const { User } = require('../models');

// 创建默认客服账号
async function createCsAccount() {
  try {
    // 确保数据库连接
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 检查是否已存在客服账号
    const existingCs = await User.findOne({
      where: { username: 'customer_service', role: 'customer_service' }
    });
    
    if (existingCs) {
      console.log('客服账号已存在');
      return;
    }
    
    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);
    
    // 创建客服账号
    const csUser = await User.create({
      username: 'customer_service',
      nickname: '客服001',
      role: 'customer_service',
      password_hash: hashedPassword,
      is_active: true,
      points: 0
    });
    
    console.log('默认客服账号创建成功：');
    console.log(`  用户名: customer_service`);
    console.log(`  密码: 123456`);
    console.log(`  用户ID: ${csUser.id}`);
    
  } catch (error) {
    console.error('创建客服账号失败:', error);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
  }
}

// 执行脚本
createCsAccount();
