import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = new Set(['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com']);

function getResellerApiKey(reseller: any): string {
  if (reseller.apiKey || reseller.api_key) return reseller.apiKey || reseller.api_key;
  const cleanId = String(reseller.id || '').replace(/[^a-zA-Z0-9]/g, '');
  return `flw_res_${cleanId}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-reseller-id, x-reseller-api-key, x-admin-key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  if (!supaUrl || !supaKey) {
    return res.status(500).json({ success: false, error: 'Database configuration missing' });
  }

  const supabase = createClient(supaUrl, supaKey);

  try {
    if (req.method === 'GET') {
      let rawResellers: any[] = [];
      const { data: supaResellers } = await supabase.from('resellers').select('*');
      if (supaResellers && Array.isArray(supaResellers) && supaResellers.length > 0) {
        rawResellers = supaResellers;
      } else {
        // Fallback: check admin_config_resellers row in users table
        const { data: resRow } = await supabase.from('users').select('name').eq('id', 'admin_config_resellers').maybeSingle();
        if (resRow?.name) {
          try {
            const parsed = JSON.parse(resRow.name);
            if (Array.isArray(parsed)) rawResellers = parsed;
          } catch {}
        }
      }

      const now = Date.now();
      const mapped = rawResellers.map((sr: any) => {
        let daysLeft = sr.days_left !== undefined ? Number(sr.days_left) : (sr.daysLeft !== undefined ? Number(sr.daysLeft) : 30);
        const expiresAt = sr.expires_at || sr.expiresAt;
        if (expiresAt) {
          const diff = new Date(expiresAt).getTime() - now;
          daysLeft = Math.max(0, Math.ceil(diff / 86400000));
        }
        const isExp = daysLeft <= 0;
        const status = sr.status === 'suspended' ? 'suspended' : (isExp ? 'expired' : 'active');

        return {
          id: sr.id,
          portalName: sr.portal_name || sr.portalName || 'Reseller Portal',
          email: sr.email || '',
          userLimit: sr.user_limit || sr.userLimit || sr.max_users || 50,
          daysLeft,
          expiryDate: sr.expiry_date || sr.expiryDate || '30/10/2026',
          expiresAt,
          status,
          createdAt: sr.created_at || sr.createdAt || new Date().toISOString(),
          notes: sr.notes || '',
          apiKey: getResellerApiKey(sr),
        };
      });

      return res.status(200).json({ resellers: mapped });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const reseller = body;
      if (!reseller.apiKey) reseller.apiKey = getResellerApiKey(reseller);
      if (!reseller.expiresAt && reseller.daysLeft) {
        reseller.expiresAt = new Date(Date.now() + Number(reseller.daysLeft) * 86400000).toISOString();
      }

      const payload = {
        id: reseller.id,
        portal_name: reseller.portalName,
        email: reseller.email,
        password: reseller.password,
        user_limit: reseller.userLimit,
        days_left: reseller.daysLeft,
        expiry_date: reseller.expiryDate,
        expires_at: reseller.expiresAt,
        status: reseller.status,
        created_at: reseller.createdAt,
        notes: reseller.notes,
        api_key: reseller.apiKey,
      };

      try {
        await supabase.from('resellers').upsert(payload, { onConflict: 'id' });
      } catch {}

      return res.status(200).json({ success: true, reseller });
    }

    if (req.method === 'DELETE') {
      const id = (req.query.id || req.body?.id || '').toString();
      if (id) {
        await supabase.from('resellers').delete().eq('id', id);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('api/resellers error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
