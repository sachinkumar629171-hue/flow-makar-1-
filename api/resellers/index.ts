import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = new Set(['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com']);
const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || 'flw_srv_adm_v9_sec_key_9842';

function getResellerApiKey(reseller: any): string {
  if (reseller.apiKey || reseller.api_key) return reseller.apiKey || reseller.api_key;
  const cleanId = String(reseller.id || '').replace(/[^a-zA-Z0-9]/g, '');
  return `flw_res_${cleanId}`;
}

export function createResellerSessionToken(reseller: any, randomSuffix?: string): string {
  const cleanId = String(reseller.id || '').trim();
  const cleanEmail = String(reseller.email || '').trim().toLowerCase();
  const cleanPass = String(reseller.password || '').trim();
  const sig = Buffer.from(`${cleanId}|${cleanEmail}|${cleanPass}|flw_res_sec`).toString('base64url').slice(0, 16);
  const rand = randomSuffix || `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 7)}`;
  return `rsess_${sig}_${rand}`;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-admin-session-id, x-reseller-id, x-reseller-session-id, x-reseller-api-key, x-admin-key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!supaUrl || !supaKey) {
    return res.status(500).json({ success: false, error: 'Database configuration missing' });
  }

  const supabase = createClient(supaUrl, supaKey);

  // Extract Admin session token from headers or body
  const authHeader = (req.headers.authorization || '').toString();
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const adminSessionId = (
    req.body?.sessionId ||
    req.body?.adminSessionId ||
    req.headers['x-admin-session-id'] ||
    req.headers['x-session-token'] ||
    bearerToken ||
    ''
  ).toString().trim();

  try {
    const loadAllResellersFromSupabase = async () => {
      const mergedMap = new Map<string, any>();

      // 1. Load backup row from users table first
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

      // 2. Load authoritative resellers table and merge
      try {
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
              sessionId: sr.session_token || sr.session_id || existing.sessionId || existing.session_token || '',
            };
            if (keyById) mergedMap.set(keyById, merged);
            else if (keyByEmail) mergedMap.set(keyByEmail, merged);
          }
        }
      } catch {}

      // Deduplicate by id / email
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

      const now = Date.now();
      return rawResellers.map((sr: any) => {
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
          totalUsersCreated: Number(sr.total_users_created ?? sr.totalUsersCreated ?? 0) || 0,
          daysLeft,
          expiryDate: sr.expiry_date || sr.expiryDate || '30/10/2026',
          expiresAt,
          status,
          createdAt: sr.created_at || sr.createdAt || new Date().toISOString(),
          notes: sr.notes || '',
          sessionId: sr.sessionId || sr.session_token || sr.session_id || '',
          perUserRate: Number(sr.per_user_rate ?? sr.perUserRate ?? 0) || 0,
          rateCurrency: (sr.rate_currency || sr.rateCurrency || 'INR') as 'INR' | 'USD',
          pendingPayment: Number(sr.pending_payment ?? sr.pendingPayment ?? 0) || 0,
          paidPayment: Number(sr.paid_payment ?? sr.paidPayment ?? 0) || 0,
        };
      });
    };

    const toSafeReseller = (r: any) => ({
      id: r.id,
      portalName: r.portalName || r.portal_name || 'Reseller Portal',
      email: r.email || '',
      userLimit: r.userLimit ?? r.user_limit ?? 50,
      totalUsersCreated: Number(r.totalUsersCreated ?? r.total_users_created ?? 0) || 0,
      daysLeft: r.daysLeft ?? r.days_left ?? 30,
      expiryDate: r.expiryDate || r.expiry_date || '30/10/2026',
      expiresAt: r.expiresAt || r.expires_at,
      status: r.status || 'active',
      createdAt: r.createdAt || r.created_at || new Date().toISOString(),
      perUserRate: Number(r.perUserRate ?? r.per_user_rate ?? 0) || 0,
      rateCurrency: r.rateCurrency || r.rate_currency || 'INR',
      pendingPayment: Number(r.pendingPayment ?? r.pending_payment ?? 0) || 0,
      paidPayment: Number(r.paidPayment ?? r.paid_payment ?? 0) || 0,
    });

    if (req.method === 'GET') {
      if (!adminSessionId || !(await verifyAdminSession(supabase, adminSessionId))) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Valid Admin sessionId is required.',
        });
      }
      const mapped = await loadAllResellersFromSupabase();
      return res.status(200).json({ resellers: mapped.map(toSafeReseller) });
    }

    if (req.method === 'POST') {
      const body = req.body || {};

      // 1. Reseller Login Request: payload is { email, password } (no id / portalName)
      if (!body.id && !body.portalName && !body.portal_name) {
        const cleanEmail = (body.email || '').toString().trim().toLowerCase();
        const cleanPass = (body.password || '').toString().trim();

        if (!cleanEmail || !cleanPass) {
          return res.status(400).json({
            success: false,
            error: 'Email and password are required.',
          });
        }

        const xff = req.headers['x-forwarded-for'];
        const clientIp = String(Array.isArray(xff) ? xff[0] : (xff || req.socket?.remoteAddress || 'unknown')).split(',')[0].trim() || 'unknown';
        const nowAttempt = Date.now();
        const attemptKeys = [`ip:${clientIp}`, `email:${cleanEmail}`];
        const gMap: Map<string, number[]> = (globalThis as any).__flwResellerLoginAttempts || ((globalThis as any).__flwResellerLoginAttempts = new Map<string, number[]>());

        for (const k of attemptKeys) {
          const list = (gMap.get(k) || []).filter(t => nowAttempt - t < 2 * 60 * 1000);
          if (list.length > 0) gMap.set(k, list);
          else gMap.delete(k);
          if (list.length >= 5) {
            return res.status(429).json({
              success: false,
              error: 'Too many login attempts',
            });
          }
        }

        const recordFailed = () => {
          const ts = Date.now();
          for (const k of attemptKeys) {
            const list = (gMap.get(k) || []).filter(t => ts - t < 2 * 60 * 1000);
            list.push(ts);
            gMap.set(k, list);
          }
        };

        const allResellers = await loadAllResellersFromSupabase();
        const matched = allResellers.find(
          (r: any) =>
            (r.email && String(r.email).trim().toLowerCase() === cleanEmail) ||
            (r.id && String(r.id).trim().toLowerCase() === cleanEmail)
        );

        if (!matched) {
          recordFailed();
          return res.status(404).json({
            success: false,
            error: 'No reseller portal found with this email. Contact main administrator.',
          });
        }

        if (String(matched.password || '').trim() !== cleanPass) {
          recordFailed();
          return res.status(401).json({
            success: false,
            error: 'Incorrect portal password.',
          });
        }

        for (const k of attemptKeys) gMap.delete(k);

        if (matched.status === 'suspended') {
          return res.status(403).json({
            success: false,
            error: 'This reseller portal has been suspended by administration.',
          });
        }

        const sessionId = createResellerSessionToken(matched);
        matched.sessionId = sessionId;

        // Persist updated sessionId in admin_config_resellers backup row
        try {
          const updatedBackup = allResellers.map((r: any) =>
            r.id === matched.id ? { ...r, sessionId } : r
          );
          await supabase.from('users').upsert(
            {
              id: 'admin_config_resellers',
              name: JSON.stringify(updatedBackup),
              email: 'resellers_backup@flowmaker.local',
              password: 'config_no_login_123',
              plan: 'basic',
              credits: 0,
              max_credits: 0,
              plan_days_left: 0,
              role: 'user',
              status: 'active',
            },
            { onConflict: 'id' }
          );
        } catch {}

        return res.status(200).json({
          success: true,
          sessionId,
          reseller: {
            ...toSafeReseller(matched),
            sessionId,
          },
        });
      }

      // 2. Admin Create/Update Reseller Request: Strictly require Admin sessionId
      if (!adminSessionId || !(await verifyAdminSession(supabase, adminSessionId))) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Valid Admin sessionId is required to manage resellers.',
        });
      }

      const reseller = body;
      const internalApiKey = reseller.apiKey || reseller.api_key || getResellerApiKey(reseller);
      if (!reseller.expiresAt && reseller.daysLeft) {
        reseller.expiresAt = new Date(Date.now() + Number(reseller.daysLeft) * 86400000).toISOString();
      }

      const payload: Record<string, any> = {
        id: reseller.id,
        portal_name: reseller.portalName || reseller.portal_name || 'Reseller Portal',
        email: (reseller.email || '').trim().toLowerCase(),
        password: reseller.password || '',
        user_limit: reseller.userLimit ?? reseller.user_limit ?? 20,
        total_users_created: Number(reseller.totalUsersCreated ?? reseller.total_users_created ?? 0) || 0,
        days_left: reseller.daysLeft ?? reseller.days_left ?? 30,
        expiry_date: reseller.expiryDate || reseller.expiry_date,
        expires_at: reseller.expiresAt || reseller.expires_at,
        status: reseller.status || 'active',
        created_at: reseller.createdAt || reseller.created_at || new Date().toISOString(),
        notes: reseller.notes || '',
        api_key: internalApiKey,
        per_user_rate: Number(reseller.perUserRate ?? reseller.per_user_rate ?? 0) || 0,
        rate_currency: String(reseller.rateCurrency || reseller.rate_currency || 'INR'),
        pending_payment: Number(reseller.pendingPayment ?? reseller.pending_payment ?? 0) || 0,
        paid_payment: Number(reseller.paidPayment ?? reseller.paid_payment ?? 0) || 0,
      };

      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const { error } = await supabase.from('resellers').upsert(payload, { onConflict: 'id' });
          if (!error) break;
          const msg = `${error.message || ''} ${error.details || ''}`;
          const match = msg.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i) ||
                        msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of relation/i) ||
                        msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
          if (match && match[1] && payload[match[1]] !== undefined) {
            delete payload[match[1]];
            continue;
          }
          break;
        } catch {
          break;
        }
      }

      return res.status(200).json({ success: true, reseller: toSafeReseller(reseller) });
    }

    if (req.method === 'DELETE') {
      if (!adminSessionId || !(await verifyAdminSession(supabase, adminSessionId))) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Valid Admin sessionId is required to delete resellers.',
        });
      }
      const id = (req.query.id || req.body?.id || '').toString();
      if (id) {
        await supabase.from('resellers').delete().eq('id', id);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('api/resellers error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
