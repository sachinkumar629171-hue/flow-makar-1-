import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = new Set(['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com']);

const DEFAULT_PLAN_EXTENSIONS = {
  basic: {
    name: 'Flow Basic Chrome Extension',
    version: '1.8.0',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1ow7jqVhIgJZiJfXw9AsYMTNw_AzPZLwc',
    fileName: 'flow-basic-extension-v1.8.0.zip',
    description: 'Standard Video Prompt Sync & Studio Launcher for Basic Plan Members.',
    updatedAt: new Date().toISOString(),
    downloadType: 'url',
  },
  ultra: {
    name: 'Flow Ultra VIP Extension',
    version: '3.2.0',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1ow7jqVhIgJZiJfXw9AsYMTNw_AzPZLwc',
    fileName: 'flow-ultra-vip-extension-v3.2.0.zip',
    description: 'High-Speed 4K Pipeline, Unlimited Prompt Queue & VIP Multi-Session Sync.',
    updatedAt: new Date().toISOString(),
    downloadType: 'url',
  },
};

const DEFAULT_TUTORIAL_CONFIG = {
  desktopVideoUrl: 'https://youtu.be/bNZXy0cAv_o?si=_hgtM9DrSpMS4EhN',
  desktopTitle: 'How to Use Flow on Desktop / PC',
  desktopSubtitle: 'Complete tutorial on setting up the Chrome extension & using Desktop Studio.',
  mobileVideoUrl: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
  mobileTitle: 'How to Use Flow on Mobile (Android & iOS)',
  mobileSubtitle: 'Step-by-step guide on generating AI videos seamlessly from mobile browsers.',
};

const DEFAULT_PROMPT_CONFIG = {
  servers: [
    {
      id: 'server1',
      label: 'Server 1',
      prompt: '',
    }
  ],
  costs: {
    image: 20,
    video: 30
  },
  signupTelegramUrl: 'https://t.me/google_ultra_veo3_bot',
  resellerContactUrl: 'https://t.me/google_ultra_veo3_bot',
};

function getResellerApiKey(reseller: any): string {
  if (reseller.apiKey || reseller.api_key) return reseller.apiKey || reseller.api_key;
  const cleanId = String(reseller.id || '').replace(/[^a-zA-Z0-9]/g, '');
  return `flw_res_${cleanId}`;
}

function createAdminSessionToken(email: string, randomSuffix?: string): string {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const sig = Buffer.from(`admin|${cleanEmail}|flw_adm_sec_2026`).toString('base64url').slice(0, 16);
  const rand = randomSuffix || `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 7)}`;
  return `asess_${sig}_${rand}`;
}

function verifySignedAdminSessionToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const cleanToken = token.trim();
  if (!cleanToken.startsWith('asess_')) return false;
  const parts = cleanToken.split('_');
  if (parts.length < 3) return false;
  const suffix = parts.slice(2).join('_');
  for (const adminEmail of ADMIN_EMAILS) {
    if (cleanToken === createAdminSessionToken(adminEmail, suffix)) {
      return true;
    }
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-admin-session-id, x-admin-key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  if (!supaUrl || !supaKey) {
    return res.status(500).json({ success: false, error: 'Database configuration missing' });
  }

  const supabase = createClient(supaUrl, supaKey);

  // Strictly require Admin sessionId in request headers or body (never allow unauthenticated direct link access)
  const authHeader = (req.headers.authorization || '').toString();
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const headerSessionId = (req.headers['x-admin-session-id'] || req.headers['x-session-token'] || '').toString().trim();
  const bodySessionId = (req.body?.sessionId || req.body?.sessionToken || '').toString().trim();
  const sessionId = headerSessionId || bearerToken || bodySessionId;

  if (!sessionId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Admin sessionId is required to access admin data.',
    });
  }

  try {
    let isAuthorizedAdmin = verifySignedAdminSessionToken(sessionId);

    if (!isAuthorizedAdmin) {
      const { data: callerUser } = await supabase
        .from('users')
        .select('id, email, role, session_token')
        .eq('session_token', sessionId)
        .maybeSingle();

      if (callerUser) {
        const callerEmail = String(callerUser.email || '').trim().toLowerCase();
        if (ADMIN_EMAILS.has(callerEmail) || callerUser.role === 'admin') {
          isAuthorizedAdmin = true;
        }
      }
    }

    if (!isAuthorizedAdmin) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or expired admin sessionId.',
      });
    }

    const now = Date.now();

    // 1. Fetch Users (excluding heavy admin_config_% backup rows to save Egress)
    let usersList: any[] = [];
    try {
      const { data: allUsers } = await supabase.from('users').select('*').not('id', 'like', 'admin_config_%');
      if (allUsers && Array.isArray(allUsers)) {
        usersList = allUsers
          .filter((u: any) => u.id && !u.id.startsWith('admin_config_') && !u.id.startsWith('sys_config_') && !u.email?.includes('@system.local'))
          .map((u: any) => {
            const userEmail = (u.email || '').toLowerCase().trim();
            const isSysAdmin = ADMIN_EMAILS.has(userEmail) || u.role === 'admin';
            const lastActiveTime = u.last_active ? new Date(u.last_active).getTime() : NaN;
            // Strict 2-minute (120,000 ms) heartbeat window
            const isLive = !isNaN(lastActiveTime) && (now - lastActiveTime <= 120000 && now - lastActiveTime >= -5000);

            // Time-based continuous plan validity decrease - use actual creation time (jab access mila)
            const planStartedAt = u.plan_started_at || u['created_at TIMESTAMPTZ'] || u.created_at || new Date().toISOString();
            let planDaysLeft = Number(u.plan_days_left) ?? 30;
            let planExpiresAt = u.plan_expires_at;

            if (!planExpiresAt) {
              const startMs = new Date(planStartedAt).getTime();
              const computedExpMs = (isNaN(startMs) ? now : startMs) + Math.max(1, planDaysLeft) * 86400000;
              planExpiresAt = new Date(computedExpMs).toISOString();
              supabase.from('users').update({
                plan_started_at: planStartedAt,
                plan_expires_at: planExpiresAt
              }).eq('id', u.id).then(() => {}, () => {});
            } else if (!isSysAdmin) {
              const expMs = new Date(planExpiresAt).getTime();
              if (!isNaN(expMs)) {
                planDaysLeft = Math.max(0, Math.ceil((expMs - now) / 86400000));
                if (Number(u.plan_days_left) !== planDaysLeft) {
                  supabase.from('users').update({ plan_days_left: planDaysLeft }).eq('id', u.id).then(() => {}, () => {});
                }
              }
            }

            const isExpired = !isSysAdmin && planDaysLeft <= 0;

            return {
              id: u.id,
              name: u.name || 'User',
              email: u.email || '',
              plan: isSysAdmin ? 'ultra' : (isExpired ? 'basic' : (u.plan || 'basic')),
              credits: isSysAdmin ? 45000 : (isExpired ? Math.min(Number(u.credits) ?? 100, 100) : (Number(u.credits) ?? 100)),
              maxCredits: isSysAdmin ? 45000 : (isExpired ? 100 : (Number(u.max_credits) ?? (u.plan === 'ultra' ? 45000 : 100))),
              planDaysLeft: isSysAdmin ? 30 : planDaysLeft,
              planExpiresAt,
              planStartedAt,
              role: isSysAdmin ? 'admin' : (u.role || 'user'),
              resellerId: u.reseller_id,
              resellerName: u.reseller_name,
              status: u.status || 'active',
              extensionAccess: u.extension_access !== false,
              canEditPrompts: u.can_edit_prompts === true,
              isOnline: isLive, // Strictly from heartbeat within 2 minutes!
              lastActive: u.last_active || '', // Never fake lastActive
              createdAt: u.created_at || new Date().toISOString(),
              avatarColor: u.avatar_color || (isSysAdmin ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600'),
            };
          });

        // Zero-Quota Guard: Only update Supabase if an Ultra/Unlimited user actually expired (no unnecessary writes!)
        for (const u of allUsers) {
          if (!u.id || u.id.startsWith('admin_config_')) continue;
          if (u.plan_expires_at && (u.plan === 'ultra' || u.plan === 'unlimited')) {
            const expMs = new Date(u.plan_expires_at).getTime();
            if (!isNaN(expMs) && expMs <= now) {
              supabase.from('users').update({
                plan: 'basic',
                plan_days_left: 0,
                max_credits: 100,
                credits: Math.min(Number(u.credits) ?? 100, 100),
              }).eq('id', u.id).then(() => {});
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching users in /api/admin/data:', e);
    }

    // Ensure system admins are present
    const ensureAdmins = [
      { email: 'sachinxexplore@gmail.com', name: 'Sachin Kumar', ref: 'FLOWADMIN' },
      { email: 'sachinkumar629171@gmail.com', name: 'Sachin Kumar (Alt)', ref: 'FLOWADMIN2' },
    ];
    for (const adm of ensureAdmins) {
      if (!usersList.some(u => u.email.toLowerCase() === adm.email.toLowerCase())) {
        usersList.unshift({
          id: `usr-admin-${adm.ref}`,
          name: adm.name,
          email: adm.email,
          plan: 'ultra',
          credits: 45000,
          maxCredits: 45000,
          planDaysLeft: 30,
          planExpiresAt: undefined,
          role: 'admin',
          resellerId: undefined,
          resellerName: undefined,
          status: 'active',
          extensionAccess: true,
          canEditPrompts: true,
          isOnline: false,
          lastActive: '',
          createdAt: '2025-01-10T10:00:00Z',
          avatarColor: 'from-purple-600 to-indigo-600',
        });
      }
    }

    // 2. Fetch Resellers
    let resellersList: any[] = [];
    try {
      const mergedMap = new Map<string, any>();
      try {
        const { data: resRow } = await supabase.from('users').select('name').eq('id', 'admin_config_resellers').maybeSingle();
        if (resRow?.name) {
          const parsed = JSON.parse(resRow.name);
          if (Array.isArray(parsed)) {
            for (const r of parsed) {
              const key = String(r.id || r.email || '').trim().toLowerCase();
              if (key) mergedMap.set(key, r);
            }
          }
        }
      } catch {}

      const { data: supaResellers } = await supabase.from('resellers').select('*');
      if (supaResellers && Array.isArray(supaResellers)) {
        for (const sr of supaResellers) {
          const keyById = String(sr.id || '').trim().toLowerCase();
          const keyByEmail = String(sr.email || '').trim().toLowerCase();
          const existing = mergedMap.get(keyById) || (keyByEmail ? mergedMap.get(keyByEmail) : undefined) || {};
          const merged = {
            ...existing,
            ...sr,
            password: sr.password || existing.password || '',
          };
          if (keyById) mergedMap.set(keyById, merged);
          else if (keyByEmail) mergedMap.set(keyByEmail, merged);
        }
      }

      const seenIds = new Set<string>();
      const seenEmails = new Set<string>();
      const rawResellers: any[] = [];
      for (const item of mergedMap.values()) {
        const idKey = String(item.id || '').trim().toLowerCase();
        const emailKey = String(item.email || '').trim().toLowerCase();
        if ((idKey && seenIds.has(idKey)) || (emailKey && seenEmails.has(emailKey))) continue;
        if (idKey) seenIds.add(idKey);
        if (emailKey) seenEmails.add(emailKey);
        rawResellers.push(item);
      }

      resellersList = rawResellers.map((sr: any) => {
        let daysLeft = sr.days_left !== undefined ? Number(sr.days_left) : (sr.daysLeft !== undefined ? Number(sr.daysLeft) : 30);
        const expiresAt = sr.expires_at || sr.expiresAt;
        if (expiresAt) {
          const diff = new Date(expiresAt).getTime() - now;
          daysLeft = Math.max(0, Math.ceil(diff / 86400000));
        }
        const isExp = daysLeft <= 0;
        const status = sr.status === 'suspended' ? 'suspended' : (isExp ? 'expired' : 'active');

        return {
          id: sr.id,
          portalName: sr.portal_name || sr.portalName || 'Reseller Portal',
          email: sr.email || '',
          password: sr.password || '',
          userLimit: sr.user_limit || sr.userLimit || sr.max_users || 50,
          daysLeft,
          expiryDate: sr.expiry_date || sr.expiryDate || '30/10/2026',
          expiresAt,
          status,
          createdAt: sr.created_at || sr.createdAt || new Date().toISOString(),
          notes: sr.notes || '',
          apiKey: getResellerApiKey(sr),
        };
      });
    } catch (e) {
      console.error('Error fetching resellers in /api/admin/data:', e);
    }

    // 3. Fetch Configs
    let promptConfig: any = DEFAULT_PROMPT_CONFIG;
    let planExtensions: any = DEFAULT_PLAN_EXTENSIONS;
    let tutorialConfig: any = DEFAULT_TUTORIAL_CONFIG;

    try {
      const { data: configs } = await supabase.from('app_config').select('*');
      if (configs && Array.isArray(configs)) {
        for (const cfg of configs) {
          if (cfg.key === 'admin_config_prompts' && cfg.value) promptConfig = cfg.value;
          else if (cfg.key === 'admin_config_extensions' && cfg.value) planExtensions = cfg.value;
          else if (cfg.key === 'admin_config_tutorial' && cfg.value) tutorialConfig = cfg.value;
        }
      }
    } catch {}

    try {
      const { data: promptRow } = await supabase.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
      if (promptRow?.name) {
        const parsed = JSON.parse(promptRow.name);
        if (parsed && typeof parsed === 'object') promptConfig = { ...promptConfig, ...parsed };
      }
    } catch {}

    try {
      const { data: extRow } = await supabase.from('users').select('name').eq('id', 'admin_config_extensions').maybeSingle();
      if (extRow?.name) {
        const parsed = JSON.parse(extRow.name);
        if (parsed && typeof parsed === 'object') planExtensions = { ...planExtensions, ...parsed };
      }
    } catch {}

    try {
      const { data: tutRow } = await supabase.from('users').select('name').eq('id', 'admin_config_tutorial').maybeSingle();
      if (tutRow?.name) {
        const parsed = JSON.parse(tutRow.name);
        if (parsed && typeof parsed === 'object') tutorialConfig = { ...tutorialConfig, ...parsed };
      }
    } catch {}

    // Return ALL Supabase data in ONE single response!
    return res.status(200).json({
      success: true,
      users: usersList,
      resellers: resellersList,
      promptConfig,
      planExtensions,
      tutorialConfig,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('/api/admin/data error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
