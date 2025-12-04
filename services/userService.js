const { User, Order, DownloadLog, Material, PointTransaction, MaterialExchange } = require('../models');
const { Op } = require('sequelize');

class UserService {
  // 创建或查找用户
  static async findOrCreateUser(openid, userInfo = {}) {
    const [user, created] = await User.findOrCreate({
      where: { openid },
      defaults: {
        openid,
        nickname: userInfo.nickName || `用户${openid.substring(0, 8)}`,
        avatar_url: userInfo.avatarUrl || '/default-avatar.png',
        role: 'user',
        is_active: true,
        points: 0,
        membership_type: 'none',
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    // 更新用户信息和登录记录
    const updateData = {
      last_login_at: new Date(),
      updated_at: new Date()
    };
    
    // 如果用户提供了新的昵称或头像，更新它们
    if (userInfo.nickName && userInfo.nickName !== user.nickname) {
      updateData.nickname = userInfo.nickName;
    }
    
    if (userInfo.avatarUrl && userInfo.avatarUrl !== user.avatar_url) {
      updateData.avatar_url = userInfo.avatarUrl;
    }
    
    // 如果是首次登录，设置注册时间
    if (created) {
      console.log(`新用户注册: ${user.nickname} (ID: ${user.id})`);
    } else {
      // 更新用户信息
      await user.update(updateData);
      console.log(`用户登录: ${user.nickname} (ID: ${user.id})`);
    }
    
    // 刷新用户实例以获取最新数据
    return await User.findByPk(user.id);
  }

  // 获取用户信息（不包含敏感信息）
  static async getUserProfile(userId) {
    return await User.findByPk(userId, {
      attributes: { 
        exclude: ['openid', 'created_at', 'updated_at'] 
      },
      include: [{
        model: Order,
        attributes: ['id', 'order_type', 'amount', 'status'],
        limit: 10,
        order: [['id', 'DESC']] // 使用id代替created_at进行排序
      }]
    });
  }

  // 更新用户积分
  static async updateUserPoints(userId, points, transaction = null) {
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      throw new Error('用户不存在');
    }

    const newPoints = parseInt(user.points) + parseInt(points);
    if (newPoints < 0) {
      throw new Error('积分不足');
    }

    await user.update({ points: newPoints }, { transaction });
    return newPoints;
  }

  // 为用户添加积分（购买积分）
  static async addPointsToUser(userId, points, sourceId = null, expiryDays = 365, transaction = null) {
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      throw new Error('用户不存在');
    }

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // 创建积分交易记录
    const pointTransaction = await PointTransaction.create({
      user_id: userId,
      points: points,
      type: 'purchase',
      source_id: sourceId,
      expires_at: expiresAt,
      status: 'active'
    }, { transaction });

    // 更新用户积分
    const newTotalPoints = await this.updateUserPoints(userId, points, transaction);

    // 设置用户会员类型为积分会员
    if (user.membership_type === 'none') {
      await user.update({ membership_type: 'points' }, { transaction });
    }

    return {
      transactionId: pointTransaction.id,
      totalPoints: newTotalPoints,
      expiresAt: expiresAt
    };
  }

  // 获取用户积分详情，包括有效期倒计时信息
  static async getUserPointsWithExpiry(userId) {
    // 先处理过期积分
    await this.expirePoints(userId);
    
    // 获取用户当前总积分
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    
    // 获取活跃的积分交易记录，按过期时间排序
    const activeTransactions = await PointTransaction.findAll({
      where: {
        user_id: userId,
        type: 'purchase',
        status: 'active'
      },
      order: [['expires_at', 'ASC']]
    });
    
    // 计算每个积分交易的过期倒计时
    const now = new Date();
    const pointsWithExpiry = activeTransactions.map(transaction => {
      const expiryDate = transaction.expires_at;
      const remainingTime = expiryDate ? expiryDate - now : null;
      const daysRemaining = remainingTime ? Math.ceil(remainingTime / (1000 * 60 * 60 * 24)) : null;
      
      return {
        transaction_id: transaction.id,
        points: transaction.points,
        acquired_date: transaction.created_at,
        expires_at: expiryDate,
        days_remaining: daysRemaining,
        is_expiring_soon: daysRemaining !== null && daysRemaining <= 30
      };
    });
    
    // 计算即将过期的积分总额
    const expiringSoonPoints = pointsWithExpiry
      .filter(item => item.is_expiring_soon)
      .reduce((sum, item) => sum + item.points, 0);
    
    return {
      total_points: user.points,
      active_transactions: pointsWithExpiry,
      expiring_soon_points: expiringSoonPoints,
      active_points_count: pointsWithExpiry.reduce((sum, item) => sum + item.points, 0)
    };
  }

  // 从用户扣除积分（支持兑换资料和管理员扣除）
  static async deductPointsFromUser(userId, points, reason = null, transaction = null) {
    // 首先检查是否有足够的活跃积分
    const activePoints = await this.getActivePoints(userId, transaction);
    if (activePoints < points) {
      throw new Error('可用积分不足');
    }

    // 判断是管理员操作还是正常兑换
    const isAdminOperation = reason !== null;
    const transactionType = isAdminOperation ? 'admin_deduction' : 'exchange';
    
    // 创建积分交易记录（负数表示扣除）
    await PointTransaction.create({
      user_id: userId,
      points: -points,
      type: transactionType,
      source_id: isAdminOperation ? null : reason, // reason参数在管理员操作时是备注，在普通操作时是sourceId
      status: 'used',
      remark: isAdminOperation ? reason : null
    }, { transaction });

    // 更新用户积分
    const newTotalPoints = await this.updateUserPoints(userId, -points, transaction);

    // 更新积分交易状态（从最旧的开始使用积分）
    await this.useUserPoints(userId, points, transaction);

    return {
      userId: userId,
      newPoints: newTotalPoints,
      deductedPoints: points
    };
  }

  // 重置用户积分
  static async resetUserPoints(userId, reason = '管理员重置', transaction = null) {
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      throw new Error('用户不存在');
    }

    const currentPoints = user.points;
    if (currentPoints <= 0) {
      return {
        userId: userId,
        newPoints: 0,
        message: '用户积分已为0，无需重置'
      };
    }

    // 记录重置操作
    await PointTransaction.create({
      user_id: userId,
      points: -currentPoints,
      type: 'reset',
      status: 'used',
      remark: reason
    }, { transaction });

    // 更新用户积分为0
    await user.update({ points: 0 }, { transaction });

    // 将所有活跃积分标记为已使用
    const activeTransactions = await PointTransaction.findAll({
      where: {
        user_id: userId,
        status: 'active',
        type: 'purchase'
      },
      transaction
    });

    for (const trans of activeTransactions) {
      await trans.update({ status: 'used' }, { transaction });
    }

    return {
      userId: userId,
      newPoints: 0,
      resetPoints: currentPoints
    };
  }

