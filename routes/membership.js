const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');

// 公开路由 - 供小程序使用的查询接口
router.get('/packages', membershipController.getPackages);
router.get('/packages/:id', membershipController.getPackageDetail);

// 所有接口都无需认证（私人使用系统）

// 管理后台使用的接口（需要管理员权限）
// 创建会员套餐
router.post('/packages', membershipController.createPackage);

// 更新会员套餐
router.put('/packages/:id', membershipController.updatePackage);

// 删除会员套餐
router.delete('/packages/:id', membershipController.deletePackage);

// 更新会员套餐状态
router.patch('/packages/:id/status', membershipController.updatePackageStatus);

// 创建会员订单
router.post('/orders', membershipController.createMembershipOrder);

// 处理支付回调（实际项目中可能需要更安全的验证）
router.post('/orders/payment-callback', membershipController.processPaymentCallback);

// 获取用户会员信息 - 使用已有的getUserMemberships方法
router.get('/user-membership', membershipController.getUserMemberships);

// 获取用户所有会员信息
router.get('/user/memberships', membershipController.getUserMemberships);

// 获取用户有效会员信息
router.get('/user/active-memberships', membershipController.getUserActiveMemberships);

// 检查特定类型会员
router.get('/check/membership', (req, res, next) => {
  // 调用中间件函数作为检查
  membershipController.checkMembershipPermission(req, res, () => {
    // 如果通过检查，返回成功响应
    res.status(200).json({
      success: true,
      message: '会员权限验证通过',
      data: req.membershipInfo
    });
  });
});

// 检查资料访问权限
router.get('/check/access', membershipController.checkAccessPermission);



module.exports = router;