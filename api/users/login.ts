import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = new Set(['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com']);
const ADMIN_PASSWORD = '147258';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract parameters from either POST body or GET query params
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
  const isSystemAdmin = ADMIN_EMAILS.has(cleanEmail);

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  try {
    const supabase = createClient(supaUrl, supaKey);

    // 1. Fetch user from Supabase
    let supaUser: any = null;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (!error && data && !data.id?.startsWith('admin_config_')) {
      supaUser = data;
    }

    // 2. Admin fallback if not in DB
    if (!supaUser && isSystemAdmin) {
      if (passwordRaw && passwordRaw !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Incorrect password.' });
      }
      const newSessionToken = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      const adminUserData = {
        id: 'usr-admin-1',
        name: 'Sachin Kumar',
        email: cleanEmail,
        plan: 'ultra',
        credits: 45000,
        maxCredits: 45000,
        planDaysLeft: 30,
        role: 'admin',
        status: 'active',
        isOnline: true,
        lastActive: new Date().toISOString(),
      };

      try {
        await supabase.from('users').upsert({
          id: 'usr-admin-1',
          name: 'Sachin Kumar',
          email: cleanEmail,
          password: ADMIN_PASSWORD,
          plan: 'ultra',
          credits: 45000,
          max_credits: 45000,
          plan_days_left: 30,
          role: 'admin',
          status: 'active',
          is_online: true,
          session_token: newSessionToken,
          last_active: adminUserData.lastActive
        }, { onConflict: 'id' });
      } catch {}

      return res.status(200).json({
        success: true,
        sessionId: newSessionToken,
        user: adminUserData,
      });
    }

    if (!supaUser) {
      return res.status(404).json({
        success: false,
        error: 'Account not found. Please sign up or contact administrator.'
      });
    }

    // 3. Password Verification
    if (passwordRaw && supaUser.password && supaUser.password !== passwordRaw) {
      return res.status(401).json({ success: false, error: 'Incorrect password.' });
    }

    // 4. Status Check
    if (supaUser.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'This account has been suspended by administration.'
      });
    }

    // 5. Single Device Check (Skip for admin or if forceLogin is true)
    const activeSessionToken = supaUser.session_token || '';
    const isOnline = Boolean(supaUser.is_online);
    const lastActiveTime = supaUser.last_active ? new Date(supaUser.last_active).getTime() : 0;
    const isRecentlyActive = (Date.now() - lastActiveTime) < 3 * 60 * 1000;

    if (!isSystemAdmin && !forceLogin && isOnline && activeSessionToken && isRecentlyActive) {
      const isSameDevice = clientSessionToken && clientSessionToken === activeSessionToken;
      if (!isSameDevice) {
        return res.status(403).json({
          success: false,
          isDeviceLocked: true,
          error: '⚠️ Yeh account abhi kisi dusre device / browser par ACTIVE hai! Ek samay me kewal 1 device par login allowed hai. Kripya pehle waha se logout karein ya Force Login karein.'
        });
      }
    }

    // 6. Generate brand new session token
    const newSessionToken = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const nowIso = new Date().toISOString();

    // Update session token and online status in database
    try {
      await supabase.from('users').update({
        session_token: newSessionToken,
        is_online: true,
        last_active: nowIso,
      }).ilike('email', cleanEmail);
    } catch (updateErr) {
      console.error('Supabase login token update error:', updateErr);
    }

    if (isSystemAdmin && supaUser.role !== 'admin') {
      supabase.from('users').update({ role: 'admin' }).ilike('email', cleanEmail).then(() => {});
    }

    const safeUser = {
      id: supaUser.id,
      name: supaUser.name || 'User',
      email: supaUser.email,
      plan: isSystemAdmin ? 'ultra' : (supaUser.plan || 'basic'),
      credits: isSystemAdmin ? 45000 : (Number(supaUser.credits) ?? 100),
      maxCredits: isSystemAdmin ? 45000 : (Number(supaUser.max_credits) ?? 100),
      planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
      role: isSystemAdmin ? 'admin' : (supaUser.role || 'user'),
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
