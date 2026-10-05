import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, Check, AlertCircle, RefreshCw, Trash2, Key, Globe, Terminal, Copy } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, getSupabase } from '../../lib/supabase';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url);
      setAnonKey(config.anonKey);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sqlSchema = `-- Run this in your Supabase SQL Editor:
create table if not exists public.users (
  id text primary key,
  name text,
  email text unique not null,
  password text default 'Flow@1122',
  plan text default 'basic',
  max_credits numeric default 100,
  credits numeric default 100,
  plan_days_left numeric default 30,
  whatsapp text,
  telegram text,
  referral_code text,
  referred_by text,
  reseller_id text,
  reseller_name text,
  session_token text,
  role text default 'user',
  status text default 'active',
  extension_access boolean default true,
  is_online boolean default false,
  last_active timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- If users table already exists, run this to ensure new columns exist:
alter table public.users add column if not exists extension_access boolean default true;
alter table public.users add column if not exists session_token text;
alter table public.users add column if not exists reseller_id text;
alter table public.users add column if not exists telegram text;
alter table public.users add column if not exists whatsapp text;

create table if not exists public.resellers (
  id text primary key,
  portal_name text not null,
  email text,
  password text,
  user_limit integer default 50,
  days_left numeric default 30,
  api_key text,
  status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Read & Write permissions (RLS)
alter table public.users enable row level security;
alter table public.resellers enable row level security;

create policy "Allow all operations on users" on public.users for all using (true) with check (true);
create policy "Allow all operations on resellers" on public.resellers for all using (true) with check (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({ success: false, message: 'Please enter both Supabase URL and Anon Key' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      saveSupabaseConfig(url, anonKey);
      
      // Also sync Supabase config with backend server so server.ts can immediately connect
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseConfig: { url: url.trim(), anonKey: anonKey.trim() } })
      }).catch(() => {});

      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Failed to initialize Supabase client');
      }

      // Try pinging users table
      const { error } = await supabase.from('users').select('id').limit(1);
      
      if (error && error.code !== 'PGRST116') {
        // Table might not exist yet or connection error
        if (error.message?.includes('does not exist') || error.message?.includes('relation "public.users"')) {
          setTestResult({
            success: true,
            message: 'Connected to Supabase! Please make sure to run the SQL query below to create tables.',
          });
        } else {
          setTestResult({
            success: false,
            message: `Supabase Error: ${error.message}`,
          });
          return;
        }
      } else {
        setTestResult({
          success: true,
          message: 'Connected to Supabase database successfully! All user & reseller data is now live syncing.',
        });
      }

      if (onConfigSaved) {
        onConfigSaved();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Could not connect to Supabase. Please verify URL and Key.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = () => {
    clearSupabaseConfig();
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseConfig: { url: '', anonKey: '' } })
    }).catch(() => {});
    setUrl('');
    setAnonKey('');
    setTestResult({ success: false, message: 'Supabase disconnected. Using local/fallback server.' });
    if (onConfigSaved) {
      onConfigSaved();
    }
  };

  const currentConfig = getSupabaseConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none overflow-y-auto">
      <div className="bg-[#101116] border border-neutral-800 w-full max-w-xl rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Supabase Database Cloud Setup</span>
                {currentConfig.isConnected && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700/60 text-emerald-300 font-mono">
                    CONNECTED
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-400">
                Connect your own Supabase project for 100% online real-time user authentication & Admin storage.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Status message */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-200'
                : 'bg-red-950/70 border-red-700/70 text-red-200'
            }`}
          >
            {testResult.success ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>{testResult.message}</div>
          </div>
        )}

        {/* Config Form */}
        <form onSubmit={handleTestAndSave} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-neutral-400" />
              <span>Project URL</span>
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full px-3.5 py-2.5 bg-[#08090b] border border-neutral-800 rounded-xl text-white text-xs font-mono placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-neutral-400" />
              <span>Anon Public Key (API Key)</span>
            </label>
            <input
              type="password"
              required
              value={anonKey}
              onChange={e => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-3.5 py-2.5 bg-[#08090b] border border-neutral-800 rounded-xl text-white text-xs font-mono placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={testing}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save & Connect Supabase</span>
                </>
              )}
            </button>

            {currentConfig.isConnected && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-3.5 py-2.5 bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Disconnect Supabase"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </form>

        {/* SQL Schema Copy Box */}
        <div className="bg-[#08090b] border border-neutral-800/90 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-300">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>One-Time Supabase SQL Setup (Tables & RLS)</span>
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] rounded-lg transition-colors font-semibold cursor-pointer"
            >
              {copiedSql ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-neutral-400">
            Paste this in your <strong>Supabase Dashboard ➔ SQL Editor ➔ Run</strong> to create the users and resellers tables.
          </p>
          <pre className="text-[10px] font-mono text-neutral-400 bg-black/50 p-2.5 rounded-lg overflow-x-auto max-h-32 border border-neutral-800/60">
            {sqlSchema}
          </pre>
        </div>
      </div>
    </div>
  );
};
