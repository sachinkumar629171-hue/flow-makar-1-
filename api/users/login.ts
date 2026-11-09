import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || 'flw_srv_adm_v9_sec_key_9842';

const LOGIN_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const MAX_FAILED_ATTEMPTS = 5;
const failedLoginMap = new Map<string, number[]>();

function getClientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : (xff || req.socket?.remoteAddress || 'unknown');
  return String(raw).split(',')[0].trim() || 'unknown';
}

function isLoginRateLimited(ip: string, email: string): boolean {
  const now = Date.now();
  const keys = [`ip:${ip}`, ...(email ? [`email:${email}`] : [])];
  for (const key of keys) {
    const timestamps = (failedLoginMap.get(key) || []).filter(t => now - t < LOGIN_WINDOW_MS);
    if (timestamps.length > 0) {
      failedLoginMap.set(key, timestamps);
    } else {
      failedLoginMap.delete(key);
    }
    if (timestamps.length >= MAX_FAILED_ATTEMPTS) {
      return true;
    }
  }
  return false;
}

function recordFailedLogin(ip: string, email: string): void {
  const now = Date.now();
  const keys = [`ip:${ip}`, ...(email ? [`email:${email}`] : [])];
  for (const key of keys) {
    const timestamps = (failedLoginMap.get(key) || []).filter(t => now - t < LOGIN_WINDOW_MS);
    timestamps.push(now);
    failedLoginMap.set(key, timestamps);
  }
}

function clearFailedLogin(ip: string, email: string): void {
  failedLoginMap.delete(`ip:${ip}`);
  if (email) failedLoginMap.delete(`email:${email}`);
}

