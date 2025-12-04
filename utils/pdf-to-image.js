const path = require('path');
const fs = require('fs');
const pp = require('pdf-poppler');

async function convertFirstPageToImage(pdfPath, outputDir = '../uploads/previews', page = 1) {
    try {
        console.log('开始转换PDF第一页为图片...');
        
        // 检查PDF文件是否存在
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`PDF文件不存在: ${pdfPath}`);
        }
        
        // 创建输出目录
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 生成输出文件名
        const pdfName = path.basename(pdfPath, path.extname(pdfPath));
        const pNo = page<10?'0'+page:page;
        const outputPath = path.join(outputDir, `${pdfName}-${pNo}.png`);
        
        // 转换选项
        const opts = {
            format: 'png',      // 输出格式
            out_dir: outputDir, // 输出目录
            out_prefix: pdfName, // 输出文件前缀
            page:page          // 只转换第一页！
        };
        
        console.log(`正在转换: ${pdfPath}`);
        
        // 执行转换
        await pp.convert(pdfPath, opts);
        
        console.log('✅ PDF第一页转换成功！');
        const relativePath = path.relative(process.cwd(), outputPath);
        console.log(`📁 输出relativePath文件: ${relativePath}`);
        return relativePath;
        
    } catch (error) {
        console.error('❌ 转换失败:', error.message);
        throw error;
    }
}

// 使用示例
async function main() {
    const pdfFile = './test.pdf'; // 替换为你的PDF文件路径
    await convertFirstPageToImage(pdfFile);
}

// 如果直接运行这个文件，执行示例
if (require.main === module) {
    main();
}

module.exports = { convertFirstPageToImage };