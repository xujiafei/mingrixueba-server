const errorHandler = (err, req, res, next) => {
  console.error('=== 错误处理中间件 ===');
  console.error('错误名称:', err.name);
  console.error('错误消息:', err.message);
  console.error('错误堆栈:', err.stack);
  console.error('完整错误对象:', JSON.stringify(err, null, 2));

  // Sequelize错误
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      error: '数据验证失败',
      details: err.errors.map(e => e.message)
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      error: '数据已存在',
      details: err.errors.map(e => e.message)
    });
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: '无效的token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'token已过期'
    });
  }

  // 默认错误 - 在开发环境中返回详细信息
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '服务器内部错误',
    ...(isDevelopment && { 
      errorName: err.name,
      errorStack: err.stack 
    })
  });
};

module.exports = errorHandler;