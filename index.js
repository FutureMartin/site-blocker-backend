// index.js (已修正)

// 导入必要的库
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

// 从配置文件导入密钥和ID
const { APP_ID, APP_PRIVATE_KEY, YOUR_EXTENSION_ID } = require('./config');

// --- START: 环境变量健壮性检查 ---
console.log('开始检查环境变量...');
const requiredEnvVars = {
  APP_ID,
  APP_PRIVATE_KEY,
  YOUR_EXTENSION_ID
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    const errorMessage = `[启动失败] 致命错误: 缺少环境变量 ${key}。请在 Vercel 项目设置中正确配置该变量。`;
    console.error(errorMessage);
    // 在非Vercel环境（例如本地）中，我们希望它能正常抛出错误并停止
    if (process.env.VERCEL) {
        // 在Vercel上，直接返回错误响应可能更友好
        return;
    }
    throw new Error(errorMessage);
  }
}
console.log('[启动成功] 所有必需的环境变量均已成功加载。');
// --- END: 环境变量健壮性检查 ---

// 初始化 Express 应用
const app = express();

// 配置 CORS，非常重要！确保你的扩展ID是正确的
const corsOptions = {
  origin: `chrome-extension://${YOUR_EXTENSION_ID}`,
  methods: ['GET', 'POST', 'OPTIONS'], // 允许 POST 方法
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json()); // 添加这个中间件来解析JSON请求体

// --- START: 修正后的支付订单创建 API ---
// 使用 POST 方法，并且路径与前端匹配
app.post('/api/create-order', (req, res) => {
  try {
    console.log('收到创建订单请求，开始生成支付宝支付链接...');

    // 1. 公共请求参数
    const params = {
      app_id: APP_ID,
      method: 'alipay.trade.page.pay',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      version: '1.0',
      // 支付宝服务器会向这个地址发送异步通知
      notify_url: 'https://YOUR_VERCEL_APP_URL/api/alipay-notify' // 【重要】建议配置一个接收异步通知的地址
    };

    // 2. 业务请求参数
    const bizContent = {
      out_trade_no: `order_pro_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, // 订单号更随机
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: '1.00', // 金额与前端显示一致
      subject: '网站拦截器 - 专业版终身授权',
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
    console.log('生成的签名 (sign) 已隐藏');

    // 5. 构造最终的请求 URL
    const alipayGateway = 'https://openapi.alipay.com/gateway.do';
    const encodedParams = sortedKeys.map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    const finalUrl = `${alipayGateway}?${encodedParams}&sign=${encodeURIComponent(sign)}`;
    
    console.log('最终生成的支付 URL 已成功创建。');

    // 6. 【核心修改】将支付URL作为JSON返回给前端，而不是重定向
    res.status(200).json({
        success: true,
        message: '订单创建成功',
        orderId: bizContent.out_trade_no, // 将订单号也返回给前端
        qrCodeUrl: finalUrl // 这个就是前端需要的二维码链接
    });

  } catch (error) {
    console.error('生成支付链接时出错:', error.stack);
    // 返回一个JSON格式的错误信息
    res.status(500).json({
        success: false,
        message: `生成支付链接失败: ${error.message}`
    });
  }
});
// --- END: 修正后的 API ---

// 根路由，用于测试服务是否正常运行
app.get('/', (req, res) => {
  res.send('支付宝支付后端服务运行中 (V2 - JSON模式)...');
});

// 导出 app 实例，以便 Vercel 可以使用
module.exports = app;