const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// 添加日志中间件
router.use((req, res, next) => {
  console.log('📍 用户路由被访问:', req.method, req.path);
  console.log('Authorization header:', req.header('Authorization'));
  next();
});

// 所有路由都无需认证（私人使用系统）

// 用户资料
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);

// 用户管理（管理员功能）
router.get('/getList', userController.getUserList);
router.get('/getInfo/:id', userController.getUserInfo);
router.get('/downloads/:id', userController.getUserDownloadHistory);
router.post('/create', userController.createUser);
router.put('/update/:id', userController.updateUser);
router.delete('/delete/:id', userController.deleteUser);
router.put('/status/:id', userController.updateUserStatus);

// 下载历史
router.get('/downloads', userController.getDownloadHistory);

// 余额相关
// router.get('/balance', userController.getBalance);
// router.post('/recharge', userController.recharge);

// 积分管理（用户端）
router.get('/points', userController.getUserPoints);
router.get('/points/transactions', userController.getUserPointTransactions);

// 积分管理（管理员/客服功能）
router.put('/points/:id', userController.setUserPoints);
router.get('/points/transactions/:id', userController.getUserPointTransactionsByAdmin);
// 获取用户积分详情（包含过期信息）
router.get('/points-with-expiry/:id', userController.getUserPointsWithExpiry);
// 增加用户积分
router.post('/points/add/:id', userController.addUserPoints);
// 扣除用户积分
router.post('/points/deduct/:id', userController.deductUserPoints);
// 重置用户积分
router.post('/points/reset/:id', userController.resetUserPoints);

// 获取用户会员信息
router.get('/membership/info', userController.getMembershipInfo);

// 资料兑换相关路由

// 用户端兑换功能
router.post('/exchanges/semester', userController.exchangeSemesterMaterials); // 兑换学期资料
router.get('/exchanges/semesters', userController.getUserExchangedSemesters); // 获取已兑换学期列表
router.get('/exchanges/check/:semester_id', userController.checkSemesterExchanged); // 检查学期是否已兑换
router.get('/exchanges/available', userController.getAvailableSemesters); // 获取可兑换学期列表

// 管理员端兑换管理
router.get('/exchanges/check/:user_id/:semester_id', userController.adminCheckSemesterExchanged); // 管理员检查用户学期兑换状态

module.exports = router;