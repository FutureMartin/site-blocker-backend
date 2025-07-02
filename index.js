// 导入必要的库
const express = require('express');
const cors = require('cors');
const AlipaySDK = require('alipay-sdk').default;
const AlipayFormData = require('alipay-sdk/lib/form').default;

// 从配置文件导入密钥和ID
const { APP_ID, APP_PRIVATE_KEY, ALIPAY_PUBLIC_KEY, YOUR_EXTENSION_ID } = require('./config');

// 初始化 Express 应用
const app = express();

// 配置 CORS 中间件，允许特定来源的请求
const corsOptions = {
  origin: `chrome-extension://${YOUR_EXTENSION_ID}`,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));

// 初始化支付宝 SDK
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
