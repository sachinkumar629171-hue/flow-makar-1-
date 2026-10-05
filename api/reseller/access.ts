import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function parseDurationToExpiry(body: any): { planDaysLeft: number; planExpiresAt?: string; durationText: string } {
  const rawDuration = (
    body.duration ||
    body.time ||
    body.validity ||
    ''
  ).toString().trim().toLowerCase();

  let hours = Number(body.planHours || body.hours || body.durationHours) || 0;
  let days = Number(body.planDays || body.days || body.durationDays) || 0;

  if (rawDuration) {
    if (rawDuration.includes('hour') || rawDuration.endsWith('h')) {
      const parsedHours = parseFloat(rawDuration.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedHours) && parsedHours > 0) hours = parsedHours;
    } else if (rawDuration.includes('day') || rawDuration.endsWith('d')) {
      const parsedDays = parseFloat(rawDuration.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedDays) && parsedDays > 0) days = parsedDays;
    } else if (rawDuration.includes('min') || rawDuration.endsWith('m')) {
      const parsedMins = parseFloat(rawDuration.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedMins) && parsedMins > 0) hours = parsedMins / 60;
    }
  }

  const now = Date.now();
  if (hours > 0) {
    const expiresMs = now + Math.round(hours * 60 * 60 * 1000);
    const planExpiresAt = new Date(expiresMs).toISOString();
    const planDaysLeft = Math.max(0.01, parseFloat((hours / 24).toFixed(3)));
    return {
      planDaysLeft,
      planExpiresAt,
      durationText: `${hours} hours`,
    };
  }

  const finalDays = days > 0 ? days : 30;
  const expiresMs = now + Math.round(finalDays * 24 * 60 * 60 * 1000);
  return {
    planDaysLeft: finalDays,
    planExpiresAt: new Date(expiresMs).toISOString(),
    durationText: `${finalDays} days`,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  const action = (
    req.query?.action ||
    req.body?.action ||
    (req.method === 'DELETE' ? 'revoke' : '') ||
    (req.url?.includes('/status') ? 'status' : '') ||
    (req.url?.includes('/revoke') ? 'revoke' : '') ||
    (req.url?.includes('/grant') ? 'grant' : '') ||
    (req.method === 'GET' ? 'status' : 'grant')
  ).toString().trim().toLowerCase();

  const supabase = createClient(supaUrl, supaKey);

  // ACTION: STATUS (check access)
  if (action === 'status') {
    const rawEmail = (req.query?.email || req.body?.email || '') as string;
    const email = (rawEmail || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email parameter is required.' });
    }

    const { data: user } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();
    if (!user || user.id?.startsWith('admin_config_')) {
      return res.status(404).json({ success: false, error: `User not found: ${email}` });
    }

    const isAllowed = user.status === 'active' && user.extension_access !== false && (Number(user.plan_days_left) ?? 0) > 0;
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        status: user.status,
        extensionAccess: user.extension_access !== false,
        credits: Number(user.credits) ?? 0,
        planDaysLeft: Number(user.plan_days_left) ?? 0,
        isAllowed,
        resellerId: user.reseller_id,
        resellerName: user.reseller_name,
      }
    });
  }

  // Reseller Authentication for Grant & Revoke
  const apiKey = (
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
    req.query?.apiKey ||
    req.body?.apiKey ||
    ''
  ).toString().trim();

  const resellerId = (req.body?.resellerId || req.query?.resellerId || '').toString().trim();
  const resellerEmail = (req.body?.resellerEmail || req.query?.resellerEmail || '').toString().trim().toLowerCase();

  let reseller: any = null;
  const { data: resellersList } = await supabase.from('resellers').select('*');
  const allResellers = Array.isArray(resellersList) ? resellersList : [];

  if (apiKey) {
    if (apiKey === 'admin_master_key' || apiKey === 'sachinxexplore@gmail.com') {
      reseller = allResellers.find(r => r.id === resellerId) || allResellers[0] || { id: 'admin', portal_name: 'Admin Portal', email: 'admin' };
    } else {
      reseller = allResellers.find(r => 
        r.api_key === apiKey ||
        r.apiKey === apiKey ||
        r.id === apiKey ||
        r.email?.toLowerCase() === apiKey.toLowerCase() ||
        `flw_res_${r.id.replace(/[^a-zA-Z0-9]/g, '')}` === apiKey
      );
    }
  } else if (resellerId) {
    reseller = allResellers.find(r => r.id === resellerId);
  } else if (resellerEmail) {
    reseller = allResellers.find(r => r.email?.toLowerCase() === resellerEmail);
  }

  if (!reseller) {
    return res.status(401).json({
      success: false,
      access: false,
      error: 'Unauthorized: Invalid Reseller API Key (x-api-key header) or Reseller ID.',
    });
  }

  const rawEmail = req.body?.email || req.body?.gmailId || req.body?.gmail || req.body?.userEmail || req.query?.email || req.query?.gmailId || req.query?.gmail || '';
  const email = (rawEmail || '').trim().toLowerCase();

  // ACTION: REVOKE ACCESS
  if (action === 'revoke') {
    if (!email) {
      return res.status(400).json({ success: false, access: false, error: 'Customer email is required to revoke access.' });
    }
    await supabase.from('users').delete().ilike('email', email);
    return res.status(200).json({
      success: true,
      access: false,
      action: 'removed',
      email,
      message: `Access completely removed for ${email}. User account deleted.`,
    });
  }

  // ACTION: GRANT / RENEW ACCESS (DEFAULT)
  if (!email || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      access: false,
      error: 'A valid customer email is required (e.g., {"email": "customer@gmail.com"}).',
    });
  }

  const name = (req.body?.name || req.query?.name || email.split('@')[0]).trim();
  const password = (req.body?.password || req.query?.password || `pass_${Math.random().toString(36).substring(2, 8)}`).trim();
  const telegram = (req.body?.telegram || req.body?.telegramUid || req.body?.telegramProfile || req.body?.telegramId || req.query?.telegram || '').trim();
  const plan = (req.body?.plan || req.query?.plan || 'ultra').trim();
  const credits = req.body?.credits !== undefined ? Number(req.body.credits) : (plan === 'ultra' ? 45000 : 100);
  const maxCredits = req.body?.maxCredits !== undefined ? Number(req.body.maxCredits) : credits;
  const extensionAccess = req.body?.extensionAccess !== false;

  const durationInfo = parseDurationToExpiry(req.body || req.query || {});
  const now = new Date().toISOString();

  const { data: existingUser } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();

  let grantAction = 'created';
  let userId = existingUser?.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
  let sessionToken = existingUser?.session_token || `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  if (existingUser && !existingUser.id?.startsWith('admin_config_')) {
    grantAction = 'renewed';
    await supabase.from('users').update({
      name: name || existingUser.name,
      password: req.body?.password ? password : existingUser.password,
      telegram: telegram || existingUser.telegram,
      plan,
      credits,
      max_credits: maxCredits,
      plan_days_left: durationInfo.planDaysLeft,
      plan_expires_at: durationInfo.planExpiresAt,
      status: 'active',
      extension_access: extensionAccess,
      reseller_id: reseller.id,
      reseller_name: reseller.portal_name || reseller.portalName,
      last_active: now,
    }).eq('id', existingUser.id);
  } else {
    grantAction = 'created';
    await supabase.from('users').insert({
      id: userId,
      name,
      email,
      password,
      telegram,
      plan,
      credits,
      max_credits: maxCredits,
      plan_days_left: durationInfo.planDaysLeft,
      plan_expires_at: durationInfo.planExpiresAt,
      status: 'active',
      extension_access: extensionAccess,
      session_token: sessionToken,
      reseller_id: reseller.id,
      reseller_name: reseller.portal_name || reseller.portalName,
      role: 'user',
      is_online: true,
      created_at: now,
      last_active: now,
    });
  }

  return res.status(200).json({
    success: true,
    access: true,
    action: grantAction,
    message: `Access successfully granted for ${email}`,
    duration: durationInfo.durationText,
    expiresAt: durationInfo.planExpiresAt,
    reseller: {
      id: reseller.id,
      portalName: reseller.portal_name || reseller.portalName,
      email: reseller.email,
    },
    user: {
      id: userId,
      name,
      email,
      password,
      telegram,
      plan,
      credits,
      maxCredits,
      planDaysLeft: durationInfo.planDaysLeft,
      planExpiresAt: durationInfo.planExpiresAt,
      sessionToken,
      status: 'active',
      extensionAccess,
      resellerId: reseller.id,
      resellerName: reseller.portal_name || reseller.portalName,
    },
    portalUrl: 'https://flowmakerai.site',
  });
}
