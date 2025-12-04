const { Sequelize } = require('sequelize');
require('dotenv').config();

// 根据环境选择不同的数据库配置
const isProduction = process.env.NODE_ENV === 'production';

const dbConfig = {
  host: isProduction ? process.env.PROD_DB_HOST : process.env.DEV_DB_HOST,
  port: isProduction ? process.env.PROD_DB_PORT : process.env.DEV_DB_PORT,
  database: isProduction ? process.env.PROD_DB_NAME : process.env.DEV_DB_NAME,
  username: isProduction ? process.env.PROD_DB_USER : process.env.DEV_DB_USER,
  password: isProduction ? process.env.PROD_DB_PASS : process.env.DEV_DB_PASS,
  dialect: 'mysql'
};

// 创建Sequelize实例
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: isProduction ? false : console.log,
    timezone: '+08:00',
    dialectOptions: {
      charset: 'utf8mb4',
      dateStrings: true,
      typeCast: true
    }
  }
);

// 测试数据库连接的方法
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  testConnection
};
