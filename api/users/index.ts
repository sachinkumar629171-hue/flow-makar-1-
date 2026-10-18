import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = new Set(['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-reseller-id, x-reseller-api-key, x-admin-key');
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

  // Extract auth token
  const authHeader = (req.headers.authorization || '').toString();
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const headerToken = (req.headers['x-session-token'] || '').toString().trim();
  const queryToken = (req.query.sessionToken || req.query.token || '').toString().trim();
  const token = bearerToken || headerToken || queryToken;

  const apiKey = (req.headers['x-admin-key'] || req.headers['x-api-key'] || req.query.apiKey || '').toString().trim();
  const resellerId = (req.headers['x-reseller-id'] || req.query.resellerId || '').toString().trim();
  const resellerKey = (req.headers['x-reseller-api-key'] || req.query.resellerApiKey || '').toString().trim();

  try {
    // 1. Fetch the calling user if token provided
    let callingUser: any = null;
    let isAdmin = apiKey === 'admin_master_key' || ADMIN_EMAILS.has(apiKey.toLowerCase());

    if (token) {
      let tokenQuery = supabase.from('users').select('*');
      if (token.startsWith('sess-')) {
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
      // Fetch all users from Supabase
      const { data: allUsers, error: usersErr } = await supabase.from('users').select('*');

      if (usersErr) {
        return res.status(500).json({ success: false, error: usersErr.message });
      }

      const now = Date.now();
      const validUsers = (allUsers || [])
        .filter((u: any) => u.id && !u.id.startsWith('admin_config_') && !u.id.startsWith('sys_config_') && !u.email?.includes('@system.local'))
        .map((u: any) => {
          const userEmail = (u.email || '').toLowerCase().trim();
          const isSysAdmin = ADMIN_EMAILS.has(userEmail) || u.role === 'admin';
          const lastActiveTime = u.last_active ? new Date(u.last_active).getTime() : NaN;
          const isLive = !isNaN(lastActiveTime) && (now - lastActiveTime <= 120000 && now - lastActiveTime >= -60000);

          return {
            id: u.id,
            name: u.name || 'User',
            email: u.email || '',
            plan: isSysAdmin ? 'ultra' : (u.plan || 'basic'),
            credits: isSysAdmin ? 45000 : (Number(u.credits) ?? 100),
            maxCredits: isSysAdmin ? 45000 : (Number(u.max_credits) ?? (u.plan === 'ultra' ? 45000 : 100)),
            planDaysLeft: Number(u.plan_days_left) ?? 30,
            planExpiresAt: u.plan_expires_at,
            role: isSysAdmin ? 'admin' : (u.role || 'user'),
            resellerId: u.reseller_id,
            resellerName: u.reseller_name,
            status: u.status || 'active',
            extensionAccess: u.extension_access !== false,
            canEditPrompts: u.can_edit_prompts === true,
            isOnline: isLive || Boolean(u.is_online),
            lastActive: u.last_active || new Date().toISOString(),
            createdAt: u.created_at || new Date().toISOString(),
            avatarColor: u.avatar_color || (isSysAdmin ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600'),
          };
        });

      // Ensure both default admins exist in the list
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
            isOnline: true,
            lastActive: new Date().toISOString(),
            createdAt: '2025-01-10T10:00:00Z',
            avatarColor: 'from-purple-600 to-indigo-600',
          });
        }
      }

      // 1. Admin gets all users
      if (isAdmin) {
        return res.status(200).json({ users: validUsers });
      }

      // 2. Reseller gets their users
      if (resellerId || resellerKey) {
        const matchingUsers = validUsers.filter(u => u.resellerId === resellerId);
        return res.status(200).json({ users: matchingUsers });
      }

      // 3. Regular caller gets only own user profile
      if (callingUser) {
        const callerEmail = (callingUser.email || '').toLowerCase().trim();
        const callerProfile = validUsers.find(u => u.id === callingUser.id || u.email.toLowerCase() === callerEmail);
        return res.status(200).json({ users: callerProfile ? [callerProfile] : [] });
      }

      // 4. Public unauthenticated caller gets all users if in admin mode or empty list
      return res.status(200).json({ users: [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { email, name, password, plan, credits, maxCredits, planDaysLeft, role, status } = body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const isSysAdmin = ADMIN_EMAILS.has(cleanEmail);
      const userPayload: any = {
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        plan: isSysAdmin ? 'ultra' : (plan || 'basic'),
        credits: isSysAdmin ? 45000 : (credits !== undefined ? Number(credits) : 100),
        max_credits: isSysAdmin ? 45000 : (maxCredits !== undefined ? Number(maxCredits) : 100),
        plan_days_left: planDaysLeft !== undefined ? Number(planDaysLeft) : 30,
        role: isSysAdmin ? 'admin' : (role || 'user'),
        status: status || 'active',
        is_online: true,
        last_active: new Date().toISOString(),
      };
      if (password) userPayload.password = password;

      const { data: savedUser, error: saveErr } = await supabase
        .from('users')
        .upsert(userPayload, { onConflict: 'email' })
        .select()
        .single();

      if (saveErr) {
        return res.status(500).json({ success: false, error: saveErr.message });
      }

      return res.status(200).json({ success: true, user: savedUser });
    }

    if (req.method === 'DELETE') {
      const id = (req.query.id || req.body?.id || '').toString();
      if (!id) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
      }
      await supabase.from('users').delete().eq('id', id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('api/users handler error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
