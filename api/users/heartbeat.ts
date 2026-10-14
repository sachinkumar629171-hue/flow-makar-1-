import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Memory cache to throttle Supabase writes: only write once every 80 seconds per user
// Saves >75% Supabase API quota while keeping 2-minute live window perfectly active!
const lastSupaWriteMap = new Map<string, number>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};
  const userId = (body.userId || body.id || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const sessionToken = (body.sessionToken || body.token || '').trim();
  const isOnline = body.isOnline !== false;

  const now = new Date().toISOString();
  const userKey = userId || email;
  const lastWrite = userKey ? (lastSupaWriteMap.get(userKey) || 0) : 0;
  const timeSinceLastWrite = Date.now() - lastWrite;

  // Smart Quota Saver: Only write to Supabase if going offline OR at least 80 seconds passed
  const shouldWriteSupabase = !isOnline || timeSinceLastWrite >= 80000;

  if (!shouldWriteSupabase) {
    return res.status(200).json({
      success: true,
      isOnline,
      lastActive: now,
      throttled: true,
    });
  }

  const supaUrl = (req.headers['x-supabase-url'] as string) || 
                  process.env.VITE_SUPABASE_URL || 
                  process.env.SUPABASE_URL || 
                  'https://dhtnplocynujkkhqieut.supabase.co';
  const supaKey = (req.headers['x-supabase-anon-key'] as string) || 
                  process.env.VITE_SUPABASE_ANON_KEY || 
                  process.env.SUPABASE_ANON_KEY || 
                  '';

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);

      // Check session token mismatch if provided
      if (sessionToken && email) {
        const { data: supaUser } = await supabase.from('users').select('id, session_token').ilike('email', email).maybeSingle();
        if (supaUser && supaUser.session_token && supaUser.session_token !== sessionToken) {
          return res.status(200).json({
            success: false,
            sessionMismatch: true,
            error: 'Session mismatch. Logged in on another device.',
          });
        }
      }

      // Update Supabase with is_online and last_active
      if (userId && !userId.startsWith('admin_config_')) {
        await supabase.from('users').update({
          is_online: isOnline,
          last_active: now,
        }).eq('id', userId);
        lastSupaWriteMap.set(userKey, Date.now());
      } else if (email) {
        await supabase.from('users').update({
          is_online: isOnline,
          last_active: now,
        }).ilike('email', email);
        lastSupaWriteMap.set(userKey, Date.now());
      }
    } catch (err) {
      console.error('Heartbeat update error:', err);
    }
  }

  return res.status(200).json({
    success: true,
    isOnline,
    lastActive: now,
  });
}
