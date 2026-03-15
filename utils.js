const crypto = require('crypto');

/**
 * 验证从 Telegram Web App 接收到的 initData 签名是否有效
 * @param {string} initData - 原始的 window.Telegram.WebApp.initData 字符串
 * @param {string} botToken - 你的 Telegram Bot Token
 * @returns {boolean} - 验证结果
 */
function verifyTelegramWebAppData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return computedHash === hash;
}

module.exports = { verifyTelegramWebAppData };
