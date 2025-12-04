const { sequelize } = require('../config/database');

async function optimizeMaterialModel() {
  try {
    console.log('开始优化Material模型...');
    
    const transaction = await sequelize.transaction();
    
    try {
      // 检查表结构，看看是否已经有grade和subject_id字段（MySQL方式）
      const [gradeResults] = await sequelize.query(
        `SHOW COLUMNS FROM materials LIKE 'grade';`,
        { transaction }
      );
      
      const [subjectIdResults] = await sequelize.query(
        `SHOW COLUMNS FROM materials LIKE 'subject_id';`,
        { transaction }
      );
      
      const hasGradeColumn = gradeResults.length > 0;
      const hasSubjectIdColumn = subjectIdResults.length > 0;
      
      // 1. 添加grade字段（如果不存在）
      if (!hasGradeColumn) {
        await sequelize.query(
          `ALTER TABLE materials ADD COLUMN grade INTEGER AFTER original_price;`,
          { transaction }
        );
        console.log('已添加grade字段');
        
        // 复制grade_level的数据到grade字段
        await sequelize.query(
          `UPDATE materials SET grade = grade_level;`,
          { transaction }
        );
        console.log('已复制grade_level数据到grade字段');
      } else {
        console.log('grade字段已存在，跳过添加');
      }
      
      // 2. 添加subject_id字段（如果不存在）
      if (!hasSubjectIdColumn) {
        await sequelize.query(
          `ALTER TABLE materials ADD COLUMN subject_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;`,
          { transaction }
        );
        console.log('已添加subject_id字段');
        
        // 尝试根据subject名称关联到对应的category ID
        await sequelize.query(
          `UPDATE materials m
          SET subject_id = (
            SELECT id FROM categories c
            WHERE c.subject = m.subject
            AND c.level = 3
            LIMIT 1
          )
          WHERE m.subject IS NOT NULL;`,
          { transaction }
        );
        console.log('已尝试关联subject_id到categories表');
      } else {
        console.log('subject_id字段已存在，跳过添加');
      }
      
      await transaction.commit();
      console.log('Material模型优化成功！');
      
      // 3. 修改Material模型定义，添加新字段的支持
      console.log('\n请记住在models/index.js中的Material模型定义中添加新字段：');
      console.log(`grade: { type: DataTypes.INTEGER, comment: '年级，0-9，其中0代表幼升小' },`);
      console.log(`subject_id: { type: DataTypes.INTEGER, references: { model: 'categories', key: 'id' }, allowNull: true },`);
      
    } catch (error) {
      await transaction.rollback();
      console.error('优化失败，已回滚:', error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('连接数据库失败:', error);
    process.exit(1);
  }
}

// 执行优化
optimizeMaterialModel();