  // 获取用户的活跃积分
  static async getActivePoints(userId, transaction = null) {
    const now = new Date();
    const activeTransactions = await PointTransaction.findAll({
      where: {
        user_id: userId,
        type: 'purchase',
        status: 'active',
        expires_at: { [Op.gt]: now }
      },
      order: [['created_at', 'ASC']], // 按时间顺序，先使用旧积分
      transaction
    });

    return activeTransactions.reduce((total, trans) => total + trans.points, 0);
  }

  // 使用用户积分（更新交易状态）
  static async useUserPoints(userId, pointsToUse, transaction = null) {
    const now = new Date();
    let remainingPoints = pointsToUse;

    // 获取所有活跃积分，从最旧的开始使用
    const activeTransactions = await PointTransaction.findAll({
      where: {
        user_id: userId,
        type: 'purchase',
        status: 'active',
        expires_at: { [Op.gt]: now }
      },
      order: [['created_at', 'ASC']],
      transaction
    });

    for (const transaction of activeTransactions) {
      if (remainingPoints <= 0) break;

      if (transaction.points <= remainingPoints) {
        // 使用整个交易的积分
        await transaction.update({ status: 'used' }, { transaction });
        remainingPoints -= transaction.points;
      } else {
        // 部分使用交易的积分 - 需要先将当前交易拆分为两个
        // 1. 将当前交易更新为已使用状态
        await transaction.update({ status: 'used' }, { transaction });
        // 2. 创建一个新的交易，包含剩余积分
        await PointTransaction.create({
          user_id: userId,
          points: transaction.points - remainingPoints,
          type: 'purchase',
          source_id: transaction.source_id,
          expires_at: transaction.expires_at,
          status: 'active'
        }, { transaction });
        remainingPoints = 0;
      }
    }
  }

