import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const email = (req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password || '';

  if (!email) {
    return res.status(400).json({ success: false, error: 'Gmail ID (email) is required in request body.' });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);
      const { data: supaUser } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        if (supaUser.password && password && supaUser.password !== password) {
          return res.status(401).json({ success: false, error: 'Incorrect password. Please check your Gmail ID and password.' });
        }

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

        let requiredVersion = '3.2.0';
        const { data: configRow } = await supabase.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
        if (configRow?.name) {
          try {
            const parsed = JSON.parse(configRow.name);
            if (parsed?.extensionVersion) requiredVersion = String(parsed.extensionVersion).trim();
            if (parsed?.servers) servers = parsed.servers;
            if (parsed?.costs) costs = parsed.costs;
          } catch {}
        }

        const isUltra = supaUser.plan === 'ultra';
        const sessionToken = supaUser.session_token || supaUser.sessionToken || '';
        const canAccessPrompts = isUltra && supaUser.status === 'active';

        return res.status(200).json({
          success: true,
          updateRequired: false,
          requiredVersion,
          user: {
            id: supaUser.id,
            name: supaUser.name,
            email: supaUser.email,
            plan: supaUser.plan || 'basic',
            planName: isUltra ? 'Ultra VIP Plan' : 'Basic Plan',
            credits,
            creditsLeft: credits,
            maxCredits,
            totalCredits: maxCredits,
            creditsUsed,
            sessionToken,
            canAccessPrompts, // False for basic plan, True for Ultra
            planDaysLeft,
            status: supaUser.status || 'active',
            extensionAccess: supaUser.extension_access !== false,
            isAllowed: extensionAllowed,
          },
          servers: isUltra ? servers : [],
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
      const r = await fetch(`${protocol}://${req.headers.host}/api/extension/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch {}
  }

  return res.status(404).json({ success: false, error: `No user found registered with Gmail ID: ${email}` });
}
