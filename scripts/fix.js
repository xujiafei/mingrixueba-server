const { sequelize } = require('../config/database');

const fixDatabaseCharset = async () => {
  try {
    console.log('开始修复数据库字符集...');
    
    const databaseName = process.env.DB_NAME;
    
    // 1. 修改数据库字符集
    console.log(`修改数据库 ${databaseName} 字符集...`);
    await sequelize.query(`ALTER DATABASE ${databaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('✅ 数据库字符集修改完成');
    
    // 2. 获取所有表
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${databaseName}'
    `);
    
    console.log(`找到 ${tables.length} 张表需要修复字符集`);
    
    // 3. 修改每个表的字符集
    for (const table of tables) {
      const tableName = table.TABLE_NAME || table.table_name;
      console.log(`修复表 ${tableName} 的字符集...`);
      
      try {
        await sequelize.query(`
          ALTER TABLE ${tableName} 
          CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log(`✅ 表 ${tableName} 字符集修复完成`);
      } catch (error) {
        console.error(`❌ 修复表 ${tableName} 失败:`, error.message);
      }
    }
    
    // 4. 验证修复结果
    console.log('\n验证修复结果...');
    const [result] = await sequelize.query(`
      SELECT 
        table_name,
        table_collation 
      FROM information_schema.tables 
      WHERE table_schema = '${databaseName}'
    `);
    
    console.log('\n修复后的表字符集:');
    result.forEach(row => {
      console.log(`- ${row.table_name}: ${row.table_collation}`);
    });
    
    // 检查是否有表还是latin1
    const latin1Tables = result.filter(row => row.table_collation.includes('latin1'));
    if (latin1Tables.length === 0) {
      console.log('\n🎉 所有表字符集修复成功！现在支持中文字符了。');
    } else {
      console.log('\n⚠️  以下表字符集可能仍有问题:', latin1Tables.map(t => t.table_name).join(', '));
    }
    
  } catch (error) {
    console.error('修复数据库字符集失败:', error);
    throw error;
  }
};

if (require.main === module) {
  fixDatabaseCharset()
    .then(() => {
      console.log('\n✅ 字符集修复完成，现在可以运行分类数据插入脚本了。');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 字符集修复失败');
      process.exit(1);
    });
}

module.exports = fixDatabaseCharset;