const { Material, Category } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PreviewService = require('../services/previewService');
const pdfParse = require('pdf-parse');
const { cloudStorage } = require('../config/cloudbaseConfig');
const { cos, cosConfig } = require('../config/cosConfig'); // 保留COS配置作为备选

// 配置multer使用内存存储
const storage = multer.memoryStorage({
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = 'material-' + uniqueSuffix + ext;
    cb(null, filename);
  }
});

// 文件过滤器
const fileFilter = function (req, file, cb) {
  // 允许的文件类型 - 仅支持需求中的五种格式
  const allowedTypes = [
    'text/plain', // txt
    'application/pdf', // pdf
    'application/msword', // word .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // word .docx
    'application/vnd.ms-excel', // excel .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // excel .xlsx
    'image/jpeg', // 图片
    'image/png', // 图片
    'image/gif', // 图片
    'image/webp' // 图片
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型，仅支持 txt、pdf、word、excel、图片格式'), false);
  }
};

// 创建multer实例
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB限制
  }
});

// 统一上传文件到对象存储的函数
async function uploadToStorage(fileInfo, isPreview = false) {
  try {
    // 生成云存储路径
    const folder = isPreview ? 'previews' : 'materials';
    const cloudPath = `${folder}/${fileInfo.filename}`;
    
    // 使用云开发存储上传
    const result = await cloudStorage.uploadBuffer(
      fileInfo.buffer, 
      cloudPath, 
      fileInfo.mimetype
    );
    
    // 获取文件URL
    const fileUrl = await cloudStorage.getFileUrl(cloudPath);
    return fileUrl;
  } catch (error) {
    console.error('上传文件到云存储失败:', error);
    throw error;
  }
}

// 从本地文件路径上传到对象存储
async function uploadFromLocal(localFilePath, filename, mimetype = 'image/jpeg') {
  try {
    // 读取文件内容到Buffer
    const buffer = await fs.promises.readFile(localFilePath);
    
    // 生成云存储路径
    const cloudPath = `previews/${filename}`;
    
    // 使用云开发存储上传
    const result = await cloudStorage.uploadBuffer(
      buffer, 
      cloudPath, 
      mimetype
    );
    
    // 获取文件URL
    const fileUrl = await cloudStorage.getFileUrl(cloudPath);
    return fileUrl;
  } catch (error) {
    console.error('从本地文件上传到云存储失败:', error);
    throw error;
  }
}

// 文件上传处理函数
exports.uploadMaterial = async (req, res) => {
  try {
    // 使用multer中间件处理文件上传
    upload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message || '文件上传失败'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请选择要上传的文件'
        });
      }

      const { title, category_id, is_free, price } = req.body;

      // 验证必填字段
      if (!title || !category_id) {
        return res.status(400).json({
          success: false,
          error: '标题和分类是必填字段'
        });
      }

      try {
        // 检查分类是否存在
        const category = await Category.findByPk(category_id);
        if (!category) {
          return res.status(404).json({
            success: false,
            error: '指定的分类不存在'
          });
        }

        // 获取文件信息
        const fileInfo = req.file;
        const fileSize = fileInfo.size;
        const fileType = fileInfo.mimetype;
        
        // 上传文件到云托管对象存储
        const fileUrl = await uploadToStorage(fileInfo);
        console.log('文件上传到云存储成功:', fileUrl);
        
        // 读取PDF页数
        let pageCount = 0;
        if (fileType === 'application/pdf') {
          try {
            const pdfData = await pdfParse(fileInfo.buffer);
            pageCount = pdfInfo.numpages || 0;
            console.log(`PDF文件页数: ${pageCount}`);
          } catch (pdfError) {
            console.warn('读取PDF页数失败:', pdfError);
          }
        }
        
        // 生成预览图
        let coverImage = null;
        
        try {
          console.log('生成文档预览图...');
          
          if (fileType.startsWith('image/')) {
            // 对于图片文件，使用原图作为封面
            coverImage = fileUrl;
            console.log('使用原图作为封面');
          } else {
            // 对于非图片文件，先保存到临时文件，生成预览后再删除
            const tempDir = path.join(__dirname, '..', 'temp');
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }
            const tempFilePath = path.join(tempDir, fileInfo.filename);
            await fs.promises.writeFile(tempFilePath, fileInfo.buffer);
            
            // 生成预览图
            const previewUrl = await PreviewService.generatePreview(tempFilePath, fileType);
            console.log('DEBUG: previewUrl的值:', previewUrl, '类型:', typeof previewUrl);
            
            if (typeof previewUrl === 'string' && previewUrl.trim()) {
              // 上传预览图到云托管对象存储
            const previewFilename = `preview-${Date.now()}.jpg`;
            coverImage = await uploadFromLocal(previewUrl, previewFilename);
            console.log('预览图上传到云存储成功:', coverImage);
              
              // 删除临时文件
              fs.unlinkSync(previewUrl);
            } else {
              console.log('预览图生成失败或返回非字符串值');
            }
            
            // 删除临时文件
            fs.unlinkSync(tempFilePath);
          }
        } catch (previewError) {
          console.warn('预览图生成失败:', previewError);
          // 处理失败不影响文件上传
          // 对于图片文件，仍然可以使用原图作为封面
          if (fileType.startsWith('image/')) {
            coverImage = fileUrl;
          }
        }

        // 创建材料记录
        const material = await Material.create({
          title: title.trim(),
          file_url: fileUrl,
          file_size: fileSize,
          file_type: fileType,
          category_id: parseInt(category_id),
          is_free: is_free === 'true' || is_free === true,
          price: parseFloat(price) || 0,
          version: req.body.version || null,
          version_year: req.body.version_year || null,
          status: 'published',
          view_count: 0,
          cover_image: coverImage,
          page_count: pageCount
        });

        res.json({
          success: true,
          data: material,
          message: '文件上传成功'
        });

      } catch (dbError) {
        throw dbError;
      }
    });

  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({
      success: false,
      error: '文件上传失败: ' + error.message
    });
  }
};

