// 腾讯云COS配置
const COS = require('cos-nodejs-sdk-v5');
require('dotenv').config();

// 从环境变量获取COS配置
const cosConfig = {
  Bucket: process.env.COS_BUCKET,
  Region: process.env.COS_REGION,
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY
};

// 创建COS实例
const cos = new COS({
  SecretId: cosConfig.SecretId,
  SecretKey: cosConfig.SecretKey
});

module.exports = {
  cos,
  cosConfig
};
