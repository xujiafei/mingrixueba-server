const {sequelize} = require('../config/database');
const { DataTypes } = require('sequelize');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  openid: { type: DataTypes.STRING(64), allowNull: true, comment: '微信小程序openid' },
  unionid: { type: DataTypes.STRING(64), comment: '微信开放平台unionid' },
  session_key: { type: DataTypes.STRING(128), comment: '微信会话密钥' },
  username: { type: DataTypes.STRING(50), unique: true, comment: '用户名（可选）' },
  nickname: { type: DataTypes.STRING(100), comment: '微信昵称' },
  avatar_url: { type: DataTypes.STRING(500), comment: '微信头像URL' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true, comment: '是否激活' },
  points: { type: DataTypes.INTEGER, defaultValue: 0, comment: '积分' },
  membership_type: { type: DataTypes.ENUM('none', 'single', 'double', 'primary_full', 'junior_full'), defaultValue: 'none', comment: '会员类型' },
  membership_expiry: { type: DataTypes.DATE, comment: '会员到期时间' },
  role: { type: DataTypes.ENUM('user', 'customer_service', 'admin'), defaultValue: 'user', comment: '用户角色' },
  password_hash: { type: DataTypes.STRING(255), comment: '密码哈希（用于客服和管理员登录）' }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// 用户-会员关联表，支持一个用户拥有多个会员套餐
const UserMembership = sequelize.define('UserMembership', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  membership_package_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  start_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  expiry_date: DataTypes.DATE, // null表示永久
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'user_memberships',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// 会员套餐模型
const MembershipPackage = sequelize.define('MembershipPackage', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: DataTypes.TEXT,
  price: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  duration_days: { type: DataTypes.INTEGER }, // null表示永久
  level: { type: DataTypes.ENUM('primary', 'junior'), allowNull: false },
  type: { type: DataTypes.ENUM('none', 'single', 'double', 'primary_full', 'junior_full'), allowNull: false },
  features: DataTypes.JSON,
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  order_index: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'membership_packages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  level: { type: DataTypes.INTEGER, allowNull: false, comment: '层级，1-4级' },
  grade: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null, comment: '年级，0-9，其中0代表幼升小' },
  subject: DataTypes.STRING(50),
  parent_id: DataTypes.INTEGER,
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'categories',
  timestamps: true,
  createdAt: 'created_at', // 明确指定数据库字段名
  updatedAt: 'updated_at', // 明确指定数据库字段名
  underscored: true // 使用下划线命名约定
});

const Material = sequelize.define('Material', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: DataTypes.TEXT,
  file_url: { type: DataTypes.STRING(500), allowNull: false },
  file_size: DataTypes.BIGINT,
  file_type: DataTypes.STRING(50),
  cover_image: DataTypes.STRING(500),
  price: { type: DataTypes.DECIMAL(10,2), defaultValue: 0.00 },
  original_price: { type: DataTypes.DECIMAL(10,2), defaultValue: 0.00 },
  grade: { 
    type: DataTypes.INTEGER, 
    comment: '年级，0-9，其中0代表幼升小' 
  },
  grade_level: DataTypes.INTEGER,
  subject: DataTypes.STRING(50),
  subject_id: {
    type: DataTypes.INTEGER,
    references: { model: 'categories', key: 'id' }
  },
  version: { type: DataTypes.STRING(50), comment: '教材版本，如：人教版、苏教版等' },
  version_year: { type: DataTypes.STRING(4), comment: '教材年份，如：2023, 2024' },
  tags: DataTypes.JSON,
  download_count: { 
    type: DataTypes.INTEGER, 
    defaultValue: () => Math.floor(Math.random() * 951) + 50 // 生成50-1000之间的随机整数
  },
  view_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_free: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { 
    type: DataTypes.ENUM('draft', 'published', 'hidden'), 
    defaultValue: 'published' 
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  page_count: { type: DataTypes.INTEGER, defaultValue: 0, comment: 'PDF文件页数' },
}, {
  tableName: 'materials',
  timestamps: true,
  createdAt: 'created_at', // 明确指定数据库字段名
  updatedAt: 'updated_at', // 明确指定数据库字段名
  underscored: true // 使用下划线命名约定
});

