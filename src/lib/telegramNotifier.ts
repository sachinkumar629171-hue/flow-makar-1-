// Telegram notification service and IST time formatting for Server Prompt Alerts

export interface ISTDateTime {
  dateStr: string;
  timeStr: string;
  fullStr: string;
  iso: string;
}

export function formatISTDateTime(dateInput?: string | number | Date): ISTDateTime {
  const date = dateInput ? new Date(dateInput) : new Date();
  
  if (isNaN(date.getTime())) {
    const fallback = new Date();
    return {
      dateStr: fallback.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }),
      timeStr: fallback.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
      fullStr: `${fallback.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)`,
      iso: fallback.toISOString(),
    };
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };

  const dateStr = date.toLocaleDateString('en-IN', dateOptions);
  const timeStr = date.toLocaleTimeString('en-IN', timeOptions);
  const fullStr = `${dateStr}, ${timeStr} (IST)`;

  return {
    dateStr,
    timeStr,
    fullStr,
    iso: date.toISOString(),
  };
}

export async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  messageHtml: string
): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Telegram Bot Token and Chat/Channel ID are required.' };
  }

  const cleanToken = botToken.trim();
  const cleanChatId = chatId.trim();

  // 1. Direct browser fetch to Telegram Bot API
  try {
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: messageHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return { success: true };
    } else {
      let desc = data.description || `Telegram API error (${response.status})`;
      if (desc.includes('Unauthorized') || desc.includes('Not Found')) {
        desc += ' -> Bot API Token invalid hai. @BotFather se naya token lein.';
      } else if (desc.includes('chat not found')) {
        desc += ' -> Chat/Channel ID galat hai ya bot channel me added nahi hai (e.g. -100xxxxxxxxxx ya @channel_username).';
      } else if (desc.includes('bot is not a member') || desc.includes('rights') || desc.includes('have no rights') || desc.includes('forbidden')) {
        desc += ' -> Bot ko apne Telegram Channel/Group me Administrator banayein aur "Post Messages" permission enable karein!';
      }
      return {
        success: false,
        error: desc,
      };
    }
  } catch (directErr: any) {
    // 2. Fallback to /api/telegram/test or server endpoint if browser blocked
    try {
      const serverRes = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: cleanToken, chatId: cleanChatId }),
      });
      if (serverRes.ok) {
        const sData = await serverRes.json();
        if (sData.success) return { success: true };
        return { success: false, error: sData.error || 'Telegram delivery failed' };
      }
    } catch {}

    return {
      success: false,
      error: directErr?.message || 'Network error communicating with Telegram.',
    };
  }
}

// 1. Pre-expiry Reminder Template (e.g. 20 minutes left)
export function generate20MinReminderMessage(
  serverLabel: string,
  serverId: string,
  minutesLeft: number,
  updatedBy?: string
): string {
  const istNow = formatISTDateTime(new Date());

  return `⏳ <b>PROMPT REFRESH REMINDER</b> ⏳
━━━━━━━━━━━━━━━━━━━━
🔹 <b>Server:</b> <code>${escapeHtml(serverLabel)}</code> (<code>${escapeHtml(serverId)}</code>)
⏱️ <b>Time Remaining:</b> <b>${minutesLeft} Minutes Left</b>
🕒 <b>Indian Time (IST):</b> ${istNow.fullStr}
👤 <b>Last Updated By:</b> ${escapeHtml(updatedBy || 'Admin')}
━━━━━━━━━━━━━━━━━━━━
⚠️ <b>Note:</b> Is server ka prompt set deadline se pehle update karne ke liye kripya naya prompt fill karein!`;
}

// 2. 5 Minutes Missed / Overdue Alert Template
export function generate5MinMissedAlertMessage(
  serverLabel: string,
  serverId: string,
  overdueMinutes: number,
  updatedBy?: string
): string {
  const istNow = formatISTDateTime(new Date());

  return `🚨 <b>ALERT: PROMPT UPDATE MISSED!</b> 🚨
━━━━━━━━━━━━━━━━━━━━
❌ <b>Server:</b> <code>${escapeHtml(serverLabel)}</code> (<code>${escapeHtml(serverId)}</code>)
📅 <b>Date:</b> ${istNow.dateStr}
⏰ <b>Missed Time (IST):</b> <b>${istNow.timeStr}</b>
⏳ <b>Overdue Duration:</b> <b>${overdueMinutes} minutes past deadline</b>
👤 <b>Last Updated By:</b> ${escapeHtml(updatedBy || 'Admin')}
━━━━━━━━━━━━━━━━━━━━
⚠️ <b>Warning:</b> Is server ka prompt timing end hone ke 5 minutes baad tak update nahi hua hai! Kripya jald se jald prompt refresh karein.`;
}

// 3. Recovery / Restored Alert Template (when updated after delay)
export function generateRecoveryMessage(
  serverLabel: string,
  serverId: string,
  delayMinutes: number,
  updaterName: string,
  nextCycleMinutes: number
): string {
  const istNow = formatISTDateTime(new Date());

  return `✅ <b>PROMPT UPDATED & RESTORED!</b> ✅
━━━━━━━━━━━━━━━━━━━━
🔹 <b>Server:</b> <code>${escapeHtml(serverLabel)}</code> (<code>${escapeHtml(serverId)}</code>)
🕒 <b>Updated At (IST):</b> <b>${istNow.fullStr}</b>
⏱️ <b>Delayed / Missed By:</b> <b>${delayMinutes} Minutes</b>
👤 <b>Updated By:</b> <b>${escapeHtml(updaterName)}</b>
🔄 <b>Next Update Due In:</b> ${nextCycleMinutes} Minutes (${Math.round((nextCycleMinutes / 60) * 10) / 10}h)
━━━━━━━━━━━━━━━━━━━━
✨ <i>Server prompt successfully synced with Chrome Extension and timer restarted!</i>`;
}

// 4. Test Notification Template
export function generateTestAlertMessage(): string {
  const istNow = formatISTDateTime(new Date());

  return `🤖 <b>TELEGRAM BOT CONNECTED SUCCESSFULLY!</b> 🚀
━━━━━━━━━━━━━━━━━━━━
✅ <b>Status:</b> Prompt Server Alert System is Active & Connected.
🕒 <b>Test Timestamp (IST):</b> ${istNow.fullStr}
🔔 <b>Alert Rules Active:</b>
 • ⏳ <b>20 Minutes Reminder:</b> Pre-expiry alert
 • 🚨 <b>5 Minutes Missed Alert:</b> Overdue alert with exact Indian Time
 • ✅ <b>Recovery Alert:</b> Duration missed & restored notification
━━━━━━━━━━━━━━━━━━━━
<i>Your Telegram channel/group will now receive automatic real-time prompt reminders!</i>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
