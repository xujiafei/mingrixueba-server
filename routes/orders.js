const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// 所有接口都无需认证（私人使用系统）

// 订单相关
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrderDetail);
router.post('/membership', orderController.createMembershipOrder);
router.post('/:id/cancel', orderController.cancelOrder);

// 支付回调（不需要认证）
router.post('/payment/notify', orderController.paymentNotify);

module.exports = router;