// Banner模型
const Banner = sequelize.define('Banner', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  image_url: { type: DataTypes.STRING(500), allowNull: false },
  title: { type: DataTypes.STRING(200) },
  link_url: { type: DataTypes.STRING(500) },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'banners',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// Notice模型
const Notice = sequelize.define('Notice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  link: { type: DataTypes.STRING(500) },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  display_order: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'notices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// 积分交易记录模型定义移至下方，避免重复声明


// 网站配置模型 - 合并banner和notice
const SiteConfig = sequelize.define('SiteConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  banner_list: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '[]',
    comment: '轮播图列表，JSON格式存储[{image: base64字符串}]',
  },
  notice_list: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '[]',
    comment: '公告列表，JSON格式存储[{content: 公告内容}]',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否激活',
  }
}, {
  tableName: 'site_configs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_no: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  status: { 
    type: DataTypes.ENUM('pending', 'paid', 'cancelled', 'refunded'), 
    defaultValue: 'pending' 
  },
  payment_method: DataTypes.STRING(20),
  paid_at: DataTypes.DATE,
  order_type: { type: DataTypes.ENUM('material', 'membership'), defaultValue: 'material' },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  material_id: {
    type: DataTypes.INTEGER
  },
  membership_package_id: {
    type: DataTypes.INTEGER
  },
  user_membership_id: {
    type: DataTypes.INTEGER
  }
}, {
  tableName: 'orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// 积分交易记录模型
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
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// 资料兑换记录模型
const MaterialExchange = sequelize.define('MaterialExchange', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  semester_id: { type: DataTypes.INTEGER, allowNull: false }, // 学期ID
  exchange_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  point_cost: { type: DataTypes.INTEGER, allowNull: false }, // 消耗的积分
  transaction_id: { type: DataTypes.INTEGER }, // 关联的积分交易ID
  activated: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'material_exchanges',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// 下载记录模型
const DownloadLog = sequelize.define('DownloadLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ip_address: DataTypes.STRING(45),
  user_agent: DataTypes.TEXT,
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  material_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  expiry_date: { type: DataTypes.DATE }, // 访问过期时间，null表示永久
  exchange_id: { type: DataTypes.INTEGER }, // 关联的兑换记录
  access_type: { 
    type: DataTypes.ENUM('direct', 'exchange', 'membership'), 
    defaultValue: 'direct' 
  }
}, {
  tableName: 'download_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

Category.hasMany(Category, { 
  as: 'children', 
  foreignKey: 'parent_id',
  onDelete: 'CASCADE'
});
Category.belongsTo(Category, { 
  as: 'parent', 
  foreignKey: 'parent_id' 
});

// 定义关联关系
Category.hasMany(Material, { foreignKey: 'category_id' });
Material.belongsTo(Category, { foreignKey: 'category_id' });
Material.belongsTo(Category, { as: 'subjectCategory', foreignKey: 'subject_id' });
Category.hasMany(Material, { as: 'subjectMaterials', foreignKey: 'subject_id' });

User.hasMany(Order, { foreignKey: 'user_id' });
Order.belongsTo(User, { foreignKey: 'user_id' });

Material.hasMany(Order, { foreignKey: 'material_id' });
Order.belongsTo(Material, { foreignKey: 'material_id' });

// Add associations for DownloadLog
User.hasMany(DownloadLog, { foreignKey: 'user_id' });
DownloadLog.belongsTo(User, { foreignKey: 'user_id' });

Material.hasMany(DownloadLog, { foreignKey: 'material_id' });
DownloadLog.belongsTo(Material, { foreignKey: 'material_id' });

// 用户与积分交易关联
User.hasMany(PointTransaction, { foreignKey: 'user_id' });
PointTransaction.belongsTo(User, { foreignKey: 'user_id' });

// 用户与资料兑换关联
User.hasMany(MaterialExchange, { foreignKey: 'user_id' });
MaterialExchange.belongsTo(User, { foreignKey: 'user_id' });

// 积分交易与资料兑换关联
PointTransaction.hasMany(MaterialExchange, { foreignKey: 'transaction_id' });
MaterialExchange.belongsTo(PointTransaction, { foreignKey: 'transaction_id' });

// 资料兑换与下载记录关联
MaterialExchange.hasMany(DownloadLog, { foreignKey: 'exchange_id' });
DownloadLog.belongsTo(MaterialExchange, { foreignKey: 'exchange_id' });

// 学期与资料兑换关联
Category.hasMany(MaterialExchange, { foreignKey: 'semester_id' });
MaterialExchange.belongsTo(Category, { foreignKey: 'semester_id', as: 'semester' });

// 定义关联关系
User.hasMany(UserMembership, { foreignKey: 'user_id' });
UserMembership.belongsTo(User, { foreignKey: 'user_id' });

UserMembership.belongsTo(MembershipPackage, { foreignKey: 'membership_package_id' });
MembershipPackage.hasMany(UserMembership, { foreignKey: 'membership_package_id' });

MembershipPackage.hasMany(Order, { foreignKey: 'membership_package_id' });
Order.belongsTo(UserMembership, { foreignKey: 'user_membership_id' });

module.exports = {
  User,
  Category,
  Material,
  Order,
  DownloadLog,
  MembershipPackage,
  UserMembership,
  Banner, // Banner模型
  Notice, // Notice模型
  SiteConfig, // 网站配置模型
  PointTransaction, // 积分交易模型
  MaterialExchange // 资料兑换模型
};