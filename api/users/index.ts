import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-supabase-url, x-supabase-anon-key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (
    req.headers['x-session-token'] || 
    req.query.sessionToken || 
    (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '') || 
    ''
  ).toString().trim();

  // If no session token, return empty list - zero leakage
  if (!token) {
    return res.status(200).json({ users: [] });
  }

  const supaUrl = (req.headers['x-supabase-url'] as string) || 
                  process.env.VITE_SUPABASE_URL || 
                  process.env.SUPABASE_URL || 
                  'https://dhtnplocynujkkhqieut.supabase.co';
  const supaKey = (req.headers['x-supabase-anon-key'] as string) || 
                  process.env.VITE_SUPABASE_ANON_KEY || 
                  process.env.SUPABASE_ANON_KEY || 
                  '';

  if (!supaUrl || !supaKey) {
    return res.status(200).json({ users: [] });
  }

  try {
    const supabase = createClient(supaUrl, supaKey);

    // Look up user by session token
    let query = supabase.from('users').select('*');
    if (token.startsWith('sess-')) {
      query = query.eq('session_token', token);
    } else {
      query = query.or(`session_token.eq.${token},id.eq.${token}`);
    }

    const { data: supaUser, error } = await query.maybeSingle();

    if (error || !supaUser || supaUser.id?.startsWith('admin_config_')) {
      return res.status(200).json({ users: [] });
    }

    const isSystemAdmin = ['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com'].includes(supaUser.email?.toLowerCase());
    const isAdmin = supaUser.role === 'admin' || isSystemAdmin;

    // If admin, return sanitized user list
    if (isAdmin) {
      const { data: allUsers } = await supabase.from('users').select('*').limit(200);
      const safeList = (allUsers || [])
        .filter((u: any) => u.id && !u.id.startsWith('admin_config_'))
        .map((u: any) => {
          const { password, session_token, sessionToken, ...rest } = u;
          return {
            id: rest.id,
            name: rest.name || 'User',
            email: rest.email || '',
            plan: rest.plan || 'basic',
            credits: Number(rest.credits) ?? 100,
            maxCredits: Number(rest.max_credits) ?? 100,
            planDaysLeft: Number(rest.plan_days_left) ?? 30,
            role: rest.role || 'user',
            status: rest.status || 'active',
            avatarColor: rest.avatar_color || 'from-purple-600 to-indigo-600',
            createdAt: rest.created_at,
          };
        });
      return res.status(200).json({ users: safeList });
    }

    // Normal user: ONLY their own user profile!
    // User requested: "sirf jaruri chije rahenge vahi jaise name,plan, credit, kitna days left etc"
    const safeSelf = {
      id: supaUser.id,
      name: supaUser.name || 'User',
      email: supaUser.email,
      plan: supaUser.plan || 'basic',
      credits: Number(supaUser.credits) ?? 100,
      maxCredits: Number(supaUser.max_credits) ?? (supaUser.plan === 'ultra' ? 45000 : 100),
      planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
      role: supaUser.role || 'user',
      status: supaUser.status || 'active',
      avatarColor: supaUser.avatar_color || 'from-purple-600 to-indigo-600',
    };

    return res.status(200).json({ users: [safeSelf] });
  } catch {
    return res.status(200).json({ users: [] });
  }
}
