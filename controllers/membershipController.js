const membershipService = require('../services/membershipService');

/**
 * 会员控制器
 */
class MembershipController {
  // 获取会员套餐列表
  async getPackages(req, res) {
    try {
      const { level } = req.query;
      const packages = await membershipService.getAllPackages(level);
      res.status(200).json({
        success: true,
        data: packages
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message || '获取会员套餐列表失败'
      });
    }
  }

  // 获取单个会员套餐详情
  async getPackageDetail(req, res) {
    try {
      const { id } = req.params;
      const packageInfo = await membershipService.getPackageById(id);
      
      if (!packageInfo) {
        return res.status(404).json({
          success: false,
          error: '会员套餐不存在'
        });
      }
      
      res.status(200).json({
        success: true,
        data: packageInfo
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message || '获取会员套餐详情失败'
      });
    }
  }

  // 创建会员套餐
  async createPackage(req, res) {
    try {
      const packageData = req.body;
      const newPackage = await membershipService.createPackage(packageData);
      
      res.status(201).json({
        success: true,
        data: newPackage,
        message: '会员套餐创建成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message || '创建会员套餐失败'
      });
    }
  }

  // 更新会员套餐
  async updatePackage(req, res) {
    try {
      const { id } = req.params;
      const packageData = req.body;
      const updatedPackage = await membershipService.updatePackage(id, packageData);
      
      res.status(200).json({
        success: true,
        data: updatedPackage,
        message: '会员套餐更新成功'
      });
    } catch (error) {
      if (error.message === '会员套餐不存在') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      res.status(400).json({
        success: false,
        error: error.message || '更新会员套餐失败'
      });
    }
  }

  // 删除会员套餐
  async deletePackage(req, res) {
    try {
      const { id } = req.params;
      await membershipService.deletePackage(id);
      
      res.status(200).json({
        success: true,
        message: '会员套餐删除成功'
      });
    } catch (error) {
      if (error.message === '会员套餐不存在') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      res.status(400).json({
        success: false,
        error: error.message || '删除会员套餐失败'
      });
    }
  }

  // 更新会员套餐状态
  async updatePackageStatus(req, res) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      
      if (typeof is_active !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: '请提供有效的状态值'
        });
      }
      
      const updatedPackage = await membershipService.updatePackageStatus(id, is_active);
      
      res.status(200).json({
        success: true,
        data: updatedPackage,
        message: '会员套餐状态更新成功'
      });
    } catch (error) {
      if (error.message === '会员套餐不存在') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      res.status(400).json({
        success: false,
        error: error.message || '更新会员套餐状态失败'
      });
    }
  }

  // 创建会员订单
  async createMembershipOrder(req, res) {
    try {
      const { packageId, paymentMethod } = req.body;
      const userId = req.user.id;
      
      if (!packageId) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数'
        });
      }
      
      const order = await membershipService.createMembershipOrder(userId, packageId, paymentMethod);
      
      res.status(201).json({
        success: true,
        data: order,
        message: '会员订单创建成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message || '创建会员订单失败'
      });
    }
  }

  // 处理支付回调（假设第三方支付回调）
  async processPaymentCallback(req, res) {
    try {
      const { orderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: '缺少订单ID'
        });
      }
      
      const result = await membershipService.processMembershipPayment(orderId);
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message || '处理支付回调失败'
      });
    }
  }

  // 获取用户所有会员信息
  async getUserMemberships(req, res) {
    try {
      const userId = req.user.id;
      const memberships = await membershipService.getUserMemberships(userId);
      
      res.status(200).json({
        success: true,
        data: memberships
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message || '获取用户会员信息失败'
      });
    }
  }

  // 获取用户有效会员信息
  async getUserActiveMemberships(req, res) {
    try {
      const userId = req.user.id;
      const memberships = await membershipService.getUserActiveMemberships(userId);
      
      res.status(200).json({
        success: true,
        data: memberships
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message || '获取用户有效会员信息失败'
      });
    }
  }

  // 检查会员权限（可用于其他接口的前置检查）
  async checkMembershipPermission(req, res, next) {
    try {
      const userId = req.user.id;
      const membershipInfo = await membershipService.getUserMembershipInfo(userId);
      
      if (!membershipInfo.isActive) {
        return res.status(403).json({
          success: false,
          error: '您不是会员，请先开通会员'
        });
      }
      
      // 将会员信息添加到请求对象中，供后续中间件使用
      req.membershipInfo = membershipInfo;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '检查会员权限失败'
      });
    }
  }

  // 检查资料访问权限
  async checkAccessPermission(req, res) {
    try {
      const { materialType } = req.query; // 'primary' 或 'junior'
      const userId = req.user.id;
      
      const hasAccess = await membershipService.checkAccessPermission(userId, materialType);
      
      res.status(200).json({
        success: true,
        data: {
          hasAccess
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message || '检查访问权限失败'
      });
    }
  }


}

module.exports = new MembershipController();