# 用户积分和会员系统设计

## 现有数据结构分析

### User模型
- 已有 `points` 字段：用于存储用户积分
- 已有 `membership_type` 字段：支持 'none', 'primary', 'junior'
- 已有 `membership_expiry` 字段：会员到期时间

### 关联模型
- UserMembership：用户-会员关联表
- MembershipPackage：会员套餐
- DownloadLog：下载记录

## 需要新增的数据结构

### 1. PointTransaction（积分交易记录）
- 记录积分的获取和消耗历史
- 跟踪积分的有效期

### 2. MaterialExchange（资料兑换记录）
- 记录用户兑换的学期资料
- 管理资料的锁定和激活状态

### 3. 修改DownloadLog
- 添加有效期字段
- 支持已兑换资料的长期访问

## 会员类型定义

### 1. 无会员（none）
- 默认状态
- 无法访问会员资料

### 2. 会员积分（points）
- 通过购买获得积分
- 单册购买：5积分
- 双册购买：10积分
- 使用积分兑换资料

### 3. 小学全册（primary_full）
- 无限制访问所有小学资料

### 4. 初中全册（junior_full）
- 无限制访问所有初中资料

## 积分有效期规则
- 积分从购买之日起开始计算有效期
- 超过有效期后积分失效
- 已兑换的资料永久可访问

## 资料兑换规则
- 兑换某一学期的某份资料时，激活该学期所有学科资料
- 扣除相应积分
- 其他学期保持锁定状态

## 数据结构详细设计

### PointTransaction表
```javascript
const PointTransaction = sequelize.define('PointTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  points: { type: DataTypes.INTEGER, allowNull: false }, // 正数表示增加，负数表示扣除
  type: { 
    type: DataTypes.ENUM('purchase', 'exchange', 'expire'), 
    allowNull: false 
  },
  source_id: { type: DataTypes.INTEGER }, // 关联的订单ID或资料ID
  expires_at: { type: DataTypes.DATE }, // 积分过期时间
  status: { 
    type: DataTypes.ENUM('active', 'used', 'expired'), 
    defaultValue: 'active' 
  }
}, {
  tableName: 'point_transactions',
  timestamps: true
});
```

### MaterialExchange表
```javascript
const MaterialExchange = sequelize.define('MaterialExchange', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  semester_id: { type: DataTypes.INTEGER, allowNull: false }, // 学期ID
  exchange_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  point_cost: { type: DataTypes.INTEGER, allowNull: false }, // 消耗的积分
  activated: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'material_exchanges',
  timestamps: true
});
```

### 修改DownloadLog表
```javascript
// 添加到现有的DownloadLog定义中
const DownloadLog = sequelize.define('DownloadLog', {
  // 现有字段...
  expiry_date: { type: DataTypes.DATE }, // 访问过期时间，null表示永久
  exchange_id: { type: DataTypes.INTEGER }, // 关联的兑换记录
  access_type: { 
    type: DataTypes.ENUM('direct', 'exchange', 'membership'), 
    defaultValue: 'direct' 
  }
}, {
  // 配置...
});
```

## 关联关系

```javascript
// 用户与积分交易
User.hasMany(PointTransaction, { foreignKey: 'user_id' });
PointTransaction.belongsTo(User, { foreignKey: 'user_id' });

// 用户与资料兑换
User.hasMany(MaterialExchange, { foreignKey: 'user_id' });
MaterialExchange.belongsTo(User, { foreignKey: 'user_id' });

// 积分交易与资料兑换（一对多）
PointTransaction.hasMany(MaterialExchange, { foreignKey: 'transaction_id' });
MaterialExchange.belongsTo(PointTransaction, { foreignKey: 'transaction_id' });

// 资料兑换与下载记录
MaterialExchange.hasMany(DownloadLog, { foreignKey: 'exchange_id' });
DownloadLog.belongsTo(MaterialExchange, { foreignKey: 'exchange_id' });

// 学期与资料兑换
Category.hasMany(MaterialExchange, { foreignKey: 'semester_id' });
MaterialExchange.belongsTo(Category, { foreignKey: 'semester_id', as: 'semester' });
```