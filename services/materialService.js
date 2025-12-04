const { Material, Category, User, DownloadLog, MaterialExchange, UserMembership } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class MaterialService {
  // 获取资料列表（带高级筛选和访问权限标记）
  static async getMaterials(filters = {}, page = 1, limit = 20, userId = null) {
    const {
      category_id,
      grade_level,
      subject,
      is_free,
      keyword,
      tags,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = filters;

    const where = { status: 'published' };
    const include = [{
      model: Category,
      attributes: ['id', 'name', 'level', 'subject']
    }];

    // 构建查询条件
    if (category_id) where.category_id = category_id;
    if (grade_level) where.grade_level = grade_level;
    if (subject) where.subject = subject;
    if (is_free !== undefined) where.is_free = is_free === 'true';
    
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } }
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = {
        [Op.overlap]: tags // JSON数组重叠查询
      };
    }

    const order = [];
    if (sort_by === 'popular') {
      order.push(['download_count', 'DESC']);
    } else if (sort_by === 'price') {
      order.push(['price', sort_order]);
    } else {
      order.push([sort_by, sort_order]);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Material.findAndCountAll({
      where,
      include,
      attributes: {
        exclude: ['file_url'], // 敏感信息不返回
        include: ['cover_image'] // 包含预览图字段
      },
      order,
      limit: parseInt(limit),
      offset: offset
    });

    // 为每个资料添加访问权限状态
    let materialsWithAccess = rows;
    if (userId) {
      materialsWithAccess = await Promise.all(rows.map(async (material) => {
        const canAccess = await this.checkMaterialAccess(userId, material.id, material);
        return {
          ...material.toJSON(),
          can_access: canAccess
        };
      }));
    } else {
      // 未登录用户只对免费资料有访问权限
      materialsWithAccess = rows.map(material => ({
        ...material.toJSON(),
        can_access: material.is_free
      }));
    }

    return {
      data: materialsWithAccess,
      pagination: {
        current: parseInt(page),
        total: count,
        pageSize: parseInt(limit),
        totalPages: Math.ceil(count / limit)
        }
      };
    }
    
    // 递归获取所有子分类ID
    static async getAllChildCategoryIds(parentId) {
      const childCategories = await Category.findAll({
        where: { parent_id: parentId },
        attributes: ['id']
      });
      
      let allChildIds = [];
      for (const child of childCategories) {
        allChildIds.push(child.id);
        // 递归获取更深层级的子分类
        const deeperChildIds = await this.getAllChildCategoryIds(child.id);
        allChildIds = [...allChildIds, ...deeperChildIds];
      }
      
      return allChildIds;
    }
    
    // 深度查询材料（跳过版本层级，支持版本过滤）
    static async getMaterialsByDepth(categoryId, options = {}) {
      try {
        // 日志输出，方便调试
        console.log('getMaterialsByDepth参数:', { categoryId, options });
        
        // 确保参数正确解析
        const page = parseInt(options.page) || 1;
        const limit = parseInt(options.limit) || 20;
        
        // 获取当前分类和所有层级的子分类ID
        let categoryIds = [categoryId];
        
        // 使用递归方法获取所有子分类ID
        const allChildIds = await this.getAllChildCategoryIds(categoryId);
        categoryIds = [...categoryIds, ...allChildIds];
        
        console.log('需要查询的分类ID列表:', categoryIds);
        
        // 构建基础查询条件
        const where = {
          category_id: { [Op.in]: categoryIds }
        };
        
        // 处理grade_level和subject参数（优先使用旧参数名）
        if (options.grade_level) {
          where.grade_level = options.grade_level;
        } else if (options.grade) {
          where.grade = options.grade;
        }
        
        if (options.subject) {
          where.subject = options.subject;
        } else if (options.subject_id) {
          where.subject_id = options.subject_id;
        }
        
        // 处理关键词搜索
        if (options.keyword) {
          where[Op.or] = [
            { title: { [Op.like]: `%${options.keyword}%` } },
            { description: { [Op.like]: `%${options.keyword}%` } }
          ];
        }
        
        // 处理免费资源过滤
        if (options.is_free !== undefined) {
          where.is_free = options.is_free === 'true' || options.is_free === true;
        }
        
        console.log('最终查询条件:', where);
        
        // 查询所有符合条件的资料
        const materials = await Material.findAndCountAll({
          where: where,
          offset: (page - 1) * limit,
          limit: limit,
          order: [['created_at', 'DESC']]
        });
        
        console.log('查询结果:', { count: materials.count, rows: materials.rows.length });
        
        return materials;
      } catch (error) {
        console.error('获取深度资料失败:', error);
        throw error;
      }
    }
    
    // 递归获取所有子分类ID方法已在文件后面定义

    // 获取资料详情
  static async getMaterialDetail(materialId, userId = null) {
    const material = await Material.findByPk(materialId, {
      include: [{
        model: Category,
        attributes: ['id', 'name', 'level']
      }]
    });

    if (!material) {
      throw new Error('资料不存在');
    }

    // 增加浏览量
    await material.increment('view_count');
    // 增加下载次数（每次查看详情时+1）
    await material.increment('download_count');

    // 检查用户是否有权限访问文件
    let canAccess = material.is_free;
    if (userId && !canAccess) {
      // 检查资料访问权限（考虑会员类型、已购买和学期兑换）
      canAccess = await this.checkMaterialAccess(userId, materialId, material);
    }

    const result = material.toJSON();
    if (!canAccess) {
      delete result.file_url; // 无权限时隐藏文件URL
    }

    return {
      ...result,
      can_access: canAccess
    };
  }

  // 检查用户对资料的访问权限
  static async checkMaterialAccess(userId, materialId, material = null) {
    // 如果提供了material对象，直接使用；否则从数据库查询
    const materialInfo = material || await Material.findByPk(materialId, {
      include: [{ model: Category, attributes: ['id', 'level', 'subject'] }]
    });

    if (!materialInfo) {
      throw new Error('资料不存在');
    }

    // 检查是否已购买
    const downloadLog = await DownloadLog.findOne({
      where: {
        user_id: userId,
        material_id: materialId
      }
    });

    if (downloadLog) {
      // 检查下载记录是否过期（如果有过期时间的话）
      if (!downloadLog.expiry_date || new Date(downloadLog.expiry_date) >= new Date()) {
        return true;
      }
      // 如果是兑换获取的资料，即使过期也可以访问
      if (downloadLog.access_type === 'exchange') {
        return true;
      }
    }

    // 检查用户会员信息
    const userMembership = await UserMembership.findOne({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });

    if (userMembership) {
      // 检查会员是否过期
      const membershipExpired = userMembership.expiry_date && new Date(userMembership.expiry_date) < new Date();
      
      // 全册会员（小学全册或初中全册）
      if (userMembership.membership_type === 'primary_full' || userMembership.membership_type === 'junior_full') {
        // 全册会员对特定学段的资料都有访问权
        const isPrimaryMaterial = materialInfo.grade_level && materialInfo.grade_level.includes('小学');
        const isJuniorMaterial = materialInfo.grade_level && materialInfo.grade_level.includes('初中');
        
        if ((userMembership.membership_type === 'primary_full' && isPrimaryMaterial) ||
            (userMembership.membership_type === 'junior_full' && isJuniorMaterial)) {
          // 全册会员即使过期也能访问已兑换的资料
          return true;
        }
      }
      
      // 积分会员（会员积分类型）
      if (userMembership.membership_type === 'points' && !membershipExpired) {
        // 积分会员需要兑换才能访问特定学期的资料
        const semester = this.extractSemesterFromMaterial(materialInfo);
        const grade = this.extractGradeFromMaterial(materialInfo);
        
        if (semester && grade) {
          const exchanged = await MaterialExchange.findOne({
            where: {
              user_id: userId,
              grade: grade,
              semester: semester
            }
          });
          
          if (exchanged) {
            return true;
          }
        }
      }
    }

    // 默认无访问权限
    return false;
  }

  // 从资料信息中提取学期信息
  static extractSemesterFromMaterial(material) {
    // 假设资料标题或描述中包含学期信息，如"上册"、"下册"、"第一学期"、"第二学期"
    const title = material.title || '';
    const desc = material.description || '';
    const text = title + ' ' + desc;
    
    if (text.includes('第一学期') || text.includes('上册') || text.includes('上学期')) {
      return 'first';
    } else if (text.includes('第二学期') || text.includes('下册') || text.includes('下学期')) {
      return 'second';
    }
    
    return null;
  }

  // 从资料信息中提取年级信息
  static extractGradeFromMaterial(material) {
    // 从年级等级或标题中提取年级信息
    const gradeLevel = material.grade_level || '';
    const title = material.title || '';
    
    // 匹配小学和初中的年级信息
    const gradePattern = /(一年级|二年级|三年级|四年级|五年级|六年级|初一|初二|初三|七年级|八年级|九年级)/;
    const match = gradeLevel.match(gradePattern) || title.match(gradePattern);
    
    if (match) {
      return match[0];
    }
    
    return null;
  }

  // 搜索资料
  static async searchMaterials(keyword, options = {}) {
    const {
      page = 1,
      limit = 20,
      fields = ['title']  // 只在title字段中搜索，不搜索description和subject
    } = options;

    const where = {
      status: 'published',
      title: { [Op.like]: `%${keyword}%` }  // 直接在title字段中搜索，不再使用OR条件
    };

    const { count, rows } = await Material.findAndCountAll({
      where,
      include: [{
        model: Category,
        attributes: ['id', 'name']
      }],
      attributes: {
        exclude: ['file_url']
      },
      order: [
        // 移除全文搜索，只按下载量排序
        ['download_count', 'DESC'],
        ['created_at', 'DESC']
      ],
      limit: parseInt(limit),
      offset: (page - 1) * limit
    });

    return {
      data: rows,
      total: count,
      keyword: keyword
    };
  }

  // 获取热门资料
  static async getPopularMaterials(limit = 10) {
    return await Material.findAll({
      where: { status: 'published' },
      order: [['download_count', 'DESC']],
      limit: parseInt(limit),
      attributes: {
        exclude: ['file_url']
      }
    });
  }

  // 获取分类下的资料统计
  static async getCategoryStats() {
    const stats = await Material.findAll({
      where: { status: 'published' },
      attributes: [
        'category_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'material_count'],
        [sequelize.fn('SUM', sequelize.col('download_count')), 'total_downloads']
      ],
      group: ['category_id'],
      include: [{
        model: Category,
        attributes: ['id', 'name']
      }],
      raw: true
    });

    return stats;
  }

  // 获取指定分类及其所有子分类的资料列表（递归查询）
  static async getMaterialsByCategoryWithChildren(categoryId, filters = {}, page = 1, limit = 20, userId = null) {
    const { Category } = require('../models');
    
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

    // 获取所有相关分类ID
    const allCategoryIds = await getAllChildrenIds(parseInt(categoryId));

    const {
      grade_level,
      subject,
      is_free,
      keyword,
      tags,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = filters;

    const where = { 
      status: 'published',
      category_id: {
        [Op.in]: allCategoryIds
      }
    };
    
    const include = [{
      model: Category,
      attributes: ['id', 'name', 'level', 'subject']
    }];

    // 构建其他查询条件
    if (grade_level) where.grade_level = grade_level;
    if (subject) where.subject = subject;
    if (is_free !== undefined) where.is_free = is_free === 'true';
    
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } }
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = {
        [Op.overlap]: tags
      };
    }

    const order = [];
    if (sort_by === 'popular') {
      order.push(['download_count', 'DESC']);
    } else if (sort_by === 'price') {
      order.push(['price', sort_order]);
    } else {
      order.push([sort_by, sort_order]);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Material.findAndCountAll({
      where,
      include,
      attributes: {
        exclude: ['file_url']
      },
      order,
      limit: parseInt(limit),
      offset: offset
    });

    // 为每个资料添加访问权限状态
    let materialsWithAccess = rows;
    if (userId) {
      materialsWithAccess = await Promise.all(rows.map(async (material) => {
        const canAccess = await this.checkMaterialAccess(userId, material.id, material);
        return {
          ...material.toJSON(),
          can_access: canAccess
        };
      }));
    } else {
      // 未登录用户只对免费资料有访问权限
      materialsWithAccess = rows.map(material => ({
        ...material.toJSON(),
        can_access: material.is_free
      }));
    }

    return {
      data: materialsWithAccess,
      pagination: {
        current: parseInt(page),
        total: count,
        pageSize: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

    // 重命名资料
    static async renameMaterial(materialId, newTitle) {
      const material = await Material.findByPk(materialId);
      if (!material) {
        throw new Error('资料不存在');
      }

      // 开始事务
      const transaction = await sequelize.transaction();
      
      try {
        // 更新数据库中的标题
        await material.update({ title: newTitle }, { transaction });
        
        // 提交事务
        await transaction.commit();
        
        return { success: true, material };
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }

    // 重命名文件（可选，用于文件系统中的实际重命名）
    static async renameMaterialFile(materialId, newFileName) {
      const material = await Material.findByPk(materialId);
      if (!material) {
        throw new Error('资料不存在');
      }

      // 获取原始文件路径
      const originalFilePath = path.join(__dirname, '..', material.file_url.replace('/uploads/', 'uploads/'));
      const fileExtension = path.extname(originalFilePath);
      
      // 生成新的文件路径
      const safeFileName = newFileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const newFilePath = path.join(path.dirname(originalFilePath), `${safeFileName}${fileExtension}`);
      
      // 检查文件是否存在
      if (!fs.existsSync(originalFilePath)) {
        throw new Error('原始文件不存在');
      }

      try {
        // 重命名文件
        fs.renameSync(originalFilePath, newFilePath);
        
        // 更新数据库中的文件URL
        const newFileUrl = `/uploads/${path.relative(path.join(__dirname, '..', 'uploads'), newFilePath)}`;
        await material.update({ file_url: newFileUrl });
        
        return { success: true, material };
      } catch (error) {
        throw new Error(`文件重命名失败: ${error.message}`);
      }
    }

    // 移动资料到其他分类
    static async moveMaterial(materialId, newCategoryId) {
      const material = await Material.findByPk(materialId);
      if (!material) {
        throw new Error('资料不存在');
      }

      // 检查目标分类是否存在
      const targetCategory = await Category.findByPk(newCategoryId);
      if (!targetCategory) {
        throw new Error('目标分类不存在');
      }

      // 开始事务
      const transaction = await sequelize.transaction();
      
      try {
        // 更新资料的分类
        await material.update({ category_id: newCategoryId }, { transaction });
        
        // 提交事务
        await transaction.commit();
        
        return { success: true, material };
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }
    
    // 递归获取所有子分类ID - 重写实现避免递归问题
  static async getAllChildCategoriesRecursively(categoryId) {
    // 使用非递归的方式获取所有子分类
    const allChildIds = [];
    const queue = [categoryId];
    
    while (queue.length > 0) {
      const currentId = queue.shift();
      
      // 获取当前ID的直接子分类
      const childCategories = await Category.findAll({
        where: {
          parent_id: currentId
        },
        attributes: ['id']
      });
      
      // 将子分类ID添加到结果和队列中
      for (const child of childCategories) {
        if (!allChildIds.includes(child.id)) {
          allChildIds.push(child.id);
          queue.push(child.id);
        }
      }
    }
    
    return allChildIds;
  }
  };

module.exports = MaterialService;