import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase LocalStorage persistence keys
const SUPABASE_URL_KEY = 'flow_supabase_url';
const SUPABASE_ANON_KEY = 'flow_supabase_anon_key';

let cachedClient: SupabaseClient | null = null;
let currentUrl: string = '';
let currentKey: string = '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  if (typeof window === 'undefined') {
    return { url: '', anonKey: '', isConnected: false };
  }
  const url = localStorage.getItem(SUPABASE_URL_KEY) || (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const anonKey = localStorage.getItem(SUPABASE_ANON_KEY) || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  return {
    url,
    anonKey,
    isConnected: Boolean(url && anonKey),
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): boolean {
  if (typeof window === 'undefined') return false;
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  
  if (!cleanUrl || !cleanKey) {
    localStorage.removeItem(SUPABASE_URL_KEY);
    localStorage.removeItem(SUPABASE_ANON_KEY);
    cachedClient = null;
    currentUrl = '';
    currentKey = '';
    return false;
  }

  localStorage.setItem(SUPABASE_URL_KEY, cleanUrl);
  localStorage.setItem(SUPABASE_ANON_KEY, cleanKey);
  cachedClient = createClient(cleanUrl, cleanKey);
  currentUrl = cleanUrl;
  currentKey = cleanKey;
  return true;
}

export function clearSupabaseConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SUPABASE_URL_KEY);
  localStorage.removeItem(SUPABASE_ANON_KEY);
  cachedClient = null;
  currentUrl = '';
  currentKey = '';
}

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;

  if (cachedClient && currentUrl === url && currentKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey);
    currentUrl = url;
    currentKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

// Columns supported in Supabase public.users table (missing columns are automatically stripped upon retry)
export const ALLOWED_USER_COLUMNS = new Set([
  'id',
  'name',
  'email',
  'password',
  'plan',
  'max_credits',
  'credits',
  'plan_days_left',
  'session_token',
  'is_online',
  'whatsapp',
  'telegram',
  'referral_code',
  'referred_by',
  'reseller_id',
  'reseller_name',
  'role',
  'status',
  'last_active',
  'can_edit_prompts',
  'created_at'
]);

// Set of columns known to be missing from the user's Supabase schema
const knownMissingColumns = new Set<string>();

function extractMissingColumn(error: any): string | null {
  if (!error) return null;
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  const match = msg.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i) ||
                msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of relation/i) ||
                msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
  return match ? match[1] : null;
}

export function formatSupabaseUserPayload(user: Record<string, any>): Record<string, any> {
  const payload: Record<string, any> = {};
  if (user.id !== undefined) payload.id = String(user.id);
  if (user.name !== undefined) payload.name = String(user.name);
  if (user.email !== undefined) payload.email = String(user.email).toLowerCase().trim();
  if (user.password !== undefined) payload.password = String(user.password);
  if (user.plan !== undefined) payload.plan = String(user.plan);
  
  if (user.maxCredits !== undefined) payload.max_credits = Number(user.maxCredits) || 100;
  else if (user.max_credits !== undefined) payload.max_credits = Number(user.max_credits) || 100;

  if (user.credits !== undefined) payload.credits = Number(user.credits) ?? 0;
  
  if (user.planDaysLeft !== undefined) payload.plan_days_left = Number(user.planDaysLeft) ?? 30;
  else if (user.plan_days_left !== undefined) payload.plan_days_left = Number(user.plan_days_left) ?? 30;

  if (user.sessionToken !== undefined) payload.session_token = String(user.sessionToken);
  else if (user.session_token !== undefined) payload.session_token = String(user.session_token);

  if (user.isOnline !== undefined) payload.is_online = Boolean(user.isOnline);
  else if (user.is_online !== undefined) payload.is_online = Boolean(user.is_online);

  if (user.whatsapp !== undefined && user.whatsapp !== null) payload.whatsapp = String(user.whatsapp);
  if (user.telegram !== undefined && user.telegram !== null) payload.telegram = String(user.telegram);
  
  if (user.referralCode !== undefined && user.referralCode !== null) payload.referral_code = String(user.referralCode);
  else if (user.referral_code !== undefined && user.referral_code !== null) payload.referral_code = String(user.referral_code);

  if (user.referredBy !== undefined && user.referredBy !== null) payload.referred_by = String(user.referredBy);
  else if (user.referred_by !== undefined && user.referred_by !== null) payload.referred_by = String(user.referred_by);

  if (user.resellerId !== undefined && user.resellerId !== null) payload.reseller_id = String(user.resellerId);
  else if (user.reseller_id !== undefined && user.reseller_id !== null) payload.reseller_id = String(user.reseller_id);

  if (user.resellerName !== undefined && user.resellerName !== null) payload.reseller_name = String(user.resellerName);
  else if (user.reseller_name !== undefined && user.reseller_name !== null) payload.reseller_name = String(user.reseller_name);

  if (user.role !== undefined) payload.role = String(user.role);
  if (user.status !== undefined) payload.status = String(user.status);
  
  if (user.lastActive !== undefined) payload.last_active = String(user.lastActive);
  else if (user.last_active !== undefined) payload.last_active = String(user.last_active);

  if (user.canEditPrompts !== undefined) payload.can_edit_prompts = Boolean(user.canEditPrompts);
  else if (user.can_edit_prompts !== undefined) payload.can_edit_prompts = Boolean(user.can_edit_prompts);

  if (user.createdAt !== undefined) payload.created_at = String(user.createdAt);
  else if (user.created_at !== undefined) payload.created_at = String(user.created_at);

  // Remove any known missing columns
  for (const col of knownMissingColumns) {
    delete payload[col];
  }

  return payload;
}

