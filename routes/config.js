const express = require('express');
const router = express.Router();
const { SiteConfig } = require('../models');

// 获取网站配置
router.get('/', async (req, res) => {
  try {
    let config = await SiteConfig.findOne({
      where: { is_active: true },
      order: [['id', 'DESC']]
    });

    // 如果没有配置，创建默认配置
    if (!config) {
      config = await SiteConfig.create({
        banner_list: JSON.stringify([
          { image: '' }
        ]),
        notice_list: JSON.stringify([
          { content: '欢迎使用资源平台' }
        ]),
        is_active: true
      });
    }

    // 解析JSON数据
    const bannerList = JSON.parse(config.banner_list || '[]');
    const noticeList = JSON.parse(config.notice_list || '[]');

    res.json({
      success: true,
      data: {
        id: config.id,
        banner_list: bannerList,
        notice_list: noticeList,
        is_active: config.is_active,
        created_at: config.created_at,
        updated_at: config.updated_at
      }
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({
      success: false,
      error: '获取配置失败'
    });
  }
});

// 更新网站配置（开发测试时临时移除认证）
router.put('/', async (req, res) => {
  try {
    const { banner_list, notice_list, is_active } = req.body;

    // 验证数据格式
    if (banner_list && !Array.isArray(banner_list)) {
      return res.status(400).json({
        success: false,
        error: 'banner_list必须是数组'
      });
    }

    if (notice_list && !Array.isArray(notice_list)) {
      return res.status(400).json({
        success: false,
        error: 'notice_list必须是数组'
      });
    }

    // 查找现有配置
    let config = await SiteConfig.findOne({
      order: [['id', 'DESC']]
    });

    const updateData = {};
    if (banner_list !== undefined) {
      updateData.banner_list = JSON.stringify(banner_list);
    }
    if (notice_list !== undefined) {
      updateData.notice_list = JSON.stringify(notice_list);
    }
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    if (config) {
      // 更新现有配置
      await config.update(updateData);
    } else {
      // 创建新配置
      config = await SiteConfig.create({
        banner_list: updateData.banner_list || JSON.stringify([]),
        notice_list: updateData.notice_list || JSON.stringify([]),
        is_active: updateData.is_active !== undefined ? updateData.is_active : true
      });
    }

    // 解析JSON数据返回
    const bannerList = JSON.parse(config.banner_list || '[]');
    const noticeList = JSON.parse(config.notice_list || '[]');

    res.json({
      success: true,
      data: {
        id: config.id,
        banner_list: bannerList,
        notice_list: noticeList,
        is_active: config.is_active,
        created_at: config.created_at,
        updated_at: config.updated_at
      }
    });
  } catch (error) {
    console.error('更新配置失败:', error);
    res.status(500).json({
      success: false,
      error: '更新配置失败'
    });
  }
});

module.exports = router;