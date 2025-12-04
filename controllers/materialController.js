const MaterialService = require('../services/materialService');
const OrderService = require('../services/orderService');
const { Material, Category, DownloadLog, sequelize } = require('../models');

exports.getMaterials = async (req, res, next) => {
  try {
    const result = await MaterialService.getMaterials(req.query);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

exports.getMaterialDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    // 获取用户ID（如果已登录）
    const userId = req.user ? req.user.userId : null;

    const material = await MaterialService.getMaterialDetail(id, userId);
    
    res.json({
      success: true,
      data: material
    });
  } catch (error) {
    next(error);
  }
};

exports.purchaseMaterial = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const material = await Material.findByPk(id, { transaction });
    if (!material) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: '资料不存在'
      });
    }

    // 检查是否已购买
    const existingDownload = await DownloadLog.findOne({
      where: { user_id: userId, material_id: id },
      transaction
    });

    if (existingDownload) {
      await transaction.rollback();
      return res.json({
        success: true,
        data: { file_url: material.file_url },
        message: '您已购买过此资料'
      });
    }

    // 免费资料直接下载
    if (material.is_free || material.price === 0) {
      await DownloadLog.create({
        user_id: userId,
        material_id: id
      }, { transaction });

      await material.increment('download_count', { transaction });
      await transaction.commit();

      return res.json({
        success: true,
        data: { file_url: material.file_url }
      });
    }

    // 付费资料创建订单
    const order = await OrderService.createOrder({
      user_id: userId,
      order_type: 'material',
      amount: material.price,
      material_id: material.id
    }, transaction);

    // 简化处理：直接标记为已支付
    await OrderService.handlePaymentSuccess(order.order_no, {
      payment_method: 'balance'
    }, transaction);

    await transaction.commit();

    res.json({
      success: true,
      data: {
        file_url: material.file_url,
        order_id: order.id,
        order_no: order.order_no
      }
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      order: [['level', 'ASC'], ['sort_order', 'ASC']]
    });
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

exports.searchMaterials = async (req, res, next) => {
  try {
    // 同时支持'q'和'keyword'参数，优先使用'q'，如果'q'不存在则使用'keyword'
    const query = req.query.q || req.query.keyword;
    const page = req.query.page || 1;
    const limit = req.query.limit || req.query.pageSize || 20;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: '请输入搜索关键词'
      });
    }

    const result = await MaterialService.searchMaterials(query, { page, limit });
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

exports.getPopularMaterials = async (req, res, next) => {
  try {
    const materials = await MaterialService.getPopularMaterials(10);
    res.json({
      success: true,
      data: materials
    });
  } catch (error) {
    next(error);
  }
};

exports.downloadMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // 检查下载权限
    const canDownload = await DownloadLog.findOne({
      where: { user_id: userId, material_id: id }
    });

    if (!canDownload) {
      return res.status(403).json({
        success: false,
        error: '请先购买此资料'
      });
    }

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '资料不存在'
      });
    }

    // 返回文件URL（实际生产环境应该生成临时下载链接）
    res.json({
      success: true,
      data: {
        download_url: material.file_url,
        file_name: material.title
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 重命名资料
 */
exports.renameMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newTitle } = req.body;
    
    // 验证参数
    if (!newTitle || newTitle.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '新标题不能为空'
      });
    }
    
    const result = await MaterialService.renameMaterial(id, newTitle.trim());
    
    res.json({
      success: true,
      message: '资料重命名成功',
      data: result.material
    });
  } catch (error) {
    console.error('重命名资料失败:', error);
    next(error);
  }
};

/**
 * 重命名资料文件
 */
exports.renameMaterialFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newFileName } = req.body;
    
    // 验证参数
    if (!newFileName || newFileName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '新文件名不能为空'
      });
    }
    
    const result = await MaterialService.renameMaterialFile(id, newFileName.trim());
    
    res.json({
      success: true,
      message: '文件重命名成功',
      data: result.material
    });
  } catch (error) {
    console.error('重命名文件失败:', error);
    next(error);
  }
};

/**
 * 移动资料
 */
