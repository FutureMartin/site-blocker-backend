// config.js
// 这个文件用于从 Vercel 的环境变量中读取敏感信息

const config = {
  // 你的支付宝应用ID
  APP_ID: process.env.APP_ID,

  // 你的应用私钥
  APP_PRIVATE_KEY: process.env.APP_PRIVATE_KEY,

  // 你的支付宝公钥
  ALIPAY_PUBLIC_KEY: process.env.ALIPAY_PUBLIC_KEY,

  // 你的 Edge 浏览器扩展的 ID
  YOUR_EXTENSION_ID: process.env.YOUR_EXTENSION_ID,
};

// 导出配置对象
module.exports = config;