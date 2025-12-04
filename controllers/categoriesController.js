const { Category, Material, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * 获取所有分类列表
 */
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC']
      ],
      attributes: ['id', 'name', 'level', 'grade', 'subject', 'parent_id', 'sort_order']
    });

    res.json({
      success: true,
      data: categories,
      message: '获取分类列表成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 获取指定分类下的所有子分类（支持文件夹浏览）
 */
exports.getChildrenByParentId = async (req, res, next) => {
  try {
    const { parentId } = req.params;

    // 查找指定父分类ID下的所有子分类
    const children = await Category.findAll({
      where: {
        parent_id: parentId
      },
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC']
      ],
      attributes: ['id', 'name', 'level', 'grade', 'subject', 'parent_id', 'sort_order', 'created_at']
    });

    res.json({
      success: true,
      data: children,
      message: '获取子分类列表成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 获取分类树形结构
 */
exports.getCategoryTree = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      order: [
        ['grade', 'ASC'],
        ['level', 'ASC'],
        ['sort_order', 'ASC'],
        ['id', 'ASC']
      ]
    });

    // 构建树形结构
    const buildTree = (parentId = null) => {
      return categories
        .filter(cat => cat.parent_id === parentId)
        .map(cat => {
          const category = cat.toJSON();
          
          // 对于所有分类都尝试查找子分类
          const children = buildTree(cat.id);
          if (children.length > 0) {
            category.children = children;
          }
          
          return category;
        });
    };

    const treeData = buildTree();

    res.json({
      success: true,
      data: treeData,
      message: '获取分类树成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 获取所有年级分类
 */
exports.getGrades = async (req, res, next) => {
  try {
    const grades = await Category.findAll({
      where: {
        parent_id: null
      },
      order: [
        ['grade', 'ASC'],
        ['sort_order', 'ASC']
      ],
      attributes: ['id', 'name', 'grade', 'level', 'sort_order']
    });

    res.json({
      success: true,
      data: grades,
      message: '获取年级列表成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 根据年级获取学期
 */
exports.getSemestersByGrade = async (req, res, next) => {
  try {
    const { gradeId } = req.params;

    const semesters = await Category.findAll({
      where: {
        parent_id: gradeId,
        subject: '学期'
      },
      order: [['sort_order', 'ASC']],
      attributes: ['id', 'name', 'level', 'grade', 'subject', 'sort_order']
    });

    res.json({
      success: true,
      data: semesters,
      message: '获取学期列表成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 根据学期获取科目
 */
exports.getSubjectsBySemester = async (req, res, next) => {
  try {
    const { semesterId } = req.params;

    const subjects = await Category.findAll({
      where: {
        parent_id: semesterId,
        subject: {
          [Op.not]: '学期' // 排除学期类型
        }
      },
      order: [['sort_order', 'ASC']],
      attributes: ['id', 'name', 'level', 'subject', 'sort_order']
    });

    res.json({
      success: true,
      data: subjects,
      message: '获取科目列表成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 根据年级级别获取分类
 */
exports.getCategoriesByLevel = async (req, res, next) => {
  try {
    const { level } = req.params;

    const categories = await Category.findAll({
      where: { level: parseInt(level) },
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'level', 'grade']
        }
      ],
      order: [['sort_order', 'ASC']],
      attributes: ['id', 'name', 'level', 'grade', 'subject', 'parent_id', 'sort_order']
    });

    res.json({
      success: true,
      data: categories,
      message: `获取${level}年级分类成功`
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 根据科目名称搜索分类
 */
exports.searchCategories = async (req, res, next) => {
  try {
    const { keyword, type } = req.query;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: '请输入搜索关键词'
      });
    }

    const where = {
      name: {
        [Op.like]: `%${keyword}%`
      }
    };

    // 按类型过滤
    if (type === 'grade') {
      where.parent_id = null;
    } else if (type === 'semester') {
      where.subject = '学期';
    } else if (type === 'subject') {
      where.subject = {
        [Op.not]: '学期',
        [Op.not]: null
      };
    }

    const categories = await Category.findAll({
      where,
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'level', 'grade']
        }
      ],
      order: [['level', 'ASC'], ['sort_order', 'ASC']],
      limit: 50
    });

    res.json({
      success: true,
      data: categories,
      message: `搜索到 ${categories.length} 个相关分类`
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 获取分类详情
 */
exports.getCategoryDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id, {
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'level', 'grade', 'subject']
        },
        {
          model: Category,
          as: 'children',
          attributes: ['id', 'name', 'level', 'grade', 'subject', 'sort_order'],
          order: [['sort_order', 'ASC']]
        },
        {
          model: Material,
          attributes: ['id', 'title', 'cover_image', 'price', 'is_free', 'download_count'],
          where: { status: 'published' },
          required: false
        }
      ]
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: '分类不存在'
      });
    }

    res.json({
      success: true,
      data: category,
      message: '获取分类详情成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 获取热门分类（按资料数量排序）
 */
exports.getPopularCategories = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const popularCategories = await Category.findAll({
      attributes: [
        'id',
        'name',
        'level',
        'grade',
        'subject',
        [sequelize.fn('COUNT', sequelize.col('materials.id')), 'material_count']
      ],
      include: [
        {
          model: Material,
          attributes: [],
          where: { status: 'published' },
          required: false
        }
      ],
      group: ['Category.id'],
      having: sequelize.where(sequelize.fn('COUNT', sequelize.col('materials.id')), '>', 0),
      order: [[sequelize.literal('material_count'), 'DESC']],
      limit: parseInt(limit),
      subQuery: false
    });

    res.json({
      success: true,
      data: popularCategories,
      message: '获取热门分类成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 获取指定分类及其所有子分类的ID列表（递归）
 */
exports.getAllDescendantIds = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    
    // 递归获取所有子分类ID
    const getAllChildrenIds = async (parentId) => {
      const children = await Category.findAll({
        where: { parent_id: parentId },
        attributes: ['id']
      });
      
      let allIds = [parentId];
      
      for (const child of children) {
        const childIds = await getAllChildrenIds(child.id);
        allIds = allIds.concat(childIds);
      }
      
      return allIds;
    };
    
    const allCategoryIds = await getAllChildrenIds(parseInt(categoryId));
    
    res.json({
      success: true,
      data: allCategoryIds,
      message: '获取分类及其子分类ID成功'
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * 获取分类统计信息
 */
exports.getCategoryStats = async (req, res, next) => {
  try {
    const stats = await Category.findAll({
      attributes: [
        'level',
        'subject',
        [sequelize.fn('COUNT', sequelize.col('id')), 'category_count'],
        [sequelize.fn('COUNT', sequelize.col('materials.id')), 'material_count'],
        [sequelize.fn('SUM', sequelize.col('materials.download_count')), 'total_downloads']
      ],
      include: [
        {
          model: Material,
          attributes: [],
          where: { status: 'published' },
          required: false
        }
      ],
      group: ['level', 'subject'],
      order: [['level', 'ASC']],
      raw: true,
      subQuery: false
    });

    // 格式化统计结果
    const formattedStats = {
      total_categories: 0,
      total_materials: 0,
      total_downloads: 0,
      by_level: {},
      by_subject: {}
    };

    stats.forEach(stat => {
      formattedStats.total_categories += parseInt(stat.category_count);
      formattedStats.total_materials += parseInt(stat.material_count);
      formattedStats.total_downloads += parseInt(stat.total_downloads) || 0;

      // 按年级统计
      if (!formattedStats.by_level[stat.level]) {
        formattedStats.by_level[stat.level] = {
          categories: 0,
          materials: 0,
          downloads: 0
        };
      }
      formattedStats.by_level[stat.level].categories += parseInt(stat.category_count);
      formattedStats.by_level[stat.level].materials += parseInt(stat.material_count);
      formattedStats.by_level[stat.level].downloads += parseInt(stat.total_downloads) || 0;

      // 按科目统计
      if (stat.subject && stat.subject !== '学期') {
        if (!formattedStats.by_subject[stat.subject]) {
          formattedStats.by_subject[stat.subject] = {
            categories: 0,
            materials: 0,
            downloads: 0
          };
        }
        formattedStats.by_subject[stat.subject].categories += parseInt(stat.category_count);
        formattedStats.by_subject[stat.subject].materials += parseInt(stat.material_count);
        formattedStats.by_subject[stat.subject].downloads += parseInt(stat.total_downloads) || 0;
      }
    });

    res.json({
      success: true,
      data: formattedStats,
      message: '获取分类统计成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 根据路径获取分类（年级/学期/科目）
 */
exports.getCategoryByPath = async (req, res, next) => {
  try {
    const { grade, semester, subject } = req.query;

    if (!grade) {
      return res.status(400).json({
        success: false,
        error: '必须指定年级'
      });
    }

    // 查找年级
    const gradeCategory = await Category.findOne({
      where: {
        name: grade,
        parent_id: null
      }
    });

    if (!gradeCategory) {
      return res.status(404).json({
        success: false,
        error: '年级不存在'
      });
    }

    let result = {
      grade: gradeCategory
    };

    // 如果指定了学期
    if (semester) {
      const semesterCategory = await Category.findOne({
        where: {
          name: semester,
          parent_id: gradeCategory.id,
          subject: '学期'
        }
      });

      if (!semesterCategory) {
        return res.status(404).json({
          success: false,
          error: '学期不存在'
        });
      }

      result.semester = semesterCategory;

      // 如果指定了科目
      if (subject) {
        const subjectCategory = await Category.findOne({
          where: {
            name: subject,
            parent_id: semesterCategory.id,
            subject: subject
          }
        });

        if (!subjectCategory) {
          return res.status(404).json({
            success: false,
            error: '科目不存在'
          });
        }

        result.subject = subjectCategory;
      }
    }

    res.json({
      success: true,
      data: result,
      message: '获取分类路径成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 创建新分类（文件夹）
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, parent_id } = req.body;

    // 验证必填字段
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '分类名称不能为空'
      });
    }

    // 验证分类名称长度
    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        error: '分类名称不能超过100个字符'
      });
    }

    // 如果有父分类，验证父分类是否存在
    if (parent_id) {
      const parentCategory = await Category.findByPk(parent_id);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          error: '父分类不存在'
        });
      }
    }

    // 检查同级分类下是否已存在同名分类
    const existingCategory = await Category.findOne({
      where: {
        name: name.trim(),
        parent_id: parent_id || null
      }
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        error: '该分类名称已存在'
      });
    }

    // 确定分类的级别和类型
    let level = 1;
    let subject = '其他';
    let grade=0;
    if (parent_id) {
      const parentCategory = await Category.findByPk(parent_id);
      if (parentCategory) {
        level = parentCategory.level + 1;
        // 根据层级确定科目类型
        if (level === 2) {
          subject = '学期';
        } else if (level === 3) {
          subject = name.trim();
        } else {
          subject = parentCategory.subject || '其他';
        }
        grade = parentCategory.grade;
      }
    } else {
      // 顶级分类（年级）
      subject = name.trim();
    }

    // 计算排序号
    const maxSortOrder = await Category.max('sort_order', {
      where: {
        parent_id: parent_id || null
      }
    });
    const sortOrder = (maxSortOrder || 0) + 1;

    // 创建新分类
    const newCategoryData = {
      name: name.trim(),
      parent_id: parent_id || null,
      level: level,
      subject: subject,
      sort_order: sortOrder,
      grade: grade
    };
    
    // 对于顶级分类（年级），设置grade值
    if (!parent_id) {
      // 获取最大的grade值，然后加1
      const maxGrade = await Category.max('grade', {
        where: { parent_id: null }
      });
      newCategoryData.grade = maxGrade !== null ? maxGrade + 1 : 0;
    }
    
    const newCategory = await Category.create(newCategoryData);

    res.json({
      success: true,
      data: newCategory,
      message: '分类创建成功'
    });

  } catch (error) {
    console.error('创建分类失败:', error);
    next(error);
  }
};

/**
 * 删除分类（文件夹）
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    console.log('Delete category called with params:', req.params);
    const { id } = req.params;
    
    // 验证ID
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: '无效的分类ID'
      });
    }
    
    // 查找分类
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: '分类不存在'
      });
    }
    
    // 检查是否有子分类
    const childCategories = await Category.findOne({
      where: { parent_id: id }
    });
    
    if (childCategories) {
      return res.status(409).json({
        success: false,
        error: '该分类下还有子分类，不能删除'
      });
    }
    
    // 检查是否有关联的资源文件
    const materials = await Material.findOne({
      where: { category_id: id }
    });
    
    if (materials) {
      return res.status(409).json({
        success: false,
        error: '该分类下还有资源文件，不能删除'
      });
    }
    
    // 执行删除
    await category.destroy();
    
    res.json({
      success: true,
      message: '分类删除成功'
    });
    
  } catch (error) {
    console.error('删除分类失败:', error);
    next(error);
  }
};

/**
 * 更新分类（移动文件夹）
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, parent_id } = req.body;

    // 验证ID
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: '无效的分类ID'
      });
    }

    // 查找要更新的分类
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: '分类不存在'
      });
    }

    // 如果有新的父分类ID，验证父分类是否存在
    if (parent_id !== undefined && parent_id !== null) {
      const parentCategory = await Category.findByPk(parent_id);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          error: '父分类不存在'
        });
      }

      // 检查是否尝试移动到自身或自己的子分类下
      if (parseInt(parent_id) === parseInt(id)) {
        return res.status(400).json({
          success: false,
          error: '不能将分类移动到自身下'
        });
      }

      // 检查是否尝试移动到自己的子分类下
      const descendants = await exports.getAllDescendantIdsHelper(id);
      if (descendants.includes(parseInt(parent_id))) {
        return res.status(400).json({
          success: false,
          error: '不能将分类移动到自己的子分类下'
        });
      }

      // 检查目标父分类下是否已存在同名分类
      const existingCategory = await Category.findOne({
        where: {
          name: name || category.name,
          parent_id: parent_id,
          id: { [Op.ne]: id } // 排除当前分类
        }
      });

      if (existingCategory) {
        return res.status(409).json({
          success: false,
          error: '目标分类下已存在同名分类'
        });
      }
    }

    // 更新分类信息
    const updateData = {};
    if (name !== undefined && name !== null) {
      updateData.name = name.trim();
    }
    if (parent_id !== undefined && parent_id !== null) {
      updateData.parent_id = parent_id;
      
      // 如果移动了父分类，需要更新level
      if (parseInt(parent_id) === 0 || parent_id === null) {
        updateData.level = 1;
        // 如果移动到顶级，设置grade值
        const maxGrade = await Category.max('grade', {
          where: { parent_id: null }
        });
        updateData.grade = maxGrade !== null ? maxGrade + 1 : 0;
      } else {
        const parentCategory = await Category.findByPk(parent_id);
        if (parentCategory) {
          updateData.level = parentCategory.level + 1;
          // 非顶级分类不设置grade
          updateData.grade = null;
        }
      }
    }

    await category.update(updateData);

    res.json({
      success: true,
      data: category,
      message: '分类更新成功'
    });

  } catch (error) {
    console.error('更新分类失败:', error);
    next(error);
  }
};

/**
 * 获取所有后代分类ID的辅助函数
 */
exports.getAllDescendantIdsHelper = async (categoryId) => {
  const descendantIds = [];
  
  const findDescendants = async (parentId) => {
    const children = await Category.findAll({
      where: { parent_id: parentId },
      attributes: ['id']
    });
    
    for (const child of children) {
      descendantIds.push(child.id);
      await findDescendants(child.id);
    }
  };
  
  await findDescendants(categoryId);
  return descendantIds;
};

/**
 * 批量删除分类（文件夹）
 */
exports.batchDeleteCategories = async (req, res, next) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供要删除的分类ID列表'
      });
    }

    console.log(`Batch delete categories called with body:`, { ids });

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // 逐个删除分类
    for (const id of ids) {
      try {
        // 查找分类
        const category = await Category.findByPk(id);
        if (!category) {
          results.push({
            id: id,
            success: false,
            error: '分类不存在'
          });
          failedCount++;
          continue;
        }
        
        // 检查是否有子分类
        const childCategories = await Category.findOne({
          where: { parent_id: id }
        });
        
        if (childCategories) {
          results.push({
            id: id,
            success: false,
            error: '该分类下还有子分类，不能删除'
          });
          failedCount++;
          continue;
        }
        
        // 检查是否有关联的资源文件
        const materials = await Material.findOne({
          where: { category_id: id }
        });
        
        if (materials) {
          results.push({
            id: id,
            success: false,
            error: '该分类下还有资源文件，不能删除'
          });
          failedCount++;
          continue;
        }
        
        // 执行删除
        await category.destroy();
        
        results.push({
          id: id,
          success: true
        });
        successCount++;
        
      } catch (error) {
        console.error(`删除分类 ${id} 失败:`, error);
        results.push({
          id: id,
          success: false,
          error: error.message || '删除失败'
        });
        failedCount++;
      }
    }

    res.json({
      success: true,
      data: {
        total: ids.length,
        success: successCount,
        failed: failedCount,
        results: results
      },
      message: `批量删除完成：成功 ${successCount} 个，失败 ${failedCount} 个`
    });

  } catch (error) {
    console.error('批量删除分类失败:', error);
    next(error);
  }
};