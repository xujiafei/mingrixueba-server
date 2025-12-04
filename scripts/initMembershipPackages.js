const { sequelize } = require('../config/database');
const { MembershipPackage } = require('../models');

// 会员套餐数据
const packages = [
  // 小学套餐
  {
    name: '小学单册会员',
    description: '适用于小学阶段的单册会员，可享受有效期内任选一学期内所有学习资料。',
    price: 59.00,
    duration_days: 280,
    level: 'primary',
    type: 'single',
    features: [
      '单册所有学习资料免费下载',
      '会员专属学习指导',
      '优先获取更新内容',
      '无广告学习体验'
    ],
    is_active: true,
    order_index: 1
  },
  {
    name: '小学双册会员',
    description: '适用于小学阶段的双册会员，可享受有效期内任选两学期内所有学习资料。',
    price: 79.00,
    duration_days: 298,
    level: 'primary',
    type: 'double',
    features: [
      '两册所有学习资料免费下载',
      '会员专属学习指导',
      '优先获取更新内容',
      '无广告学习体验',
      '额外赠送学习工具'
    ],
    is_active: true,
    order_index: 2
  },
  {
    name: '小学全册会员',
    description: '适用于小学阶段的全册永久会员，可享受所有小学阶段学习资料。',
    price: 199.00,
    duration_days: null, // null表示永久
    level: 'primary',
    type: 'primary_full',
    features: [
      '所有小学阶段学习资料永久免费下载',
      '会员专属学习指导',
      '优先获取更新内容',
      '无广告学习体验',
      '额外赠送学习工具',
      '专属客服支持',
      '定期学习报告'
    ],
    is_active: true,
    order_index: 3
  },
  // 初中套餐
  {
    name: '初中单册会员',
    description: '适用于初中阶段的单册会员，可享受有效期内任选一学期内学习资料。',
    price: 59.00,
    duration_days: 280,
    level: 'junior',
    type: 'single',
    features: [
      '单册所有学习资料免费下载',
      '会员专属学习指导',
      '优先获取更新内容',
      '无广告学习体验'
    ],
    is_active: true,
    order_index: 4
  },
  {
    name: '初中双册会员',
    description: '适用于初中阶段的双册会员，可享受有效期内任选两学期内所有学习资料。',
    price: 79.00,
    duration_days: 298,
    level: 'junior',
    type: 'double',
    features: [
      '两册所有学习资料免费下载',
      '会员专属学习指导',
      '优先获取更新内容',
      '无广告学习体验',
      '额外赠送学习工具'
    ],
    is_active: true,
    order_index: 5
  },
  {
    name: '初中全册会员',
    description: '适用于初中阶段的全册永久会员，可享受所有初中阶段学习资料。',
    price: 199.00,
    duration_days: null, // null表示永久
    level: 'junior',
    type: 'junior_full',
    features: [
      '所有初中阶段学习资料永久免费下载',
      '会员专属学习指导',
      '优先获取更新内容',
      '无广告学习体验',
      '额外赠送学习工具',
      '专属客服支持',
      '定期学习报告'
    ],
    is_active: true,
    order_index: 6
  }
];

async function initMembershipPackages() {
  try {
    // 连接数据库
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 同步模型到数据库
    await sequelize.sync({ alter: true });
    console.log('数据库同步完成');
    
    // 插入会员套餐数据
    for (const pkg of packages) {
      // 检查是否已存在相同名称的套餐
      const existing = await MembershipPackage.findOne({ where: { name: pkg.name } });
      if (!existing) {
        await MembershipPackage.create(pkg);
        console.log(`成功创建套餐: ${pkg.name}`);
      } else {
        console.log(`套餐已存在: ${pkg.name}`);
      }
    }
    
    console.log('会员套餐初始化完成');
    return;
  } catch (error) {
    console.error('初始化会员套餐时出错:', error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
  }
}

// 执行初始化
initMembershipPackages();