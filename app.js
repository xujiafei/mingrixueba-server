const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { sequelize, testConnection } = require('./config/database');
const errorHandler = require('./middleWare/errorHandler');

// 路由导入
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const materialRoutes = require('./routes/materials');
const orderRoutes = require('./routes/orders');
const categoryRoutes = require('./routes/categories');
const membershipRoutes = require('./routes/membership');
const bannerRoutes = require('./routes/banners');
const configRoutes = require('./routes/config'); 
const testUploadRoute = require('./routes/testUploadRoute'); 

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// 注释掉小程序assets目录的引用，因为在Docker环境中无法访问外部目录
// app.use('/assets', express.static(path.join(__dirname, '../WeChatProjects/miniprogram-1/assets')));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// 调试：打印所有加载的路由
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  next();
});

// 为私人使用系统添加默认用户中间件
app.use((req, res, next) => {
  // 设置默认用户（私人系统无需认证）
  req.user = {
    userId: 1, // 默认用户ID为1
    user_id: 1, // 兼容不同的命名方式
    role: 'admin', // 默认角色为管理员
    username: 'admin',
    openid: 'private_user_openid'
  };
  next();
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/config', configRoutes);
// 测试上传路由（不需要身份验证）
app.use('/api/test', testUploadRoute);
// 404处理
app.use((req, res) => {
  console.log('404 - 路由未找到:', req.originalUrl);
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 错误处理中间件
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
// 启动服务器
const startServer = async () => {
  try {
    // 开发环境下，尝试连接数据库，但不阻止服务器启动
    if (process.env.NODE_ENV === 'development') {
      console.log('开发环境：尝试连接数据库...');
      try {
        await testConnection();
        await sequelize.sync({ force: false, alter: true }); // 自动修改表结构以匹配模型定义
        console.log('数据库模型同步完成');
      } catch (dbError) {
        console.warn('警告：数据库连接失败，但服务器仍将启动用于开发测试', dbError.message);
      }
    } else {
      // 非开发环境必须确保数据库连接成功
      await testConnection();
      await sequelize.sync({ force: false, alter: true });
      console.log('数据库模型同步完成');
    }
    
    app.listen(PORT,HOST, () => {
      console.log(`🚀 Server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
      if (HOST === '0.0.0.0') {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        Object.keys(networkInterfaces).forEach(interfaceName => {
          const interfaces = networkInterfaces[interfaceName];
          interfaces.forEach(interface => {
            if (!interface.internal && interface.family === 'IPv4') {
              console.log(`🌍 Network access: http://${interface.address}:${PORT}`);
            }
          });
        });
      }
      console.log(`环境: ${process.env.NODE_ENV}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
};

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('正在关闭服务器...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('收到终止信号，正在关闭服务器...');
  await sequelize.close();
  process.exit(0);
});

startServer();