function createAdminSessionToken(email: string, randomSuffix?: string): string {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const sig = Buffer.from(`admin_v2|${cleanEmail}|${ADMIN_SECRET}`).toString('base64url').slice(0, 16);
  const rand = randomSuffix || `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;
  return `asess_${sig}_${rand}`;
}

async function findAdminFromDatabase(supabase: any, cleanEmail: string): Promise<{ row: any; tableName: string } | null> {
  for (const tableName of ['admin_data', 'admin data']) {
    try {
      const { data: rows, error } = await supabase
        .from(tableName)
        .select('*')
        .ilike('email', cleanEmail);
      if (!error && Array.isArray(rows) && rows.length > 0) {
        const match = rows.find((r: any) => !r.role || String(r.role).toLowerCase() === 'admin') || rows[0];
        if (match) return { row: match, tableName };
      }
    } catch {}
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-admin-session-id');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const body = req.body || {};
  const query = req.query || {};

  const emailRaw = (body.email || query.email || '').toString().trim();
  const passwordRaw = (body.password || query.password || '').toString().trim();
  const clientSessionToken = (body.sessionToken || body.sessionId || query.sessionToken || query.sessionId || '').toString().trim();
  const forceLogin = body.forceLogin === true || body.forceLogin === 'true' || query.forceLogin === 'true';

  if (!emailRaw) {
    if (req.method === 'GET') {
      return res.status(200).json({
        success: false,
        message: 'FlowMaker AI Login API is active. Send a POST request with email and password to log in.',
        endpoint: '/api/users/login',
        method: 'POST'
      });
    }
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const cleanEmail = emailRaw.toLowerCase().trim();
  const clientIp = getClientIp(req);

  if (isLoginRateLimited(clientIp, cleanEmail)) {
    return res.status(429).json({
      success: false,
      error: 'Too many login attempts',
    });
  }

  // STRICT SECURITY: Never allow empty password to bypass authentication!
  if (!passwordRaw) {
    recordFailedLogin(clientIp, cleanEmail);
    return res.status(401).json({ success: false, error: 'Password is required.' });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  try {
    const supabase = createClient(supaUrl, supaKey);
    const nowIso = new Date().toISOString();

    // 1. Check dedicated admin_data table in Supabase first
    const adminLookup = await findAdminFromDatabase(supabase, cleanEmail);
    if (adminLookup) {
      const { row: adminRow, tableName } = adminLookup;
      const expectedAdminPass = String(adminRow.password || '').trim();
      const adminRole = String(adminRow.role || 'admin').trim().toLowerCase();

      if (adminRole !== 'admin' || !expectedAdminPass || expectedAdminPass !== passwordRaw) {
        recordFailedLogin(clientIp, cleanEmail);
        return res.status(401).json({ success: false, error: 'Incorrect password.' });
      }

      clearFailedLogin(clientIp, cleanEmail);
      const newSessionToken = createAdminSessionToken(cleanEmail);
      const adminId = String(adminRow.id || 'usr-admin-1');
      const adminName = String(adminRow.name || cleanEmail.split('@')[0] || 'Admin');

      // Update session_token in admin_data table
      try {
        if (adminRow.id) {
          await supabase.from(tableName).update({ session_token: newSessionToken }).eq('id', adminRow.id);
        } else {
          await supabase.from(tableName).update({ session_token: newSessionToken }).ilike('email', cleanEmail);
        }
      } catch {}

      // Also sync session_token into users table if the admin has a row in users
      try {
        const { data: existingAdminUsers } = await supabase.from('users').select('id').ilike('email', cleanEmail);
        if (Array.isArray(existingAdminUsers) && existingAdminUsers.length > 0) {
          await supabase.from('users').update({
            role: 'admin',
            session_token: newSessionToken,
            is_online: true,
            last_active: nowIso,
          }).eq('id', existingAdminUsers[0].id);
        }
      } catch {}

      const adminUserData = {
        id: adminId,
        name: adminName,
        email: cleanEmail,
        plan: 'ultra',
        credits: 45000,
        maxCredits: 45000,
        planDaysLeft: 30,
        role: 'admin',
        status: 'active',
        isOnline: true,
        lastActive: nowIso,
      };

      return res.status(200).json({
        success: true,
        sessionId: newSessionToken,
        user: adminUserData,
      });
    }

    // 2. Fetch user(s) from Supabase users table by email
    let supaUser: any = null;
    const { data: matchingRows, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', cleanEmail);

    if (!error && Array.isArray(matchingRows) && matchingRows.length > 0) {
      const validRows = matchingRows.filter((r: any) => r.id && !String(r.id).startsWith('admin_config_') && !String(r.id).startsWith('sys_config_'));
      if (validRows.length > 0) {
        const planRank = (p: string) => (p === 'unlimited' ? 3 : p === 'ultra' ? 2 : 1);
        validRows.sort((a: any, b: any) => {
          const rankDiff = planRank(b.plan) - planRank(a.plan);
          if (rankDiff !== 0) return rankDiff;
          const credDiff = (Number(b.credits) || 0) - (Number(a.credits) || 0);
          if (credDiff !== 0) return credDiff;
          const daysDiff = (Number(b.plan_days_left) || 0) - (Number(a.plan_days_left) || 0);
          return daysDiff;
        });
        supaUser = validRows[0];

        if (validRows.length > 1) {
          const duplicateIds = validRows.slice(1).map((r: any) => r.id).filter(Boolean);
          if (duplicateIds.length > 0) {
            supabase.from('users').delete().in('id', duplicateIds).then(() => {});
          }
        }
      }
    }

    if (!supaUser) {
      recordFailedLogin(clientIp, cleanEmail);
      return res.status(404).json({
        success: false,
        error: 'Account not found. Please sign up or contact administrator.'
      });
    }

    // 3. Strict Password Verification (never allow empty or mismatched password)
    const expectedPassword = String(supaUser.password || '').trim();
    if (!expectedPassword || expectedPassword !== passwordRaw) {
      recordFailedLogin(clientIp, cleanEmail);
      return res.status(401).json({ success: false, error: 'Incorrect password.' });
    }

    clearFailedLogin(clientIp, cleanEmail);

    // 4. Status Check
    if (supaUser.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'This account has been suspended by administration.'
      });
    }

    const isUserAdmin = String(supaUser.role || '').toLowerCase() === 'admin';

    // 5. Single Device Check (Skip for admin or if forceLogin is true)
    const activeSessionToken = supaUser.session_token || '';
    const isOnline = Boolean(supaUser.is_online);
    const lastActiveTime = supaUser.last_active ? new Date(supaUser.last_active).getTime() : 0;
    const isRecentlyActive = (Date.now() - lastActiveTime) < 3 * 60 * 1000;

    if (!isUserAdmin && !forceLogin && isOnline && activeSessionToken && isRecentlyActive) {
      const isSameDevice = clientSessionToken && clientSessionToken === activeSessionToken;
      if (!isSameDevice) {
        return res.status(403).json({
          success: false,
          isDeviceLocked: true,
          error: '⚠️ Yeh account abhi kisi dusre device / browser par ACTIVE hai! Ek samay me kewal 1 device par login allowed hai. Kripya pehle waha se logout karein ya Force Login karein.'
        });
      }
    }

    // 6. Generate brand new session token (asess_... for admin, sess-... for regular user)
    const newSessionToken = isUserAdmin
      ? createAdminSessionToken(cleanEmail)
      : 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

    try {
      await supabase.from('users').update({
        session_token: newSessionToken,
        is_online: true,
        last_active: nowIso,
      }).eq('id', supaUser.id);
    } catch (updateErr) {
      console.error('Supabase login token update error:', updateErr);
    }

    const rawStartedAt = supaUser.plan_started_at || supaUser['created_at TIMESTAMPTZ'] || supaUser.created_at || nowIso;
    const safeUser = {
      id: supaUser.id,
      name: supaUser.name || 'User',
      email: supaUser.email,
      plan: isUserAdmin ? 'ultra' : (supaUser.plan || 'basic'),
      credits: isUserAdmin ? 45000 : (Number(supaUser.credits) ?? 100),
      maxCredits: isUserAdmin ? 45000 : (Number(supaUser.max_credits) ?? (supaUser.plan === 'ultra' ? 45000 : 100)),
      planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
      planExpiresAt: supaUser.plan_expires_at || undefined,
      planStartedAt: rawStartedAt,
      role: isUserAdmin ? 'admin' : (supaUser.role || 'user'),
      status: supaUser.status || 'active',
      isOnline: true,
      lastActive: nowIso,
    };

    return res.status(200).json({
      success: true,
      sessionId: newSessionToken,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Login handler error:', err);
    return res.status(500).json({
      success: false,
      error: 'Login service encountered an error: ' + (err?.message || 'unknown error')
    });
  }
}
