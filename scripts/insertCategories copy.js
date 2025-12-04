const { sequelize } = require('../config/database');

const insertCategoriesFinal = async () => {
  try {
    console.log('开始插入分类数据...');
    
    // 先检查表结构
    const [tableInfo] = await sequelize.query(`
      DESCRIBE categories
    `);
    
    console.log('categories表结构:');
    tableInfo.forEach(column => {
      console.log(`- ${column.Field} (${column.Type})`);
    });
    
    // 清空表数据
    await sequelize.query('DELETE FROM categories');
    console.log('✅ 清空categories表数据');
    
    // 重置自增ID
    await sequelize.query('ALTER TABLE categories AUTO_INCREMENT = 1');
    console.log('✅ 重置自增ID');
    
    const categories = [
      // 年级分类 (level 0-9)
      { name: '幼升小', level: 0, subject: null, parent_id: null, sort_order: 1 },
      { name: '一年级', level: 1, subject: null, parent_id: null, sort_order: 2 },
      { name: '二年级', level: 2, subject: null, parent_id: null, sort_order: 3 },
      { name: '三年级', level: 3, subject: null, parent_id: null, sort_order: 4 },
      { name: '四年级', level: 4, subject: null, parent_id: null, sort_order: 5 },
      { name: '五年级', level: 5, subject: null, parent_id: null, sort_order: 6 },
      { name: '六年级', level: 6, subject: null, parent_id: null, sort_order: 7 },
      { name: '七年级', level: 7, subject: null, parent_id: null, sort_order: 8 },
      { name: '八年级', level: 8, subject: null, parent_id: null, sort_order: 9 },
      { name: '九年级', level: 9, subject: null, parent_id: null, sort_order: 10 },
    ];

    // 插入年级分类 - 使用参数化查询
    const gradeIds = {};
    for (const category of categories) {
      const [result] = await sequelize.query(
        'INSERT INTO categories (name, level, subject, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        {
          replacements: [category.name, category.level, category.subject, category.parent_id, category.sort_order],
          type: sequelize.QueryTypes.INSERT
        }
      );
      // 获取插入的ID
      const [insertIdResult] = await sequelize.query('SELECT LAST_INSERT_ID() as id');
      const insertId = insertIdResult[0].id;
      gradeIds[category.level] = insertId;
      console.log(`✅ 插入年级: ${category.name} (ID: ${insertId})`);
    }

    console.log('✅ 年级分类插入完成');

    // 学期分类 - 幼升小没有学期
    const semesters = [];
    const semesterIds = {};
    
    categories.forEach(grade => {
      // 只有一年级及以上才有学期
      if (grade.level > 0) {
        const gradeId = gradeIds[grade.level];
        semesters.push(
          { name: '上学期', level: grade.level, subject: '学期', parent_id: gradeId, sort_order: 1 },
          { name: '下学期', level: grade.level, subject: '学期', parent_id: gradeId, sort_order: 2 }
        );
      }
    });

    // 插入学期分类
    for (const semester of semesters) {
      await sequelize.query(
        'INSERT INTO categories (name, level, subject, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        {
          replacements: [semester.name, semester.level, semester.subject, semester.parent_id, semester.sort_order],
          type: sequelize.QueryTypes.INSERT
        }
      );
      
      // 获取插入的ID
      const [insertIdResult] = await sequelize.query('SELECT LAST_INSERT_ID() as id');
      const insertId = insertIdResult[0].id;
      const key = `${semester.level}_${semester.name}`;
      semesterIds[key] = insertId;
      const gradeName = categories.find(g => g.level === semester.level).name;
      console.log(`✅ 插入学期: ${gradeName} ${semester.name} (ID: ${insertId})`);
    }

    console.log('✅ 学期分类插入完成');

    // 科目分类
    const subjects = [];

    // 为幼升小直接添加科目（没有学期）
    const ysxParentId = gradeIds[0]; // 幼升小的ID
    const ysxSubjects = ['语文', '数学'];
    ysxSubjects.forEach((subjectName, index) => {
      subjects.push({
        name: subjectName,
        level: 0,
        subject: subjectName,
        parent_id: ysxParentId,
        sort_order: index + 1
      });
    });

    // 为其他年级的学期添加科目
    semesters.forEach(semester => {
      const gradeLevel = semester.level;
      const semesterKey = `${gradeLevel}_${semester.name}`;
      const parentId = semesterIds[semesterKey];
      
      let subjectList = [];
      
      if (gradeLevel <= 2) {
        subjectList = ['语文', '数学'];
      } else if (gradeLevel <= 6) {
        subjectList = ['语文', '数学', '英语'];
      } else {
        subjectList = ['语文', '数学', '英语', '生物', '道法', '历史', '地理'];
      }
      
      subjectList.forEach((subjectName, index) => {
        subjects.push({
          name: subjectName,
          level: gradeLevel,
          subject: subjectName,
          parent_id: parentId,
          sort_order: index + 1
        });
      });
    });

    // 插入科目分类
    for (const subject of subjects) {
      await sequelize.query(
        'INSERT INTO categories (name, level, subject, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        {
          replacements: [subject.name, subject.level, subject.subject, subject.parent_id, subject.sort_order],
          type: sequelize.QueryTypes.INSERT
        }
      );
    }

    console.log(`✅ 科目分类插入完成，共 ${subjects.length} 个科目`);

    // 验证插入结果
    const [results] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN parent_id IS NULL THEN 1 ELSE 0 END) as grades,
        SUM(CASE WHEN subject = '学期' THEN 1 ELSE 0 END) as semesters,
        SUM(CASE WHEN subject NOT IN ('学期', NULL) THEN 1 ELSE 0 END) as subjects
      FROM categories
    `);
    
    console.log('\n📊 插入结果统计:');
    console.log(`- 总分类数: ${results[0].total}`);
    console.log(`- 年级数量: ${results[0].grades}`);
    console.log(`- 学期数量: ${results[0].semesters}`);
    console.log(`- 科目数量: ${results[0].subjects}`);

    // 显示分类结构
    const [structure] = await sequelize.query(`
      SELECT 
        g.name as grade,
        s.name as semester,
        COUNT(sub.name) as subject_count
      FROM categories g
      LEFT JOIN categories s ON s.parent_id = g.id AND s.subject = '学期'
      LEFT JOIN categories sub ON sub.parent_id = s.id
      WHERE g.parent_id IS NULL
      GROUP BY g.id, s.id
      ORDER BY g.level, s.sort_order
    `);

    console.log('\n📚 分类结构:');
    structure.forEach(row => {
      console.log(`- ${row.grade} ${row.semester}: ${row.subject_count}个科目`);
    });

  } catch (error) {
    console.error('❌ 插入分类数据失败:', error.message);
    
    // 如果是字段不匹配错误，提供解决方案
    if (error.message.includes("Field 'createdAt' doesn't have a default value")) {
      console.log('\n💡 解决方案:');
      console.log('1. 检查数据库表字段名是 created_at 还是 createdAt');
      console.log('2. 或者重新创建表结构');
    }
    
    throw error;
  }
};

// 只有在直接运行此文件时才执行
if (require.main === module) {
  insertCategoriesFinal()
    .then(() => {
      console.log('\n🎉 分类数据插入完成！');
      console.log('📖 数据结构：年级 → 学期 → 科目');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 分类数据插入失败');
      process.exit(1);
    });
}

module.exports = insertCategoriesFinal;