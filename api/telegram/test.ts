import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { botToken, chatId } = req.body || {};
  if (!botToken || !chatId) {
    return res.status(400).json({ success: false, error: 'Telegram Bot Token and Chat/Channel ID are required.' });
  }

  const cleanToken = String(botToken).trim();
  const cleanChatId = String(chatId).trim();

  const istNow = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const testMsg = `🤖 <b>TELEGRAM BOT CONNECTED SUCCESSFULLY!</b> 🚀\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ <b>Status:</b> Prompt Server Alert System is Active & Connected.\n` +
    `🕒 <b>Test Timestamp (IST):</b> ${istNow} (IST)\n` +
    `🔔 <b>Active Alerts Configured:</b>\n` +
    ` • ⏳ <b>20-Min Reminder:</b> Pre-expiry alert\n` +
    ` • 🚨 <b>5-Min Missed Alert:</b> Overdue alert with Indian Time\n` +
    ` • ✅ <b>Recovery Alert:</b> Restoration duration notification\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Your Telegram channel/group will now receive real-time prompt alerts!</i>`;

  try {
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: testMsg,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data: any = await response.json();
    if (data.ok) {
      return res.status(200).json({ success: true, message: 'Test message sent successfully to Telegram!' });
    } else {
      let desc = data.description || `Telegram error (${response.status})`;
      if (desc.includes('Unauthorized')) {
        desc += ' -> Bot API Token invalid hai. @BotFather se token verify karein.';
      } else if (desc.includes('chat not found')) {
        desc += ' -> Channel / Chat ID verify karein (e.g. -100xxxxxxxxxx ya @channel).';
      } else if (desc.includes('bot is not a member') || desc.includes('rights')) {
        desc += ' -> Bot ko apne Channel / Group me Administrator banayein aur "Post Messages" permission dein!';
      }
      return res.status(400).json({ success: false, error: desc });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Network error communicating with Telegram.' });
  }
}
