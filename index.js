// 导入必要的库
const express = require('express');
const cors = require('cors');

// --- START: 重要代码更新 ---
// 在将 Express 稳定在 v4 后，我们使用 alipay-sdk 最标准的 default 导入方式。
// 之前的失败很可能是由不稳定的 Express v5-alpha 引起的。
const AlipaySDK = require('alipay-sdk').default;

// **增加防御性检查**：验证 AlipaySDK 是否被正确导入为一个可用的类(构造函数)
if (typeof AlipaySDK !== 'function') {
  const errorMsg = '[启动失败] 无法从 "alipay-sdk" 中正确导入 AlipaySDK。请检查依赖版本或模块导出方式。';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// AlipayFormData 通常是主类的一个静态属性
const AlipayFormData = AlipaySDK.AlipayFormData;

// **增加防御性检查**：验证 AlipayFormData 是否也被正确获取
if (typeof AlipayFormData !== 'function') {
  const errorMsg = '[启动失败] 无法从 AlipaySDK 中正确导入 AlipayFormData。';
  console.error(errorMsg);
  throw new Error(errorMsg);
}
// --- END: 重要代码更新 ---

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

// 初始化支付宝 SDK
let alipaySdk;
try {
  alipaySdk = new AlipaySDK({
    appId: APP_ID,
    privateKey: APP_PRIVATE_KEY,
    alipayPublicKey: ALIPAY_PUBLIC_KEY,
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
    res.redirect(result);
  } catch (error) {
    console.error('生成支付链接时出错:', error);
    res.status(500).send('生成支付链接失败');
  }
});

// 根路由，用于测试服务是否正常运行
app.get('/', (req, res) => {
  res.send('支付宝支付后端服务运行中...');
});

// 导出 app 实例，以便 Vercel 可以使用
module.exports = app;
