import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function normalizeVersion(v: any): string {
  if (!v) return '';
  return String(v).trim().toLowerCase().replace(/^v/i, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-extension-version, x-client-version, x-version');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};
  const query = req.query || {};
  const headers = req.headers || {};

  const email = (body.email || query.email || headers['x-user-email'] || '').toString().trim().toLowerCase();
  const password = body.password || query.password || '';
  const reqToken = (body.token || body.sessionToken || query.token || query.sessionToken || headers['authorization'] || '').toString().replace(/^Bearer\s+/i, '').trim();
  const clientVersion = (
    body.version ||
    body.extensionVersion ||
    body.clientVersion ||
    body.extVersion ||
    query.version ||
    query.extensionVersion ||
    query.clientVersion ||
    query.extVersion ||
    headers['x-extension-version'] ||
    headers['x-client-version'] ||
    headers['x-version'] ||
    ''
  ).toString().trim();

  if (!email) {
    return res.status(400).json({ success: false, error: 'Gmail ID (email) is required.' });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);
      let requiredVersion = '3.2.0';
      let servers = [
        { id: 'server1', label: 'Server 1', prompt: '' },
        { id: 'server2', label: 'Server 2', prompt: '' },
      ];
      let costs = { image: 20, video: 30 };

      let appExt: any = null;
      let usrExt: any = null;
      let appPrompt: any = null;
      let usrPrompt: any = null;

      try {
        const { data: appConfigs } = await supabase
          .from('app_config')
          .select('key, value')
          .in('key', ['admin_config_extensions', 'admin_config_prompts']);
        if (Array.isArray(appConfigs)) {
          for (const row of appConfigs) {
            const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            if (row.key === 'admin_config_extensions') appExt = val;
            if (row.key === 'admin_config_prompts') appPrompt = val;
          }
        }
      } catch {}

      try {
        const { data: usrConfigs } = await supabase
          .from('users')
          .select('id, name')
          .in('id', ['admin_config_extensions', 'admin_config_prompts']);
        if (Array.isArray(usrConfigs)) {
          for (const row of usrConfigs) {
            if (!row.name) continue;
            const val = typeof row.name === 'string' ? JSON.parse(row.name) : row.name;
            if (row.id === 'admin_config_extensions') usrExt = val;
            if (row.id === 'admin_config_prompts') usrPrompt = val;
          }
        }
      } catch {}

      const appExtTs = Number(appExt?._updatedAt || (appExt?.ultra?.updatedAt ? new Date(appExt.ultra.updatedAt).getTime() : 0) || 0);
      const usrExtTs = Number(usrExt?._updatedAt || (usrExt?.ultra?.updatedAt ? new Date(usrExt.ultra.updatedAt).getTime() : 0) || 0);
      const bestExt = (usrExt && usrExtTs > appExtTs) ? usrExt : (appExt || usrExt);
      const latestExtTs = Math.max(appExtTs, usrExtTs);

      const appPromptTs = Number(appPrompt?._updatedAt || appPrompt?.dashboardAnnouncement?.updatedAt || 0);
      const usrPromptTs = Number(usrPrompt?._updatedAt || usrPrompt?.dashboardAnnouncement?.updatedAt || 0);
      const bestPrompt = (usrPrompt && usrPromptTs > appPromptTs) ? usrPrompt : (appPrompt || usrPrompt);
      const latestPromptTs = Math.max(appPromptTs, usrPromptTs);

      const extVer = bestExt?.ultra?.version ? String(bestExt.ultra.version).trim() : '';
      const promptVer = bestPrompt?.extensionVersion ? String(bestPrompt.extensionVersion).trim() : '';

      if (promptVer && extVer) {
        requiredVersion = latestExtTs > latestPromptTs ? extVer : promptVer;
      } else if (promptVer || extVer) {
        requiredVersion = promptVer || extVer;
      }

      if (bestPrompt?.servers) servers = bestPrompt.servers;
      if (bestPrompt?.costs) costs = bestPrompt.costs;

      if (clientVersion && normalizeVersion(clientVersion) !== normalizeVersion(requiredVersion)) {
        return res.status(426).json({
          success: false,
          allowed: false,
          updateRequired: true,
          needsUpdate: true,
          isOutdated: true,
          requiredVersion,
          version: requiredVersion,
          extensionVersion: requiredVersion,
          clientVersion,
          error: `Extension Update Required: Your extension version (${clientVersion}) is outdated. Required version is ${requiredVersion}.`,
          message: `Extension Update Required: Your extension version (${clientVersion}) is outdated. Required version is ${requiredVersion}.`,
          servers: [],
        });
      }

      const { data: supaUser } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        if (supaUser.password && password && supaUser.password !== password) {
          return res.status(401).json({
            success: false,
            requiredVersion,
            version: requiredVersion,
            extensionVersion: requiredVersion,
            error: 'Incorrect password. Please check your Gmail ID and password.'
          });
        }

        const sessionToken = supaUser.session_token || supaUser.sessionToken || '';
        if (reqToken && sessionToken && reqToken !== sessionToken) {
          return res.status(401).json({
            success: false,
            allowed: false,
            requiredVersion,
            version: requiredVersion,
            extensionVersion: requiredVersion,
            error: 'Invalid or expired session token. Please log in again on FlowMaker portal.',
          });
        }

        const maxCredits = Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100);
        const credits = Number(supaUser.credits) ?? 0;
        const creditsUsed = Math.max(0, maxCredits - credits);
        const planDaysLeft = Number(supaUser.plan_days_left) ?? 30;
        const extensionAllowed = supaUser.extension_access !== false && supaUser.status !== 'suspended' && planDaysLeft > 0;

        const isUltra = supaUser.plan === 'ultra' || supaUser.plan === 'unlimited' || supaUser.role === 'admin';
        const canAccessPrompts = isUltra && supaUser.status === 'active';

        return res.status(200).json({
          success: true,
          requiredVersion,
          version: requiredVersion,
          extensionVersion: requiredVersion,
          clientVersion: clientVersion || requiredVersion,
          updateRequired: false,
          isOutdated: false,
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
            canAccessPrompts,
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
