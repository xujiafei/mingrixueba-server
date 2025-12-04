const { sequelize } = require('../config/database');

async function addMissingTimestampFields() {
  try {
    console.log('开始添加缺失的时间戳字段...');
    
    // 添加orders表的created_at和updated_at字段
    console.log('\n1. 为orders表添加时间戳字段...');
    await sequelize.query(`
      ALTER TABLE orders 
      ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
    `);
    console.log('✓ orders表时间戳字段添加成功');
    
    // 检查其他可能缺少时间戳字段的表
    const tables = ['users', 'categories', 'materials', 'banners', 'notices', 'site_configs', 
                   'point_transactions', 'material_exchanges', 'download_logs', 
                   'user_memberships', 'membership_packages'];
    
    for (const table of tables) {
      console.log(`\n检查 ${table} 表的时间戳字段...`);
      const [columns] = await sequelize.query(`DESCRIBE ${table};`);
      const hasCreatedAt = columns.some(col => col.Field === 'created_at');
      const hasUpdatedAt = columns.some(col => col.Field === 'updated_at');
      
      if (!hasCreatedAt || !hasUpdatedAt) {
        console.log(`${table} 表缺少时间戳字段，开始添加...`);
        const sql = [];
        if (!hasCreatedAt) {
          sql.push(`ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
        }
        if (!hasUpdatedAt) {
          sql.push(`ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        }
        
        if (sql.length > 0) {
          await sequelize.query(`ALTER TABLE ${table} ${sql.join(', ')};`);
          console.log(`✓ ${table} 表时间戳字段添加成功`);
        } else {
          console.log(`✓ ${table} 表已包含所有时间戳字段`);
        }
      } else {
        console.log(`✓ ${table} 表已包含所有时间戳字段`);
      }
    }
    
    console.log('\n所有表的时间戳字段检查和添加完成！');
    
  } catch (error) {
    console.error('添加时间戳字段时出错:', error);
    console.error('错误详情:', error.original || error);
  } finally {
    await sequelize.close();
    console.log('\n数据库连接已关闭');
  }
}

addMissingTimestampFields();
