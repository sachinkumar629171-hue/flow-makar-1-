import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, max-age=180, s-maxage=180, stale-while-revalidate=360');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const email = (req.query.email as string || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, error: 'Gmail ID (email) query parameter is required.' });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);
      const { data: supaUser } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const maxCredits = Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100);
        const credits = Number(supaUser.credits) ?? 0;
        const creditsUsed = Math.max(0, maxCredits - credits);
        const planDaysLeft = Number(supaUser.plan_days_left) ?? 30;
        const extensionAllowed = supaUser.extension_access !== false && supaUser.status !== 'suspended' && planDaysLeft > 0;

        let servers = [
          { id: 'server1', label: 'Server 1', prompt: '' },
          { id: 'server2', label: 'Server 2', prompt: '' },
        ];
        let costs = { image: 20, video: 30 };

        const { data: configRow } = await supabase.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
        if (configRow?.name) {
          try {
            const parsed = JSON.parse(configRow.name);
            if (parsed?.servers) servers = parsed.servers;
            if (parsed?.costs) costs = parsed.costs;
          } catch {}
        }

        const reqToken = ((req.query.token || req.query.sessionToken || req.headers['authorization'] || '') as string).replace(/^Bearer\s+/i, '').trim();
        const isUltraOrUnlimited = supaUser.plan === 'ultra' || supaUser.plan === 'unlimited';
        const sessionToken = supaUser.session_token || supaUser.sessionToken || '';
        const isTokenValid = Boolean(reqToken && sessionToken && reqToken === sessionToken);
        const canAccessPrompts = isUltraOrUnlimited && supaUser.status !== 'suspended' && extensionAllowed && isTokenValid;

        let planDisplayName = 'Basic Plan';
        if (supaUser.plan === 'unlimited') planDisplayName = 'Unlimited VIP Plan';
        else if (supaUser.plan === 'ultra') planDisplayName = 'Ultra VIP Plan';

        return res.status(200).json({
          success: true,
          user: {
            id: supaUser.id,
            name: supaUser.name,
            email: supaUser.email,
            plan: supaUser.plan || 'basic',
            planName: planDisplayName,
            credits,
            creditsLeft: credits,
            maxCredits,
            totalCredits: maxCredits,
            creditsUsed,
            sessionToken,
            canAccessPrompts, // True ONLY if active ultra/unlimited user with matching valid sessionToken
            planDaysLeft,
            status: supaUser.status || 'active',
            extensionAccess: supaUser.extension_access !== false,
            isAllowed: extensionAllowed,
          },
          // HIGH SECURITY: Server prompts are NEVER returned unless caller has active matching session token
          servers: canAccessPrompts ? servers : [],
          costs,
          serverTimestamp: new Date().toISOString(),
        });
      }
    } catch {}
  }

  // Fallback to backend server via dynamic host
  if (req.headers.host) {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const r = await fetch(`${protocol}://${req.headers.host}/api/extension/user?email=${encodeURIComponent(email)}`);
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch {}
  }

  return res.status(404).json({ success: false, error: `No user found registered with Gmail ID: ${email}` });
}
