const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { exec } = require('child_process');
const util = require('util');
const { convertFirstPageToImage } = require('../utils/pdf-to-image');
const execPromise = util.promisify(exec);

// 确保预览图目录存在
const previewDir = path.join(__dirname, '..', 'uploads', 'previews');
if (!fs.existsSync(previewDir)) {
  fs.mkdirSync(previewDir, { recursive: true });
}

/**
 * 预览图生成服务类
 */
class PreviewService {
  
  /**
   * 生成文件预览图
   * @param {string} filePath - 文件路径
   * @param {string} fileType - 文件MIME类型
   * @returns {Promise<string>} 预览图URL
   */
  static async generatePreview(filePath, fileType) {
    try {
      console.log(`开始生成预览图: ${filePath}, 类型: ${fileType}`);
      
      // 生成预览图文件名
      const timestamp = Date.now();
      const safeFileName = this.generateSafeFileName(path.basename(filePath));
      const previewFileName = `${safeFileName}_${timestamp}_preview.jpg`;
      const previewPath = path.join(previewDir, previewFileName);
      console.log('预览图路径:', previewPath);
      // 确保预览图目录存在
      if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
      }
      
      let previewUrl = '';
      const fileName = path.basename(filePath);
      
      // 根据文件类型选择不同的预览生成方法
      try {
        if (fileType.includes('pdf')) {
          console.log('开始处理PDF文件...,');
          previewUrl = await convertFirstPageToImage(filePath, previewDir);
        } else if (fileType.includes('word') || fileType.includes('document')) {
          previewUrl = await this.generateWordPreview(filePath, previewPath, previewFileName);
        } else if (fileType.includes('image')) {
          previewUrl = await this.generateImagePreview(filePath, previewPath);
        } else if (fileType.includes('text')) {
          previewUrl = await this.generateTextPreview(filePath, previewPath);
        } else {
          // 其他文件类型使用默认预览图
          previewUrl = await this.generateDefaultPreview(previewPath, fileType, fileName);
        }
      } catch (specificError) {
        console.error(`特定类型预览图生成失败: ${specificError.message}`);
        previewUrl = '';
      }
      
      // 确保返回的是字符串URL
      if (typeof previewUrl === 'string' && previewUrl) {
        console.log('预览图生成成功，URL:', previewUrl);
        return previewUrl;
      }
     ;
      
      // 确保最后返回的是字符串
      return typeof previewUrl === 'string' ? previewUrl : '';
      
    } catch (error) {
      console.error('预览图生成失败:', error);
      try {
        // 尝试生成一个通用默认预览图作为最后的后备选项
        const timestamp = Date.now();
        const fallbackPreviewPath = path.join(previewDir, `fallback_${timestamp}_preview.jpg`);
        const fallbackUrl = await this.generateDefaultPreview(fallbackPreviewPath, 'unknown', '文件');
        return typeof fallbackUrl === 'string' ? fallbackUrl : '';
      } catch (fallbackError) {
        console.error('默认预览图生成也失败:', fallbackError);
        return '';
      }
    }
  }
  
  /**
   * 生成PDF预览图
   * @param {string} pdfPath - PDF文件路径
   * @param {string} previewPath - 预览图输出路径
   * @returns {Promise<string>} 预览图URL
   */
  static async generatePdfPreview(pdfPath, previewPath) {
    try {
      // 确保预览目录存在
      const previewDir = path.join(__dirname, '..', 'uploads', 'previews');
      if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
      }
      
      // 尝试使用pdf2pic生成PDF预览
      try {
        const previewUrl = await this.generatePdfPreviewWithPdf2pic(filePath, previewFileName, previewPath);
        if (previewUrl) {
          return previewUrl;
        }
      } catch (error) {
        console.error('pdf2pic生成PDF预览失败:', error);
      }
      
      // 首先尝试使用Ghostscript生成PDF预览图
      try {
        const command = `gswin64c -dSAFER -dBATCH -dNOPAUSE -dNOCACHE -sDEVICE=jpeg -dJPEG_QUALITY=80 -r150 -sOutputFile="${previewPath}" "${pdfPath}"`;
        await execPromise(command);
        
        if (fs.existsSync(previewPath)) {
          // 使用Sharp处理生成的图片
          await sharp(previewPath)
            .resize(300, 400, { 
              fit: 'inside', 
              withoutEnlargement: true 
            })
            .jpeg({ quality: 80 })
            .toFile(previewPath);
          const previewFileName = path.basename(previewPath);
          const previewUrl = `/uploads/previews/${previewFileName}`;
          console.log('PDF预览图生成成功 (Ghostscript)，URL:', previewUrl);
          return previewUrl;
        }
      } catch (ghostscriptError) {
        console.log('Ghostscript不可用，尝试ImageMagick');
      }
      
      // 如果Ghostscript不可用，尝试使用ImageMagick
      try {
        const magickCommand = `magick "${pdfPath}[0]" -resize 300x400 -quality 80 "${previewPath}"`;
        await execPromise(magickCommand);
        
        if (fs.existsSync(previewPath)) {
          const previewFileName = path.basename(previewPath);
          const previewUrl = `/uploads/previews/${previewFileName}`;
          console.log('PDF预览图生成成功 (ImageMagick)，URL:', previewUrl);
          return previewUrl;
        }
      } catch (magickError) {
        console.log('ImageMagick不可用，生成自定义PDF预览');
      }
      
      // 如果外部工具都不可用，生成自定义PDF预览图
      const previewUrl = await this.generateCustomPdfPreview(pdfPath, previewPath);
      if (typeof previewUrl === 'string' && previewUrl.trim()) {
        console.log('PDF预览图生成成功 (自定义)，URL:', previewUrl);
        return previewUrl;
      }
      console.log('PDF预览图生成失败：所有方法都尝试失败');
      return '';
      
    } catch (error) {
      console.error('PDF预览生成失败:', error);
      return '';
    }
  }
  
  /**
   * 使用pdf2pic生成PDF第一页预览
   * @param {string} pdfPath - PDF文件路径
   * @param {string} previewFileName - 预览文件名
   * @param {string} previewPath - 预览图输出路径
   * @returns {Promise<string>} 预览图URL
   */
  async generatePdfPreviewWithPdf2pic(filePath, previewFileName, previewPath) {
    try {
      console.log(`使用pdf2pic生成PDF预览: ${pdfPath}`);
      
      // 动态导入pdf2pic
      const { fromPath } = require('pdf2pic');
      
      // 配置pdf2pic选项
      const options = {
        density: 300,        // 分辨率
        saveFilename: previewFileName.replace('.jpg', ''),
        savePath: this.previewDir,
        format: 'jpg',
        width: 300,
        height: 400
      };
      
      // 创建转换实例
      const convert = fromPath(pdfPath, options);
      
      // 转换第一页
      const result = await convert(1, { responseType: 'image' });
      
      // 检查转换结果
      if (result && result.path) {
        // 使用Sharp优化图片质量
        await sharp(result.path)
          .jpeg({ quality: 85 })
          .toFile(previewPath);
        
        console.log('PDF预览生成成功 (pdf2pic):', previewPath);
        return `/${this.previewDirRelative}/${previewFileName}`;
      }
      
      return null;
    } catch (error) {
      console.error('使用pdf2pic生成PDF预览失败:', error);
      return null;
    }
  }
  
  
  
  /**
   * 生成自定义PDF预览图（无外部工具依赖）
   * @param {string} pdfPath - PDF文件路径
   * @param {string} previewPath - 预览图输出路径
   * @returns {Promise<string>} 预览图URL
   */
  static async generateCustomPdfPreview(pdfPath, previewPath) {
    try {
      const fileName = path.basename(pdfPath);
      const fileSize = fs.statSync(pdfPath).size;
      const fileSizeKB = Math.round(fileSize / 1024);
      
      // 创建自定义PDF预览图
      const svgWidth = 300;
      const svgHeight = 400;
      const svgContent = `
        <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f8f9fa"/>
          <rect x="30" y="50" width="240" height="280" fill="#e74c3c" stroke="#c0392b" 
                stroke-width="2" rx="8"/>
          <text x="${svgWidth / 2}" y="${svgHeight / 2 - 20}" 
                font-family="Arial" font-size="24" fill="white" 
                text-anchor="middle" font-weight="bold">PDF</text>
          <text x="${svgWidth / 2}" y="${svgHeight / 2 + 20}" 
                font-family="Arial" font-size="14" fill="white" 
                text-anchor="middle">${fileName}</text>
          <text x="${svgWidth / 2}" y="${svgHeight - 40}" 
                font-family="Arial" font-size="12" fill="#7f8c8d" 
                text-anchor="middle">${fileSizeKB} KB</text>
          <text x="${svgWidth / 2}" y="${svgHeight - 20}" 
                font-family="Arial" font-size="10" fill="#95a5a6" 
                text-anchor="middle">PDF文档</text>
        </svg>
      `;
      
      // 保存SVG文件
      const svgPath = previewPath.replace('.jpg', '.svg');
      fs.writeFileSync(svgPath, svgContent);
      
      // 使用Sharp将SVG转换为JPEG
      await sharp(svgPath)
        .jpeg({ quality: 80 })
        .toFile(previewPath);
      
      // 清理SVG文件
      if (fs.existsSync(svgPath)) {
        fs.unlinkSync(svgPath);
      }
      
      // 检查文件是否存在并返回URL
      if (fs.existsSync(previewPath)) {
        const previewFileName = path.basename(previewPath);
        const previewUrl = `/uploads/previews/${previewFileName}`;
        console.log('自定义PDF预览图生成成功，URL:', previewUrl);
        return previewUrl;
      }
      return '';
      
    } catch (error) {
      console.error('自定义PDF预览生成失败:', error);
      return '';
    }
  }
  
  /**
   * 生成Word文档预览图
   * @param {string} wordPath - Word文件路径
   * @param {string} previewPath - 预览图输出路径
   * @returns {Promise<string>} 预览图路径
   */
  static async generateWordPreview(wordPath, previewPath) {
    try {
      // 1. 尝试使用LibreOffice转换为PDF再生成预览
      try {
        const libreOfficePreviewPath = await this.generateWordPreviewWithLibreOffice(wordPath, previewPath);
        if (libreOfficePreviewPath) {
          return libreOfficePreviewPath;
        }
      } catch (error) {
        console.log('LibreOffice预览失败，使用自定义预览:', error.message);
      }
      
      // 2. 使用自定义Word预览
      return await this.generateCustomWordPreview(wordPath, previewPath);
      
    } catch (error) {
      console.error('Word预览图生成失败:', error);
      // 如果所有方法都失败，返回默认预览图
      const fileName = path.basename(wordPath);
      return await this.generateDefaultPreview(previewPath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName);
    }
  }
  
  /**
   * 生成自定义Word预览图（无外部工具依赖）
   * @param {string} wordPath - Word文件路径
   * @param {string} previewPath - 预览图输出路径
   * @returns {Promise<boolean>} 是否成功生成
   */
  static async generateCustomWordPreview(wordPath, previewPath) {
    try {
      const fileName = path.basename(wordPath);
      const fileSize = fs.statSync(wordPath).size;
      const fileSizeKB = Math.round(fileSize / 1024);
      const fileExtension = path.extname(wordPath).toUpperCase();
      
      // 创建自定义Word预览图
      const svgWidth = 300;
      const svgHeight = 400;
      const svgContent = `
        <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f8f9fa"/>
          <rect x="30" y="50" width="240" height="280" fill="#3498db" stroke="#2980b9" 
                stroke-width="2" rx="8"/>
          <text x="${svgWidth / 2}" y="${svgHeight / 2 - 20}" 
                font-family="Arial" font-size="24" fill="white" 
                text-anchor="middle" font-weight="bold">${fileExtension}</text>
          <text x="${svgWidth / 2}" y="${svgHeight / 2 + 20}" 
                font-family="Arial" font-size="14" fill="white" 
                text-anchor="middle">${fileName}</text>
          <text x="${svgWidth / 2}" y="${svgHeight - 40}" 
                font-family="Arial" font-size="12" fill="#7f8c8d" 
                text-anchor="middle">${fileSizeKB} KB</text>
          <text x="${svgWidth / 2}" y="${svgHeight - 20}" 
                font-family="Arial" font-size="10" fill="#95a5a6" 
                text-anchor="middle">Word文档</text>
        </svg>
      `;
      
      // 保存SVG文件
      const svgPath = previewPath.replace('.jpg', '.svg');
      fs.writeFileSync(svgPath, svgContent);
      
      // 使用Sharp将SVG转换为JPEG
      await sharp(svgPath)
        .jpeg({ quality: 80 })
        .toFile(previewPath);
      
      // 清理SVG文件
      if (fs.existsSync(svgPath)) {
        fs.unlinkSync(svgPath);
      }
      
      return fs.existsSync(previewPath);
      
    } catch (error) {
      console.error('自定义Word预览生成失败:', error);
      return false;
    }
  }
  
  /**
   * 生成图片预览图
   * @param {string} imagePath - 图片文件路径
   * @param {string} previewPath - 预览图输出路径
   * @returns {Promise<string>} 预览图路径
   */
  static async generateImagePreview(imagePath, previewPath) {
    try {
      // 使用Sharp调整图片尺寸
      await sharp(imagePath)
        .resize(300, 400, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toFile(previewPath);
      
      const previewFileName = path.basename(previewPath);
      return `/uploads/previews/${previewFileName}`;
      
    } catch (error) {
      console.error('图片预览图生成失败:', error);
      // 如果图片处理失败，返回默认预览图
      const fileName = path.basename(imagePath);
      return await this.generateDefaultPreview(previewPath, 'image/jpeg', fileName);
    }
  }
  
  /**
   * 生成文本文件预览
   * @param {string} textPath - 文本文件路径
   * @param {string} previewPath - 预览图输出路径
   * @returns {Promise<string>} 预览图路径
   */
  static async generateTextPreview(textPath, previewPath) {
    try {
      // 读取文本文件内容
      const textContent = fs.readFileSync(textPath, 'utf8');
      
      // 创建简单的文本预览图片
      const textToShow = textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '');
      const lines = textToShow.split('\n').slice(0, 15); // 最多显示15行
      
      // 使用SVG创建文本预览
      const svgWidth = 400;
      const svgHeight = 300;
      const lineHeight = 18;
      const padding = 20;
      
      let svgContent = `
        <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f8f9fa"/>
          <rect x="${padding}" y="${padding}" width="${svgWidth - padding * 2}" height="${svgHeight - padding * 2}" 
                fill="white" stroke="#dee2e6" stroke-width="1" rx="8"/>
          <text x="${padding + 10}" y="${padding + 30}" font-family="monospace" font-size="12" fill="#495057">
      `;
      
      lines.forEach((line, index) => {
        const y = padding + 50 + (index * lineHeight);
        const safeText = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        svgContent += `<tspan x="${padding + 10}" y="${y}">${safeText}</tspan>`;
      });
      
      svgContent += `
          </text>
          <text x="${svgWidth - padding - 100}" y="${svgHeight - padding - 10}" 
                font-family="Arial" font-size="14" fill="#6c757d">文本文件</text>
        </svg>
      `;
      
      // 保存SVG并转换为JPEG
      const svgPath = previewPath.replace('.jpg', '.svg');
      fs.writeFileSync(svgPath, svgContent);
      
      // 使用Sharp将SVG转换为JPEG
      await sharp(svgPath)
        .jpeg({ quality: 80 })
        .toFile(previewPath);
      
      // 清理SVG文件
      if (fs.existsSync(svgPath)) {
        fs.unlinkSync(svgPath);
      }
      
      const previewFileName = path.basename(previewPath);
      return `/uploads/previews/${previewFileName}`;
      
    } catch (error) {
      console.error('文本预览生成失败:', error);
      // 如果文本处理失败，返回默认预览图
      const fileName = path.basename(textPath);
      return await this.generateDefaultPreview(previewPath, 'text/plain', fileName);
    }
  }
  
  /**
   * 生成安全的文件名（避免中文编码问题）
   * @param {string} fileName - 原始文件名
   * @returns {string} 安全文件名
   */
  static generateSafeFileName(fileName) {
    // 使用简单的哈希函数生成唯一标识
    let hash = 0;
    for (let i = 0; i < fileName.length; i++) {
      const char = fileName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    // 移除所有非字母数字字符，只保留字母、数字、下划线和连字符
    const safeName = fileName.replace(/[^\w\-_]/g, '_');
    
    // 如果文件名过长，截断并添加哈希值
    if (safeName.length > 50) {
      return safeName.substring(0, 30) + '_' + Math.abs(hash).toString(36);
    }
    
    // 如果文件名包含中文字符，使用哈希值作为文件名
    if (/[\u4e00-\u9fa5]/.test(fileName)) {
      return 'file_' + Math.abs(hash).toString(36);
    }
    
    return safeName;
  }

  /**
   * 生成默认预览图
   * @param {string} previewPath - 预览图输出路径
   * @param {string} fileType - 文件类型
   * @param {string} fileName - 文件名
   * @returns {Promise<string>} 预览图路径
   */
  static async generateDefaultPreview(previewPath, fileType = 'unknown', fileName = '') {
    try {
      if (!previewPath) {
        // 如果没有指定路径，生成一个新的
        const timestamp = Date.now();
        const previewFileName = `default_${timestamp}_preview.jpg`;
        previewPath = path.join(previewDir, previewFileName);
      }
      
      // 根据文件类型生成不同的预览图
      let svgContent = '';
      const svgWidth = 300;
      const svgHeight = 400;
      
      const displayName = fileName || '文件';
      const fileExtension = fileName ? path.extname(fileName).toUpperCase() : '';
      
      // 根据文件类型选择不同的图标和颜色
      let iconColor = '#95a5a6';
      let iconText = '文件';
      let backgroundColor = '#f8f9fa';
      
      if (fileType.includes('pdf')) {
        iconColor = '#e74c3c';
        iconText = fileExtension || 'PDF';
      } else if (fileType.includes('word') || fileType.includes('document')) {
        iconColor = '#3498db';
        iconText = fileExtension || 'DOC';
      } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
        iconColor = '#27ae60';
        iconText = fileExtension || 'XLS';
      } else if (fileType.includes('powerpoint') || fileType.includes('presentation')) {
        iconColor = '#e67e22';
        iconText = fileExtension || 'PPT';
      } else if (fileType.includes('image')) {
        iconColor = '#9b59b6';
        iconText = fileExtension || 'IMG';
      } else if (fileType.includes('text')) {
        iconColor = '#34495e';
        iconText = fileExtension || 'TXT';
      } else if (fileType.includes('zip') || fileType.includes('archive')) {
        iconColor = '#f39c12';
        iconText = fileExtension || 'ZIP';
      }
      
      svgContent = `
        <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="${backgroundColor}"/>
          <rect x="50" y="80" width="200" height="240" fill="${iconColor}" stroke="${this.darkenColor(iconColor)}" 
                stroke-width="2" rx="12"/>
          <text x="${svgWidth / 2}" y="${svgHeight / 2}" 
                font-family="Arial" font-size="32" fill="white" 
                text-anchor="middle" font-weight="bold">${iconText}</text>
          <text x="${svgWidth / 2}" y="${svgHeight - 60}" 
                font-family="Arial" font-size="14" fill="#7f8c8d" 
                text-anchor="middle">${displayName}</text>
          <text x="${svgWidth / 2}" y="${svgHeight - 30}" 
                font-family="Arial" font-size="12" fill="#95a5a6" 
                text-anchor="middle">${this.getFileTypeDescription(fileType)}</text>
        </svg>
      `;
      
      // 保存SVG文件
      const svgPath = previewPath.replace('.jpg', '.svg');
      fs.writeFileSync(svgPath, svgContent);
      
      // 使用Sharp将SVG转换为JPEG
      await sharp(svgPath)
        .jpeg({ quality: 80 })
        .toFile(previewPath);
      
      // 清理SVG文件
      if (fs.existsSync(svgPath)) {
        fs.unlinkSync(svgPath);
      }
      
      const previewFileName = path.basename(previewPath);
      return `/uploads/previews/${previewFileName}`;
      
    } catch (error) {
      console.error('默认预览图生成失败:', error);
      // 如果所有方法都失败，返回空字符串
      return '';
    }
  }
  
  /**
   * 加深颜色
   * @param {string} color - 原始颜色
   * @returns {string} 加深后的颜色
   */
  static darkenColor(color) {
    // 简单的颜色加深逻辑
    if (color.startsWith('#')) {
      // 将颜色值转换为RGB并加深
      const hex = color.replace('#', '');
      const num = parseInt(hex, 16);
      const amt = -30; // 加深程度
      const R = Math.max(0, Math.min(255, (num >> 16) + amt));
      const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
      const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
      return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
    }
    return color;
  }
  
  /**
   * 获取文件类型描述
   * @param {string} fileType - MIME类型
   * @returns {string} 文件类型描述
   */
  static getFileTypeDescription(fileType) {
    if (fileType.includes('pdf')) return 'PDF文档';
    if (fileType.includes('word') || fileType.includes('document')) return 'Word文档';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'Excel表格';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'PowerPoint演示';
    if (fileType.includes('image')) return '图片文件';
    if (fileType.includes('text')) return '文本文件';
    if (fileType.includes('zip') || fileType.includes('archive')) return '压缩文件';
    if (fileType.includes('audio')) return '音频文件';
    if (fileType.includes('video')) return '视频文件';
    return '文档文件';
  }
  
  /**
   * 删除文件的预览图
   * @param {string} previewUrl - 预览图URL
   * @returns {Promise<boolean>} 是否成功删除
   */
  static async deletePreview(previewUrl) {
    try {
      if (!previewUrl) return false;
      
      const previewPath = path.join(__dirname, '..', previewUrl.replace('/uploads', 'uploads'));
      
      if (fs.existsSync(previewPath)) {
        fs.unlinkSync(previewPath);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('删除预览图失败:', error);
      return false;
    }
  }
  
  /**
   * 清理无效的预览图文件
   * @returns {Promise<number>} 清理的文件数量
   */
  static async cleanupOrphanedPreviews() {
    try {
      const files = fs.readdirSync(previewDir);
      let cleanedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(previewDir, file);
        const stats = fs.statSync(filePath);
        
        // 删除超过7天的预览图文件
        const daysSinceCreated = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceCreated > 7) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
      
      return cleanedCount;
      
    } catch (error) {
      console.error('清理预览图失败:', error);
      return 0;
    }
  }
}

module.exports = PreviewService;