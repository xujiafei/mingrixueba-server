// 云开发配置
const cloudbase = require('@cloudbase/node-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 本地存储根目录
const LOCAL_STORAGE_ROOT = path.join(__dirname, '../uploads');

// 确保本地存储目录存在
if (!fs.existsSync(LOCAL_STORAGE_ROOT)) {
  fs.mkdirSync(LOCAL_STORAGE_ROOT, { recursive: true });
}

// 根据环境选择使用云存储还是本地存储
let app = null;
let cloudStorage = {};

if (process.env.NODE_ENV === 'development' && !process.env.USE_CLOUD_STORAGE) {
  // 开发环境：使用本地文件系统模拟云存储
  console.log('使用本地存储模拟云存储...');
  
  cloudStorage = {
    /**
     * 上传本地文件到本地存储
     * @param {string} filePath 本地文件路径
     * @param {string} cloudPath 云存储路径
     * @param {Object} options 上传选项
     * @returns {Promise<Object>} 上传结果
     */
    uploadFile: async (filePath, cloudPath, options = {}) => {
      try {
        // 构建本地存储路径
        const localPath = path.join(LOCAL_STORAGE_ROOT, cloudPath);
        const directory = path.dirname(localPath);
        
        // 确保目录存在
        if (!fs.existsSync(directory)) {
          fs.mkdirSync(directory, { recursive: true });
        }
        
        // 读取源文件内容
        const fileContent = fs.readFileSync(filePath);
        
        // 写入目标文件
        fs.writeFileSync(localPath, fileContent);
        
        // 返回模拟的上传结果
        return {
          fileID: `local://${cloudPath}`,
          status: 'success',
          message: '文件上传成功'
        };
      } catch (error) {
        console.error('本地文件上传失败:', error);
        throw error;
      }
    },

    /**
     * 上传Buffer到本地存储
     * @param {Buffer} buffer 文件内容Buffer
     * @param {string} cloudPath 云存储路径
     * @param {string} contentType 文件MIME类型
     * @returns {Promise<Object>} 上传结果
     */
    uploadBuffer: async (buffer, cloudPath, contentType = 'application/octet-stream') => {
      try {
        // 构建本地存储路径
        const localPath = path.join(LOCAL_STORAGE_ROOT, cloudPath);
        const directory = path.dirname(localPath);
        
        // 确保目录存在
        if (!fs.existsSync(directory)) {
          fs.mkdirSync(directory, { recursive: true });
        }
        
        // 写入Buffer内容
        fs.writeFileSync(localPath, buffer);
        
        // 返回模拟的上传结果
        return {
          fileID: `local://${cloudPath}`,
          status: 'success',
          message: 'Buffer上传成功'
        };
      } catch (error) {
        console.error('本地Buffer上传失败:', error);
        throw error;
      }
    },

    /**
     * 获取文件URL
     * @param {string} cloudPath 云存储路径
     * @returns {Promise<string>} 文件URL
     */
    getFileUrl: async (cloudPath) => {
      try {
        // 返回本地文件的访问URL
        return `http://localhost:${process.env.PORT || 3000}/uploads/${cloudPath}`;
      } catch (error) {
        console.error('获取本地文件URL失败:', error);
        throw error;
      }
    },

    /**
     * 删除文件
     * @param {string} cloudPath 云存储路径
     * @returns {Promise<Object>} 删除结果
     */
    deleteFile: async (cloudPath) => {
      try {
        // 构建本地存储路径
        const localPath = path.join(LOCAL_STORAGE_ROOT, cloudPath);
        
        // 删除文件
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
        
        // 返回模拟的删除结果
        return {
          status: 'success',
          message: '文件删除成功'
        };
      } catch (error) {
        console.error('删除本地文件失败:', error);
        throw error;
      }
    }
  };
} else {
  // 生产环境或指定使用云存储：使用云开发SDK
  console.log('使用云开发存储...');
  
  // 初始化云开发环境
  app = cloudbase.init({
    env: process.env.CLOUDBASE_ENV_ID || process.env.TENCENTCLOUD_RUN_ENV, // 云开发环境ID
    secretId: process.env.COS_SECRET_ID, // 腾讯云SecretId
    secretKey: process.env.COS_SECRET_KEY // 腾讯云SecretKey
  });
  
  // 对象存储操作封装
  cloudStorage = {
    /**
       */
    uploadFile: async (filePath, cloudPath, options = {}) => {
      try {
        // 调用云开发SDK的文件上传方法
        const result = await app.uploadFile({
          cloudPath,
          filePath,
          ...options
        });
        return result;
      } catch (error) {
        console.error('文件上传失败:', error);
        throw error;
      }
    },

    /**
     * 上传Buffer到云存储
     * @param {Buffer} buffer 文件内容Buffer
     * @param {string} cloudPath 云存储路径
     * @param {string} contentType 文件MIME类型
     * @returns {Promise<Object>} 上传结果
     */
    uploadBuffer: async (buffer, cloudPath, contentType = 'application/octet-stream') => {
      try {
        // 调用云开发SDK的Buffer上传方法
        const result = await app.uploadFile({
          cloudPath,
          fileContent: buffer,
          contentType
        });
        return result;
      } catch (error) {
        console.error('Buffer上传失败:', error);
        throw error;
      }
    },

    /**
     * 获取文件URL
     * @param {string} cloudPath 云存储路径
     * @returns {Promise<string>} 文件URL
     */
    getFileUrl: async (cloudPath) => {
      try {
        // 调用云开发SDK获取临时文件URL
        const result = await app.getTempFileURL({
          fileList: [cloudPath]
        });
        return result.fileList[0].tempFileURL;
      } catch (error) {
        console.error('获取文件URL失败:', error);
        throw error;
      }
    },

    /**
     * 删除文件
     * @param {string} cloudPath 云存储路径
     * @returns {Promise<Object>} 删除结果
     */
    deleteFile: async (cloudPath) => {
      try {
        // 调用云开发SDK删除文件
        const result = await app.deleteFile({
          fileList: [cloudPath]
        });
        return result;
      } catch (error) {
        console.error('删除文件失败:', error);
        throw error;
      }
    }
  };
}

module.exports = {
  cloudStorage
};
