const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const UserService = require('../services/userService');
const { wxLogin } = require('../utils/wxAuth');
const { User } = require('../models');

// 客服登录
exports.csLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // 验证参数
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }
    
    // 查找用户
    const user = await User.findOne({
      where: { username, role: ['customer_service', 'admin'] }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或无权限'
      });
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '密码错误'
      });
    }
    
    // 检查用户状态
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: '账号已被禁用'
      });
    }
    
    // 生成token
    const token = jwt.sign(
      {
        user_id: user.id,
        username: user.username,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24小时过期
      },
      process.env.JWT_SECRET || 'default_secret_key'
    );
    
    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname || '客服',
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('客服登录错误:', error);
    next(error);
  }
};

exports.wxLogin = async (req, res, next) => {
  try {
    const { code, userInfo, platform } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: '缺少登录code'
      });
    }

    console.log('微信登录请求:', { code, platform });
    
    // 微信登录，验证code获取openid
    const wxResult = await wxLogin(code);
    
    if (!wxResult.openid) {
      console.error('微信登录失败，未获取到openid:', wxResult);
      return res.status(401).json({
        success: false,
        error: '微信登录失败: ' + (wxResult.errmsg || '未知错误')
      });
    }

    console.log('成功获取微信openid:', wxResult.openid);

    // 创建或查找用户
    const user = await UserService.findOrCreateUser(wxResult.openid, userInfo);

    // 生成token，设置合理的过期时间
    const token = jwt.sign(
      { 
        userId: user.id, 
        openid: user.openid,
        platform: platform || 'wechat_mini'
      },
      process.env.JWT_SECRET || 'default_secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('用户登录成功，ID:', user.id);
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatar_url: user.avatar_url,
          points: user.points || 0,
          membership_type: user.membership_type,
          membership_expiry: user.membership_expiry
        }
      }
    });

  } catch (error) {
    console.error('微信登录处理异常:', error);
    res.status(500).json({
      success: false,
      error: '登录处理失败，请重试'
    });
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { userId } = req.user; // 从auth中间件获取用户信息
    
    // 查找用户
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }
    
    // 生成新token
    const newToken = jwt.sign(
      { 
        userId: user.id, 
        openid: user.openid
      },
      process.env.JWT_SECRET || 'default_secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({
      success: true,
      data: {
        token: newToken
      }
    });
  } catch (error) {
    console.error('Token刷新失败:', error);
    res.status(500).json({
      success: false,
      error: 'Token刷新失败'
    });
  }
};

exports.logout = async (req, res, next) => {
  try {
    // 小程序端可以清除本地存储的token
    res.json({
      success: true,
      message: '退出成功'
    });
  } catch (error) {
    next(error);
  }
};