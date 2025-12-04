const { sequelize } = require('../config/database');
const { User, Category, Material, Banner, Notice } = require('../models');

const initDatabase = async () => {
  try {
    // 同步数据库结构
    await sequelize.sync({ force: false }); // force: true 会删除现有表
    
    console.log('数据库表结构同步完成');
    
    // 初始化分类数据
    // await initCategories();
    
    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
};

const initCategories = async () => {
  const categories = [
    // 年级分类
    { name: '幼小衔接', level: 0, subject: null, parent_id: null, sort_order: 1 },
    { name: '小学', level: 1, subject: null, parent_id: null, sort_order: 2 },
    { name: '初中', level: 2, subject: null, parent_id: null, sort_order: 3 },
    { name: '高中', level: 3, subject: null, parent_id: null, sort_order: 4 },
    
    // 小学科目
    { name: '语文', level: 1, subject: '语文', parent_id: 2, sort_order: 1 },
    { name: '数学', level: 1, subject: '数学', parent_id: 2, sort_order: 2 },
    { name: '英语', level: 1, subject: '英语', parent_id: 2, sort_order: 3 }
  ];

  for (const categoryData of categories) {
    await Category.findOrCreate({
      where: { name: categoryData.name, level: categoryData.level },
      defaults: categoryData
    });
  }
};

// 执行初始化
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;