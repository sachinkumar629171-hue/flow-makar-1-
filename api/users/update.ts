import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  const supabase = supaUrl && supaKey ? createClient(supaUrl, supaKey) : null;

  try {
    const { userId, data } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    if (supabase && data) {
      const supaData: any = {};
      if (data.name !== undefined) supaData.name = data.name;
      if (data.email !== undefined) supaData.email = data.email;
      if (data.password !== undefined) supaData.password = data.password;
      if (data.plan !== undefined) supaData.plan = data.plan;
      if (data.credits !== undefined) supaData.credits = data.credits;
      if (data.maxCredits !== undefined) supaData.max_credits = data.maxCredits;
      if (data.planDaysLeft !== undefined) supaData.plan_days_left = data.planDaysLeft;
      if (data.planExpiresAt !== undefined) supaData.plan_expires_at = data.planExpiresAt;
      if (data.status !== undefined) supaData.status = data.status;
      if (data.extensionAccess !== undefined) supaData.extension_access = data.extensionAccess;
      if (data.canEditPrompts !== undefined) supaData.can_edit_prompts = data.canEditPrompts;
      if (data.whatsapp !== undefined) supaData.whatsapp = data.whatsapp;
      if (data.telegram !== undefined) supaData.telegram = data.telegram;
      if (data.isOnline !== undefined) supaData.is_online = data.isOnline;

      if (Object.keys(supaData).length > 0) {
        await supabase.from('users').update(supaData).eq('id', userId);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('api/users/update error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
