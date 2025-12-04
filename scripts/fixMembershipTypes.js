const { sequelize } = require('../config/database');

async function fixMembershipTypes() {
  try {
    console.log('开始修复会员类型...');
    
    // 先将type字段临时改为VARCHAR类型，以允许更新旧数据
    await sequelize.query(
      'ALTER TABLE `membership_packages` CHANGE `type` `type` VARCHAR(50) NOT NULL;'
    );
    console.log('已将type字段临时改为VARCHAR类型');
    
    // 更新小学全册会员的type值
    await sequelize.query(
      "UPDATE `membership_packages` SET `type` = 'primary_full' WHERE `type` = 'full' AND `level` = 'primary';"
    );
    console.log('已更新小学全册会员类型');
    
    // 更新初中全册会员的type值
    await sequelize.query(
      "UPDATE `membership_packages` SET `type` = 'junior_full' WHERE `type` = 'full' AND `level` = 'junior';"
    );
    console.log('已更新初中全册会员类型');
    
    // 恢复type字段为ENUM类型
    await sequelize.query(
      "ALTER TABLE `membership_packages` CHANGE `type` `type` ENUM('none', 'single', 'double', 'primary_full', 'junior_full') NOT NULL;"
    );
    console.log('已恢复type字段为ENUM类型');
    
    console.log('会员类型修复完成！');
  } catch (error) {
    console.error('修复会员类型时出错:', error);
  } finally {
    await sequelize.close();
  }
}

fixMembershipTypes();