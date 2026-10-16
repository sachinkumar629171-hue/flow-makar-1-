import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract token from Bearer header or x-session-token or query
  const authHeader = (req.headers.authorization || '').toString();
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const headerToken = (req.headers['x-session-token'] || '').toString().trim();
  const queryToken = (req.query.sessionToken || req.query.token || '').toString().trim();

  const token = bearerToken || headerToken || queryToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Session token required or invalid',
    });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  if (!supaUrl || !supaKey) {
    return res.status(500).json({ success: false, error: 'Database configuration missing' });
  }

  try {
    const supabase = createClient(supaUrl, supaKey);

    // Look up this exact single user by session_token or user id
    let query = supabase.from('users').select('*');
    if (token.startsWith('sess-')) {
      query = query.eq('session_token', token);
    } else {
      query = query.or(`session_token.eq.${token},id.eq.${token}`);
    }

    const { data: supaUser, error } = await query.maybeSingle();

    if (error || !supaUser || supaUser.id?.startsWith('admin_config_')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Session expired or user not found in database',
      });
    }

    // Check account status
    if (supaUser.status === 'suspended' || supaUser.status === 'inactive') {
      return res.status(403).json({
        success: false,
        error: 'Account suspended or inactive',
      });
    }

    // Return ONLY essential fields requested by user (No internal IDs, session tokens, reseller or online status)
    const safeUser = {
      name: supaUser.name || 'User',
      email: supaUser.email || '',
      plan: supaUser.plan || 'basic',
      credits: Number(supaUser.credits) ?? 100,
      maxCredits: Number(supaUser.max_credits) ?? (supaUser.plan === 'ultra' ? 45000 : 100),
      planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
      role: supaUser.role || 'user',
    };

    return res.status(200).json({
      success: true,
      user: safeUser,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Database connection error: ' + (err?.message || 'unknown'),
    });
  }
}