  // 处理积分过期
  static async expirePoints(userId, transaction = null) {
    const now = new Date();
    
    // 查找所有过期的积分交易
    const expiredTransactions = await PointTransaction.findAll({
      where: {
        user_id: userId,
        type: 'purchase',
        status: 'active',
        expires_at: { [Op.lte]: now }
      },
      transaction
    });

    let totalExpiredPoints = 0;
    
    // 更新过期交易的状态
    for (const trans of expiredTransactions) {
      await trans.update({ status: 'expired' }, { transaction });
      totalExpiredPoints += trans.points;
    }

    // 如果有过期积分，更新用户总积分并记录过期交易
    if (totalExpiredPoints > 0) {
      // 记录过期交易
      await PointTransaction.create({
        user_id: userId,
        points: -totalExpiredPoints,
        type: 'expire',
        status: 'used'
      }, { transaction });

      // 更新用户积分
      await this.updateUserPoints(userId, -totalExpiredPoints, transaction);
    }

    return totalExpiredPoints;
  }

  // 获取用户积分交易记录
  static async getUserPointTransactions(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    const { count, rows } = await PointTransaction.findAndCountAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    return {
      data: rows,
      pagination: {
        current: parseInt(page),
        total: count,
        pageSize: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  // 管理员设置用户积分
  static async setUserPoints(userId, points, transaction = null) {
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      throw new Error('用户不存在');
    }

    // 计算积分变化
    const pointDifference = points - user.points;
    
    // 更新用户积分
    await user.update({ points: points }, { transaction });

    // 记录积分调整（管理员操作）
    if (pointDifference !== 0) {
      await PointTransaction.create({
        user_id: userId,
        points: pointDifference,
        type: 'purchase', // 管理员操作也记为purchase类型
        source_id: null,
        status: pointDifference > 0 ? 'active' : 'used',
        expires_at: pointDifference > 0 ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null // 新增积分有效期1年
      }, { transaction });

      // 如果是积分增加，设置用户会员类型为积分会员
      if (pointDifference > 0 && user.membership_type === 'none') {
        await user.update({ membership_type: 'points' }, { transaction });
      }
    }

    return points;
  }

  // 检查会员状态
  static async checkMembership(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      return { isValid: false, reason: '用户不存在' };
    }

    if (user.membership_type === 'none') {
      return { isValid: false, reason: '非会员用户' };
    }

    // 检查会员是否过期
    if (user.membership_expiry && new Date() > user.membership_expiry) {
      await user.update({ 
        membership_type: 'none',
        membership_expiry: null 
      });
      return { isValid: false, reason: '会员已过期' };
    }

    return { 
      isValid: true, 
      type: user.membership_type,
      expiry: user.membership_expiry 
    };
  }

  // 设置用户会员类型
  static async setUserMembership(userId, membershipType, expiryDays = 365, transaction = null) {
    // 验证会员类型
    const validTypes = ['none', 'single', 'double', 'primary_full', 'junior_full'];
    if (!validTypes.includes(membershipType)) {
      throw new Error('无效的会员类型');
    }

    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      throw new Error('用户不存在');
    }

    // 计算到期时间（除了非会员外都需要设置有效期）
    let expiryDate = null;
    if (membershipType !== 'none') {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);
    }

    // 更新用户会员信息
    await user.update({
      membership_type: membershipType,
      membership_expiry: expiryDate
    }, { transaction });

