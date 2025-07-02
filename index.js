// 导入必要的库
const express = require('express');
const cors = require('cors');
const AlipaySDK = require('alipay-sdk').default;
const AlipayFormData = require('alipay-sdk/lib/form').default;

// 从配置文件导入密钥和ID
const { APP_ID, APP_PRIVATE_KEY, ALIPAY_PUBLIC_KEY, YOUR_EXTENSION_ID } = require('./config');

// --- START: 增加环境变量健壮性检查 ---
// 在应用启动时，检查所有必需的环境变量是否都已设置。
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
    const errorMessage = `启动失败: 缺少环境变量 ${key}。请在 Vercel 项目设置中正确配置该变量。`;
    console.error(errorMessage);
    // 抛出错误以停止执行，Vercel会捕获这个错误并显示在日志中。
    throw new Error(errorMessage);
  }
}
console.log('所有必需的环境变量均已成功加载。');
// --- END: 增加环境变量健壮性检查 ---


// 初始化 Express 应用
const app = express();

// 配置 CORS 中间件，允许特定来源的请求
const corsOptions = {
  origin: `chrome-extension://${YOUR_EXTENSION_ID}`,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));

// 初始化支付宝 SDK
// 确保传入的密钥是完整的 PEM 格式
const alipaySdk = new AlipaySDK({
  appId: APP_ID,
  privateKey: APP_PRIVATE_KEY,
  alipayPublicKey: ALIPAY_PUBLIC_KEY,
  gateway: 'https://openapi.alipay.com/gateway.do', // 支付宝网关地址
});

// 创建一个 API 路由来生成支付订单
app.get('/api/pay', async (req, res) => {
  try {
    // 从查询参数中获取订单信息，这里我们使用固定的测试值
    const orderId = `order_${Date.now()}`; // 生成一个唯一的订单号
    const amount = '0.01'; // 支付金额，单位为元
    const subject = '网站访问权限购买'; // 订单标题

    // 创建一个 FormData 实例用于生成支付表单
    const formData = new AlipayFormData();
    formData.setMethod('get'); // 设置请求方法
    formData.add({
      bizContent: {
        outTradeNo: orderId, // 商户订单号
        productCode: 'FAST_INSTANT_TRADE_PAY', // 销售产品码，固定值
        totalAmount: amount, // 订单总金额
        subject: subject, // 订单标题
      },
    });
    
    // 调用支付宝 SDK 的 pageExecute 方法生成支付链接
    const result = await alipaySdk.exec('alipay.trade.page.pay', {}, {
      formData: formData,
    });

    // 成功后，将支付宝返回的支付链接发送给前端
    console.log('支付链接生成成功:', result);
    res.json({ success: true, paymentUrl: result });

  } catch (error) {
    // 如果发生错误，记录错误日志并返回错误信息
    console.error('生成支付链接失败:', error);
    res.status(500).json({ success: false, message: '生成支付链接失败' });
  }
});

// 导出 Express 应用实例，供 Vercel 调用
module.exports = app;
