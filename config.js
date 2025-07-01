// --- 文件: config.js ---
// 为了安全，我们从环境变量中读取密钥
require('dotenv').config();

module.exports = {
  appId: process.env.APP_ID,
  appPrivateKey: process.env.APP_PRIVATE_KEY,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
};