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

    // Check active dashboard notification/announcement & requiredVersion configured by Admin in Supabase (cached 10s for zero extra egress)
    let activeAnnouncement: { enabled: boolean; text: string; type: 'info' | 'warning' | 'success' } | null = null;
    let requiredVersion = '3.2.0';
    try {
      const g = globalThis as any;
      const nowMs = Date.now();
      if (g.__meAnnouncementCache && (nowMs - g.__meAnnouncementCache.ts < 10000)) {
        activeAnnouncement = g.__meAnnouncementCache.data;
        requiredVersion = g.__meAnnouncementCache.requiredVersion || '3.2.0';
      } else {
        let appCfg: any = null;
        let usrCfg: any = null;
        let appExt: any = null;
        let usrExt: any = null;
        try {
          const { data: appRows } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', ['admin_config_prompts', 'admin_config_extensions']);
          if (Array.isArray(appRows)) {
            for (const r of appRows) {
              const v = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
              if (r.key === 'admin_config_prompts') appCfg = v;
              if (r.key === 'admin_config_extensions') appExt = v;
            }
          }
        } catch {}
        try {
          const { data: usrRows } = await supabase
            .from('users')
            .select('id, name')
            .in('id', ['admin_config_prompts', 'admin_config_extensions']);
          if (Array.isArray(usrRows)) {
            for (const r of usrRows) {
              if (!r.name) continue;
              const v = typeof r.name === 'string' ? JSON.parse(r.name) : r.name;
              if (r.id === 'admin_config_prompts') usrCfg = v;
              if (r.id === 'admin_config_extensions') usrExt = v;
            }
          }
        } catch {}

        const appTs = Number(appCfg?.dashboardAnnouncement?.updatedAt || appCfg?._updatedAt || 0);
        const usrTs = Number(usrCfg?.dashboardAnnouncement?.updatedAt || usrCfg?._updatedAt || 0);
        const parsedCfg = (usrCfg && usrTs > appTs) ? usrCfg : (appCfg || usrCfg);
        const latestPromptTs = Math.max(appTs, usrTs);

        const appExtTs = Number(appExt?._updatedAt || (appExt?.ultra?.updatedAt ? new Date(appExt.ultra.updatedAt).getTime() : 0) || 0);
        const usrExtTs = Number(usrExt?._updatedAt || (usrExt?.ultra?.updatedAt ? new Date(usrExt.ultra.updatedAt).getTime() : 0) || 0);
        const parsedExt = (usrExt && usrExtTs > appExtTs) ? usrExt : (appExt || usrExt);
        const latestExtTs = Math.max(appExtTs, usrExtTs);

        const promptVer = parsedCfg?.extensionVersion ? String(parsedCfg.extensionVersion).trim() : '';
        const extVer = parsedExt?.ultra?.version ? String(parsedExt.ultra.version).trim() : '';
        if (promptVer && extVer) {
          requiredVersion = latestExtTs > latestPromptTs ? extVer : promptVer;
        } else if (promptVer || extVer) {
          requiredVersion = promptVer || extVer;
        }

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
        g.__meAnnouncementCache = { ts: nowMs, data: activeAnnouncement, requiredVersion };
      }
    } catch {}

    const clientVersion = (
      req.query.version ||
      req.query.extensionVersion ||
      req.query.clientVersion ||
      req.headers['x-extension-version'] ||
      req.headers['x-client-version'] ||
      ''
    ).toString().trim();

    const norm = (v: string) => v.trim().toLowerCase().replace(/^v/i, '');
    if (clientVersion && norm(clientVersion) !== norm(requiredVersion)) {
      return res.status(426).json({
        success: false,
        allowed: false,
        updateRequired: true,
        needsUpdate: true,
        isOutdated: true,
        requiredVersion,
        version: requiredVersion,
        extensionVersion: requiredVersion,
        clientVersion,
        error: `Update Required: Your extension version (${clientVersion}) is outdated. Required version is ${requiredVersion}.`,
      });
    }

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
      requiredVersion,
      version: requiredVersion,
      extensionVersion: requiredVersion,
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
