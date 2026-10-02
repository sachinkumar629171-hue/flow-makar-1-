import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST.' });
  }

  const email = (req.body?.email || req.query?.email || '').trim().toLowerCase();
  const sessionToken = (
    req.body?.sessionToken || 
    req.body?.token || 
    req.query?.sessionToken || 
    req.query?.token || 
    (req.headers['authorization'] || '')
  ).replace(/^Bearer\s+/i, '').trim();

  if (!email || !sessionToken) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing email or session token. Please login on the portal.',
      servers: [],
    });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey);
      const { data: supaUser } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();

      if (!supaUser) {
        return res.status(404).json({ success: false, error: 'User not found.', servers: [] });
      }

      const dbToken = supaUser.session_token || supaUser.sessionToken || '';
      
      // Strict Security Checks:
      // 1. Session token MUST match the active login on the portal
      if (!dbToken || dbToken !== sessionToken) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Invalid or expired session. Please log in on flowmakerai.site.',
          servers: [],
        });
      }

      // 2. Account must be active and not suspended
      if (supaUser.status === 'suspended') {
        return res.status(403).json({ success: false, error: 'Account suspended by admin.', servers: [] });
      }

      // 3. Plan must be Ultra (or Admin)
      if (supaUser.plan !== 'ultra' && supaUser.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Basic Plan members do not have access to server prompts. Upgrade to Ultra VIP.',
          servers: [],
        });
      }

      // 4. Plan validity check
      const daysLeft = Number(supaUser.plan_days_left) || 0;
      if (daysLeft <= 0) {
        return res.status(403).json({ success: false, error: 'Plan expired. Please renew.', servers: [] });
      }

      // 5. Fetch secure server prompts from configuration
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

      return res.status(200).json({
        success: true,
        servers,
        costs,
        serverTimestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message || 'Server error', servers: [] });
    }
  }

  return res.status(500).json({ success: false, error: 'Database configuration missing.', servers: [] });
}
