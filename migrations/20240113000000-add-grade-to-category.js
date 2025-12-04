'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * 添加grade字段到category表
     */
    await queryInterface.addColumn('categories', 'grade', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '年级，0-9，其中0代表幼升小'
    });

    /**
     * 更新现有数据的grade值
     * 将level字段表示年级的值转移到grade字段
     * 对于一级分类（年级），grade设置为对应的值，其他保持null
     */
    await queryInterface.sequelize.query(`
      UPDATE categories
      SET grade = CASE
        WHEN parent_id IS NULL THEN level
        ELSE NULL
      END
      WHERE grade IS NULL
    `);

    /**
     * 更新level字段的含义
     * 将level重置为表示层级的值
     * - 一级分类（年级）level = 1
     * - 二级分类（学期）level = 2
     * - 三级分类（科目）level = 3
     * - 四级分类（具体分类）level = 4
     */
    await queryInterface.sequelize.query(`
      WITH recursive CategoryLevels AS (
        SELECT 
          id, 
          parent_id,
          1 as depth
        FROM categories
        WHERE parent_id IS NULL
        
        UNION ALL
        
        SELECT 
          c.id, 
          c.parent_id,
          cl.depth + 1 as depth
        FROM categories c
        JOIN CategoryLevels cl ON c.parent_id = cl.id
      )
      UPDATE categories
      JOIN CategoryLevels cl ON categories.id = cl.id
      SET categories.level = cl.depth
    `);
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * 回滚操作：恢复level字段的原始含义
     * 首先对于一级分类（年级），将grade值恢复到level字段
     */
    await queryInterface.sequelize.query(`
      UPDATE categories
      SET level = grade
      WHERE parent_id IS NULL AND grade IS NOT NULL
    `);

    /**
     * 删除grade字段
     */
    await queryInterface.removeColumn('categories', 'grade');
  }
};
