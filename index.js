// 导入必要的库
const express = require('express');
const cors = require('cors');
const crypto = require('crypto'); // 导入 Node.js 内置的加密库

// 从配置文件导入密钥和ID
const { APP_ID, APP_PRIVATE_KEY, ALIPAY_PUBLIC_KEY, YOUR_EXTENSION_ID } = require('./config');

// --- START: 环境变量健壮性检查 ---
console.log('开始检查环境变量...');
const requiredEnvVars = {
  APP_ID,
  APP_PRIVATE_KEY,
  ALIPAY_PUBLIC_KEY,
  YOUR_EXTENSION_ID
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    const errorMessage = `[启动失败] 致命错误: 缺少环境变量 ${key}。请在 Vercel 项目设置中正确配置该变量。`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}
console.log('[启动成功] 所有必需的环境变量均已成功加载。');
// --- END: 环境变量健壮性检查 ---

// 初始化 Express 应用
const app = express();

// 配置 CORS，允许来自你的 Edge 扩展的请求
const corsOptions = {
  origin: `chrome-extension://${YOUR_EXTENSION_ID}`,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));


// --- START: 手动实现支付宝支付逻辑 (不再使用 alipay-sdk) ---
// 创建一个 API 路由来生成支付订单
app.get('/api/pay', (req, res) => {
  try {
    console.log('开始手动生成支付宝支付链接...');

    // 1. 公共请求参数
    const params = {
      app_id: APP_ID,
      method: 'alipay.trade.page.pay',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      version: '1.0',
      return_url: 'https://www.google.com', // 支付成功后的回跳地址
    };

    // 2. 业务请求参数
    const bizContent = {
      out_trade_no: `order_${Date.now()}`,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: '0.01',
      subject: '网站访问权限购买',
    };
    params.biz_content = JSON.stringify(bizContent);

    // 3. 对所有参数按 key 进行字典序排序，并拼接成待签名字符串
    const sortedKeys = Object.keys(params).sort();
    const preSignStr = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    console.log('待签名字符串 (preSignStr):', preSignStr);

    // 4. 使用应用私钥进行签名
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(preSignStr, 'utf8');
    const sign = signer.sign(APP_PRIVATE_KEY, 'base64');
    console.log('生成的签名 (sign):', sign);

    // 5. 构造最终的请求 URL (所有参数值都需要进行 URL 编码)
    const alipayGateway = 'https://openapi.alipay.com/gateway.do';
    const encodedParams = sortedKeys.map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    const finalUrl = `${alipayGateway}?${encodedParams}&sign=${encodeURIComponent(sign)}`;
    
    console.log('最终生成的支付 URL:', finalUrl);

    // 6. 重定向到支付宝支付页面
    res.redirect(finalUrl);

  } catch (error) {
    console.error('生成支付链接时出错:', error.stack); // 使用 error.stack 获取更详细的错误信息
    res.status(500).send(`生成支付链接失败: ${error.message}`);
  }
});
// --- END: 手动实现支付宝支付逻辑 ---


// 根路由，用于测试服务是否正常运行
app.get('/', (req, res) => {
  res.send('支付宝支付后端服务运行中 (手动签名模式)...');
});

// 导出 app 实例，以便 Vercel 可以使用
module.exports = app;
