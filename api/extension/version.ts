import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let version = 'v2.4.1';

  // 1. Try fetching directly from Supabase
  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';
  
  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);
      const { data: promptRow } = await supabase.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
      if (promptRow?.name) {
        const parsed = JSON.parse(promptRow.name);
        if (parsed?.extensionVersion) {
          version = parsed.extensionVersion;
        }
      }
    } catch {}
  }

  // 2. Fallback to backend server via dynamic host
  if (version === 'v2.4.1' && req.headers.host) {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const r = await fetch(`${protocol}://${req.headers.host}/api/extension/version`);
      const data = await r.json();
      if (data?.version) {
        version = data.version;
      }
    } catch {}
  }

  return res.status(200).json({
    success: true,
    version,
    extensionVersion: version,
    requiredVersion: version
  });
}
