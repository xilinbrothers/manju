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
  res.json([
    {
      id: 'series_001',
      title: '绝世医仙 来自后端',
      description: '身怀绝技的神医，游走于都市之间，妙手回春的同时揭开惊天阴谋。',
      cover: 'https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&q=80&w=640&h=360',
      status: '连载中',
      total: 45,
      category: '都市情感'
    },
    {
      id: 'series_002',
      title: '霸道总裁的替身娇妻',
      description: '一场意外的替身契约，开启了一段爱恨纠葛的豪门绝恋...',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=640&h=360',
      status: '已完结',
      total: 12,
      category: '商战权谋'
    }
  ]);
});

app.get('/api/plans', (req, res) => {
  const seriesId = req.query.series_id;
  const basePlans = [
    { id: '30days', label: '30天', price: '29.9', daily: '1.0', enabled: true },
    { id: '90days', label: '90天', price: '69.9', daily: '0.78', save: '21', popular: true, enabled: true },
    { id: '365days', label: '365天', price: '199.9', daily: '0.55', save: '159', enabled: true },
    { id: '15days', label: '15天 (临近完结)', price: '19.9', daily: '1.33', note: '暂不可选', enabled: false }
  ];

  if (seriesId === 'series_002') {
    return res.json(basePlans.map((p) => (p.id === '365days' ? { ...p, enabled: false, note: '暂不可选' } : p)));
  }

  return res.json(basePlans);
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
