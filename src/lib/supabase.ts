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
