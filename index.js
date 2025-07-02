// 导入必要的库
const express = require('express');
const cors = require('cors');
const AlipaySDK = require('alipay-sdk').default;
const AlipayFormData = require('alipay-sdk/lib/form').default;

// 从配置文件导入密钥和ID
const { APP_ID, APP_PRIVATE_KEY, ALIPAY_PUBLIC_KEY, YOUR_EXTENSION_ID } = require('./config');

// --- START: 增加环境变量健壮性检查 ---
// 在应用启动时，检查所有必需的环境变量是否都已设置。
console.log('开始检查环境变量...');
const requiredEnvVars = {
  APP_ID,
  APP_PRIVATE_KEY,
  ALIPAY_PUBLIC_KEY,
  YOUR_EXTENSION_ID
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    // 如果在 Vercel 环境中，直接抛出错误会导致函数崩溃并在日志中记录明确的原因。
    // 这比程序静默失败要容易调试得多。
    const errorMessage = `[启动失败] 致命错误: 缺少环境变量 ${key}。请在 Vercel 项目设置中正确配置该变量。`;
    console.error(errorMessage);
    // 抛出错误以停止执行，Vercel会捕获这个错误并显示在日志中。
    throw new Error(errorMessage);
  }
}
console.log('[启动成功] 所有必需的环境变量均已成功加载。');
// --- END: 增加环境变量健壮性检查 ---


// 初始化 Express 应用
const app = express();

// 配置 CORS 中间件，允许特定来源的请求
const corsOptions = {
  origin: `chrome-extension://${YOUR_EXTENSION_ID}`,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

let alipaySdk;
try {
  // 初始化支付宝 SDK
  // 确保传入的密钥是完整的 PEM 格式
  alipaySdk = new AlipaySDK({
    appId: APP_ID,
    privateKey: APP_PRIVATE_KEY,
    alipayPublicKey: ALIPAY_PUBLIC_KEY,
    // 使用生产环境网关地址
    gateway: 'https://openapi.alipay.com/gateway.do',
  });
  console.log('支付宝 SDK 初始化成功 (生产模式)。');
} catch (error) {
  console.error('[启动失败] 支付宝 SDK 初始化时发生错误:', error.message);
  throw new Error(`支付宝 SDK 初始化失败: ${error.message}`);
}


// 创建一个 API 路由来生成支付订单
app.get('/api/pay', async (req, res) => {
  try {
    const orderId = `order_${Date.now()}`;
    const amount = '0.01';
    const subject = '网站访问权限购买';

    const formData = new AlipayFormData();
    formData.setMethod('get');
    
    // **重要更新**: 显式设置支付成功后的回跳地址
    // 这是一个临时的测试地址，请在正式上线时替换为你自己的“支付成功”页面地址。
    formData.addField('returnUrl', 'https://www.google.com');

    formData.add({
      bizContent: {
        outTradeNo: orderId,
        productCode: 'FAST_INSTANT_TRADE_PAY',
        totalAmount: amount,
        subject: subject,
      },
    });
    
    const result = await alipaySdk.exec('alipay.trade.page.pay', {}, {
      formData: formData,
    });

    console.log('支付链接生成成功:', result);
    res.json({ success: true, paymentUrl: result });

  } catch (error) {
    // 优化错误日志，打印出支付宝返回的详细错误信息
    console.error('生成支付链接失败，详细错误:', JSON.stringify(error, null, 2));
    res.status(500).json({
        success: false,
        message: '生成支付链接失败',
        // 将具体的错误码和信息也返回给前端，方便调试
        errorCode: error.subCode || error.code,
        errorMessage: error.subMsg || error.message,
    });
  }
});

// 导出 Express 应用实例，供 Vercel 调用
module.exports = app;
