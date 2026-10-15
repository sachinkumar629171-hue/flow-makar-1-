import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};
  const email = (body.email || (req.query.email as string) || '').trim().toLowerCase();
  const sessionToken = (body.sessionToken || body.token || (req.query.token as string) || '').trim();
  const clientVersion = (body.version || body.extensionVersion || (req.query.version as string) || '').trim();

  let requiredVersion = '3.2.0';
  let costs = { image: 20, video: 30 };

  if (!email || !sessionToken) {
    return res.status(401).json({
      allowed: false,
      success: false,
      error: 'Authentication failed: Gmail ID (email) and session token are required.',
      requiredVersion,
    });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);

      // 1. Fetch Admin Config for Required Version & Costs
      try {
        const { data: appConfigRow } = await supabase.from('app_config').select('value').eq('key', 'admin_config_prompts').maybeSingle();
        let promptParsed = null;
        if (appConfigRow?.value) {
          promptParsed = typeof appConfigRow.value === 'string' ? JSON.parse(appConfigRow.value) : appConfigRow.value;
        } else {
          const { data: configRow } = await supabase.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
          if (configRow?.name) promptParsed = JSON.parse(configRow.name);
        }

        if (promptParsed?.extensionVersion) {
          requiredVersion = promptParsed.extensionVersion;
        }
        if (promptParsed?.costs) {
          costs = promptParsed.costs;
        }
      } catch {}

      // 2. Check Extension Version
      if (clientVersion && clientVersion !== requiredVersion) {
        return res.status(426).json({
          allowed: false,
          updateRequired: true,
          error: `Update Required: Please update your extension to version ${requiredVersion}.`,
          requiredVersion,
          clientVersion,
        });
      }

      // 3. Fetch User from Supabase
      const { data: supaUser } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();

      if (!supaUser || supaUser.id?.startsWith('admin_config_')) {
        return res.status(404).json({
          allowed: false,
          success: false,
          error: `No user found registered with Gmail ID: ${email}`,
          requiredVersion,
        });
      }

      const userToken = supaUser.session_token || supaUser.sessionToken || '';
      if (!userToken || userToken !== sessionToken) {
        return res.status(401).json({
          allowed: false,
          success: false,
          error: 'Invalid or expired session token. Please log in again to FlowMaker.',
          requiredVersion,
        });
      }

      if (supaUser.status === 'suspended') {
        return res.status(403).json({
          allowed: false,
          success: false,
          error: 'Account suspended. Please contact support.',
          requiredVersion,
        });
      }

      const isUltraOrAdmin = supaUser.plan === 'ultra' || supaUser.plan === 'unlimited' || supaUser.role === 'admin';
      const planDaysLeft = Number(supaUser.plan_days_left) ?? 30;

      if (!isUltraOrAdmin || planDaysLeft <= 0) {
        return res.status(403).json({
          allowed: false,
          success: false,
          error: 'Ultra VIP Plan required to access live prompt servers.',
          requiredVersion,
        });
      }

      // Everything verified! Mark user as online/live in Supabase
      const cfVerifyNow = new Date().toISOString();
      supabase.from('users').update({
        is_online: true,
        last_active: cfVerifyNow,
      }).eq('id', supaUser.id).then(() => {});

      return res.status(200).json({
        allowed: true,
        success: true,
        requiredVersion,
        costs,
        user: {
          id: supaUser.id,
          name: supaUser.name,
          email: supaUser.email,
          plan: supaUser.plan || 'ultra',
          credits: Number(supaUser.credits) ?? 0,
          maxCredits: Number(supaUser.max_credits) || 45000,
          planDaysLeft,
        }
      });

    } catch (err: any) {
      return res.status(500).json({
        allowed: false,
        success: false,
        error: `Database check error: ${err?.message || 'Failed to verify user'}`,
        requiredVersion,
      });
    }
  }

  return res.status(500).json({
    allowed: false,
    success: false,
    error: 'Supabase configuration missing on server.',
    requiredVersion,
  });
}
