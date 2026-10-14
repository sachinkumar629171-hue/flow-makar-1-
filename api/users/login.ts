import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { email, password, sessionToken: clientSessionToken, forceLogin } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = (password || '').toString().trim();
  const isSystemAdmin = ['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com'].includes(cleanEmail);

  const supaUrl = (req.headers['x-supabase-url'] as string) || 
                  req.body?.supabaseUrl || 
                  process.env.VITE_SUPABASE_URL || 
                  process.env.SUPABASE_URL || 
                  'https://dhtnplocynujkkhqieut.supabase.co';
  const supaKey = (req.headers['x-supabase-anon-key'] as string) || 
                  req.body?.supabaseAnonKey || 
                  process.env.VITE_SUPABASE_ANON_KEY || 
                  process.env.SUPABASE_ANON_KEY || 
                  '';

  if (!supaUrl || !supaKey) {
    return res.status(500).json({ success: false, error: 'Database configuration missing' });
  }

  try {
    const supabase = createClient(supaUrl, supaKey);

    // 1. Fetch user securely on server side
    const { data: supaUser, error: supaErr } = await supabase
      .from('users')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (supaErr || !supaUser || supaUser.id?.startsWith('admin_config_')) {
      return res.status(404).json({ success: false, error: 'No account found with this email. Please sign up.' });
    }

    // 2. Server-side password check (NEVER expose to client)
    if (supaUser.password && supaUser.password !== cleanPass) {
      return res.status(401).json({ success: false, error: 'Incorrect password. Please try again.' });
    }

    // 3. Status check
    if (supaUser.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'This account has been suspended by administration.' });
    }

    // 4. Single-Device Lock: Check if already actively logged in on another device
    const activeSessionToken = supaUser.session_token || supaUser.sessionToken;
    const isOnline = Boolean(supaUser.is_online);
    const lastActiveTimestamp = supaUser.last_active;
    const lastActiveTime = lastActiveTimestamp ? new Date(lastActiveTimestamp).getTime() : 0;
    const isRecentlyActive = (Date.now() - lastActiveTime) < 3 * 60 * 1000; // 3 minutes window

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

    // 5. Generate new secure session token
    const newSessionToken = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const nowIso = new Date().toISOString();

    // 6. Update database on server side
    await supabase.from('users').update({
      session_token: newSessionToken,
      is_online: true,
      last_active: nowIso,
    }).eq('id', supaUser.id);

    // 7. Return SAFE user object to client (Password is 100% stripped!)
    // User requested: "sirf jaruri chije rahenge vahi jaise name,plan, credit, kitna days left etc"
    const safeUser = {
      id: supaUser.id,
      name: supaUser.name || 'User',
      email: supaUser.email,
      plan: supaUser.plan || 'basic',
      credits: Number(supaUser.credits) ?? 100,
      maxCredits: Number(supaUser.max_credits) ?? (supaUser.plan === 'ultra' ? 45000 : 100),
      planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
      role: supaUser.role || 'user',
      sessionToken: newSessionToken,
      status: supaUser.status || 'active',
      avatarColor: supaUser.avatar_color || (supaUser.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600'),
    };

    return res.status(200).json({
      success: true,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Server login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Login service error: ' + (err?.message || 'unknown'),
    });
  }
}