    return {
      userId: user.id,
      membershipType: membershipType,
      expiryDate: expiryDate
    };
  }

  // 延长会员有效期
  static async extendMembershipExpiry(userId, additionalDays, transaction = null) {
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      throw new Error('用户不存在');
    }

    // 只有付费会员可以延长有效期
    if (user.membership_type === 'none') {
      throw new Error('非会员用户无法延长有效期');
    }

    // 计算新的到期时间
    const now = new Date();
    let newExpiryDate;
    
    if (user.membership_expiry && user.membership_expiry > now) {
      // 如果当前会员仍在有效期内，从当前到期时间延长
      newExpiryDate = new Date(user.membership_expiry);
    } else {
      // 如果会员已过期，从当前时间开始延长
      newExpiryDate = now;
    }
    
    newExpiryDate.setDate(newExpiryDate.getDate() + additionalDays);

    // 更新到期时间
    await user.update({
      membership_expiry: newExpiryDate
    }, { transaction });

    return {
      userId: user.id,
      membershipType: user.membership_type,
      expiryDate: newExpiryDate
    };
  }

  // 检查用户是否有权限访问特定资料
  static async checkMaterialAccess(userId, material, transaction = null) {
    // 先检查会员状态
    const membershipStatus = await this.checkMembership(userId);
    
    // 如果是会员，检查会员类型是否有权限访问该资料
    if (membershipStatus.isValid) {
      // 小学全册会员可以访问所有小学资料
      if (membershipStatus.type === 'primary_full' && 
          (material.grade_level === '小学一年级' || 
           material.grade_level === '小学二年级' || 
           material.grade_level === '小学三年级' ||
           material.grade_level === '小学四年级' ||
           material.grade_level === '小学五年级' ||
           material.grade_level === '小学六年级')) {
        return { hasAccess: true, reason: '小学全册会员' };
      }
      
      // 初中全册会员可以访问所有初中资料
      if (membershipStatus.type === 'junior_full' && 
          (material.grade_level === '初中一年级' || 
           material.grade_level === '初中二年级' || 
           material.grade_level === '初中三年级')) {
        return { hasAccess: true, reason: '初中全册会员' };
      }
      
      // 双册会员可以访问对应的两个学期资料
      // 注意：这里需要根据实际业务逻辑实现双册会员的具体权限判断
      if (membershipStatus.type === 'double') {
        // TODO: 根据实际业务逻辑判断双册会员的具体权限
        // 可能需要从数据库获取用户购买的具体学期信息
        return { hasAccess: true, reason: '双册会员' };
      }
      
      // 单册会员可以访问对应的一个学期资料
      // 注意：这里需要根据实际业务逻辑实现单册会员的具体权限判断
      if (membershipStatus.type === 'single') {
        // TODO: 根据实际业务逻辑判断单册会员的具体权限
        // 可能需要从数据库获取用户购买的具体学期信息
        return { hasAccess: true, reason: '单册会员' };
      }
    }
    
    // 检查是否已兑换过该资料所属学期
    const exchange = await MaterialExchange.findOne({
      where: {
        user_id: userId,
        semester_id: material.semester_id || material.category_id, // 假设学期ID存储在这两个字段之一
        activated: true
      },
      transaction
    });
    
    if (exchange) {
      return { hasAccess: true, reason: '已兑换该学期资料' };
    }
    
    return { hasAccess: false, reason: '无访问权限' };
  }

  // 获取用户下载记录
  static async getUserDownloadHistory(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    const { count, rows } = await DownloadLog.findAndCountAll({
      where: { user_id: userId },
      include: [{
        model: Material,
        attributes: ['id', 'title', 'subject', 'grade_level', 'cover_image']
      }],
      order: [['downloaded_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    return {
      data: rows,
      pagination: {
        current: parseInt(page),
        total: count,
        pageSize: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  // 获取用户列表（管理员功能）
  static async getUserList(page = 1, limit = 20, keyword = '') {
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (keyword) {
      whereClause[Op.or] = [
        { username: { [Op.like]: `%${keyword}%` } },
        { nickname: { [Op.like]: `%${keyword}%` } }
      ];
    }

    console.log('User模型字段:', Object.keys(User.rawAttributes));
    console.log('查询参数:', {
      where: whereClause,
      attributes: ['id', 'username', 'nickname', 'avatar_url', 'is_active', 'points', 'membership_type', 'membership_expiry', 'created_at', 'updated_at'],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'username', 'nickname', 'avatar_url',  'is_active', 'points', 'membership_type', 'membership_expiry', 'created_at', 'updated_at'],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset,
      logging: console.log // 启用SQL日志
    });

    // 处理返回数据，添加membershipTypes字段支持
    // 注意：这里需要根据实际的数据库结构实现多类型会员的获取逻辑
    // 目前我们通过简单的方式模拟：如果用户有非none的会员类型，就将其添加到membershipTypes数组中
    const processedRows = rows.map(user => {
      const userData = user.toJSON();
      
      // 初始化membershipTypes数组
      userData.membershipTypes = [];
      
      // 如果用户有会员类型且不是none，则添加到membershipTypes数组
      if (userData.membership_type && userData.membership_type !== 'none') {
        userData.membershipTypes.push(userData.membership_type);
      }
      
      // TODO: 实际实现时，应该从UserMembership关联表中获取用户的所有会员类型
      // 此处应该查询关联表，获取用户的所有会员类型和对应的有效期
      
      return userData;
    });

    return {
      data: processedRows,
      pagination: {
        current: parseInt(page),
        total: count,
        pageSize: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  // 获取单个用户信息（管理员功能）
  static async getUserInfo(userId) {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['openid'] },
      include: [
        {
          model: Order,
          attributes: ['id', 'order_type', 'amount', 'status', 'created_at'],
          limit: 10,
          order: [['created_at', 'DESC']]
        },
        {
          model: DownloadLog,
          include: [{
            model: Material,
            attributes: ['id', 'title', 'subject', 'grade_level']
          }],
          limit: 10,
          order: [['downloaded_at', 'DESC']]
        }
      ]
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    return user;
  }

  // 创建用户（管理员功能）
  static async createUser(userData) {
    const { username, nickname} = userData;
    
    // 检查用户名是否已存在
    const existingUser = await User.findOne({
      where: { username }
    });
    
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    const user = await User.create({
      username,
      nickname,
      openid: null // 管理员创建的用户没有openid
    });

    return user;
  }

  // 更新用户（管理员功能）
  static async updateUser(userId, userData) {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('用户不存在');
    }

    const { username, nickname, membership_type, membership_expiry, membershipTypes } = userData;
    const updateData = {};
    
    // 如果更新用户名，检查是否已存在
    if (username && username !== user.username) {
      const existingUser = await User.findOne({
        where: { username }
      });
      
      if (existingUser) {
        throw new Error('用户名已存在');
      }
      updateData.username = username;
    }
    
    // 更新昵称
    if (nickname !== undefined) {
      updateData.nickname = nickname;
    }
    
    // 更新会员类型和过期时间
    if (membership_type !== undefined) {
      // 验证会员类型
      const validTypes = ['none', 'single', 'double', 'primary_full', 'junior_full'];
      if (!validTypes.includes(membership_type)) {
        throw new Error('无效的会员类型');
      }
      updateData.membership_type = membership_type;
      
      // 如果是取消会员，设置过期时间为null
      if (membership_type === 'none') {
        updateData.membership_expiry = null;
      }
    }
    
    // 如果明确提供了过期时间，使用它
    if (membership_expiry !== undefined && membership_expiry !== null) {
      updateData.membership_expiry = membership_expiry;
    }
    
    // 处理多类型会员信息（这里只是日志记录，实际实现需要关联表）
    if (membershipTypes && Array.isArray(membershipTypes) && membershipTypes.length > 0) {
      console.log(`用户 ${userId} 的多类型会员:`, membershipTypes);
      // TODO: 实现多类型会员的存储逻辑，需要创建关联表
    }

    // 如果需要更新会员信息
    if (Object.keys(updateData).length > 0) {
      await user.update(updateData);
    }
    
    // 处理多类型会员
    if (membershipTypes && Array.isArray(membershipTypes)) {
      console.log('处理多类型会员:', userId, membershipTypes);
      
      // 这里需要根据数据库结构实现多类型会员的存储逻辑
      // 注意：由于我们看到数据库中有UserMembership关联表，应该使用该表存储多类型会员
      // 目前先记录日志，实际实现需要根据具体的数据库结构和业务逻辑
      
      // TODO: 实现与UserMembership关联表的交互逻辑
      // 1. 清除用户现有的会员类型关联
      // 2. 为每个选择的会员类型创建新的关联记录
    }

    // 返回更新后的用户信息，包括会员相关字段
    const updatedUser = await User.findByPk(userId, {
      attributes: ['id', 'username', 'nickname', 'membership_type', 'membership_expiry']
    });
    
    // 如果有membershipTypes，添加到返回结果中
    if (membershipTypes && Array.isArray(membershipTypes)) {
      updatedUser.membershipTypes = membershipTypes;
    }

    return updatedUser;
  }

  // 删除用户（管理员功能）
  static async deleteUser(userId) {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('用户不存在');
    }

    await user.destroy();
    return true;
  }

  // 更新用户状态（管理员功能）
  static async updateUserStatus(userId, isActive) {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('用户不存在');
    }

    await user.update({ is_active: isActive });
    return user;
  }
}

// 资料兑换功能
async function exchangeSemesterMaterials(userId, semesterId) {
  try {
    const transaction = await sequelize.transaction();
    
    try {
      // 获取用户信息
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        throw new Error('用户不存在');
      }
      
      // 检查是否已经兑换过该学期
      const existingExchange = await MaterialExchange.findOne({
        where: { user_id: userId, semester_id: semesterId, activated: true },
        transaction
      });
      
      if (existingExchange) {
        throw new Error('该学期资料已经兑换过');
      }
      
      // 获取学期信息（通过Category表）
      const semester = await Category.findByPk(semesterId, {
        transaction
      });
      
      if (!semester) {
        throw new Error('学期信息不存在');
      }
      
      // 根据学期级别确定积分消耗
      // 单册（单学期单学科）5积分，双册（单学期双学科）10积分
      // 这里假设从Category中可以判断是单册还是双册
      let pointsRequired = 5; // 默认单册
      
      // 可以根据Category的特性判断是否为双册
      // 这里使用一个简单的判断逻辑，实际可能需要更复杂的规则
      const materialsCount = await Material.count({
        where: { category_id: semesterId },
        transaction
      });
      
      if (materialsCount > 1) {
        pointsRequired = 10; // 双册
      }
      
      // 检查用户积分是否足够
      if (user.points < pointsRequired) {
        throw new Error('积分不足');
      }
      
      // 扣除积分
      const transactionRecord = await UserService.deductPointsFromUser(
        userId,
        pointsRequired,
        semesterId, // 在普通操作中，这里是sourceId
        transaction
      );
      
      // 创建兑换记录
      const exchange = await MaterialExchange.create({
        user_id: userId,
        semester_id: semesterId,
        point_cost: pointsRequired,
        transaction_id: transactionRecord.id
      }, { transaction });
      
      // 如果是会员积分用户，不设置过期时间，否则设置默认1年过期
      let expiryDate = null;
      if (user.membership_type !== 'points') {
        expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      }
      
      // 获取该学期下的所有资料
      const materials = await Material.findAll({
        where: { category_id: semesterId },
        transaction
      });
      
      // 为每个资料创建下载记录（表示激活）
      for (const material of materials) {
        await DownloadLog.create({
          user_id: userId,
          material_id: material.id,
          expiry_date: expiryDate,
          exchange_id: exchange.id,
          access_type: 'exchange'
        }, { transaction });
      }
      
      await transaction.commit();
      
      return {
        exchange_id: exchange.id,
        semester_id: semesterId,
        points_used: pointsRequired,
        remaining_points: user.points - pointsRequired,
        materials_count: materials.length
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('兑换学期资料失败:', error);
    throw error;
  }
}

// 获取用户已兑换的学期列表
async function getUserExchangedSemesters(userId) {
  try {
    const exchanges = await MaterialExchange.findAll({
      where: { user_id: userId, activated: true },
      include: [
        {
          model: Category,
          as: 'semester',
          attributes: ['id', 'name', 'level']
        }
      ],
      order: [['exchange_date', 'DESC']]
    });
    
    return exchanges.map(exchange => ({
      exchange_id: exchange.id,
      semester: exchange.semester,
      exchange_date: exchange.exchange_date,
      point_cost: exchange.point_cost
    }));
  } catch (error) {
    console.error('获取用户已兑换学期失败:', error);
    throw error;
  }
}

// 检查学期是否已兑换
async function checkSemesterExchanged(userId, semesterId) {
  try {
    const exchange = await MaterialExchange.findOne({
      where: { user_id: userId, semester_id: semesterId, activated: true }
    });
    
    return {
      exchanged: !!exchange,
      exchange_date: exchange?.exchange_date,
      point_cost: exchange?.point_cost
    };
  } catch (error) {
    console.error('检查学期兑换状态失败:', error);
    throw error;
  }
}

// 获取用户可兑换的学期列表
async function getAvailableSemestersForExchange() {
  try {
    // 假设Category的level=2表示学期级别
    const semesters = await Category.findAll({
      where: { level: 2 },
      include: [
        {
          model: Material,
          attributes: ['id', 'title'],
          where: { status: 'published' },
          required: true
        }
      ],
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
    
    // 计算每个学期的积分需求
    return semesters.map(semester => {
      const materialsCount = semester.Materials.length;
      const pointsRequired = materialsCount > 1 ? 10 : 5;
      
      return {
        semester_id: semester.id,
        name: semester.name,
        subject: semester.subject,
        materials_count: materialsCount,
        points_required: pointsRequired
      };
    });
  } catch (error) {
    console.error('获取可兑换学期列表失败:', error);
    throw error;
  }
}

// 导出服务模块
module.exports = UserService;