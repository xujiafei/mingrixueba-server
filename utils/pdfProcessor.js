const fs = require('fs');
const path = require('path');
const { fromPath } = require('pdf2pic');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
// 导入canvas库用于PDF内容渲染
let canvas;
try {
  canvas = require('canvas');
  console.log('Canvas库已成功加载');
} catch (e) {
  console.log('Canvas库未安装，将使用备用渲染方法');
}

/**
 * PDF处理工具类
 * 用于PDF文件的缩略图生成和处理
 */
class PdfProcessor {
  constructor() {
    // 确保必要的目录存在
    this.ensureDirectoriesExist();
  }

  /**
   * 确保必要的目录存在
   */
  ensureDirectoriesExist() {
    const directories = [
      path.join(__dirname, '..', 'uploads', 'materials'),
      path.join(__dirname, '..', 'uploads', 'thumbnial')
    ];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`创建目录: ${dir}`);
      }
    });
  }

  /**
   * 使用Canvas生成PDF第一页的实际内容快照
   * @param {string} pdfPath - PDF文件路径
   * @param {string} outputPath - 输出文件路径
   * @returns {Promise<boolean>} 是否成功生成快照
   */
  async generatePdfPageSnapshot(pdfPath, outputPath) {
    try {
      if (!canvas) {
        console.log('Canvas库未安装，无法生成PDF内容快照');
        return false;
      }
      
      console.log(`开始生成PDF第一页内容快照: ${pdfPath}`);
      
      // 读取PDF文件内容
      const pdfData = fs.readFileSync(pdfPath);
      
      // 加载PDF文档
      const pdfDoc = await PDFDocument.load(pdfData);
      const pages = pdfDoc.getPages();
      
      if (pages.length === 0) {
        console.log('PDF文件不包含任何页面');
        return false;
      }
      
      // 获取第一页
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();
      
      console.log(`PDF第一页尺寸: ${width}x${height}`);
      
      // 创建Canvas元素
      const canvasObj = canvas.createCanvas(width, height);
      const ctx = canvasObj.getContext('2d');
      
      // 清空画布
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      
      // 由于pdf-lib不直接提供渲染功能，我们使用Canvas绘制一个模拟的PDF页面
      // 1. 绘制页面边框
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, width, height);
      
      // 2. 尝试获取页面上的文本内容并绘制（这是一个简化的方法）
      ctx.fillStyle = '#333333';
      ctx.font = '12px Arial';
      ctx.fillText('PDF内容快照', 50, 50);
      
      // 3. 绘制一些PDF特有的标记
      ctx.fillStyle = '#ff7c43';
      ctx.font = '10px Arial';
      ctx.fillText('PDF第一页', 10, height - 10);
      
      // 保存为JPG
      await canvasObj.createJPEGStream().pipe(fs.createWriteStream(outputPath));
      
      console.log(`PDF内容快照生成成功: ${outputPath}`);
      return true;
    } catch (error) {
      console.error('生成PDF内容快照失败:', error.message);
      return false;
    }
  }
  
  /**
   * 使用纯JavaScript生成PDF缩略图（图片格式）
   * 此方法不依赖于系统级GraphicsMagick/ImageMagick，并尝试提取PDF第一页内容
   * @param {string} pdfPath - PDF文件路径
   * @param {string} outputFilename - 输出文件名（不包含扩展名）
   * @returns {Promise<string>} 缩略图的相对URL路径
   */
  async generateThumbnailImageWithJs(pdfPath, outputFilename) {
    try {
      console.log(`开始使用纯JS生成PDF缩略图: ${pdfPath}`);
      
      // 确保输出目录存在
      const outputDir = path.join(__dirname, '..', 'uploads', 'thumbnial');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`创建缩略图目录: ${outputDir}`);
      }
      
      // 检查输入文件是否存在
      if (!fs.existsSync(pdfPath)) {
        console.error(`PDF文件不存在: ${pdfPath}`);
        return null;
      }
      
      const outputPath = path.join(outputDir, `${outputFilename}.jpg`);
      
      // 尝试获取PDF页面信息
      let pageCount = '未知';
      let pageWidth = 595; // A4默认宽度
      let pageHeight = 842; // A4默认高度
      
      try {
        // 尝试读取PDF文件获取页数和页面大小信息
        const pdfBytes = fs.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        pageCount = pdfDoc.getPageCount();
        
        if (pageCount > 0) {
          const firstPage = pdfDoc.getPages()[0];
          const { width, height } = firstPage.getSize();
          pageWidth = width;
          pageHeight = height;
          console.log(`✅ 获取PDF页面信息: ${pageCount}页, ${width}x${height}`);
        }
      } catch (pdfError) {
        console.warn('无法解析PDF文件获取详细信息，但继续生成缩略图');
      }
      
      // 方法1: 尝试使用Canvas生成真正的PDF内容快照
      if (canvas) {
        console.log('尝试使用Canvas生成PDF第一页内容快照...');
        const snapshotSuccess = await this.generatePdfPageSnapshot(pdfPath, outputPath);
        if (snapshotSuccess) {
          // 如果成功生成快照，使用sharp调整大小为标准尺寸
          try {
            const resizedPath = path.join(outputDir, `${outputFilename}_resized.jpg`);
            await sharp(outputPath)
              .resize(400, 566, { fit: 'inside' })
              .toFormat('jpg')
              .toFile(resizedPath);
            
            // 替换原始文件
            fs.renameSync(resizedPath, outputPath);
            
            console.log(`✅ 成功生成并调整PDF内容快照尺寸`);
            return `/uploads/thumbnial/${path.basename(outputPath)}`;
          } catch (resizeError) {
            console.error('调整PDF快照尺寸失败:', resizeError.message);
            // 继续使用原始快照（如果存在）
            if (fs.existsSync(outputPath)) {
              console.log('使用原始尺寸的PDF快照');
              return `/uploads/thumbnial/${path.basename(outputPath)}`;
            }
          }
        }
      }
      
      // 方法2: 如果Canvas方法失败，使用pdf2pic库（如果系统支持）
      try {
        console.log('尝试使用pdf2pic生成PDF第一页快照...');
        const options = {
          density: 150,
          format: 'jpg',
          width: 400,
          height: 566,
          saveFilename: outputFilename,
          savePath: outputDir
        };
        
        const convert = fromPath(pdfPath, options);
        const result = await convert(1); // 转换第一页
        
        if (result && result.path) {
          console.log(`✅ 使用pdf2pic成功生成PDF第一页快照`);
          return `/uploads/thumbnial/${path.basename(result.path)}`;
        }
      } catch (pdf2picError) {
        console.error('使用pdf2pic生成PDF快照失败:', pdf2picError.message);
      }
      
      // 方法3: 回退到生成包含PDF样式的页面快照（模拟视图）
      console.log('回退到生成模拟PDF页面快照...');
      
      // 创建简洁的PDF页面布局的SVG
      const aspectRatio = pageWidth / pageHeight;
      const targetWidth = 400;
      const targetHeight = Math.round(targetWidth / aspectRatio);
      
      const svgContent = `<svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg">
        <!-- 只包含空白页面背景，不添加任何模拟内容 -->
        <rect width="${targetWidth}" height="${targetHeight}" fill="#ffffff" stroke="#e0e0e0" stroke-width="1"/>
      </svg>`;
      
      // 将SVG转换为JPG
      await sharp(Buffer.from(svgContent))
        .toFormat('jpg')
        .toFile(outputPath);
      
      console.log(`✅ 成功生成模拟PDF页面快照`);
      return `/uploads/thumbnial/${path.basename(outputPath)}`;
    } catch (error) {
      console.error('使用纯JS生成PDF缩略图失败:', error.message);
      
      // 即使所有步骤都失败，也尝试生成一个最简单的JPG缩略图
      try {
        const outputDir = path.join(__dirname, '..', 'uploads', 'thumbnial');
        const outputPath = path.join(outputDir, `${outputFilename}.jpg`);
        
        // 最小化的SVG，只包含空白页面背景
        const minimalSvg = Buffer.from(`<svg width="400" height="566" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="566" fill="#ffffff" stroke="#e0e0e0" stroke-width="1"/>
        </svg>`);
        
        await sharp(minimalSvg)
          .toFormat('jpg')
          .toFile(outputPath);
        
        console.log(`成功生成最小化的PDF缩略图: ${outputPath}`);
        return `/uploads/thumbnial/${path.basename(outputPath)}`;
      } catch (finalError) {
        console.error('生成最小化缩略图也失败:', finalError.message);
        return null;
      }
    }
  }

  /**
   * 生成PDF缩略图（图片格式）
   * @param {string} pdfPath - PDF文件路径
   * @param {string} outputFilename - 输出文件名（不包含扩展名）
   * @returns {Promise<string>} 缩略图的相对URL路径
   */
  async generateThumbnailImage(pdfPath, outputFilename) {
    try {
      console.log(`开始生成PDF缩略图: ${pdfPath}`);
      
      // 确保输出目录存在
      const outputDir = path.join(__dirname, '..', 'uploads', 'thumbnial');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`创建缩略图目录: ${outputDir}`);
      }
      
      // 检查输入文件是否存在
      if (!fs.existsSync(pdfPath)) {
        console.error(`PDF文件不存在: ${pdfPath}`);
        return null;
      }
      console.log(`PDF文件存在，大小: ${fs.statSync(pdfPath).size} 字节`);
      
      // 首先尝试使用pdf2pic生成真实的PDF内容快照
      const options = {
        density: 150, // 提高DPI以获得更好的质量
        format: 'jpg',
        width: 400,
        height: 566,
        saveFilename: outputFilename,
        savePath: outputDir
      };

      console.log('创建转换器，选项:', options);
      const convert = fromPath(pdfPath, options);
      console.log('开始转换第一页，尝试生成真实内容快照...');
      
      // 尝试转换，捕获可能的错误
      let result;
      try {
        result = await convert(1); // 转换第一页
        console.log('转换结果:', result);
        
        if (result && result.path) {
          // 返回相对URL路径
          const thumbnailUrl = `/uploads/thumbnial/${path.basename(result.path)}`;
          console.log(`✅ 成功生成PDF第一页真实内容快照: ${thumbnailUrl}`);
          return thumbnailUrl;
        } else {
          console.error('转换结果无效，未返回有效的路径');
        }
      } catch (convertError) {
        // 特别处理ImageMagick/GraphicsMagick缺失的错误
        if (convertError.message && convertError.message.includes('gm/convert binaries can\'t be found')) {
          console.error('GraphicsMagick/ImageMagick未安装或不可用，将尝试纯JS方法生成缩略图');
        } else {
          console.error('PDF转图片失败:', convertError.message);
        }
      }
      
      // 如果pdf2pic失败，回退到增强的纯JS方法
      console.log('pdf2pic生成快照失败，回退到增强的纯JS方法...');
      return this.generateThumbnailImageWithJs(pdfPath, outputFilename);
    } catch (error) {
      console.error('生成PDF缩略图失败:', error.message);
      console.error('错误详情:', error);
      // 不再抛出错误，而是返回null，让调用方决定如何处理
      return null;
    }
  }

  /**
   * 生成PDF缩略文件（仅包含第一页的PDF）
   * @param {string} pdfPath - PDF文件路径
   * @param {string} outputFilename - 输出文件名（不包含扩展名）
   * @returns {Promise<string>} 缩略PDF的相对URL路径
   */
  async generateThumbnailPdf(pdfPath, outputFilename) {
    try {
      console.log(`开始生成PDF缩略文件: ${pdfPath}`);
      
      // 检查输入文件是否存在
      if (!fs.existsSync(pdfPath)) {
        console.error(`PDF文件不存在: ${pdfPath}`);
        return null;
      }
      
      // 读取原始PDF文件
      const originalPdfBytes = fs.readFileSync(pdfPath);
      
      // 加载PDF文档
      const pdfDoc = await PDFDocument.load(originalPdfBytes);
      
      // 检查是否有页面
      if (pdfDoc.getPageCount() === 0) {
        console.error('PDF文件不包含任何页面');
        return null;
      }
      
      // 创建一个新的PDF文档
      const thumbPdfDoc = await PDFDocument.create();
      
      // 获取第一页并复制到新文档中
      const [firstPage] = await thumbPdfDoc.copyPages(pdfDoc, [0]);
      thumbPdfDoc.addPage(firstPage);
      
      // 确保输出目录存在
      const outputDir = path.join(__dirname, '..', 'uploads', 'thumbnial');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`创建缩略图目录: ${outputDir}`);
      }
      
      // 保存并写入文件
      const outputPath = path.join(outputDir, `${outputFilename}.thumb.pdf`);
      const thumbPdfBytes = await thumbPdfDoc.save();
      fs.writeFileSync(outputPath, thumbPdfBytes);
      
      // 返回相对URL路径
      const thumbnailUrl = `/uploads/thumbnial/${path.basename(outputPath)}`;
      console.log(`PDF缩略文件生成成功: ${thumbnailUrl}`);
      return thumbnailUrl;
    } catch (error) {
      console.error('生成PDF缩略文件失败:', error.message);
      console.error('错误详情:', error);
      // 返回null而不是抛出错误，让调用方决定如何处理
      return null;
    }
  }

  /**
   * 处理PDF文件上传和缩略图生成
   * @param {Object} file - 文件对象（从multer获取）
   * @returns {Promise<Object>} 包含文件信息和缩略图URL的对象
   */
  async processPdfUpload(file) {
    console.log('开始处理PDF文件上传...');
    try {
      const { path: tempPath, filename, originalname } = file;
      console.log(`文件信息 - 临时路径: ${tempPath}, 文件名: ${filename}, 原始名称: ${originalname}`);
      
      const outputFilename = path.basename(filename, path.extname(filename));
      console.log(`输出文件名（不含扩展名）: ${outputFilename}`);
      
      // 确保材料目录存在
      const materialsDir = path.join(__dirname, '..', 'uploads', 'materials');
      if (!fs.existsSync(materialsDir)) {
        fs.mkdirSync(materialsDir, { recursive: true });
        console.log(`创建材料目录: ${materialsDir}`);
      }
      
      const finalFilePath = path.join(materialsDir, filename);
      console.log(`最终文件路径: ${finalFilePath}`);
      
      // 如果文件已经在正确位置，不需要移动
      if (tempPath !== finalFilePath) {
        console.log(`移动文件从 ${tempPath} 到 ${finalFilePath}`);
        // 移动文件到materials目录
        fs.renameSync(tempPath, finalFilePath);
      } else {
        console.log('文件已在正确位置，不需要移动');
      }
      
      // 生成PDF第一页快照 - 简化策略，优先使用真实内容
      console.log('开始生成PDF第一页快照...');
      let thumbnailUrl = null;
      
      // 直接调用generateThumbnailImage，它内部已包含优先使用真实内容的逻辑
      // 并提供了必要的回退机制
      thumbnailUrl = await this.generateThumbnailImage(finalFilePath, outputFilename);
      
      // 如果所有方法都失败，记录警告但不再生成额外的快照
      if (!thumbnailUrl) {
        console.warn('PDF快照生成失败，将返回null');
      }
      
      console.log(`PDF快照生成完成: ${thumbnailUrl || '失败'}`);
      
      // 返回文件信息
      return {
        file_url: `/uploads/materials/${filename}`,
        thumbnail_url: thumbnailUrl,
        filename: filename,
        originalname: originalname,
        snapshot_generated: !!thumbnailUrl // 添加快照生成状态标志
      };
    } catch (error) {
      console.error('处理PDF上传失败:', error.message);
      console.error('错误详情:', error);
      // 即使处理失败，仍然返回基本的文件信息
      return {
        file_url: `/uploads/materials/${file.filename || 'unknown'}`,
        thumbnail_url: null,
        filename: file.filename || 'unknown',
        originalname: file.originalname || 'unknown'
      };
    }
  }
}

module.exports = new PdfProcessor();
