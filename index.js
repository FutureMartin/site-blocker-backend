// 导入必要的库
const express = require('express');
const cors = require('cors');

// --- START: 重要代码更新 ---
// 修正 alipay-sdk 的导入方式
// 经过多次尝试，"is not a constructor" 错误指向模块导入问题。
// 我们将采用一种更明确的方式，并锁定到 alipay-sdk 的 default 导出，
// 这是许多现代库在 CommonJS 环境下的标准做法。

// 直接获取 default 导出作为主类
const AlipaySDK = require('alipay-sdk').default;

// **增加防御性检查**：验证 AlipaySDK 是否被正确导入为一个可用的类(构造函数)
if (typeof AlipaySDK !== 'function') {
  const errorMsg = '[启动失败] 无法从 "alipay-sdk" 中正确导入 AlipaySDK。请检查依赖版本或模块导出方式。';
  console.error(errorMsg);
  // 抛出明确的错误，终止应用启动
  throw new Error(errorMsg);
}

// AlipayFormData 通常是主类的一个静态属性
const AlipayFormData = AlipaySDK.AlipayFormData;

// **增加防御性检查**：验证 AlipayFormData 是否也被正确获取
if (typeof AlipayFormData !== 'function') {
  const errorMsg = '[启动失败] 无法从 AlipaySDK 中正确导入 AlipayFormData。';
  console.error(errorMsg);
  // 抛出明确的错误，终止应用启动
  throw new Error(errorMsg);
}
// --- END: 重要代码更新 ---

// 从配置文件导入密钥和ID
const { APP_ID, APP_PRIVATE_KEY, ALIPAY_PUBLIC_KEY, YOUR_EXTENSION_ID } = require('./config');

// --- START: 环境变量健壮性检查 ---
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
    
    // 显式设置支付成功后的回跳地址
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
    // 重定向到支付宝支付页面
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
