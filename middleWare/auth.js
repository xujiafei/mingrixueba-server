const jwt = require('jsonwebtoken');

// 基本认证中间件，验证JWT令牌
const auth = async (req, res, next) => {
  try {
    console.log('=== 认证中间件开始 ===');
    console.log('请求方法:', req.method);
    console.log('请求路径:', req.path);
    console.log('完整URL:', req.originalUrl);
    console.log('Authorization header:', req.header('Authorization'));
    
    const authHeader = req.header('Authorization');
    console.log('Authorization header类型:', typeof authHeader);
    console.log('Authorization header值:', JSON.stringify(authHeader));
    
    if (!authHeader) {
      console.log('❌ 未提供Authorization header');
      return res.status(401).json({ error: '未提供访问令牌' });
    }
    
    // 提取token，处理Bearer前缀
    let token = authHeader;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // 移除'Bearer '前缀
    }
    
    console.log('提取的token:', token);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    // 开发环境测试token
    if (process.env.NODE_ENV === 'development' && token === 'test-token-12345') {
      console.log('✅ 使用测试token通过认证');
      req.user = { 
        id: 1, 
        openid: 'test_openid',
        username: 'test_admin',
        role: 'admin' // 添加角色信息
      };
      return next();
    }
    
    console.log('尝试JWT验证...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log('JWT验证成功，用户角色:', decoded.role || 'user');
    next();
  } catch (error) {
    console.log('❌ 认证失败:', error.message);
    res.status(401).json({ error: '令牌无效' });
  }
};

// 管理员角色验证中间件
const adminAuth = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      console.log('❌ 管理员权限验证失败');
      return res.status(403).json({ error: '需要管理员权限' });
    }
    console.log('✅ 管理员权限验证通过');
    next();
  } catch (error) {
    console.log('❌ 管理员权限验证错误:', error.message);
    res.status(403).json({ error: '权限验证失败' });
  }
};

// 管理员或客服角色验证中间件
const adminOrCsAuth = async (req, res, next) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'customer_service')) {
      console.log('❌ 管理员/客服权限验证失败');
      return res.status(403).json({ error: '需要管理员或客服权限' });
    }
    console.log('✅ 管理员/客服权限验证通过，用户角色:', req.user.role);
    next();
  } catch (error) {
    console.log('❌ 权限验证错误:', error.message);
    res.status(403).json({ error: '权限验证失败' });
  }
};

// 默认导出auth中间件
module.exports = auth;

// 同时导出其他认证中间件
module.exports.auth = auth;
module.exports.adminAuth = adminAuth;
module.exports.adminOrCsAuth = adminOrCsAuth;