// 批量文件上传处理函数
exports.uploadMultipleMaterials = async (req, res) => {
  try {
    // 使用multer中间件处理多文件上传
    upload.array('files')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message || '文件上传失败'
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请选择要上传的文件'
        });
      }

      const { category_id, is_free, price } = req.body;

      // 验证必填字段
      if (!category_id) {
        // 删除已上传的文件
        req.files.forEach(file => {
          const filePath = path.join(uploadDir, file.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
        return res.status(400).json({
          success: false,
          error: '分类是必填字段'
        });
      }

      try {
        // 检查分类是否存在
        const category = await Category.findByPk(category_id);
        if (!category) {
          // 删除已上传的文件
          req.files.forEach(file => {
            const filePath = path.join(uploadDir, file.filename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          });
          return res.status(404).json({
            success: false,
            error: '指定的分类不存在'
          });
        }

        // 批量创建材料记录
        const materials = [];
        for (const fileInfo of req.files) {
          // 上传文件到云托管对象存储
          const uploadFileInfo = {
            buffer: fileInfo.buffer,
            filename: `material-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(fileInfo.originalname)}`,
            mimetype: fileInfo.mimetype
          };
          const fileUrl = await uploadToStorage(uploadFileInfo);
          console.log('批量上传文件到云存储成功:', fileUrl);
          const fileSize = fileInfo.size;
          const fileType = fileInfo.mimetype;

          // 从文件名提取标题（去掉扩展名）
          const title = path.basename(fileInfo.originalname, path.extname(fileInfo.originalname));

          // 读取PDF页数
          let pageCount = 0;
          if (fileType === 'application/pdf') {
            try {
              const filePath = path.join(uploadDir, fileInfo.filename);
              const pdfData = await fs.promises.readFile(filePath);
              const pdfInfo = await pdfParse(pdfData);
              pageCount = pdfInfo.numpages || 0;
              console.log(`PDF文件页数 (${fileInfo.originalname}): ${pageCount}`);
            } catch (pdfError) {
              console.warn(`读取PDF页数失败 (${fileInfo.originalname}):`, pdfError);
            }
          }
          
          // 生成预览图
          let coverImage = null;
          const filePath = path.join(uploadDir, fileInfo.filename);
          try {
            console.log(`生成文档预览图 (${fileInfo.originalname})...`);
            // 对于所有文件类型，使用PreviewService生成预览图
            const previewUrl = await PreviewService.generatePreview(filePath, fileType);
            if (previewUrl) {
              coverImage = previewUrl;
              console.log(`预览图生成成功 (${fileInfo.originalname}):`, coverImage);
            } else {
              // 如果预览图生成失败，对于图片文件可以使用原图作为封面
              if (fileType.startsWith('image/')) {
                coverImage = fileUrl;
                console.log(`使用原图作为封面 (${fileInfo.originalname})`);
              }
            }
          } catch (previewError) {
            console.warn(`预览图生成失败 (${fileInfo.originalname}):`, previewError);
            // 处理失败不影响文件上传
            // 对于图片文件，仍然可以使用原图作为封面
            if (fileType.startsWith('image/')) {
              coverImage = fileUrl;
            }
          }

          const material = await Material.create({
            title: title.trim(),
            file_url: fileUrl,
            file_size: fileSize,
            file_type: fileType,
            category_id: parseInt(category_id),
            is_free: is_free === 'true' || is_free === true,
            price: parseFloat(price) || 0,
            status: 'published',
            view_count: 0,
            cover_image: coverImage,
            page_count: pageCount
          });

          materials.push(material);
        }

        res.json({
          success: true,
          data: materials,
          message: `成功上传 ${materials.length} 个文件`
        });

      } catch (dbError) {
        // 数据库操作失败，删除已上传的文件
        req.files.forEach(file => {
          const filePath = path.join(uploadDir, file.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
        throw dbError;
      }
    });

  } catch (error) {
    console.error('批量文件上传失败:', error);
    res.status(500).json({
      success: false,
      error: '批量文件上传失败: ' + error.message
    });
  }
};

// 导出multer实例供路由使用
exports.upload = upload;