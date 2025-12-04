const { Op } = require('sequelize');
const { MembershipPackage, User, Order, UserMembership } = require('../models');
const { sequelize } = require('../config/database');

class MembershipService {
  // 获取所有会员套餐（管理后台用，包括非激活状态）
  async getAllPackages(level = null) {
    const where = {};
    if (level) {
      where.level = level;
    }
    
    return await MembershipPackage.findAll({
      where,
      order: [['order_index', 'ASC'], ['id', 'ASC']]
    });
  }

  // 获取单个会员套餐
  async getPackageById(id) {
    return await MembershipPackage.findByPk(id);
  }

  // 创建会员套餐
  async createPackage(packageData) {
    // 验证必填字段
    if (!packageData.name || !packageData.price || !packageData.level || !packageData.type) {
      throw new Error('缺少必要的套餐信息');
    }

    // 设置默认值
    const data = {
      ...packageData,
      is_active: packageData.is_active !== undefined ? packageData.is_active : true,
      order_index: packageData.order_index !== undefined ? packageData.order_index : 0
    };

    return await MembershipPackage.create(data);
  }

  // 更新会员套餐
  async updatePackage(id, packageData) {
    const pkg = await MembershipPackage.findByPk(id);
    if (!pkg) {
      throw new Error('会员套餐不存在');
    }

    // 不允许更新的字段（如果有必要）
    const allowedFields = {
      name: packageData.name,
      description: packageData.description,
      price: packageData.price,
      duration_days: packageData.duration_days,
      level: packageData.level,
      type: packageData.type,
      features: packageData.features,
      is_active: packageData.is_active,
      order_index: packageData.order_index
    };

    // 过滤掉undefined值
    const updateData = {};
    Object.keys(allowedFields).forEach(key => {
      if (allowedFields[key] !== undefined) {
        updateData[key] = allowedFields[key];
      }
    });

    await pkg.update(updateData);
    return pkg;
  }

  // 删除会员套餐
  async deletePackage(id) {
    const pkg = await MembershipPackage.findByPk(id);
    if (!pkg) {
      throw new Error('会员套餐不存在');
    }

    // 检查是否有关联的用户会员记录
    const userMembershipsCount = await UserMembership.count({
      where: { membership_package_id: id }
    });

    if (userMembershipsCount > 0) {
      throw new Error('该套餐已有用户购买，无法删除');
    }

    await pkg.destroy();
    return { success: true };
  }

  // 更新会员套餐状态
  async updatePackageStatus(id, isActive) {
    const pkg = await MembershipPackage.findByPk(id);
    if (!pkg) {
      throw new Error('会员套餐不存在');
    }

    await pkg.update({ is_active: isActive });
    return pkg;
  }

