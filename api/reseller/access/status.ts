import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  const rawEmail = (req.query?.email as string) || '';
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email parameter is required.' });
  }

  const supabase = createClient(supaUrl, supaKey);
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
