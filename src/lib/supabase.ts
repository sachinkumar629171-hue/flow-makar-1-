import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase LocalStorage persistence keys
const SUPABASE_URL_KEY = 'flow_supabase_url';
const SUPABASE_ANON_KEY = 'flow_supabase_anon_key';

let cachedClient: SupabaseClient | null = null;
let currentUrl: string = '';
let currentKey: string = '';

export function isBlockedSupabaseRequest(urlStr: string): boolean {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr, 'https://dummy.co');
    const path = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();
    
    // 1. app_config?select=*
    if (path.includes('/rest/v1/app_config')) {
      return true;
    }
    
    // 2. resellers: allow filtered lookups (email, id, api_key) and direct reseller portal queries
    if (path.includes('/rest/v1/resellers')) {
      return false;
    }
    
    // 3. users?select=* (bulk select of users table without any filter)
    if (path.includes('/rest/v1/users')) {
      const hasWildcardSelect = query.includes('select=*') || query.includes('select=%2a');
      const hasSpecificFilter = query.includes('id=eq.') || 
                                query.includes('email=eq.') || 
                                query.includes('email=ilike.') || 
                                query.includes('session_token=eq.') ||
                                query.includes('reseller_id=eq.') ||
                                query.includes('reseller_id=ilike.') ||
                                query.includes('reseller_name=eq.') ||
                                query.includes('reseller_name=ilike.') ||
                                query.includes('or=');
      if (hasWildcardSelect && !hasSpecificFilter) {
        return true;
      }
    }
  } catch {
    const lower = urlStr.toLowerCase();
    if (lower.includes('/rest/v1/app_config')) return true;
    if (lower.includes('/rest/v1/users') && (lower.includes('select=*') || lower.includes('select=%2a')) && !lower.includes('id=') && !lower.includes('email=') && !lower.includes('reseller_')) return true;
  }
  return false;
}

const safeSupabaseFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
  const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
  if (method === 'GET' && isBlockedSupabaseRequest(urlStr)) {
    // Intercept and block GET polling: strictly do not send request over the network
    return Promise.resolve(new Response(JSON.stringify([]), {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json',
        'content-range': '0-0/0',
      },
    }));
  }
  return fetch(input, init);
};

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
  cachedClient = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: safeSupabaseFetch,
    },
  });
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
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: safeSupabaseFetch,
      },
    });
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
  'plan_expires_at',
  'plan_started_at',
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
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''} ${JSON.stringify(error)}`;
  const match = msg.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i) ||
                msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of relation/i) ||
                msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i) ||
                msg.match(/column [\\"']?([a-zA-Z0-9_]+)[\\"']?/i);
  if (match && match[1] !== 'users' && match[1] !== 'public') {
    return match[1];
  }
  return null;
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
  
  const rawDaysLeft = user.planDaysLeft !== undefined ? Number(user.planDaysLeft) : (user.plan_days_left !== undefined ? Number(user.plan_days_left) : 30);
  const startAt = user['created_at TIMESTAMPTZ'] || user.created_at || user.createdAt || user.planStartedAt || user.plan_started_at || new Date().toISOString();
  payload.plan_started_at = startAt;

  const startMs = new Date(startAt).getTime();
  const safeStartMs = isNaN(startMs) ? Date.now() : startMs;
  const maxAllowedExpiryMs = safeStartMs + 30 * 86400000;
  const maxRemainingDays = Math.min(30, Math.max(0, Math.ceil((maxAllowedExpiryMs - Date.now()) / 86400000)));
  const daysLeft = Math.min(30, Math.min(maxRemainingDays, Math.max(0, rawDaysLeft)));
  payload.plan_days_left = daysLeft;

  let requestedExpMs = 0;
  if (user.planExpiresAt && user.planExpiresAt !== 'null') {
    const t = new Date(String(user.planExpiresAt)).getTime();
    if (!isNaN(t)) requestedExpMs = t;
  } else if (user.plan_expires_at && user.plan_expires_at !== 'null') {
    const t = new Date(String(user.plan_expires_at)).getTime();
    if (!isNaN(t)) requestedExpMs = t;
  }

  if (!requestedExpMs) {
    requestedExpMs = Date.now() + Math.max(0, daysLeft) * 86400000;
  }
  const clampedExpMs = Math.min(requestedExpMs, maxAllowedExpiryMs);
  payload.plan_expires_at = new Date(clampedExpMs).toISOString();

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
      // Strategy 1: Attempt update by ID (skip if userId is a synthetic email-based ID)
      if (userId && !userId.includes('@')) {
        const { error } = await supabase.from('users').update(cleanFields).eq('id', userId);
        if (!error) {
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
        const { error } = await supabase.from('users').update(cleanFields).eq('email', userEmail.toLowerCase().trim());
        if (!error) {
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

function parsePromptForJsonColumn(rawPrompt: string): any {
  const trimmed = (rawPrompt || '').trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return rawPrompt;
  }
}

export function serializeServerColumnValue(rawVal: any): string {
  if (rawVal === undefined || rawVal === null || rawVal === '') return '';
  if (typeof rawVal === 'object') {
    if (!Array.isArray(rawVal) && Object.keys(rawVal).length === 0) return '';
    if (Array.isArray(rawVal) && rawVal.length === 0) return '';
    return JSON.stringify(rawVal);
  }
  const str = String(rawVal).trim();
  if (str === '{}' || str === '[]') return '';
  return String(rawVal);
}

/**
 * Syncs Server 1..5 prompts directly to Supabase public.servers table
 * under the specified datatype (default: 'Flow ultra lower priority').
 * Supports both underscore ('server_1') and space ('server 1') column names.
 */
export async function syncPromptServersToSupabaseTable(
  supabase: SupabaseClient | null,
  servers: Array<{ id: string; label: string; prompt: string }>,
  dataType: string = 'Flow ultra lower priority',
  singleServerIndex?: number
): Promise<boolean> {
  if (!supabase || !Array.isArray(servers)) return false;

  const targetDataType = (dataType || 'Flow ultra lower priority').trim();
  const underscorePayload: Record<string, any> = { datatype: targetDataType };
  const spacePayload: Record<string, any> = { datatype: targetDataType };

  servers.slice(0, 5).forEach((s, idx) => {
    const num = idx + 1;
    if (singleServerIndex !== undefined && singleServerIndex !== num) return;
    const val = parsePromptForJsonColumn(s.prompt || '');
    underscorePayload[`server_${num}`] = val;
    spacePayload[`server ${num}`] = val;
  });

  try {
    const { error } = await supabase.from('servers').upsert(underscorePayload, { onConflict: 'datatype' });
    if (!error) return true;

    const { error: err2 } = await supabase.from('servers').upsert(spacePayload, { onConflict: 'datatype' });
    return !err2;
  } catch {
    return false;
  }
}

const knownMissingResellerColumns = new Set<string>();

export async function safeSupabaseResellerUpsert(
  supabase: SupabaseClient | null,
  reseller: Record<string, any>
): Promise<boolean> {
  if (!supabase || !reseller) return false;

  const payload: Record<string, any> = {
    id: String(reseller.id || ''),
    portal_name: String(reseller.portalName || reseller.portal_name || 'Reseller Portal'),
    email: String(reseller.email || '').trim().toLowerCase(),
    password: String(reseller.password || ''),
    user_limit: Number(reseller.userLimit ?? reseller.user_limit) || 20,
    days_left: Number(reseller.daysLeft ?? reseller.days_left) ?? 30,
    expiry_date: reseller.expiryDate || reseller.expiry_date || '30/10/2026',
    expires_at: reseller.expiresAt || reseller.expires_at,
    status: reseller.status || 'active',
    created_at: reseller.createdAt || reseller.created_at || new Date().toISOString(),
    notes: reseller.notes || '',
    api_key: reseller.apiKey || reseller.api_key || '',
    per_user_rate: Number(reseller.perUserRate ?? reseller.per_user_rate ?? 0) || 0,
    rate_currency: String(reseller.rateCurrency || reseller.rate_currency || 'INR'),
    pending_payment: Number(reseller.pendingPayment ?? reseller.pending_payment ?? 0) || 0,
    paid_payment: Number(reseller.paidPayment ?? reseller.paid_payment ?? 0) || 0,
  };

  for (const col of knownMissingResellerColumns) {
    delete payload[col];
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const { error } = await supabase.from('resellers').upsert(payload, { onConflict: 'id' });
      if (!error) return true;

      const missingCol = extractMissingColumn(error);
      if (missingCol && missingCol !== 'resellers' && payload[missingCol] !== undefined) {
        knownMissingResellerColumns.add(missingCol);
        delete payload[missingCol];
        continue;
      }

      if (payload.email) {
        const { id, ...updateFields } = payload;
        const { error: updateErr } = await supabase.from('resellers').update(updateFields).ilike('email', payload.email);
        if (!updateErr) return true;
        const missingUpdateCol = extractMissingColumn(updateErr);
        if (missingUpdateCol && missingUpdateCol !== 'resellers' && payload[missingUpdateCol] !== undefined) {
          knownMissingResellerColumns.add(missingUpdateCol);
          delete payload[missingUpdateCol];
          continue;
        }
      }
      break;
    } catch (err: any) {
      const missingCol = extractMissingColumn(err);
      if (missingCol && missingCol !== 'resellers' && payload[missingCol] !== undefined) {
        knownMissingResellerColumns.add(missingCol);
        delete payload[missingCol];
        continue;
      }
      break;
    }
  }
  return false;
}