  /**
   * 创建会员订单
   */
  async createOrder(userId, packageId, paymentMethod) {
    const transaction = await sequelize.transaction();
    
    try {
      // 获取套餐信息
      const packageInfo = await MembershipPackage.findByPk(packageId, { transaction });
      if (!packageInfo || !packageInfo.is_active) {
        throw new Error('会员套餐不存在或已停用');
      }

      // 生成订单号
      const orderNo = `M${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      // 创建订单
      const order = await Order.create({
        order_no: orderNo,
        amount: packageInfo.price,
        payment_method: paymentMethod,
        status: 'pending',
        order_type: 'membership',
        user_id: userId,
        membership_package_id: packageId
      }, { transaction });

      await transaction.commit();
      return order;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // 处理会员订单支付成功
  async processMembershipPayment(orderId) {
    const transaction = await sequelize.transaction();
    
    try {
      // 获取订单信息
      const order = await Order.findByPk(orderId, {
        include: [{ model: MembershipPackage }],
        transaction
      });
      
      if (!order || order.status !== 'pending') {
        throw new Error('订单不存在或状态不正确');
      }

      // 计算会员到期时间
      let expiryDate = null;
      if (order.MembershipPackage.duration_days) {
        expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + order.MembershipPackage.duration_days);
      }

      // 创建用户会员记录
      const userMembership = await UserMembership.create({
        user_id: order.user_id,
        membership_package_id: order.membership_package_id,
        start_date: new Date(),
        expiry_date: expiryDate,
        is_active: true
      }, { transaction });

      // 更新用户模型中的会员信息，实现授权有效期与会员套餐的关联
      const user = await User.findByPk(order.user_id, { transaction });
      if (user) {
        // 根据会员套餐类型更新用户的会员类型
        await user.update({
          membership_type: order.MembershipPackage.type,
          membership_expiry: expiryDate
        }, { transaction });
      }

      // 更新订单状态
      await order.update({
        status: 'paid',
        paid_at: new Date(),
        user_membership_id: userMembership.id
      }, { transaction });

      await transaction.commit();
      return { success: true, message: '会员开通成功' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // 获取用户所有会员信息
  async getUserMemberships(userId) {
    const userMemberships = await UserMembership.findAll({
      where: { user_id: userId },
      include: [{ model: MembershipPackage }],
      order: [['created_at', 'DESC']]
    });

    // 处理每个会员的激活状态
    const now = new Date();
    return userMemberships.map(membership => {
      let isActive = membership.is_active;
      if (isActive && membership.expiry_date) {
        const expiryDate = new Date(membership.expiry_date);
        isActive = now < expiryDate;
      }
      
      return {
        id: membership.id,
        start_date: membership.start_date,
        expiry_date: membership.expiry_date,
        is_active: isActive,
        package_info: membership.MembershipPackage
      };
    });
  }

  // 获取用户有效会员列表
  async getUserActiveMemberships(userId) {
    const now = new Date();
    
    return await UserMembership.findAll({
      where: {
        user_id: userId,
        is_active: true,
        [Op.or]: [
          { expiry_date: { [Op.is]: null } },
          { expiry_date: { [Op.gt]: now } }
        ]
      },
      include: [{ model: MembershipPackage }],
      order: [['created_at', 'DESC']]
    });
  }

  // 检查用户是否拥有某个类型的会员
  async checkMembership(userId, type) {
    const now = new Date();
    
    // 查询用户是否有指定类型或更高级别的有效会员
    let requiredTypes = [type];
    
    // 处理会员类型的层级关系
    if (type === 'single') {
      // 单册会员只能查看单册内容
      requiredTypes = ['single'];
    } else if (type === 'double') {
      // 双册会员可以查看单册和双册内容
      requiredTypes = ['single', 'double'];
    } else if (type === 'primary_full') {
      // 小学全册可以查看小学相关所有内容
      requiredTypes = ['single', 'double', 'primary_full'];
    } else if (type === 'junior_full') {
      // 初中全册可以查看初中相关所有内容
      requiredTypes = ['single', 'double', 'junior_full'];
    }
    
    const membership = await UserMembership.findOne({
      where: {
        user_id: userId,
        is_active: true,
        [Op.or]: [
          { expiry_date: { [Op.is]: null } },
          { expiry_date: { [Op.gt]: now } }
        ]
      },
      include: [{
        model: MembershipPackage,
        where: { type: { [Op.in]: requiredTypes } }
      }]
    });

    return !!membership;
  }

  // 检查用户是否有权限访问某类资料
  async checkAccessPermission(userId, materialType) {
    const now = new Date();
    
    // 根据资料类型和级别确定需要的会员类型
    let requiredTypes = [];
    
    // 判断是否为小学或初中资料
    const isPrimary = materialType.includes('primary') || materialType === 'primary';
    
    if (isPrimary) {
      // 小学资料：单册、双册、小学全册会员都可以访问
      requiredTypes = ['single', 'double', 'primary_full'];
    } else if (materialType.includes('junior') || materialType === 'junior') {
      // 初中资料：单册、双册、初中全册会员都可以访问
      requiredTypes = ['single', 'double', 'junior_full'];
    } else {
      // 通用资料：所有类型会员都可以访问
      requiredTypes = ['single', 'double', 'primary_full', 'junior_full'];
    }

    // 查询用户是否有有效的对应类型会员
    const membership = await UserMembership.findOne({
      where: {
        user_id: userId,
        is_active: true,
        [Op.or]: [
          { expiry_date: { [Op.is]: null } },
          { expiry_date: { [Op.gt]: now } }
        ]
      },
      include: [{
        model: MembershipPackage,
        where: { type: { [Op.in]: requiredTypes } }
      }]
    });

    return !!membership;
  }



  // 获取用户会员信息（兼容旧接口）
  async getUserMembershipInfo(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const activeMemberships = await this.getUserActiveMemberships(userId);
    return {
      userId: user.id,
      isActive: activeMemberships.length > 0,
      activeMemberships: activeMemberships,
      // 添加当前用户的会员类型和有效期信息
      membershipType: user.membership_type,
      membershipExpiry: user.membership_expiry
    };
  }
}

module.exports = new MembershipService();