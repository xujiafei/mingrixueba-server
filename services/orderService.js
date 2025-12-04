const { Order, User, Material, sequelize } = require('../models');

class OrderService {
  // 创建订单
  static async createOrder(orderData, transaction = null) {
    const { user_id, order_type, amount, material_id, membership_type } = orderData;

    // 验证数据
    if (order_type === 'material' && !material_id) {
      throw new Error('资料订单必须指定material_id');
    }

    if (order_type === 'membership' && !membership_type) {
      throw new Error('会员订单必须指定membership_type');
    }

    const orderNo = this.generateOrderNo();

    const order = await Order.create({
      order_no: orderNo,
      user_id,
      order_type,
      amount: parseFloat(amount),
      material_id,
      membership_type,
      status: 'pending'
    }, { transaction });

    return order;
  }

  // 处理支付成功
  static async handlePaymentSuccess(orderNo, paymentData, transaction = null) {
    const order = await Order.findOne({
      where: { order_no: orderNo },
      include: [User],
      transaction
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status === 'paid') {
      return order; // 已经处理过了
    }

    // 更新订单状态
    await order.update({
      status: 'paid',
      payment_method: paymentData.payment_method,
      payment_time: new Date()
    }, { transaction });

    // 根据订单类型处理业务逻辑
    if (order.order_type === 'membership') {
      await this.activateMembership(order, transaction);
    } else if (order.order_type === 'material') {
      await this.deliverMaterial(order, transaction);
    }

    return order;
  }

  // 激活会员
  static async activateMembership(order, transaction = null) {
    const user = await User.findByPk(order.user_id, { transaction });
    const expiryDate = new Date();

    if (order.membership_type === 'monthly') {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    } else if (order.membership_type === 'yearly') {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    await user.update({
      membership_type: order.membership_type,
      membership_expiry: expiryDate
    }, { transaction });
  }

  // 交付资料
  static async deliverMaterial(order, transaction = null) {
    // 记录下载日志，表示用户已购买
    const DownloadLog = require('../models').DownloadLog;
    await DownloadLog.create({
      user_id: order.user_id,
      material_id: order.material_id,
      order_id: order.id
    }, { transaction });

    // 更新资料下载次数
    await Material.increment('download_count', {
      where: { id: order.material_id },
      transaction
    });
  }

  // 生成订单号
  static generateOrderNo() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `O${timestamp}${random}`;
  }

  // 获取用户订单列表
  static async getUserOrders(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { count, rows } = await Order.findAndCountAll({
      where: { user_id: userId },
      include: [{
        model: Material,
        attributes: ['id', 'title', 'cover_image']
      }],
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
}

module.exports = OrderService;