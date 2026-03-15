require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');
const { verifyTelegramWebAppData } = require('./utils');

// 检查必要的环境变量
if (!process.env.BOT_TOKEN) {
  console.error('错误: 未在 .env 文件中设置 BOT_TOKEN');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:5173';

/**
 * Express 服务器部分 (处理 API 请求)
 */
const app = express();
app.use(cors());
app.use(express.json());

// API 身份验证中间件 (基于 Telegram initData)
const telegramAuth = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];
  if (!initData || !verifyTelegramWebAppData(initData, process.env.BOT_TOKEN)) {
    return res.status(401).json({ error: '无效的身份验证数据 (Unauthorized)' });
  }
  next();
};

// 示例 API: 获取剧集 (受保护)
app.get('/api/series', (req, res) => {
  // 这里可以从数据库获取
  res.json([
    { id: 'series_001', title: '重生之我是大魔王', cover: '...', status: '连载中' }
  ]);
});

// 示例 API: 创建订单 (受保护)
app.post('/api/orders', telegramAuth, (req, res) => {
  const { series_id, plan_id } = req.body;
  console.log(`收到安全订单请求: ${series_id} - ${plan_id}`);
  res.json({ success: true, order_id: 'ord_' + Date.now() });
});

/**
 * Telegraf Bot 部分 (处理 Bot 指令)
 */
const getWelcomeMessage = (username) => {
  return `你好 ${username}！ 👋\n\n欢迎来到漫剧订阅助手！在这里你可以：\n\n📺 浏览并订阅全网热门漫剧\n🎟 付费进群观影，永久有效\n💎 支持多种支付方式\n\n请点击下方按钮进入商城或查看您的订阅。`;
};

bot.start((ctx) => {
  const username = ctx.from.first_name || '朋友';
  return ctx.reply(getWelcomeMessage(username), 
    Markup.keyboard([
      [Markup.button.webApp('🎬 进入剧集商城', WEB_APP_URL)],
      [Markup.button.webApp('💎 我的订阅', `${WEB_APP_URL}/my-subs`) || Markup.button.callback('💎 我的订阅', 'my_subs_cb')],
      [Markup.button.url('📞 联系客服', 'https://t.me/your_support_username')]
    ])
    .resize()
  );
});

bot.on('web_app_data', (ctx) => {
  try {
    const data = JSON.parse(ctx.webAppData.data.json());
    if (data.action === 'payment_success') {
      ctx.reply(`🎉 支付成功！您已订阅《${data.series_name}》，请在“我的订阅”中查看进群链接。`);
    }
  } catch (error) {
    console.error('处理 Web App 数据出错:', error);
  }
});

bot.catch((err, ctx) => {
  console.error(`Ooops, 发生了错误: ${ctx.update_type}`, err);
});

// 启动 Bot 和 Express 服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API 服务器已在端口 ${PORT} 启动`);
});

bot.launch().then(() => {
  console.log('✅ Bot 已成功启动！');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