/**
 * Resiliently inserts or upserts a user into Supabase.
 * Dynamically handles missing columns by stripping them and retrying.
 */
export async function safeSupabaseUserUpsert(
  supabase: SupabaseClient,
  user: Record<string, any>
): Promise<boolean> {
  if (!supabase || !user) return false;

  let payload = formatSupabaseUserPayload(user);
  if (!payload.email && !payload.id) return false;

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
      if (!error) {
        return true;
      }

      console.warn(`[Supabase Upsert Attempt ${attempt + 1}] error:`, error.message);
      const missingCol = extractMissingColumn(error);
      if (missingCol && payload[missingCol] !== undefined) {
        knownMissingColumns.add(missingCol);
        delete payload[missingCol];
        continue;
      }

      // If conflict on ID failed or email unique constraint, try update by email
      if (payload.email) {
        const { id, ...updateFields } = payload;
        const { error: updateErr } = await supabase.from('users').update(updateFields).eq('email', payload.email.toLowerCase());
        if (!updateErr) return true;
        const missingUpdateCol = extractMissingColumn(updateErr);
        if (missingUpdateCol && payload[missingUpdateCol] !== undefined) {
          knownMissingColumns.add(missingUpdateCol);
          delete payload[missingUpdateCol];
          continue;
        }
      }

      break;
    } catch (err: any) {
      console.error('safeSupabaseUserUpsert exception:', err);
      const missingCol = extractMissingColumn(err);
      if (missingCol && payload[missingCol] !== undefined) {
        knownMissingColumns.add(missingCol);
        delete payload[missingCol];
        continue;
      }
      break;
    }
  }

  return false;
}

/**
 * Resiliently updates a user in Supabase.
 * Only sends columns that exist in the public.users table to prevent schema errors.
 * If user does not exist in Supabase, falls back to upserting the full record.
 */
export async function safeSupabaseUserUpdate(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | undefined,
  fields: Record<string, any>,
  fallbackFullUser?: Record<string, any>
): Promise<boolean> {
  if (!supabase || (!userId && !userEmail)) return false;

  // Clean payload and filter to allowed columns only
  const cleanFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && ALLOWED_USER_COLUMNS.has(k) && !knownMissingColumns.has(k)) {
      cleanFields[k] = v;
    }
  }

  if (Object.keys(cleanFields).length === 0 && !fallbackFullUser) return true;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      // Strategy 1: Attempt update by ID
      if (userId) {
        const { error, data } = await supabase.from('users').update(cleanFields).eq('id', userId).select('id');
        if (!error && data && data.length > 0) {
          return true;
        }
        if (error) {
          const missingCol = extractMissingColumn(error);
          if (missingCol && cleanFields[missingCol] !== undefined) {
            knownMissingColumns.add(missingCol);
            delete cleanFields[missingCol];
            continue;
          }
        }
      }

      // Strategy 2: Attempt update by Email
      if (userEmail) {
        const { error, data } = await supabase.from('users').update(cleanFields).eq('email', userEmail.toLowerCase().trim()).select('id');
        if (!error && data && data.length > 0) {
          return true;
        }
        if (error) {
          const missingCol = extractMissingColumn(error);
          if (missingCol && cleanFields[missingCol] !== undefined) {
            knownMissingColumns.add(missingCol);
            delete cleanFields[missingCol];
            continue;
          }
        }
      }

      // If update returned 0 rows (user not in Supabase yet), upsert the full user!
      if (fallbackFullUser) {
        return await safeSupabaseUserUpsert(supabase, {
          ...fallbackFullUser,
          ...cleanFields,
          id: userId || fallbackFullUser.id,
          email: userEmail || fallbackFullUser.email,
        });
      }

      return false;
    } catch (err: any) {
      console.error('safeSupabaseUserUpdate catch error:', err);
      const missingCol = extractMissingColumn(err);
      if (missingCol && cleanFields[missingCol] !== undefined) {
        knownMissingColumns.add(missingCol);
        delete cleanFields[missingCol];
        continue;
      }
      break;
    }
  }

  return false;
}
