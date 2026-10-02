import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { email, type, amount } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const deductAmount = Number(amount) || (type === 'video' ? 30 : 20);

  if (!cleanEmail) {
    return res.status(400).json({ success: false, error: 'Gmail ID (email) is required.' });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);
      const { data: supaUser } = await supabase.from('users').select('*').ilike('email', cleanEmail).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const currentCredits = Number(supaUser.credits) ?? 0;
        const newCredits = Math.max(0, currentCredits - deductAmount);
        const maxCredits = Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100);
        const planDaysLeft = Number(supaUser.plan_days_left) ?? 30;

        await supabase.from('users').update({ credits: newCredits }).eq('id', supaUser.id);

        return res.status(200).json({
          success: true,
          credits: newCredits,
          maxCredits,
          creditsUsed: Math.max(0, maxCredits - newCredits),
          planDaysLeft,
        });
      }
    } catch {}
  }

  // Fallback to backend server via dynamic host
  if (req.headers.host) {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const r = await fetch(`${protocol}://${req.headers.host}/api/extension/deduct-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch {}
  }

  return res.status(404).json({ success: false, error: 'User not found for credit deduction.' });
}
