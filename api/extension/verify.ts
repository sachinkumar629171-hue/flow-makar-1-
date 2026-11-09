import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const email = (req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '').trim();

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Gmail ID (email) and password are required in request body.' });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);
      const { data: supaUser } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        if (!supaUser.password || String(supaUser.password).trim() !== password) {
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

        const { data: configRow } = await supabase.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
        if (configRow?.name) {
          try {
            const parsed = JSON.parse(configRow.name);
            if (parsed?.servers) servers = parsed.servers;
            if (parsed?.costs) costs = parsed.costs;
          } catch {}
        }

        const serializeJsonbVal = (rawVal: any): string => {
          if (rawVal === undefined || rawVal === null || rawVal === '') return '';
          if (typeof rawVal === 'object') {
            if (!Array.isArray(rawVal) && Object.keys(rawVal).length === 0) return '';
            if (Array.isArray(rawVal) && rawVal.length === 0) return '';
            return JSON.stringify(rawVal);
          }
          const s = String(rawVal).trim();
          if (s === '{}' || s === '[]') return '';
          return String(rawVal);
        };

        const dataType = String(
          req.body?.dataType || req.body?.datatype || req.body?.platform || req.body?.service ||
          req.query?.dataType || req.query?.datatype ||
          'Flow ultra lower priority'
        ).trim();
        const dropdown = String(
          req.body?.dropdown || req.body?.server || req.body?.serverId ||
          req.query?.dropdown || req.query?.server || ''
        ).trim();
        const isDefaultFlowType = dataType.toLowerCase() === 'flow ultra lower priority';
        const serverFields: Record<string, string> = {};

        if (dropdown) {
          const numMatch = dropdown.match(/(\d+)/);
          const serverNum = numMatch ? Math.max(1, Math.min(5, parseInt(numMatch[1], 10))) : 1;
          const colUnderscore = `server_${serverNum}`;
          const colSpace = `server ${serverNum}`;
          const selectedServerKey = `server${serverNum}`;
          let selectedPrompt: string | null = null;

          try {
            const { data } = await supabase.from('servers').select(colUnderscore).ilike('datatype', dataType).maybeSingle();
            if (data && (data as any)[colUnderscore] !== undefined) {
              selectedPrompt = serializeJsonbVal((data as any)[colUnderscore]);
            } else {
              const { data: spaceData } = await supabase.from('servers').select(`"${colSpace}"`).ilike('datatype', dataType).maybeSingle();
              if (spaceData && (spaceData as any)[colSpace] !== undefined) {
                selectedPrompt = serializeJsonbVal((spaceData as any)[colSpace]);
              }
            }
          } catch {}

          const finalPrompt = selectedPrompt ?? (isDefaultFlowType ? (servers[serverNum - 1]?.prompt || '') : '');
          servers = [{ id: selectedServerKey, label: `Server ${serverNum}`, prompt: finalPrompt }];
          serverFields[selectedServerKey] = finalPrompt;
          serverFields.prompt = finalPrompt;
        } else {
          try {
            const { data: rowData } = await supabase.from('servers').select('*').ilike('datatype', dataType).maybeSingle();
            if (rowData) {
              const list: any[] = [];
              for (let i = 1; i <= 5; i++) {
                const rawVal = (rowData as any)[`server_${i}`] ?? (rowData as any)[`server ${i}`] ?? (rowData as any)[`server${i}`];
                const strVal = serializeJsonbVal(rawVal);
                list.push({ id: `server${i}`, label: `Server ${i}`, prompt: strVal });
                serverFields[`server${i}`] = strVal;
              }
              servers = list;
            }
          } catch {}
        }

        const isUltra = supaUser.plan === 'ultra' || supaUser.plan === 'unlimited';
        const sessionToken = supaUser.session_token || supaUser.sessionToken || '';
        const canAccessPrompts = isUltra && supaUser.status === 'active';

        return res.status(200).json({
          success: true,
          dataType,
          dropdown: dropdown || undefined,
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
          ...(isUltra ? serverFields : {}),
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
