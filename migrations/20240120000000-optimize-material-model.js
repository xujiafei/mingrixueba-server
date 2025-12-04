module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // 1. 先添加新的grade字段，复制grade_level的数据
      await queryInterface.addColumn('materials', 'grade', {
        type: Sequelize.INTEGER,
        allowNull: true,
        after: 'original_price',
        comment: '年级，0-9，其中0代表幼升小'
      });
      
      // 2. 复制数据
      await queryInterface.sequelize.query(`
        UPDATE materials SET grade = grade_level
      `);
      
      // 3. 添加subject_id字段
      await queryInterface.addColumn('materials', 'subject_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        after: 'grade',
        comment: '科目ID（关联categories表的level=3记录）',
        references: {
          model: 'categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      
      // 4. 尝试根据subject名称关联到对应的category ID
      // 注意：这只会匹配精确的subject名称到categories表中的记录
      await queryInterface.sequelize.query(`
        UPDATE materials m
        SET subject_id = (
          SELECT id FROM categories c
          WHERE c.subject = m.subject
          AND c.level = 3
          LIMIT 1
        )
        WHERE m.subject IS NOT NULL
      `);
      
      console.log('迁移成功：已添加grade字段并复制数据，已添加subject_id字段并尝试关联');
    } catch (error) {
      console.error('迁移失败:', error);
      throw error;
    }
  },
  
  down: async (queryInterface, Sequelize) => {
    try {
      // 删除新添加的字段
      await queryInterface.removeColumn('materials', 'grade');
      await queryInterface.removeColumn('materials', 'subject_id');
      console.log('回滚成功：已删除grade和subject_id字段');
    } catch (error) {
      console.error('回滚失败:', error);
      throw error;
    }
  }
};