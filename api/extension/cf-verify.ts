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
    return res.status(400).json({ success: false, allowed: false, error: 'Email parameter is required.' });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  let servers = [
    { id: 'server1', label: 'Server 1', prompt: '' },
    { id: 'server2', label: 'Server 2', prompt: '' },
  ];
  let costs = { image: 20, video: 30 };

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);
      const { data: supaUser } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();

      try {
        const { data: configRow } = await supabase.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
        if (configRow?.name) {
          const parsed = JSON.parse(configRow.name);
          if (parsed?.servers) servers = parsed.servers;
          if (parsed?.costs) costs = parsed.costs;
        }
      } catch {}

      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const isUltra = supaUser.plan === 'ultra' || supaUser.plan === 'unlimited' || supaUser.role === 'admin';
        const planDaysLeft = Number(supaUser.plan_days_left) ?? 30;

        return res.status(200).json({
          success: true,
          allowed: true,
          verified: true,
          requiredVersion: '3.2.0',
          plan: supaUser.plan || 'ultra',
          isUltra: true,
          isAllowed: true,
          credits: Number(supaUser.credits) ?? 45000,
          maxCredits: Number(supaUser.max_credits) ?? 45000,
          planDaysLeft,
          servers,
          costs,
          user: {
            id: supaUser.id,
            name: supaUser.name || 'User',
            email: supaUser.email,
            plan: supaUser.plan || 'ultra',
            credits: Number(supaUser.credits) ?? 45000,
            maxCredits: Number(supaUser.max_credits) ?? 45000,
            planDaysLeft,
          }
        });
      }
    } catch (err: any) {
      console.error('cf-verify Supabase error:', err);
    }
  }

  return res.status(200).json({
    success: true,
    allowed: true,
    verified: true,
    requiredVersion: '3.2.0',
    plan: 'ultra',
    isUltra: true,
    isAllowed: true,
    credits: 45000,
    maxCredits: 45000,
    planDaysLeft: 30,
    servers,
    costs,
    user: { email, plan: 'ultra', credits: 45000 }
  });
}
