const { Banner, Notice } = require('../models');
const { sequelize } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

// 确保uploads目录存在
const uploadDir = path.join(__dirname, '..', 'uploads', 'banners');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'banner-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 只接受图片文件
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只支持图片文件'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  }
});

// 导出upload对象，供路由使用
exports.upload = upload;

// 单文件上传配置（用于前端组件）
const uploadConfig = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 只接受图片文件
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只支持图片文件'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  }
});

// 导出upload对象，供路由使用
exports.uploadConfig = uploadConfig;

// 配置批量图片上传
exports.uploadMultiple = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 只接受图片文件
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只支持图片文件'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  }
});

// 处理单张图片上传
exports.handleSingleImageUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请选择要上传的图片' });
    }
    
    // 构建图片的访问URL
    const imageUrl = `/uploads/banners/${req.file.filename}`;
    
    console.log('图片上传成功:', imageUrl);
    
    // 返回符合Element UI Upload组件预期的格式
    res.json({
      code: 200,
      message: '上传成功',
      url: imageUrl // Element UI Upload组件需要的URL字段
    });
  } catch (error) {
    console.error('图片上传失败:', error);
    res.status(500).json({ code: 500, message: '图片上传失败: ' + error.message });
  }
};

// 获取所有banner（支持分页和筛选）
exports.getAllBanners = async (req, res) => {
  try {
    const { page = 1, limit = 10, is_active } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }
    
    const banners = await Banner.findAll({
      where,
      order: [['sort_order', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    const total = await Banner.count({ where });
    
    res.status(200).json({
      success: true,
      data: {
        banners,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 获取单个banner
exports.getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findByPk(req.params.id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner不存在'
      });
    }
    res.status(200).json({
      success: true,
      data: banner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 创建banner（包含图片上传）
exports.createBanner = async (req, res) => {
  try {
    // 处理文件上传
    upload.single('image')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请上传banner图片'
        });
      }
      
      const { title, link_url, sort_order = 0, is_active = true } = req.body;
      
      // 创建banner记录
      const banner = await Banner.create({
        image_url: `/uploads/banners/${req.file.filename}`,
        title,
        link_url,
        sort_order: parseInt(sort_order),
        is_active: is_active === 'true' || is_active === true
      });
      
      res.status(201).json({
        success: true,
        data: banner,
        message: 'Banner创建成功'
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 更新banner
exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findByPk(req.params.id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner不存在'
      });
    }
    
    // 处理可能的文件上传
    upload.single('image')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      
      const updateData = req.body;
      
      // 如果有新图片上传，更新图片URL并删除旧图片
      if (req.file) {
        // 删除旧图片
        if (banner.image_url) {
          const oldImagePath = path.join(__dirname, '..', banner.image_url);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        updateData.image_url = `/uploads/banners/${req.file.filename}`;
      }
      
      // 更新其他字段
      if (updateData.sort_order !== undefined) {
        updateData.sort_order = parseInt(updateData.sort_order);
      }
      if (updateData.is_active !== undefined) {
        updateData.is_active = updateData.is_active === 'true' || updateData.is_active === true;
      }
      
      await banner.update(updateData);
      
      res.status(200).json({
        success: true,
        data: banner,
        message: 'Banner更新成功'
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 删除banner
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByPk(req.params.id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner不存在'
      });
    }
    
    // 删除图片文件
    if (banner.image_url) {
      const imagePath = path.join(__dirname, '..', banner.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await banner.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Banner删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 切换banner激活状态
exports.toggleBannerStatus = async (req, res) => {
  try {
    const banner = await Banner.findByPk(req.params.id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner不存在'
      });
    }
    
    banner.is_active = !banner.is_active;
    await banner.save();
    
    res.status(200).json({
      success: true,
      data: banner,
      message: `Banner已${banner.is_active ? '激活' : '禁用'}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 获取前端显示的banner列表（仅激活状态）
exports.getActiveBanners = async (req, res) => {
  try {
    const banners = await Banner.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC']],
      attributes: ['id', 'image_url', 'title', 'link_url']
    });
    
    res.status(200).json({
      success: true,
      data: banners
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Notice 相关控制器函数

// 获取所有公告（支持分页和筛选）
exports.getAllNotices = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, search = '' } = req.query;
    
    const query = {};
    if (search) {
      query[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const offset = (page - 1) * pageSize;
    
    const { count, rows } = await Notice.findAndCountAll({
      where: query,
      order: [['display_order', 'ASC'], ['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: offset
    });
    
    res.status(200).json({
      total: count,
      pages: Math.ceil(count / pageSize),
      currentPage: parseInt(page),
      data: rows
    });
  } catch (error) {
    console.error('获取公告列表失败:', error);
    res.status(500).json({ message: '获取公告列表失败', error: error.message });
  }
};

// 获取单个公告
exports.getNoticeById = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findByPk(id);
    
    if (!notice) {
      return res.status(404).json({ message: '公告不存在' });
    }
    
    res.status(200).json(notice);
  } catch (error) {
    console.error('获取公告详情失败:', error);
    res.status(500).json({ message: '获取公告详情失败', error: error.message });
  }
};

// 创建公告
exports.createNotice = async (req, res) => {
  try {
    const { title, content, link, is_active = true, display_order = 0 } = req.body;
    
    // 验证必填字段
    if (!title || !content) {
      return res.status(400).json({ message: '标题和内容不能为空' });
    }
    
    const notice = await Notice.create({
      title,
      content,
      link,
      is_active: is_active === true || is_active === 'true',
      display_order: parseInt(display_order) || 0
    });
    
    res.status(201).json({ message: '公告创建成功', data: notice });
  } catch (error) {
    console.error('创建公告失败:', error);
    res.status(500).json({ message: '创建公告失败', error: error.message });
  }
};

// 更新公告
exports.updateNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, link, is_active, display_order } = req.body;
    
    const notice = await Notice.findByPk(id);
    if (!notice) {
      return res.status(404).json({ message: '公告不存在' });
    }
    
    // 更新字段
    if (title !== undefined) notice.title = title;
    if (content !== undefined) notice.content = content;
    if (link !== undefined) notice.link = link;
    if (is_active !== undefined) notice.is_active = is_active === true || is_active === 'true';
    if (display_order !== undefined) notice.display_order = parseInt(display_order) || 0;
    
    await notice.save();
    
    res.status(200).json({ message: '公告更新成功', data: notice });
  } catch (error) {
    console.error('更新公告失败:', error);
    res.status(500).json({ message: '更新公告失败', error: error.message });
  }
};

// 删除公告
exports.deleteNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findByPk(id);
    
    if (!notice) {
      return res.status(404).json({ message: '公告不存在' });
    }
    
    await notice.destroy();
    res.status(200).json({ message: '公告删除成功' });
  } catch (error) {
    console.error('删除公告失败:', error);
    res.status(500).json({ message: '删除公告失败', error: error.message });
  }
};

// 切换公告激活状态
exports.toggleNoticeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findByPk(id);
    
    if (!notice) {
      return res.status(404).json({ message: '公告不存在' });
    }
    
    notice.is_active = !notice.is_active;
    await notice.save();
    
    res.status(200).json({ 
      message: '公告状态更新成功', 
      data: { 
        id: notice.id,
        is_active: notice.is_active 
      } 
    });
  } catch (error) {
    console.error('切换公告状态失败:', error);
    res.status(500).json({ message: '切换公告状态失败', error: error.message });
  }
};

// 获取激活状态的公告列表（用于小程序滚动显示）
exports.getActiveNotices = async (req, res) => {
  try {
    const notices = await Notice.findAll({
      where: { is_active: true },
      order: [['display_order', 'ASC'], ['created_at', 'DESC']],
      attributes: ['id', 'title', 'content', 'link']
    });
    
    res.status(200).json({
      success: true,
      data: notices
    });
  } catch (error) {
    console.error('获取激活公告列表失败:', error);
    res.status(500).json({ message: '获取激活公告列表失败', error: error.message });
  }
};

// 批量保存Banner和Notice（支持多图上传）
exports.saveAll = async (req, res) => {
  try {
    // 处理多图上传
    const localUploadMultiple = exports.uploadMultiple;
    localUploadMultiple.array('images')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: '图片上传失败',
          error: err.message
        });
      }

      // 解析请求体数据
      let bannerDataList = [];
      let noticeDataList = [];
      
      try {
        if (req.body.banners) {
          bannerDataList = typeof req.body.banners === 'string' 
            ? JSON.parse(req.body.banners) 
            : req.body.banners;
        }
        
        if (req.body.notices) {
          noticeDataList = typeof req.body.notices === 'string' 
            ? JSON.parse(req.body.notices) 
            : req.body.notices;
        }
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: '数据格式错误',
          error: parseError.message
        });
      }

      const transaction = await sequelize.transaction();
      
      try {
        // 处理Banner数据
        if (bannerDataList && Array.isArray(bannerDataList)) {
          // 先删除所有现有banner
          await Banner.destroy({ where: {}, transaction });
          
          // 保存新的banner数据
          const savedBanners = [];
          for (let i = 0; i < bannerDataList.length; i++) {
            const bannerData = bannerDataList[i];
            
            // 构建banner对象
            const bannerObj = {
              title: bannerData.title || '',
              link_url: bannerData.link_url || '',
              sort_order: parseInt(bannerData.sort_order) || i,
              is_active: bannerData.is_active !== false // 默认激活
            };
            
            // 设置图片URL
            if (req.files && req.files[i]) {
              // 如果有上传的文件，使用新上传的文件
              bannerObj.image_url = `/uploads/banners/${req.files[i].filename}`;
            } else if (bannerData.image) {
              // 如果没有新上传的文件但有图片URL，使用现有URL
              // 检查是否是完整URL或相对路径
              if (bannerData.image.startsWith('http')) {
                bannerObj.image_url = bannerData.image;
              } else if (!bannerData.image.startsWith('/uploads')) {
                // 如果是相对路径但不是从uploads开始，加上uploads前缀
                bannerObj.image_url = `/uploads/banners/${bannerData.image}`;
              } else {
                bannerObj.image_url = bannerData.image;
              }
            } else {
              // 如果没有图片，跳过这个banner
              console.warn(`Banner ${i+1} 没有提供图片，跳过`);
              continue;
            }
            
            // 保存到数据库
            const savedBanner = await Banner.create(bannerObj, { transaction });
            savedBanners.push(savedBanner);
          }
        }
        
        // 处理Notice数据
        if (noticeDataList && Array.isArray(noticeDataList)) {
          // 先删除所有现有notice
          await Notice.destroy({ where: {}, transaction });
          
          // 保存新的notice数据
          const savedNotices = [];
          for (let i = 0; i < noticeDataList.length; i++) {
            const noticeData = noticeDataList[i];
            
            // 验证必填字段
            if (!noticeData.content) {
              console.warn(`Notice ${i+1} 没有提供内容，跳过`);
              continue;
            }
            
            // 构建notice对象
            const noticeObj = {
              title: noticeData.title || '公告',
              content: noticeData.content,
              link: noticeData.link || '',
              display_order: parseInt(noticeData.sort_order) || i,
              is_active: noticeData.is_active !== false // 默认激活
            };
            
            // 保存到数据库
            const savedNotice = await Notice.create(noticeObj, { transaction });
            savedNotices.push(savedNotice);
          }
        }
        
        // 提交事务
        await transaction.commit();
        
        res.status(200).json({
          success: true,
          message: 'Banner和Notice批量保存成功',
          data: {
            bannersSaved: bannerDataList.length,
            noticesSaved: noticeDataList.length
          }
        });
      } catch (dbError) {
        // 回滚事务
        await transaction.rollback();
        throw dbError;
      }
    });
  } catch (error) {
    console.error('批量保存Banner和Notice失败:', error);
    res.status(500).json({
      success: false,
      message: '批量保存失败',
      error: error.message
    });
  }
};