exports.moveMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newCategoryId } = req.body;
    
    // 验证参数
    if (!newCategoryId) {
      return res.status(400).json({
        success: false,
        error: '目标分类ID不能为空'
      });
    }
    
    const result = await MaterialService.moveMaterial(id, newCategoryId);
    
    res.json({
      success: true,
      message: '资料移动成功',
      data: result.material
    });
  } catch (error) {
    console.error('移动资料失败:', error);
    next(error);
  }
};

/**
 * 根据分类ID获取材料列表（用于文件夹浏览）
 */
exports.getMaterialsByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 50, include_children = 'true' } = req.query;

    let result;
    
    // 根据参数决定是否包含子分类的文件
    if (include_children === 'true') {
      // 使用递归查询获取当前分类及其所有子分类的文件
      result = await MaterialService.getMaterialsByCategoryWithChildren(
        categoryId,
        {},
        parseInt(page),
        parseInt(limit)
      );
    } else {
      // 只查询当前分类的直接文件
      result = await MaterialService.getMaterials(
        { category_id: categoryId },
        parseInt(page),
        parseInt(limit)
      );
    }

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message: include_children === 'true' ? '获取分类及其子分类下的材料成功' : '获取分类下的材料成功'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 删除资料
 */
exports.deleteMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log(`Delete material called with params:`, { id });

    // 查找资料
    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '资料不存在'
      });
    }

    // 删除资料
    await material.destroy();

    res.json({
      success: true,
      message: '资料删除成功'
    });

  } catch (error) {
    console.error('删除资料失败:', error);
    next(error);
  }
};

/**
 * 获取首页资料列表（按更新时间排序）
 */
exports.getHomeMaterials = async (req, res, next) => {
  try {
    const { limit = 20, page = 1, grade_level } = req.query;
    
    // 构建查询条件
    const filters = {
      sort_by: 'updated_at',
      sort_order: 'DESC',
      status: 'published'
    };
    
    // 如果指定了年级筛选
    if (grade_level) {
      filters.grade_level = grade_level;
    }
    
    const result = await MaterialService.getMaterials(filters, parseInt(page), parseInt(limit));
    
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
    
  } catch (error) {
    console.error('获取首页资料列表失败:', error);
    next(error);
  }
};

/**
 * 批量删除资料
 */
exports.batchDeleteMaterials = async (req, res, next) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供要删除的资料ID列表'
      });
    }

    console.log(`Batch delete materials called with body:`, { ids });

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // 逐个删除资料
    for (const id of ids) {
      try {
        const material = await Material.findByPk(id);
        if (!material) {
          results.push({
            id: id,
            success: false,
            error: '资料不存在'
          });
          failedCount++;
          continue;
        }

        await material.destroy();
        results.push({
          id: id,
          success: true
        });
        successCount++;
      } catch (error) {
        console.error(`删除资料 ${id} 失败:`, error);
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
    console.error('批量删除资料失败:', error);
    next(error);
  }
};

// 深度查询材料（跳过版本层级，支持版本过滤）
exports.getMaterialsByDepth = async (req, res, next) => {
  try {
    // 获取路径参数，支持两种格式：categoryId或id（兼容小程序调用）
    const categoryId = req.params.categoryId || req.params.id;
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: '分类ID不能为空'
      });
    }
    
    console.log('收到深度查询请求:', { categoryId, query: req.query });
    
    // 解析查询参数
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const keyword = req.query.keyword || '';
    const grade_level = req.query.grade_level || '';
    const subject = req.query.subject || '';
    const grade = req.query.grade || '';
    const subject_id = req.query.subject_id || '';
    
    // 正确处理is_free参数
    let is_free = undefined;
    if (req.query.is_free !== undefined) {
      is_free = req.query.is_free === true || req.query.is_free === 'true';
    }
    
    // 调用服务层方法获取深度查询结果
    const result = await MaterialService.getMaterialsByDepth(categoryId, {
      page,
      limit,
      keyword,
      grade_level,
      subject,
      grade,
      subject_id,
      is_free
    });
    
    res.status(200).json({
      success: true,
      message: '深度查询材料成功',
      data: result.rows,
      total: result.count,
      pagination: {
        current: page,
        pageSize: limit,
        total: result.count,
        totalPages: Math.ceil(result.count / limit)
      }
    });
  } catch (error) {
    console.error('深度查询材料失败:', error);
    if (error.message === '分类不存在') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || '深度查询材料失败'
    });
  }
};