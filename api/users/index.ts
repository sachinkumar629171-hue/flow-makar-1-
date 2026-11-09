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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-admin-session-id, x-reseller-id, x-reseller-session-id, x-reseller-api-key, x-admin-key');
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

  // Extract auth token from headers or body (never allow static x-admin-key without sessionId)
  const authHeader = (req.headers.authorization || '').toString();
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const headerToken = (
    req.headers['x-admin-session-id'] ||
    req.headers['x-session-token'] ||
    req.body?.sessionId ||
    req.body?.sessionToken ||
    ''
  ).toString().trim();
  const token = headerToken || bearerToken;

  const resellerId = (req.headers['x-reseller-id'] || req.query.resellerId || '').toString().trim();
  const resellerSessionId = (
    req.headers['x-reseller-session-id'] ||
    req.body?.sessionId ||
    req.headers['x-session-token'] ||
    ''
  ).toString().trim();
  const resellerKey = (req.headers['x-reseller-api-key'] || req.query.resellerApiKey || '').toString().trim();

  try {
    // 1. Verify if caller has a valid Admin sessionId or User sessionId
    let callingUser: any = null;
    let isAdmin = await verifyAdminSession(supabase, token);

    if (token && !token.startsWith('rsess_') && !isAdmin) {
      let tokenQuery = supabase.from('users').select('*');
      if (token.startsWith('sess-') || token.startsWith('asess_')) {
        tokenQuery = tokenQuery.eq('session_token', token);
      } else {
        tokenQuery = tokenQuery.or(`session_token.eq.${token},id.eq.${token}`);
      }
      const { data: callerData } = await tokenQuery.maybeSingle();
      if (callerData) {
        callingUser = callerData;
        const callerEmail = (callingUser.email || '').toLowerCase().trim();
        if (ADMIN_EMAILS.has(callerEmail) || callingUser.role === 'admin') {
          isAdmin = true;
        }
      }
    }

    if (req.method === 'GET') {
      const resellerNameParam = (req.headers['x-reseller-name'] || req.query.resellerName || '').toString().trim().toLowerCase();

      // If this is a Reseller Portal query, require valid Reseller sessionId (or Admin sessionId) — never allow plain link access without sessionId!
      if (resellerId || resellerKey || resellerNameParam) {
        if (!isAdmin) {
          const matchedReseller = resellerId ? await findResellerFromSupabase(supabase, resellerId) : null;
          const validResSession = matchedReseller && resellerSessionId && verifyResellerSessionToken(matchedReseller, resellerSessionId);
          const validResKey = matchedReseller && resellerKey && (matchedReseller.apiKey === resellerKey || matchedReseller.api_key === resellerKey);
          if (!validResSession && !validResKey) {
            return res.status(401).json({
              success: false,
              error: 'Unauthorized: Valid Reseller sessionId is required. Direct link access without sessionId is blocked.',
            });
          }
        }
      } else if (!isAdmin && !callingUser) {
        // Block unauthenticated direct link visits to /api/users
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Valid sessionId is required.',
        });
      }

      // Fetch all users from Supabase (excluding heavy admin_config_% backup rows to save Egress)
      const { data: allUsers, error: usersErr } = await supabase.from('users').select('*').not('id', 'like', 'admin_config_%');

      if (usersErr) {
        return res.status(500).json({ success: false, error: usersErr.message });
      }

      const now = Date.now();
      const rawFiltered = (allUsers || []).filter(
        (u: any) => u.id && !u.id.startsWith('admin_config_') && !u.id.startsWith('sys_config_') && !u.email?.includes('@system.local')
      );

      // Enforce 1 Gmail = 1 Account = 1 Single Plan (basic / ultra / unlimited)
      const planRank = (p: string) => (p === 'unlimited' ? 3 : p === 'ultra' ? 2 : 1);
      const byEmail = new Map<string, any>();
      const duplicateIdsToDelete: string[] = [];

      for (const u of rawFiltered) {
        const emailKey = String(u.email || u.id || '').trim().toLowerCase();
        if (!emailKey) continue;
        const existing = byEmail.get(emailKey);
        if (!existing) {
          byEmail.set(emailKey, u);
        } else {
          const rankDiff = planRank(u.plan) - planRank(existing.plan);
          const uBetter =
            rankDiff > 0 ||
            (rankDiff === 0 && (Number(u.credits) || 0) > (Number(existing.credits) || 0)) ||
            (rankDiff === 0 && (Number(u.plan_days_left) || 0) > (Number(existing.plan_days_left) || 0));
          if (uBetter) {
            if (existing.id) duplicateIdsToDelete.push(existing.id);
            byEmail.set(emailKey, u);
          } else {
            if (u.id) duplicateIdsToDelete.push(u.id);
          }
        }
      }

      if (duplicateIdsToDelete.length > 0) {
        supabase.from('users').delete().in('id', duplicateIdsToDelete).then(() => {}, () => {});
      }

      const validUsers = Array.from(byEmail.values())
        .map((u: any) => {
          const userEmail = (u.email || '').toLowerCase().trim();
          const isSysAdmin = ADMIN_EMAILS.has(userEmail) || u.role === 'admin';
          const lastActiveTime = u.last_active ? new Date(u.last_active).getTime() : NaN;
          const isLive = !isNaN(lastActiveTime) && (now - lastActiveTime <= 120000 && now - lastActiveTime >= -60000);

          let calculatedDaysLeft = Math.min(30, Math.max(0, Number(u.plan_days_left ?? 30)));
          let calculatedPlan = isSysAdmin ? 'ultra' : (u.plan || 'basic');
          let calculatedCredits = isSysAdmin ? 45000 : (Number(u.credits) ?? 100);
          let calculatedMaxCredits = isSysAdmin ? 45000 : (Number(u.max_credits) ?? (u.plan === 'ultra' ? 45000 : 100));
          let planExpiresAt = u.plan_expires_at;
          let needsUpdate = false;

          const rawCreatedAt = u['created_at TIMESTAMPTZ'] || u.created_at || u.plan_started_at;
          if (!isSysAdmin) {
            const createdMs = rawCreatedAt ? new Date(rawCreatedAt).getTime() : NaN;
            const maxAllowedExpiryMs = !isNaN(createdMs) && createdMs > 0
              ? (createdMs + 30 * 86400000)
              : (now + 30 * 86400000);

            let expiryMs = 0;
            if (planExpiresAt) {
              const parsed = new Date(planExpiresAt).getTime();
              if (!isNaN(parsed)) expiryMs = parsed;
            }
            if (!expiryMs) {
              const totalAllocated = Math.min(30, Math.max(1, Number(u.plan_total_days ?? calculatedDaysLeft)));
              expiryMs = (!isNaN(createdMs) && createdMs > 0 ? createdMs : now) + totalAllocated * 86400000;
              if (expiryMs <= now && calculatedDaysLeft > 0) {
                expiryMs = Math.min(now + calculatedDaysLeft * 86400000, maxAllowedExpiryMs);
              }
              expiryMs = Math.min(expiryMs, maxAllowedExpiryMs);
              planExpiresAt = new Date(expiryMs).toISOString();
              needsUpdate = true;
            } else if (expiryMs > maxAllowedExpiryMs) {
              // Strictly clamp any extended expiry back to created_at + 30 days!
              expiryMs = maxAllowedExpiryMs;
              planExpiresAt = new Date(expiryMs).toISOString();
              needsUpdate = true;
            }

            if (expiryMs > 0) {
              const diffMs = expiryMs - now;
              const remainingDays = Math.min(30, Math.max(0, Math.ceil(diffMs / 86400000)));
              calculatedDaysLeft = remainingDays;
              if (Number(u.plan_days_left) !== calculatedDaysLeft) {
                needsUpdate = true;
              }
              if (diffMs <= 0 && (calculatedPlan === 'ultra' || calculatedPlan === 'unlimited')) {
                calculatedPlan = 'basic';
                calculatedCredits = Math.min(calculatedCredits, 100);
                calculatedMaxCredits = 100;
                calculatedDaysLeft = 0;
                needsUpdate = true;
              }
            }

            if (needsUpdate && u.id) {
              supabase.from('users').update({
                plan_days_left: calculatedDaysLeft,
                plan_expires_at: planExpiresAt,
                ...(rawCreatedAt && u.plan_started_at !== rawCreatedAt ? { plan_started_at: rawCreatedAt } : {}),
                plan: calculatedPlan,
                credits: calculatedCredits,
                max_credits: calculatedMaxCredits,
              }).eq('id', u.id).then(() => {});
            }
          }

          return {
            id: u.id,
            name: u.name || 'User',
            email: u.email || '',
            whatsapp: u.whatsapp || '',
            telegram: u.telegram || '',
            plan: calculatedPlan,
            credits: calculatedCredits,
            maxCredits: calculatedMaxCredits,
            planDaysLeft: calculatedDaysLeft,
            planExpiresAt,
            planStartedAt: rawCreatedAt || new Date().toISOString(),
            role: isSysAdmin ? 'admin' : (u.role || 'user'),
            resellerId: u.reseller_id,
            resellerName: u.reseller_name,
            status: u.status || 'active',
            extensionAccess: u.extension_access !== false,
            canEditPrompts: u.can_edit_prompts === true,
            isOnline: isLive,
            lastActive: u.last_active || '',
            createdAt: rawCreatedAt || new Date().toISOString(),
            avatarColor: u.avatar_color || (isSysAdmin ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600'),
          };
        });

      // 1. Reseller Portal gets ONLY their assigned users and ONLY the 10 allowed fields (sorted by newest access first)
      if (resellerId || resellerKey || resellerNameParam) {
        const cleanTargetId = resellerId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const matchingUsers = validUsers
          .filter(u => {
            if (resellerId && u.resellerId && u.resellerId.trim().toLowerCase() === resellerId.toLowerCase()) return true;
            const cleanUserResId = String(u.resellerId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (cleanTargetId && cleanUserResId && cleanTargetId === cleanUserResId) return true;
            if (resellerNameParam && u.resellerName && String(u.resellerName).trim().toLowerCase() === resellerNameParam) return true;
            return false;
          })
          .sort((a, b) => {
            const aStart = new Date(a.planStartedAt || a.createdAt || a.planExpiresAt || 0).getTime() || 0;
            const bStart = new Date(b.planStartedAt || b.createdAt || b.planExpiresAt || 0).getTime() || 0;
            if (bStart !== aStart) return bStart - aStart;
            const aExp = new Date(a.planExpiresAt || 0).getTime() || 0;
            const bExp = new Date(b.planExpiresAt || 0).getTime() || 0;
            return bExp - aExp;
          })
          .map(u => ({
            name: u.name || 'User',
            email: u.email || '',
            plan: u.plan || 'basic',
            credits: u.credits ?? 100,
            maxCredits: u.maxCredits ?? (u.plan === 'ultra' ? 45000 : 100),
            planDaysLeft: u.planDaysLeft ?? 30,
            planExpiresAt: u.planExpiresAt || null,
            planStartedAt: u.planStartedAt || u.createdAt || new Date().toISOString(),
            isOnline: Boolean(u.isOnline),
            lastActive: u.lastActive || '',
          }));

        let resellerStats: Record<string, any> | undefined;
        try {
          const totalUsersCreated = matchingUsers.length;
          let matchedResRow: any = null;
          if (resellerId) {
            const { data: rRow } = await supabase.from('resellers').select('*').eq('id', resellerId).maybeSingle();
            if (rRow) matchedResRow = rRow;
          }
          if (!matchedResRow && resellerNameParam) {
            const { data: rRows } = await supabase.from('resellers').select('*').ilike('portal_name', resellerNameParam).limit(1);
            if (rRows && rRows[0]) matchedResRow = rRows[0];
          }
          if (matchedResRow) {
            const rate = Number(matchedResRow.per_user_rate ?? matchedResRow.perUserRate ?? 0) || 0;
            const currency = (matchedResRow.rate_currency || matchedResRow.rateCurrency || 'INR') as 'INR' | 'USD';
            const paid = Number(matchedResRow.paid_payment ?? matchedResRow.paidPayment ?? 0) || 0;
            const pending = rate > 0
              ? Math.max(0, totalUsersCreated * rate - paid)
              : (Number(matchedResRow.pending_payment ?? matchedResRow.pendingPayment ?? 0) || 0);

            resellerStats = {
              totalUsersCreated,
              userLimit: Number(matchedResRow.user_limit ?? matchedResRow.userLimit ?? 50) || 50,
              perUserRate: rate,
              rateCurrency: currency,
              pendingPayment: pending,
              paidPayment: paid,
            };

            if (
              Number(matchedResRow.total_users_created) !== totalUsersCreated ||
              (rate > 0 && Number(matchedResRow.pending_payment) !== pending)
            ) {
              supabase
                .from('resellers')
                .update({
                  total_users_created: totalUsersCreated,
                  ...(rate > 0 ? { pending_payment: pending } : {}),
                })
                .eq('id', matchedResRow.id)
                .then(() => {}, () => {});
            }
          } else {
            resellerStats = { totalUsersCreated };
          }
        } catch {}

        return res.status(200).json({ users: matchingUsers, ...(resellerStats ? { resellerStats } : {}) });
      }

      // Ensure both default admins exist in the list for admin view
      const ensureAdmins = [
        { email: 'sachinxexplore@gmail.com', name: 'Sachin Kumar', ref: 'FLOWADMIN' },
        { email: 'sachinkumar629171@gmail.com', name: 'Sachin Kumar (Alt)', ref: 'FLOWADMIN2' },
      ];
      for (const adm of ensureAdmins) {
        if (!validUsers.some(u => u.email.toLowerCase() === adm.email.toLowerCase())) {
          validUsers.unshift({
            id: `usr-admin-${adm.ref}`,
            name: adm.name,
            email: adm.email,
            whatsapp: '',
            telegram: '',
            plan: 'ultra',
            credits: 45000,
            maxCredits: 45000,
            planDaysLeft: 30,
            planExpiresAt: undefined,
            planStartedAt: '2025-01-10T10:00:00Z',
            role: 'admin',
            resellerId: undefined,
            resellerName: undefined,
            status: 'active',
            extensionAccess: true,
            canEditPrompts: true,
            isOnline: true,
            lastActive: new Date().toISOString(),
            createdAt: '2025-01-10T10:00:00Z',
            avatarColor: 'from-purple-600 to-indigo-600',
          });
        }
      }

      // 2. Admin gets all users
      if (isAdmin) {
        return res.status(200).json({ users: validUsers });
      }

      // 3. Regular caller gets only own user profile
      if (callingUser) {
        const callerEmail = (callingUser.email || '').toLowerCase().trim();
        const callerProfile = validUsers.find(u => u.id === callingUser.id || u.email.toLowerCase() === callerEmail);
        return res.status(200).json({ users: callerProfile ? [callerProfile] : [] });
      }

      return res.status(401).json({ success: false, error: 'Unauthorized: Valid sessionId is required.' });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const {
        id,
        email,
        name,
        password,
        plan,
        credits,
        maxCredits,
        planDaysLeft,
        planExpiresAt,
        role,
        status,
        resellerId: bodyResId,
        reseller_id,
        resellerName: bodyResName,
        reseller_name,
        whatsapp,
        telegram,
      } = body;

      const targetResellerId = (bodyResId || reseller_id || req.headers['x-reseller-id'] || '').toString().trim();

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      // 1. If member is being created by a Reseller, verify resellerId + sessionId match
      if (targetResellerId) {
        if (!resellerSessionId) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized: Reseller sessionId is required to add members. Please sign in again.',
          });
        }
        const matchedReseller = await findResellerFromSupabase(supabase, targetResellerId);
        if (!matchedReseller || !verifyResellerSessionToken(matchedReseller, resellerSessionId)) {
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
      } else if (plan === 'ultra' || plan === 'unlimited' || (credits && Number(credits) > 100)) {
        // 2. If creating an Ultra/VIP user directly (Admin create user), require valid Admin sessionId
        if (!isAdmin) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized: Valid Admin sessionId is required to create VIP members.',
          });
        }
      }

      const cleanEmail = email.toLowerCase().trim();

      // Strictly enforce 1 Gmail = 1 Account across the entire database
      const { data: existingRows } = await supabase
        .from('users')
        .select('id, email, plan')
        .ilike('email', cleanEmail);
      if (Array.isArray(existingRows) && existingRows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'This Gmail ID is already registered! Please use a different Gmail.',
        });
      }

      const isSysAdmin = ADMIN_EMAILS.has(cleanEmail);
      const nowIso = new Date().toISOString();
      const allocatedDays = Math.min(30, Math.max(0, planDaysLeft !== undefined ? Number(planDaysLeft) : 30));
      const resolvedExpiresAt = planExpiresAt || new Date(Date.now() + Math.max(1, allocatedDays) * 86400000).toISOString();
      const userPayload: Record<string, any> = {
        id: id || `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        plan: isSysAdmin ? 'ultra' : (plan || 'basic'),
        credits: isSysAdmin ? 45000 : (credits !== undefined ? Number(credits) : 100),
        max_credits: isSysAdmin ? 45000 : (maxCredits !== undefined ? Number(maxCredits) : 100),
        plan_days_left: allocatedDays,
        plan_total_days: Math.ceil(allocatedDays),
        plan_started_at: nowIso,
        plan_expires_at: resolvedExpiresAt,
        role: isSysAdmin ? 'admin' : (role || 'user'),
        status: status || 'active',
        is_online: false,
        last_active: nowIso,
      };
      if (password) userPayload.password = password;
      if (targetResellerId) userPayload.reseller_id = targetResellerId;
      if (bodyResName || reseller_name) userPayload.reseller_name = bodyResName || reseller_name;
      if (whatsapp) userPayload.whatsapp = whatsapp;
      if (telegram) userPayload.telegram = telegram;

      let savedUser: any = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error: saveErr } = await supabase
          .from('users')
          .upsert(userPayload, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (!saveErr) {
          savedUser = data || userPayload;
          break;
        }
        const msg = `${saveErr.message || ''} ${saveErr.details || ''}`;
        const match = msg.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i) ||
                      msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of relation/i) ||
                      msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
        if (match && match[1] && userPayload[match[1]] !== undefined) {
          delete userPayload[match[1]];
          continue;
        }
        const { id: _dropId, ...updateFields } = userPayload;
        const { data: updatedByEmail, error: emailErr } = await supabase
          .from('users')
          .update(updateFields)
          .ilike('email', cleanEmail)
          .select()
          .maybeSingle();
        if (!emailErr) {
          savedUser = updatedByEmail || userPayload;
        }
        break;
      }

      const safeSaved = { ...(savedUser || userPayload) };
      delete safeSaved.password;
      return res.status(200).json({ success: true, user: safeSaved });
    }

    if (req.method === 'DELETE') {
      const id = (req.query.id || req.body?.id || '').toString().trim();
      const email = (req.query.email || req.body?.email || '').toString().trim().toLowerCase();
      const delResellerId = (req.query.resellerId || req.body?.resellerId || req.headers['x-reseller-id'] || '').toString().trim();
      const delSessionId = (
        req.query.sessionId ||
        req.body?.sessionId ||
        req.headers['x-reseller-session-id'] ||
        req.headers['x-admin-session-id'] ||
        req.headers['x-session-token'] ||
        bearerToken ||
        ''
      ).toString().trim();

      if (delResellerId) {
        const matchedReseller = await findResellerFromSupabase(supabase, delResellerId);
        if (!matchedReseller || !verifyResellerSessionToken(matchedReseller, delSessionId)) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid reseller ID or session ID.',
          });
        }
      } else {
        const isValidAdmin = await verifyAdminSession(supabase, delSessionId);
        if (!isValidAdmin) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized: Valid Admin or Reseller sessionId is required to delete users.',
          });
        }
      }

      if (!id && !email) {
        return res.status(400).json({ success: false, error: 'User ID or email is required' });
      }
      if (id && !(id.startsWith('usr-') && id.includes('@'))) {
        await supabase.from('users').delete().eq('id', id);
      }
      const targetEmail = email || (id.startsWith('usr-') && id.includes('@') ? id.slice(4).toLowerCase() : '');
      if (targetEmail) {
        await supabase.from('users').delete().ilike('email', targetEmail);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('api/users handler error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
