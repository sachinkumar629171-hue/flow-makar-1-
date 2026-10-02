import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { botToken, chatId, text } = req.body || {};
  if (!botToken || !chatId || !text) {
    return res.status(400).json({ success: false, error: 'Telegram Bot Token, Chat ID, and message text are required.' });
  }

  const cleanToken = String(botToken).trim();
  const cleanChatId = String(chatId).trim();

  try {
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data: any = await response.json();
    if (data.ok) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ success: false, error: data.description || 'Telegram API error' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Network error communicating with Telegram.' });
  }
}
