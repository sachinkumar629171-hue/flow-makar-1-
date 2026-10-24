import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract token from Bearer header or x-session-token or query
  const authHeader = (req.headers.authorization || '').toString();
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const headerToken = (req.headers['x-session-token'] || '').toString().trim();
  const queryToken = (req.query.sessionToken || req.query.token || '').toString().trim();

  const token = bearerToken || headerToken || queryToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Session token required or invalid',
    });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  if (!supaUrl || !supaKey) {
    return res.status(500).json({ success: false, error: 'Database configuration missing' });
  }

  try {
    const supabase = createClient(supaUrl, supaKey);

    // Look up this exact single user by session_token or user id
    let query = supabase.from('users').select('*');
    if (token.startsWith('sess-')) {
      query = query.eq('session_token', token);
    } else {
      query = query.or(`session_token.eq.${token},id.eq.${token}`);
    }

    const { data: supaUser, error } = await query.maybeSingle();

    if (error || !supaUser || supaUser.id?.startsWith('admin_config_')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Session expired or user not found in database',
      });
    }

    // Check account status
    if (supaUser.status === 'suspended' || supaUser.status === 'inactive') {
      return res.status(403).json({
        success: false,
        error: 'Account suspended or inactive',
      });
    }

    const userEmail = (supaUser.email || '').toLowerCase().trim();
    const ADMIN_EMAILS = new Set(['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com']);
    const isSystemAdmin = ADMIN_EMAILS.has(userEmail) || supaUser.role === 'admin';

    if (isSystemAdmin && supaUser.role !== 'admin') {
      supabase.from('users').update({ role: 'admin' }).eq('id', supaUser.id).then(() => {});
    }

    // Check active dashboard notification/announcement configured by Admin (cached 10s for zero extra egress)
    let activeAnnouncement: { enabled: boolean; text: string; type: 'info' | 'warning' | 'success' } | null = null;
    try {
      const g = globalThis as any;
      const nowMs = Date.now();
      if (g.__meAnnouncementCache && (nowMs - g.__meAnnouncementCache.ts < 10000)) {
        activeAnnouncement = g.__meAnnouncementCache.data;
      } else {
        let appCfg: any = null;
        let usrCfg: any = null;
        try {
          const { data: appRow } = await supabase.from('app_config').select('value').eq('key', 'admin_config_prompts').maybeSingle();
          if (appRow?.value) {
            appCfg = typeof appRow.value === 'string' ? JSON.parse(appRow.value) : appRow.value;
          }
        } catch {}
        try {
          const { data: usrRow } = await supabase.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
          if (usrRow?.name) {
            usrCfg = typeof usrRow.name === 'string' ? JSON.parse(usrRow.name) : usrRow.name;
          }
        } catch {}

        const appTs = Number(appCfg?.dashboardAnnouncement?.updatedAt || appCfg?._updatedAt || 0);
        const usrTs = Number(usrCfg?.dashboardAnnouncement?.updatedAt || usrCfg?._updatedAt || 0);
        const parsedCfg = (usrCfg && usrTs > appTs) ? usrCfg : (appCfg || usrCfg);

        const ann = parsedCfg?.dashboardAnnouncement;
        if (ann && ann.enabled === true && typeof ann.text === 'string' && ann.text.trim().length > 0) {
          activeAnnouncement = {
            enabled: true,
            text: ann.text.trim(),
            type: ann.type || 'info',
          };
        } else {
          activeAnnouncement = null;
        }
        g.__meAnnouncementCache = { ts: nowMs, data: activeAnnouncement };
      }
    } catch {}

    // Return ONLY essential fields requested by user (No internal IDs, session tokens, reseller or online status)
    const safeUser: Record<string, any> = {
      name: supaUser.name || 'User',
      email: supaUser.email || '',
      plan: isSystemAdmin ? 'ultra' : (supaUser.plan || 'basic'),
      credits: Number(supaUser.credits) ?? (isSystemAdmin ? 45000 : 100),
      maxCredits: Number(supaUser.max_credits) ?? (supaUser.plan === 'ultra' || isSystemAdmin ? 45000 : 100),
      planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
      role: isSystemAdmin ? 'admin' : (supaUser.role || 'user'),
    };

    const showNotification = Boolean(activeAnnouncement && activeAnnouncement.enabled);

    return res.status(200).json({
      success: true,
      user: safeUser,
      showNotification,
      ...(showNotification && activeAnnouncement
        ? {
            notification: {
              message: activeAnnouncement.text,
              type: activeAnnouncement.type,
            },
          }
        : {}),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Database connection error: ' + (err?.message || 'unknown'),
    });
  }
}
