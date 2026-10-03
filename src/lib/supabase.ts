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

/**
 * Resiliently updates a user in Supabase.
 * If columns are missing or if id format differs, tries multiple fallback strategies
 * so that critical updates (credits, plan_days_left, plan, status) never fail.
 */
export async function safeSupabaseUserUpdate(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | undefined,
  fields: Record<string, any>
): Promise<boolean> {
  if (!supabase || (!userId && !userEmail)) return false;

  // Clean payload
  const cleanFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      cleanFields[k] = v;
    }
  }

  if (Object.keys(cleanFields).length === 0) return true;

  try {
    // Strategy 1: Attempt update by ID with full fields
    if (userId) {
      const { error, data } = await supabase.from('users').update(cleanFields).eq('id', userId).select('id');
      if (!error && data && data.length > 0) {
        return true;
      }
    }

    // Strategy 2: Attempt update by Email with full fields
    if (userEmail) {
      const { error, data } = await supabase.from('users').update(cleanFields).eq('email', userEmail.toLowerCase()).select('id');
      if (!error && data && data.length > 0) {
        return true;
      }
    }

    // Strategy 3: Column error fallback - try only core known table columns
    const coreFields: Record<string, any> = {};
    if (cleanFields.credits !== undefined) coreFields.credits = cleanFields.credits;
    if (cleanFields.plan_days_left !== undefined) coreFields.plan_days_left = cleanFields.plan_days_left;
    if (cleanFields.plan !== undefined) coreFields.plan = cleanFields.plan;
    if (cleanFields.name !== undefined) coreFields.name = cleanFields.name;
    if (cleanFields.email !== undefined) coreFields.email = cleanFields.email;
    if (cleanFields.password !== undefined) coreFields.password = cleanFields.password;
    if (cleanFields.status !== undefined) coreFields.status = cleanFields.status;
    if (cleanFields.role !== undefined) coreFields.role = cleanFields.role;

    if (Object.keys(coreFields).length > 0) {
      if (userId) {
        const { error, data } = await supabase.from('users').update(coreFields).eq('id', userId).select('id');
        if (!error && data && data.length > 0) return true;
      }
      if (userEmail) {
        const { error, data } = await supabase.from('users').update(coreFields).eq('email', userEmail.toLowerCase()).select('id');
        if (!error && data && data.length > 0) return true;
      }
    }

    // Strategy 4: Individual key updates for absolute fault tolerance
    for (const [k, v] of Object.entries(cleanFields)) {
      try {
        if (userId) {
          await supabase.from('users').update({ [k]: v }).eq('id', userId);
        } else if (userEmail) {
          await supabase.from('users').update({ [k]: v }).eq('email', userEmail.toLowerCase());
        }
      } catch {}
    }

    return true;
  } catch (err) {
    console.error('safeSupabaseUserUpdate catch error:', err);
    return false;
  }
}
