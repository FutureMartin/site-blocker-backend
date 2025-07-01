// 文件: index.js
const express = require('express');
const cors = require('cors');
const AlipaySdk = require('alipay-sdk').default;
const { appId, appPrivateKey, alipayPublicKey } = require('./config');

const app = express();
const port = process.env.PORT || 3001;

// 初始化支付宝 SDK
const alipaySdk = new AlipaySdk({
  appId: appId,
  privateKey: appPrivateKey.replace(/\\n/g, '\n'), // 处理环境变量中的换行符
  alipayPublicKey: alipayPublicKey.replace(/\\n/g, '\n'),
  gateway: 'https://openapi.alipay.com/gateway.do', // 使用正式网关
});

// 存储订单状态 (在真实应用中，你应该使用数据库)
const orders = new Map();

// 配置 CORS
const extensionId = process.env.YOUR_EXTENSION_ID;
if (!extensionId) {
    console.error("错误：环境变量 YOUR_EXTENSION_ID 未设置！");
}
const corsOptions = {
  origin: `chrome-extension://${extensionId}`,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());


// API 路由

// 1. 创建支付订单
app.post('/api/create-order', async (req, res) => {
  const orderId = `SITE_BLOCKER_${Date.now()}`;
  const subject = '网站拦截器 - 终身专业版';
  const totalAmount = '1.00'; // 支付金额

  try {
    const result = await alipaySdk.exec('alipay.trade.precreate', {
      bizContent: {
        out_trade_no: orderId,
        total_amount: totalAmount,
        subject: subject,
      },
    });

    // 保存订单初始状态
    orders.set(orderId, { status: 'PENDING' });

    console.log('创建订单成功:', result);
    res.json({
      success: true,
      orderId: orderId,
      qrCodeUrl: result.qrCode, // 支付宝返回的二维码链接
    });
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ success: false, message: '与支付宝通信失败' });
  }
});

// 2. 客户端轮询检查订单状态
app.get('/api/check-status', (req, res) => {
  const { orderId } = req.query;
  if (!orderId || !orders.has(orderId)) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const orderInfo = orders.get(orderId);
  res.json({ success: true, status: orderInfo.status, licenseKey: orderInfo.licenseKey });
});

// 3. 接收支付宝的异步回调通知
app.post('/api/alipay-notify', async (req, res) => {
  console.log('接收到支付宝异步通知:', req.body);
  try {
    // 验证签名
    const isSignVerified = alipaySdk.checkNotifySign(req.body);
    if (!isSignVerified) {
      console.error('异步通知验签失败');
      return res.status(400).send('fail');
    }

    // 验签成功，处理业务逻辑
    const { out_trade_no, trade_status } = req.body;

    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      const orderInfo = orders.get(out_trade_no);
      if (orderInfo && orderInfo.status !== 'PAID') {
        // 生成许可证密钥
        const licenseKey = `PRO-ALIPAY-${out_trade_no.slice(-8)}`;
        // 更新订单状态
        orders.set(out_trade_no, { status: 'PAID', licenseKey: licenseKey });
        console.log(`订单 ${out_trade_no} 支付成功，许可证已生成。`);
      }
    }
    // 必须返回 'success' 给支付宝，否则它会持续发送通知
    res.send('success');
  } catch (error) {
    console.error('处理异步通知失败:', error);
    res.status(500).send('fail');
  }
});


app.listen(port, () => {
  console.log(`服务器正在运行于 http://localhost:${port}`);
});