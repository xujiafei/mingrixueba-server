const axios = require('axios');

exports.wxLogin = async (code) => {
  try {
    const response = await axios.get(
      `https://api.weixin.qq.com/sns/jscode2session`,
      {
        params: {
          appid: process.env.WX_APPID,
          secret: process.env.WX_SECRET,
          js_code: code,
          grant_type: 'authorization_code'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('微信登录失败:', error);
    throw new Error('微信登录服务异常');
  }
};