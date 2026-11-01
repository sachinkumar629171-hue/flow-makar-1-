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
      const mergedMap = new Map<string, any>();

      // 1. Load backup row from users table first
      try {
        const { data: resRow } = await supabase.from('users').select('name').eq('id', 'admin_config_resellers').maybeSingle();
        if (resRow?.name) {
          const parsed = JSON.parse(resRow.name);
          if (Array.isArray(parsed)) {
            for (const r of parsed) {
              const key = String(r.id || r.email || '').trim().toLowerCase();
              if (key) mergedMap.set(key, r);
            }
          }
        }
      } catch {}

      // 2. Load authoritative resellers table and merge
      try {
        const { data: supaResellers } = await supabase.from('resellers').select('*');
        if (supaResellers && Array.isArray(supaResellers)) {
          for (const sr of supaResellers) {
            const keyById = String(sr.id || '').trim().toLowerCase();
            const keyByEmail = String(sr.email || '').trim().toLowerCase();
            const existing = mergedMap.get(keyById) || (keyByEmail ? mergedMap.get(keyByEmail) : undefined) || {};
            const merged = {
              ...existing,
              ...sr,
              password: sr.password || existing.password || '',
            };
            if (keyById) mergedMap.set(keyById, merged);
            else if (keyByEmail) mergedMap.set(keyByEmail, merged);
          }
        }
      } catch {}

      // Deduplicate by id / email
      const seenIds = new Set<string>();
      const seenEmails = new Set<string>();
      const rawResellers: any[] = [];
      for (const item of mergedMap.values()) {
        const idKey = String(item.id || '').trim().toLowerCase();
        const emailKey = String(item.email || '').trim().toLowerCase();
        if ((idKey && seenIds.has(idKey)) || (emailKey && seenEmails.has(emailKey))) continue;
        if (idKey) seenIds.add(idKey);
        if (emailKey) seenEmails.add(emailKey);
        rawResellers.push(item);
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
          password: sr.password || '',
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

      const queryEmail = (req.query.email || '').toString().trim().toLowerCase();
      if (queryEmail) {
        const matched = mapped.filter(
          (r: any) =>
            (r.email && r.email.trim().toLowerCase() === queryEmail) ||
            (r.id && String(r.id).trim().toLowerCase() === queryEmail)
        );
        return res.status(200).json({ resellers: matched });
      }

      return res.status(200).json({ resellers: mapped });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const reseller = body;
      if (!reseller.apiKey) reseller.apiKey = getResellerApiKey(reseller);
      if (!reseller.expiresAt && reseller.daysLeft) {
        reseller.expiresAt = new Date(Date.now() + Number(reseller.daysLeft) * 86400000).toISOString();
      }

      const payload: Record<string, any> = {
        id: reseller.id,
        portal_name: reseller.portalName || reseller.portal_name || 'Reseller Portal',
        email: (reseller.email || '').trim().toLowerCase(),
        password: reseller.password || '',
        user_limit: reseller.userLimit ?? reseller.user_limit ?? 20,
        days_left: reseller.daysLeft ?? reseller.days_left ?? 30,
        expiry_date: reseller.expiryDate || reseller.expiry_date,
        expires_at: reseller.expiresAt || reseller.expires_at,
        status: reseller.status || 'active',
        created_at: reseller.createdAt || reseller.created_at || new Date().toISOString(),
        notes: reseller.notes || '',
        api_key: reseller.apiKey || reseller.api_key,
      };

      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const { error } = await supabase.from('resellers').upsert(payload, { onConflict: 'id' });
          if (!error) break;
          const msg = `${error.message || ''} ${error.details || ''}`;
          const match = msg.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i) ||
                        msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of relation/i) ||
                        msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
          if (match && match[1] && payload[match[1]] !== undefined) {
            delete payload[match[1]];
            continue;
          }
          break;
        } catch {
          break;
        }
      }

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
