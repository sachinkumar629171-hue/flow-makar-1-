import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-supabase-url, x-supabase-anon-key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { userId, data } = req.body || {};
  if (!userId || !data) {
    return res.status(400).json({ success: false, error: 'userId and data are required' });
  }

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
    return res.status(200).json({ success: true, message: 'Local update processed (no Supabase config)' });
  }

  try {
    const supabase = createClient(supaUrl, supaKey);

    const supaData: Record<string, any> = {};
    if (data.name !== undefined) supaData.name = data.name;
    if (data.email !== undefined) supaData.email = data.email.toLowerCase().trim();
    if (data.password !== undefined) supaData.password = data.password;
    if (data.plan !== undefined) supaData.plan = data.plan;
    if (data.credits !== undefined) supaData.credits = Number(data.credits);
    if (data.maxCredits !== undefined) supaData.max_credits = Number(data.maxCredits);
    if (data.planDaysLeft !== undefined) supaData.plan_days_left = Number(data.planDaysLeft);
    if (data.planExpiresAt !== undefined) supaData.plan_expires_at = data.planExpiresAt;
    if (data.status !== undefined) supaData.status = data.status;
    if (data.isOnline !== undefined) supaData.is_online = data.isOnline;

    // Update by ID
    const { error: idError, data: updateRes } = await supabase
      .from('users')
      .update(supaData)
      .eq('id', userId)
      .select('id');

    if (idError || !updateRes || updateRes.length === 0) {
      // Fallback: update by email if provided
      if (data.email) {
        await supabase
          .from('users')
          .update(supaData)
          .eq('email', data.email.toLowerCase().trim());
      }
    }

    return res.status(200).json({ success: true, updated: supaData });
  } catch (err: any) {
    console.error('api/users/update error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Database update failed' });
  }
}
