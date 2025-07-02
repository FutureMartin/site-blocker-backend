// 导入必要的库
const express = require('express');
const cors = require('cors');

// --- START: 重要代码更新 ---
// 修正 alipay-sdk 的导入方式
// 根据最新的错误日志 "AlipaySDK is not a constructor"，这表明之前的导入方式不正确。
// CommonJS 模块的导入方式可能发生了变化。我们现在尝试一种更标准的导入方法。
const AlipaySDK = require('alipay-sdk');
// AlipayFormData 现在作为主导出对象的一个属性来提供
const AlipayFormData = AlipaySDK.AlipayFormData;
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
    // 如果在 Vercel 环境中，直接抛出错误会导致函数崩溃并在日志中记录明确的原因。
    const errorMessage = `[启动失败] 致命错误: 缺少环境变量 ${key}。请在 Vercel 项目设置中正确配置该变量。`;
    console.error(errorMessage);
    // 抛出错误以停止执行，Vercel会捕获这个错误并显示在日志中。
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
