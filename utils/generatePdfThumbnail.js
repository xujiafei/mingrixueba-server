const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const { fromPath } = require('pdf2pic');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 配置multer用于处理文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// 创建必要的目录
const directories = ['uploads', 'snapshots', 'thumbnails'];
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 服务静态文件，方便通过URL访问生成的快照
app.use('/snapshots', express.static('snapshots'));
app.use('/thumbnails', express.static('thumbnails'));

/**
 * 方案一：将PDF第一页转换为JPG图片 (推荐用于预览)
 * 此方案使用pdf2pic库，它基于poppler-utils，需要系统安装该依赖
 * Ubuntu/Debian: sudo apt-get install poppler-utils
 * macOS: brew install poppler
 */
async function generateImageSnapshot(pdfPath, outputPath) {
  try {
    const options = {
      density: 150,           // 输出图片清晰度
      format: 'jpg',          // 输出图片格式
      width: 800,             // 图片宽度
      height: 1120,           // 图片高度
      saveFilename: path.basename(outputPath, path.extname(outputPath)),
      savePath: path.dirname(outputPath)
    };

    const convert = fromPath(pdfPath, options);
    const result = await convert(1); // 转换第一页

    return result.path;
  } catch (error) {
    throw new Error(`图片快照生成失败: ${error.message}`);
  }
}

/**
 * 方案二：生成只包含第一页的PDF缩略文件
 * 此方案使用pdf-lib库，纯JavaScript实现，无需系统依赖[citation:9]
 */
async function generatePdfThumbnail(pdfPath, outputPath) {
  try {
    // 读取原始PDF文件[citation:9]
    const originalPdfBytes = fs.readFileSync(pdfPath);
    
    // 加载PDF文档[citation:9]
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    
    // 创建一个新的PDF文档[citation:9]
    const thumbPdfDoc = await PDFDocument.create();
    
    // 获取第一页并复制到新文档中[citation:9]
    const [firstPage] = await thumbPdfDoc.copyPages(pdfDoc, [0]);
    thumbPdfDoc.addPage(firstPage);
    
    // 保存并写入文件[citation:9]
    const thumbPdfBytes = await thumbPdfDoc.save();
    fs.writeFileSync(outputPath, thumbPdfBytes);
    
    return outputPath;
  } catch (error) {
    throw new Error(`PDF缩略文件生成失败: ${error.message}`);
  }
}

// API路由 - 处理PDF上传并生成快照
app.post('/api/generate-snapshot', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传PDF文件' });
    }

    const pdfPath = req.file.path;
    const baseName = path.basename(req.file.filename, path.extname(req.file.filename));
    
    // 根据查询参数决定使用哪种方案，默认使用图片方案
    const useImage = req.query.type !== 'pdf';

    let resultPath;
    let fileUrl;

    if (useImage) {
      // 方案一：生成图片快照
      const outputPath = path.join('snapshots', `${baseName}.jpg`);
      resultPath = await generateImageSnapshot(pdfPath, outputPath);
      fileUrl = `/snapshots/${path.basename(resultPath)}`;
    } else {
      // 方案二：生成PDF缩略文件[citation:9]
      const outputPath = path.join('thumbnails', `${baseName}.thumb.pdf`);
      resultPath = await generatePdfThumbnail(pdfPath, outputPath);
      fileUrl = `/thumbnails/${path.basename(resultPath)}`;
    }

    // 清理上传的临时文件
    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      snapshotUrl: fileUrl,
      message: `快照生成成功`,
      type: useImage ? 'image' : 'pdf'
    });

  } catch (error) {
    // 清理临时文件（如果存在）
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('处理失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`PDF快照服务运行在 http://localhost:${PORT}`);
  console.log(`请确保已安装系统依赖:`);
  console.log(`- Ubuntu/Debian: sudo apt-get install poppler-utils`);
  console.log(`- macOS: brew install poppler`);
});

module.exports = app;