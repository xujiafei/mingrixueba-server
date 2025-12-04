const UserService = require('../services/userService');
const { sequelize } = require('../config/database');

exports.getProfile = async (req, res) => {
  try {
    const user = await UserService.getUserProfile(req.user.userId);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await UserService.updateUserProfile(req.user.userId, req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getDownloadHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const history = await UserService.getUserDownloadHistory(
      req.user.userId, 
      parseInt(page), 
      parseInt(limit)
    );
    res.json({ success: true, ...history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 用户管理功能（管理员功能）
exports.getUserList = async (req, res) => {
  try {
    console.log('📍 getUserList 控制器被调用');
    console.log('用户:', req.user);
    const { page = 1, limit = 20, keyword = '' } = req.query;
    const users = await UserService.getUserList(
      parseInt(page), 
      parseInt(limit), 
      keyword
    );
    console.log('返回用户列表:', users);
    res.json({ success: true, ...users });
  } catch (error) {
    console.log('获取用户列表失败:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUserInfo = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await UserService.getUserInfo(userId);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUserDownloadHistory = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { page = 1, limit = 20 } = req.query;
    const history = await UserService.getUserDownloadHistory(
      userId, 
      parseInt(page), 
      parseInt(limit)
    );
    res.json({ success: true, ...history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const user = await UserService.createUser(req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await UserService.updateUser(userId, req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    await UserService.deleteUser(userId);
    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { is_active } = req.body;
    const user = await UserService.updateUserStatus(userId, is_active);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 积分管理功能

// 获取用户积分信息（用户端）
exports.getUserPoints = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 先处理积分过期
    await UserService.expirePoints(userId);
    
    // 获取用户信息
    const user = await UserService.getUserProfile(userId);
    
    // 获取活跃积分
    const activePoints = await UserService.getActivePoints(userId);
    
    res.json({
      success: true,
      data: {
        totalPoints: user.points,
        activePoints: activePoints,
        membershipType: user.membership_type
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 获取用户积分交易记录（用户端）
exports.getUserPointTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    
    const transactions = await UserService.getUserPointTransactions(
      userId,
      parseInt(page),
      parseInt(limit)
    );
    
    res.json({ success: true, ...transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 管理员设置用户积分
exports.setUserPoints = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { points } = req.body;
    
    // 验证积分参数
    if (points === undefined || isNaN(points) || points < 0) {
      return res.status(400).json({ success: false, error: '积分必须是非负数字' });
    }
    
    const newPoints = await UserService.setUserPoints(userId, parseInt(points));
    
    res.json({
      success: true,
      message: '用户积分设置成功',
      data: { points: newPoints }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 管理员查看用户积分交易记录
exports.getUserPointTransactionsByAdmin = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { page = 1, limit = 20, transaction_type, start_date, end_date } = req.query;
    
    const transactions = await UserService.getUserPointTransactions(
      userId,
      parseInt(page),
      parseInt(limit),
      {
        transaction_type,
        start_date,
        end_date
      }
    );
    
    res.json({ success: true, ...transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 获取用户积分详情，包括有效期倒计时信息
exports.getUserPointsWithExpiry = async (req, res) => {
  try {
    // 从认证中间件获取用户ID
    const userId = req.user.userId;
    
    const pointsInfo = await UserService.getUserPointsWithExpiry(userId);
    
    res.json({
      success: true,
      data: pointsInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 管理员扣除用户积分
exports.deductPointsFromUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { points, reason } = req.body;
    
    // 验证参数
    if (points === undefined || isNaN(points) || points <= 0) {
      return res.status(400).json({ success: false, error: '积分必须是正数字' });
    }
    
    const result = await UserService.deductPointsFromUser(
      userId,
      parseInt(points),
      reason || '管理员扣除'
    );
    
    res.json({
      success: true,
      message: '用户积分扣除成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 管理员重置用户积分
exports.resetUserPoints = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { reason } = req.body;
    
    const result = await UserService.resetUserPoints(
      userId,
      reason || '管理员重置'
    );
    
    res.json({
      success: true,
      message: '用户积分重置成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 管理员获取用户积分详情（包含有效期信息）
exports.getAdminUserPointsWithExpiry = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // 先处理积分过期
    await UserService.expirePoints(userId);
    
    const pointsInfo = await UserService.getUserPointsWithExpiry(userId);
    
    res.json({
      success: true,
      data: pointsInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 管理员为用户添加积分（购买积分）
exports.addPointsToUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { points, expiryDays = 365 } = req.body;
    
    // 验证参数
    if (points === undefined || isNaN(points) || points <= 0) {
      return res.status(400).json({ success: false, error: '积分必须是正数字' });
    }
    
    const result = await UserService.addPointsToUser(
      userId,
      parseInt(points),
      null, // 管理员添加积分不需要sourceId
      parseInt(expiryDays)
    );
    
    res.json({
      success: true,
      message: '用户积分添加成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 处理用户积分过期
exports.expireUserPoints = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    const expiredPoints = await UserService.expirePoints(userId);
    
    res.json({
      success: true,
      message: '积分过期处理完成',
      data: { expiredPoints: expiredPoints }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 会员类型管理（管理员功能）

// 设置用户会员类型
exports.setUserMembership = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { membership_type, expiry_days = 365 } = req.body;
    
    // 验证会员类型
    const validTypes = ['none', 'points', 'primary_full', 'junior_full'];
    if (!validTypes.includes(membership_type)) {
      return res.status(400).json({ success: false, error: '无效的会员类型' });
    }
    
    const result = await UserService.setUserMembership(
      userId,
      membership_type,
      parseInt(expiry_days)
    );
    
    res.json({
      success: true,
      message: '用户会员类型设置成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 延长会员有效期
exports.extendMembershipExpiry = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { additional_days } = req.body;
    
    // 验证参数
    if (additional_days === undefined || isNaN(additional_days) || additional_days <= 0) {
      return res.status(400).json({ success: false, error: '延长天数必须是正整数' });
    }
    
    const result = await UserService.extendMembershipExpiry(
      userId,
      parseInt(additional_days)
    );
    
    res.json({
      success: true,
      message: '会员有效期延长成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 检查用户会员状态
exports.checkMembershipStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    const status = await UserService.checkMembership(userId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 获取用户会员信息（用户端）
exports.getMembershipInfo = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const status = await UserService.checkMembership(userId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 资料兑换相关功能

// 兑换学期资料
exports.exchangeSemesterMaterials = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { semester_id } = req.body;
    
    if (!semester_id) {
      return res.status(400).json({ success: false, error: '学期ID不能为空' });
    }
    
    const result = await UserService.exchangeSemesterMaterials(userId, semester_id);
    
    res.json({
      success: true,
      message: '学期资料兑换成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 获取用户已兑换的学期列表
exports.getUserExchangedSemesters = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const semesters = await UserService.getUserExchangedSemesters(userId);
    
    res.json({
      success: true,
      data: semesters
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 检查学期是否已兑换
exports.checkSemesterExchanged = async (req, res) => {
  try {
    const userId = req.user.userId;
    const semesterId = req.params.semester_id;
    
    const status = await UserService.checkSemesterExchanged(userId, semesterId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 获取可兑换的学期列表
exports.getAvailableSemesters = async (req, res) => {
  try {
    const semesters = await UserService.getAvailableSemestersForExchange();
    
    res.json({
      success: true,
      data: semesters
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 管理员检查用户学期兑换状态
exports.adminCheckSemesterExchanged = async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id);
    const semesterId = req.params.semester_id;
    
    const status = await UserService.checkSemesterExchanged(userId, semesterId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 获取用户积分详情（包含过期信息）- 管理员/客服接口
exports.getUserPointsWithExpiry = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // 先处理积分过期
    await UserService.expirePoints(userId);
    
    // 获取用户信息
    const user = await UserService.getUserInfo(userId);
    
    // 获取活跃积分和即将过期积分
    const activePoints = await UserService.getActivePoints(userId);
    const expiringPoints = await UserService.getExpiringPoints(userId);
    
    res.json({
      success: true,
      data: {
        totalPoints: user.points,
        activePoints: activePoints,
        expiringPoints: expiringPoints,
        membershipType: user.membership_type,
        membershipExpiry: user.membership_expiry
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 增加用户积分 - 管理员/客服接口
exports.addUserPoints = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { points, reason, expiry_days } = req.body;
    
    // 验证参数
    if (!points || isNaN(points) || points <= 0) {
      return res.status(400).json({ success: false, error: '积分必须是正整数' });
    }
    
    if (!reason) {
      return res.status(400).json({ success: false, error: '必须提供积分变动原因' });
    }
    
    // 执行积分增加
    const result = await UserService.addUserPoints(
      userId,
      parseInt(points),
      reason,
      req.user.userId, // 操作人ID
      expiry_days
    );
    
    res.json({
      success: true,
      message: '积分增加成功',
      data: {
        points: result.points,
        transactionId: result.transactionId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 扣除用户积分 - 管理员/客服接口
exports.deductUserPoints = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { points, reason } = req.body;
    
    // 验证参数
    if (!points || isNaN(points) || points <= 0) {
      return res.status(400).json({ success: false, error: '积分必须是正整数' });
    }
    
    if (!reason) {
      return res.status(400).json({ success: false, error: '必须提供积分变动原因' });
    }
    
    // 执行积分扣除
    const result = await UserService.deductUserPoints(
      userId,
      parseInt(points),
      reason,
      req.user.userId // 操作人ID
    );
    
    res.json({
      success: true,
      message: '积分扣除成功',
      data: {
        points: result.points,
        transactionId: result.transactionId
      }
    });
  } catch (error) {
    if (error.message === '积分不足') {
      return res.status(400).json({ success: false, error: '用户积分不足' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

// 重置用户积分 - 管理员/客服接口
exports.resetUserPoints = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { reason } = req.body;
    
    // 验证参数
    if (!reason) {
      return res.status(400).json({ success: false, error: '必须提供积分重置原因' });
    }
    
    // 执行积分重置
    const result = await UserService.resetUserPoints(
      userId,
      reason,
      req.user.userId // 操作人ID
    );
    
    res.json({
      success: true,
      message: '积分重置成功',
      data: {
        points: result.points,
        transactionId: result.transactionId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};