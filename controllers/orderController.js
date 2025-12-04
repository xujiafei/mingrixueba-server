const { Order, User, Material, DownloadLog, sequelize } = require('../models');
const OrderService = require('../services/orderService');
const UserService = require('../services/userService');

/**
 * 获取用户订单列表
 */
exports.getOrders = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { 
      page = 1, 
      limit = 20, 
      status, 
      order_type,
      start_date,
      end_date 
    } = req.query;

    const where = { user_id: userId };
    
    // 构建查询条件
    if (status) where.status = status;
    if (order_type) where.order_type = order_type;
    
    // 时间范围查询
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[sequelize.Op.gte] = new Date(start_date);
      if (end_date) where.created_at[sequelize.Op.lte] = new Date(end_date);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: Material,
          attributes: ['id', 'title', 'cover_image', 'subject', 'grade_level']
        },
        {
          model: User,
          attributes: ['id', 'nickname']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      data: {
        orders: rows,
        pagination: {
          current: parseInt(page),
          total: count,
          pageSize: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 获取订单详情
 */
exports.getOrderDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const order = await Order.findOne({
      where: { 
        id, 
        user_id: userId 
      },
      include: [
        {
          model: Material,
          attributes: { exclude: ['file_url'] } // 敏感信息不返回
        },
        {
          model: User,
          attributes: ['id', 'nickname', 'avatar_url']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: '订单不存在'
      });
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 创建会员订单
 */
exports.createMembershipOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.userId;
    const { membership_type } = req.body;

    // 验证会员类型
    const validTypes = ['monthly', 'yearly'];
    if (!validTypes.includes(membership_type)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: '无效的会员类型'
      });
    }

    // 检查用户是否已经是会员且未过期
    const membershipStatus = await UserService.checkMembership(userId);
    if (membershipStatus.isValid) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: `您已经是${membershipStatus.type === 'monthly' ? '月费' : '年费'}会员，无需重复购买`
      });
    }

    // 设置价格
    const prices = {
      monthly: 29.9,
      yearly: 299.9
    };

    const amount = prices[membership_type];

    // 创建订单
    const order = await OrderService.createOrder({
      user_id: userId,
      order_type: 'membership',
      amount: amount,
      membership_type: membership_type
    }, transaction);

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        order: {
          id: order.id,
          order_no: order.order_no,
          order_type: order.order_type,
          amount: order.amount,
          status: order.status,
          membership_type: order.membership_type,
          created_at: order.created_at
        },
        payment_info: {
          // 这里可以返回支付所需的参数
          // 实际项目中需要调用微信支付接口
          order_no: order.order_no,
          amount: order.amount,
          description: `${membership_type === 'monthly' ? '月费' : '年费'}会员`
        }
      },
      message: '订单创建成功，请完成支付'
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * 取消订单
 */
