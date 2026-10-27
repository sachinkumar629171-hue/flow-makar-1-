import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

let cachedExtConfig: { requiredVersion: string; servers: any[]; costs: { image: number; video: number }; fetchedAt: number } | null = null;
const CONFIG_CACHE_TTL_MS = 60000; // 60 seconds cache to protect Supabase Egress quota

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
  const email = (body.email || query.email || '').toString().trim().toLowerCase();
  const token = (body.token || body.sessionToken || query.token || query.sessionToken || headers['authorization'] || '').toString().replace(/^Bearer\s+/i, '').trim();
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

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  let requiredVersion = '3.2.0';
  let servers = [
    { id: 'server1', label: 'Server 1', prompt: '' },
    { id: 'server2', label: 'Server 2', prompt: '' },
  ];
  let costs = { image: 20, video: 30 };

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);
      const now = Date.now();

      // 1. Fetch requiredVersion and config from 60s cache or Supabase (app_config first, fallback to users only if missing)
      if (cachedExtConfig && (now - cachedExtConfig.fetchedAt < CONFIG_CACHE_TTL_MS)) {
        requiredVersion = cachedExtConfig.requiredVersion;
        servers = cachedExtConfig.servers;
        costs = cachedExtConfig.costs;
      } else {
        let bestExt: any = null;
        let bestPrompt: any = null;

        try {
          const { data: appConfigs } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', ['admin_config_extensions', 'admin_config_prompts']);
          if (Array.isArray(appConfigs)) {
            for (const row of appConfigs) {
              const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
              if (row.key === 'admin_config_extensions') bestExt = val;
              if (row.key === 'admin_config_prompts') bestPrompt = val;
            }
          }
        } catch {}

        if (!bestExt || !bestPrompt) {
          try {
            const missingKeys: string[] = [];
            if (!bestExt) missingKeys.push('admin_config_extensions');
            if (!bestPrompt) missingKeys.push('admin_config_prompts');
            const { data: usrConfigs } = await supabase
              .from('users')
              .select('id, name')
              .in('id', missingKeys);
            if (Array.isArray(usrConfigs)) {
              for (const row of usrConfigs) {
                if (!row.name) continue;
                const val = typeof row.name === 'string' ? JSON.parse(row.name) : row.name;
                if (row.id === 'admin_config_extensions' && !bestExt) bestExt = val;
                if (row.id === 'admin_config_prompts' && !bestPrompt) bestPrompt = val;
              }
            }
          } catch {}
        }

        const latestExtTs = Number(bestExt?._updatedAt || (bestExt?.ultra?.updatedAt ? new Date(bestExt.ultra.updatedAt).getTime() : 0) || 0);
        const latestPromptTs = Number(bestPrompt?._updatedAt || bestPrompt?.dashboardAnnouncement?.updatedAt || 0);

        const extVer = bestExt?.ultra?.version ? String(bestExt.ultra.version).trim() : '';
        const promptVer = bestPrompt?.extensionVersion ? String(bestPrompt.extensionVersion).trim() : '';

        if (promptVer && extVer) {
          requiredVersion = latestExtTs > latestPromptTs ? extVer : promptVer;
        } else if (promptVer || extVer) {
          requiredVersion = promptVer || extVer;
        }

        if (bestPrompt?.servers) servers = bestPrompt.servers;
        if (bestPrompt?.costs) costs = bestPrompt.costs;

        cachedExtConfig = { requiredVersion, servers, costs, fetchedAt: now };
      }

      // 2. Strict Normalized Version Check against Supabase requiredVersion
      if (clientVersion && normalizeVersion(clientVersion) !== normalizeVersion(requiredVersion)) {
        return res.status(426).json({
          success: false,
          allowed: false,
          updateRequired: true,
          needsUpdate: true,
          isOutdated: true,
          error: `Update Required: Please update your extension to version ${requiredVersion}. Your version is ${clientVersion}.`,
          message: `Update Required: Please update your extension to version ${requiredVersion}. Your version is ${clientVersion}.`,
          requiredVersion,
          version: requiredVersion,
          extensionVersion: requiredVersion,
          clientVersion,
        });
      }

      if (!email || !token) {
        return res.status(401).json({
          success: false,
          allowed: false,
          error: 'Missing email or token (session ID).',
          requiredVersion,
          version: requiredVersion,
          extensionVersion: requiredVersion,
        });
      }

      const { data: supaUser } = await supabase
        .from('users')
        .select('id, name, email, plan, role, status, credits, max_credits, plan_days_left, plan_expires_at, session_token')
        .ilike('email', email)
        .maybeSingle();

      if (!supaUser || supaUser.id?.startsWith('admin_config_')) {
        return res.status(404).json({
          success: false,
          allowed: false,
          error: `User not registered with email: ${email}`,
          requiredVersion,
          version: requiredVersion,
          extensionVersion: requiredVersion,
        });
      }

      // Verify Session Token / Session ID
      const dbToken = supaUser.session_token || supaUser.sessionToken || '';
      if (dbToken && token && dbToken !== token) {
        return res.status(401).json({
          success: false,
          allowed: false,
          error: 'Invalid or expired session ID / token. Please log in again on FlowMaker portal.',
          requiredVersion,
          version: requiredVersion,
          extensionVersion: requiredVersion,
        });
      }

      // Verify Plan: If plan is basic, do NOT grant access!
      const plan = (supaUser.plan || 'basic').toLowerCase();
      const role = (supaUser.role || 'user').toLowerCase();
      const status = (supaUser.status || 'active').toLowerCase();
      const rawDaysLeft = supaUser.plan_expires_at
        ? Math.max(0, Math.ceil((new Date(supaUser.plan_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : (Number(supaUser.plan_days_left) ?? 30);
      const planDaysLeft = rawDaysLeft;

      if (status === 'suspended') {
        return res.status(403).json({
          success: false,
          allowed: false,
          error: 'Account is suspended. Please contact support.',
          requiredVersion,
          version: requiredVersion,
          extensionVersion: requiredVersion,
        });
      }

      const isUltraOrAdmin = (plan === 'ultra' || plan === 'unlimited' || role === 'admin') && plan !== 'basic';
      if (!isUltraOrAdmin || planDaysLeft <= 0 || plan === 'basic') {
        return res.status(403).json({
          success: false,
          allowed: false,
          error: 'Ultra VIP Plan required. Basic plan members do not have extension access. Please upgrade via your reseller.',
          requiredVersion,
          version: requiredVersion,
          extensionVersion: requiredVersion,
        });
      }

      // 3. Resolve ONLY the requested server prompt if dropdown / server is specified (saves Egress!)
      const dataType = String(body.dataType || body.datatype || query.dataType || query.datatype || 'Flow ultra lower priority').trim();
      const dropdown = String(body.dropdown || body.server || body.serverId || query.dropdown || query.server || '').trim();

      let responseServers = servers;
      let selectedPrompt: string | null = null;
      let selectedServerKey: string | null = null;

      if (dropdown) {
        const numMatch = dropdown.match(/(\d+)/);
        const serverNum = numMatch ? Math.max(1, Math.min(5, parseInt(numMatch[1], 10))) : 1;
        const colUnderscore = `server_${serverNum}`;
        const colSpace = `server ${serverNum}`;
        selectedServerKey = `server${serverNum}`;
        const label = `Server ${serverNum}`;

        try {
          const { data, error } = await supabase
            .from('servers')
            .select(colUnderscore)
            .ilike('datatype', dataType)
            .maybeSingle();

          if (!error && data && (data as any)[colUnderscore] !== undefined) {
            selectedPrompt = String((data as any)[colUnderscore] || '');
          } else {
            const { data: spaceData } = await supabase
              .from('servers')
              .select(`"${colSpace}"`)
              .ilike('datatype', dataType)
              .maybeSingle();
            if (spaceData && (spaceData as any)[colSpace] !== undefined) {
              selectedPrompt = String((spaceData as any)[colSpace] || '');
            }
          }
        } catch {}

        if (selectedPrompt === null) {
          const fallbackSrv = servers.find((s: any, idx: number) =>
            s.id === selectedServerKey ||
            String(s.label || '').toLowerCase() === dropdown.toLowerCase() ||
            idx + 1 === serverNum
          );
          selectedPrompt = fallbackSrv?.prompt || '';
        }

        responseServers = [{ id: selectedServerKey, label, prompt: selectedPrompt || '' }];
      }

      return res.status(200).json({
        success: true,
        allowed: true,
        verified: true,
        requiredVersion,
        version: requiredVersion,
        extensionVersion: requiredVersion,
        clientVersion: clientVersion || requiredVersion,
        updateRequired: false,
        isOutdated: false,
        dataType,
        dropdown: dropdown || undefined,
        selectedServer: selectedServerKey || undefined,
        servers: responseServers,
        plan,
        isUltra: true,
        isAllowed: true,
        credits: Number(supaUser.credits) ?? 45000,
        maxCredits: Number(supaUser.max_credits) ?? 45000,
        planDaysLeft,
        costs,
        user: {
          id: supaUser.id,
          name: supaUser.name || 'User',
          email: supaUser.email,
          plan,
          credits: Number(supaUser.credits) ?? 45000,
          maxCredits: Number(supaUser.max_credits) ?? 45000,
          planDaysLeft,
        }
      });
    } catch (err: any) {
      console.error('cf-verify Supabase error:', err);
    }
  }

  return res.status(401).json({
    success: false,
    allowed: false,
    error: 'Database connection error during verification.',
    requiredVersion,
  });
}
