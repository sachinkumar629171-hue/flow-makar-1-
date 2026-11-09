import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = new Set(['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com']);
const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || 'flw_srv_adm_v9_sec_key_9842';

function createResellerSessionToken(reseller: any, randomSuffix?: string): string {
  const cleanId = String(reseller.id || '').trim();
  const cleanEmail = String(reseller.email || '').trim().toLowerCase();
  const cleanPass = String(reseller.password || '').trim();
  const sig = Buffer.from(`${cleanId}|${cleanEmail}|${cleanPass}|flw_res_sec`).toString('base64url').slice(0, 16);
  const rand = randomSuffix || `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 7)}`;
  return `rsess_${sig}_${rand}`;
}

function verifyResellerSessionToken(reseller: any, token: string): boolean {
  if (!reseller || !token || typeof token !== 'string') return false;
  const cleanToken = token.trim();
  if (!cleanToken) return false;
  if (reseller.sessionId && String(reseller.sessionId).trim() === cleanToken) return true;
  if (!cleanToken.startsWith('rsess_')) return false;
  const parts = cleanToken.split('_');
  if (parts.length < 3) return false;
  const expected = createResellerSessionToken(reseller, parts.slice(2).join('_'));
  return cleanToken === expected;
}

function createAdminSessionToken(email: string, randomSuffix?: string): string {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const sig = Buffer.from(`admin_v2|${cleanEmail}|${ADMIN_SECRET}`).toString('base64url').slice(0, 16);
  const rand = randomSuffix || `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;
  return `asess_${sig}_${rand}`;
}

async function verifyAdminSession(supabase: any, token: string): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;
  const cleanToken = token.trim();
  if (!cleanToken || cleanToken.startsWith('rsess_')) return false;
  if (cleanToken.startsWith('asess_YWRtaW58') || cleanToken.startsWith('asess_YWRtf')) return false;

  if (cleanToken.startsWith('asess_')) {
    const parts = cleanToken.split('_');
    if (parts.length >= 3) {
      const rand = parts.slice(2).join('_');
      for (const adminEmail of ADMIN_EMAILS) {
        if (cleanToken === createAdminSessionToken(adminEmail, rand)) {
          return true;
        }
      }
    }
  }

  if (supabase) {
    try {
      const { data: callerData } = await supabase
        .from('users')
        .select('*')
        .eq('session_token', cleanToken)
        .maybeSingle();
      if (callerData && !callerData.id?.startsWith('admin_config_') && callerData.status !== 'suspended') {
        const callerEmail = String(callerData.email || '').trim().toLowerCase();
        if (ADMIN_EMAILS.has(callerEmail) || callerData.role === 'admin') {
          return true;
        }
      }
    } catch {}
  }

  return false;
}

async function findResellerFromSupabase(supabase: any, resellerId: string): Promise<any | null> {
  const cleanTarget = String(resellerId || '').trim().toLowerCase();
  if (!cleanTarget) return null;

  let backupMatch: any = null;
  try {
    const { data: resRow } = await supabase.from('users').select('name').eq('id', 'admin_config_resellers').maybeSingle();
    if (resRow?.name) {
      const parsed = JSON.parse(resRow.name);
      if (Array.isArray(parsed)) {
        backupMatch = parsed.find(
          (r: any) =>
            String(r.id || '').trim().toLowerCase() === cleanTarget ||
            String(r.email || '').trim().toLowerCase() === cleanTarget
        );
      }
    }
  } catch {}

  let tableMatch: any = null;
  try {
    const { data: supaResellers } = await supabase.from('resellers').select('*');
    if (Array.isArray(supaResellers)) {
      tableMatch = supaResellers.find(
        (r: any) =>
          String(r.id || '').trim().toLowerCase() === cleanTarget ||
          String(r.email || '').trim().toLowerCase() === cleanTarget
      );
    }
  } catch {}

  if (!backupMatch && !tableMatch) return null;
  return {
    ...(backupMatch || {}),
    ...(tableMatch || {}),
    password: tableMatch?.password || backupMatch?.password || '',
    sessionId: backupMatch?.sessionId || tableMatch?.session_token || tableMatch?.session_id || '',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-admin-session-id, x-reseller-id, x-reseller-session-id');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  const supabase = supaUrl && supaKey ? createClient(supaUrl, supaKey) : null;

  try {
    const body = req.body || {};
    const { userId, email, data } = body;
    const resellerId = (body.resellerId || req.headers['x-reseller-id'] || '').toString().trim();
    const authHeader = (req.headers.authorization || '').toString();
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const sessionId = (
      body.sessionId ||
      body.sessionToken ||
      req.headers['x-reseller-session-id'] ||
      req.headers['x-admin-session-id'] ||
      req.headers['x-session-token'] ||
      bearerToken ||
      ''
    ).toString().trim();

    if (!userId && !email) {
      return res.status(400).json({ success: false, error: 'userId or email is required' });
    }

    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database configuration missing' });
    }

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Valid sessionId is required to update user data.',
      });
    }

    // 1. If update is initiated by a Reseller, strictly verify both resellerId and sessionId
    if (resellerId) {
      const matchedReseller = await findResellerFromSupabase(supabase, resellerId);
      if (!matchedReseller || !verifyResellerSessionToken(matchedReseller, sessionId)) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid reseller ID or session ID. Please sign in again.',
        });
      }

      if (matchedReseller.status === 'suspended') {
        return res.status(403).json({
          success: false,
          error: 'This reseller portal has been suspended by administration.',
        });
      }
    } else {
      // 2. Otherwise verify Admin sessionId (or the user's own sessionId for self-updates like credit deduction)
      const isAdmin = await verifyAdminSession(supabase, sessionId);
      if (!isAdmin) {
        const { data: selfUser } = await supabase
          .from('users')
          .select('id, email, session_token')
          .eq('session_token', sessionId)
          .maybeSingle();
        const targetEmailCheck = String(email || '').trim().toLowerCase();
        const isSelf =
          selfUser &&
          (selfUser.id === userId || (targetEmailCheck && String(selfUser.email || '').trim().toLowerCase() === targetEmailCheck));
        if (!isSelf) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized: Valid Admin or Reseller sessionId is required.',
          });
        }
      }
    }

    if (data && typeof data === 'object') {
      const targetEmail = (
        email ||
        (typeof userId === 'string' && userId.startsWith('usr-') && userId.includes('@') ? userId.slice(4) : '')
      )
        .toString()
        .trim()
        .toLowerCase();

      const hasRealId = typeof userId === 'string' && userId.trim().length > 0 && !(userId.startsWith('usr-') && userId.includes('@'));

      // Look up user's original created_at so plan_expires_at can NEVER exceed created_at + 30 days
      let maxAllowedExpiryMs = Date.now() + 30 * 86400000;
      let originalCreatedAt: string | null = null;
      if (data.planDaysLeft !== undefined || data.planExpiresAt !== undefined) {
        try {
          let existingQ = supabase.from('users').select('*');
          if (hasRealId) existingQ = existingQ.eq('id', userId);
          else if (targetEmail) existingQ = existingQ.ilike('email', targetEmail);
          const { data: existingUser } = await existingQ.maybeSingle();
          if (existingUser) {
            const rawCreated = existingUser['created_at TIMESTAMPTZ'] || existingUser.created_at || existingUser.plan_started_at;
            if (rawCreated) {
              const cMs = new Date(rawCreated).getTime();
              if (!isNaN(cMs) && cMs > 0) {
                originalCreatedAt = rawCreated;
                maxAllowedExpiryMs = cMs + 30 * 86400000;
              }
            }
          }
        } catch {}
      }

      const maxRemainingDays = Math.min(30, Math.max(0, Math.ceil((maxAllowedExpiryMs - Date.now()) / 86400000)));

      const supaData: Record<string, any> = {};
      if (data.name !== undefined) supaData.name = data.name;
      if (data.email !== undefined) supaData.email = data.email.trim().toLowerCase();
      if (data.password !== undefined) supaData.password = data.password;
      if (data.plan !== undefined) supaData.plan = data.plan;
      if (data.credits !== undefined) supaData.credits = data.credits;
      if (data.maxCredits !== undefined) supaData.max_credits = data.maxCredits;
      if (data.planDaysLeft !== undefined) {
        const cappedDays = Math.min(maxRemainingDays, Math.max(0, Number(data.planDaysLeft)));
        supaData.plan_days_left = cappedDays;
        supaData.plan_total_days = Math.ceil(cappedDays);
        if (originalCreatedAt) {
          supaData.plan_started_at = originalCreatedAt;
        }
        const reqExpMs = data.planExpiresAt ? new Date(data.planExpiresAt).getTime() : NaN;
        const candidateExpMs = !isNaN(reqExpMs) ? reqExpMs : (Date.now() + cappedDays * 86400000);
        const clampedExpMs = Math.min(candidateExpMs, maxAllowedExpiryMs);
        supaData.plan_expires_at = new Date(clampedExpMs).toISOString();
      } else if (data.planExpiresAt !== undefined) {
        const reqExpMs = new Date(data.planExpiresAt).getTime();
        const clampedExpMs = !isNaN(reqExpMs) ? Math.min(reqExpMs, maxAllowedExpiryMs) : maxAllowedExpiryMs;
        supaData.plan_expires_at = new Date(clampedExpMs).toISOString();
      }
      if (data.status !== undefined) supaData.status = data.status;
      if (data.extensionAccess !== undefined) supaData.extension_access = data.extensionAccess;
      if (data.canEditPrompts !== undefined) supaData.can_edit_prompts = data.canEditPrompts;
      if (data.whatsapp !== undefined) supaData.whatsapp = data.whatsapp;
      if (data.telegram !== undefined) supaData.telegram = data.telegram;
      if (data.isOnline !== undefined) supaData.is_online = data.isOnline;
      if (data.sessionToken !== undefined) supaData.session_token = data.sessionToken;

      const payload = { ...supaData };
      for (let attempt = 0; attempt < 8; attempt++) {
        if (Object.keys(payload).length === 0) break;

        let query = supabase.from('users').update(payload);
        if (hasRealId) {
          query = query.eq('id', userId);
        } else if (targetEmail) {
          query = query.ilike('email', targetEmail);
        } else {
          query = query.eq('id', userId);
        }

        const { data: updatedRows, error: updErr } = await query.select('id');
        if (!updErr) {
          if ((!updatedRows || updatedRows.length === 0) && hasRealId && targetEmail) {
            await supabase.from('users').update(payload).ilike('email', targetEmail);
          }
          break;
        }

        const msg = `${updErr.message || ''} ${updErr.details || ''}`;
        const match =
          msg.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i) ||
          msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of relation/i) ||
          msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
        if (match && match[1] && payload[match[1]] !== undefined) {
          delete payload[match[1]];
          continue;
        }
        break;
      }
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('api/users/update error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