exports.cancelOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const order = await Order.findOne({
      where: { 
        id, 
        user_id: userId,
        status: 'pending' // 只能取消待支付的订单
      },
      transaction
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: '订单不存在或无法取消'
      });
    }

    // 更新订单状态
    await order.update({ 
      status: 'cancelled',
      cancelled_at: new Date()
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      data: order,
      message: '订单取消成功'
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * 支付回调通知
 * 注意：这个接口不需要认证，由支付平台调用
 */
exports.paymentNotify = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    // 微信支付回调的XML数据（需要解析）
    const { 
      return_code, 
      result_code, 
      out_trade_no, 
      transaction_id,
      total_fee,
      time_end 
    } = req.body;

    console.log('支付回调收到:', {
      return_code,
      result_code,
      out_trade_no,
      transaction_id
    });

    // 验证签名（实际项目中需要实现）
    // if (!verifyWxPaySign(req.body)) {
    //   await transaction.rollback();
    //   return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名失败]]></return_msg></xml>');
    // }

    if (return_code === 'SUCCESS' && result_code === 'SUCCESS') {
      // 根据商户订单号查找订单
      const order = await Order.findOne({
        where: { order_no: out_trade_no },
        transaction
      });

      if (!order) {
        await transaction.rollback();
        return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[订单不存在]]></return_msg></xml>');
      }

      if (order.status === 'paid') {
        // 订单已经处理过，直接返回成功
        await transaction.commit();
        return res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
      }

      // 验证金额（单位：分）
      const expectedAmount = Math.round(order.amount * 100);
      if (parseInt(total_fee) !== expectedAmount) {
        await transaction.rollback();
        return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[金额不一致]]></return_msg></xml>');
      }

      // 处理支付成功
      await OrderService.handlePaymentSuccess(
        order.order_no,
        {
          payment_method: 'wxpay',
          transaction_id: transaction_id,
          payment_time: time_end ? new Date(time_end) : new Date()
        },
        transaction
      );

      await transaction.commit();

      // 返回成功响应给微信
      res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');

    } else {
      // 支付失败
      const order = await Order.findOne({
        where: { order_no: out_trade_no },
        transaction
      });

      if (order && order.status === 'pending') {
        await order.update({ 
          status: 'failed',
          failed_reason: result_code
        }, { transaction });
      }

      await transaction.commit();
      res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
    }

  } catch (error) {
    await transaction.rollback();
    console.error('支付回调处理失败:', error);
    
    // 即使处理失败也要返回成功，避免微信重复通知
    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
  }
};

/**
 * 模拟支付（开发环境使用）
 */
exports.mockPayment = async (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      error: '仅开发环境可用'
    });
  }

  const transaction = await sequelize.transaction();
  
  try {
    const { order_no } = req.body;
    const userId = req.user.userId;

    // 查找订单
    const order = await Order.findOne({
      where: { 
        order_no,
        user_id: userId,
        status: 'pending'
      },
      transaction
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: '订单不存在或无法支付'
      });
    }

    // 模拟支付成功
    await OrderService.handlePaymentSuccess(
      order.order_no,
      {
        payment_method: 'mock',
        transaction_id: 'mock_' + Date.now(),
        payment_time: new Date()
      },
      transaction
    );

    await transaction.commit();

    res.json({
      success: true,
      data: {
        order_no: order.order_no,
        status: 'paid',
        payment_time: new Date()
      },
      message: '模拟支付成功'
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * 获取订单统计
 */
exports.getOrderStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const stats = await Order.findAll({
      where: { user_id: userId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
      ],
      group: ['status'],
      raw: true
    });

    // 格式化统计结果
    const formattedStats = {
      total: 0,
      total_amount: 0,
      by_status: {}
    };

    stats.forEach(stat => {
      formattedStats.by_status[stat.status] = {
        count: parseInt(stat.count),
        amount: parseFloat(stat.total_amount) || 0
      };
      formattedStats.total += parseInt(stat.count);
      formattedStats.total_amount += parseFloat(stat.total_amount) || 0;
    });

    res.json({
      success: true,
      data: formattedStats
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 申请退款
 */
exports.requestRefund = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: '请提供至少5个字的退款理由'
      });
    }

    const order = await Order.findOne({
      where: { 
        id, 
        user_id: userId,
        status: 'paid' // 只有已支付的订单才能退款
      },
      transaction
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: '订单不存在或无法退款'
      });
    }

    // 检查订单是否超过退款时限（例如7天）
    const orderTime = new Date(order.created_at);
    const now = new Date();
    const diffDays = (now - orderTime) / (1000 * 60 * 60 * 24);
    
    if (diffDays > 7) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: '订单已超过7天退款期限'
      });
    }

    // 更新订单状态为退款中
    // 实际项目中这里应该调用支付平台的退款接口
    await order.update({
      status: 'refunding',
      refund_reason: reason.trim(),
      refund_requested_at: new Date()
    }, { transaction });

    await transaction.commit();

    // 这里可以发送通知给管理员等

    res.json({
      success: true,
      data: order,
      message: '退款申请已提交，请等待审核'
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};