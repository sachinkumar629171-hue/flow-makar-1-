import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};
  const query = req.query || {};
  const email = (body.email || query.email || '').toString().trim().toLowerCase();
  const token = (body.token || body.sessionToken || query.token || query.sessionToken || req.headers['authorization'] || '').toString().replace(/^Bearer\s+/i, '').trim();

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email parameter is required.' });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);
      const { data: supaUser } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();

      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const isUltra = supaUser.plan === 'ultra' || supaUser.plan === 'unlimited';
        const planDaysLeft = Number(supaUser.plan_days_left) ?? 30;
        const isAllowed = supaUser.status === 'active' && supaUser.extension_access !== false && planDaysLeft > 0;
        const validSession = !token || supaUser.session_token === token;

        return res.status(200).json({
          success: true,
          verified: isAllowed && validSession,
          plan: supaUser.plan || 'basic',
          isUltra,
          isAllowed,
          credits: Number(supaUser.credits) ?? 0,
          maxCredits: Number(supaUser.max_credits) ?? (isUltra ? 45000 : 100),
          planDaysLeft,
          sessionValid: validSession,
        });
      }
    } catch (err: any) {
      console.error('cf-verify Supabase error:', err);
    }
  }

  return res.status(404).json({ success: false, verified: false, error: `User not found: ${email}` });
}
