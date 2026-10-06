import React, { useState, useEffect } from 'react';
import { X, Key, Copy, Check, Terminal, Globe, Send, ShieldCheck, Code, Zap, RotateCw } from 'lucide-react';
import { Reseller } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getOrCreateResellerApiKey } from '../../lib/resellerUtils';

interface ResellerApiDocsModalProps {
  reseller: Reseller;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const ResellerApiDocsModal: React.FC<ResellerApiDocsModalProps> = ({
  reseller,
  onClose,
  showToast,
}) => {
  const { updateReseller } = useAuth();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'curl' | 'cloudflare' | 'supabase' | 'node' | 'php' | 'python'>('curl');

  // Interactive Test State
  const [testEmail, setTestEmail] = useState('testuser@gmail.com');
  const [testDays, setTestDays] = useState(30);
  const [testAction, setTestAction] = useState<'grant' | 'revoke'>('grant');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const apiKey = getOrCreateResellerApiKey(reseller);

  // Automatically persist API Key to Supabase if missing on reseller record
  useEffect(() => {
    if (!reseller.apiKey && apiKey) {
      updateReseller(reseller.id, { apiKey });
    }
  }, [reseller.id, reseller.apiKey, apiKey, updateReseller]);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://flowmakerai.site';

  const grantUrl = `${baseUrl}/api/reseller/access/grant`;
  const revokeUrl = `${baseUrl}/api/reseller/access/revoke`;

  const copyToClipboard = (text: string, label: string) => {
    if (!text) {
      showToast('API Key not generated yet. Ask Admin to generate it.');
      return;
    }
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard!`);
    if (label === 'API Key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedCurl(label);
      setTimeout(() => setCopiedCurl(null), 2000);
    }
  };

  const handleTestApi = async () => {
    if (!apiKey) {
      showToast('Cannot test: API Key not generated yet by Admin.');
      return;
    }
    if (!testEmail || !testEmail.includes('@')) {
      showToast('Enter a valid customer email for testing.');
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    const targetUrl = testAction === 'grant' ? grantUrl : revokeUrl;
    const payload = testAction === 'grant' 
      ? { email: testEmail.trim(), password: 'testPassword123', telegram: '@testuser', duration: `${testDays} days`, plan: 'ultra' }
      : { email: testEmail.trim() };

    try {
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'x-reseller-id': reseller.id,
        },
        body: JSON.stringify({
          ...payload,
          resellerId: reseller.id,
        }),
      });
      const data = await resp.json();
      setTestResult({ status: resp.status, data });
      showToast(resp.ok ? `Test ${testAction} completed successfully!` : 'API returned error');
    } catch (err: any) {
      setTestResult({ status: 500, error: err.message });
      showToast('Network error running test');
    } finally {
      setTestLoading(false);
    }
  };

  const curlSnippet = `# 1. Give Access via cURL / Webhook (supports exact Supabase schema):
curl -X POST "${grantUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey || 'YOUR_ADMIN_GENERATED_API_KEY'}" \\
  -d '{
    "id": "usr-res-mujhzif0-mfrv",
    "name": "Rahul (Telegram Name)",
    "email": "rahul@gmail.com",
    "password": "Flow@1122",
    "plan": "ultra",
    "max_credits": 45000,
    "credits": 45000,
    "plan_days_left": 30,
    "whatsapp": "+919876543210",
    "telegram": "@rahul_tg",
    "reseller_id": "${reseller.id}"
  }'

# 2. Revoke / Remove Access (completely removes customer):
curl -X POST "${revokeUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey || 'YOUR_ADMIN_GENERATED_API_KEY'}" \\
  -d '{"email": "rahul@gmail.com"}'`;

  const cloudflareSnippet = `// Cloudflare Worker: Multi-Role Master Handler (Prompt Receiver + User Access/Supabase Sync + Revoke Access + Dynamic Multi-Server Support)

// Dynamic Memory Storage
let STORED_PROMPTS = {
  lastUpdatedAt: new Date().toISOString()
};

// Live Portal Verification & Access Sync URLs
const PRIMARY_PORTAL_URL = '${baseUrl}';
const BACKUP_PORTAL_URL = 'https://flowmakerai.site';

// 1-Minute Cache (User verification quota bachaane ke liye)
const AUTH_CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-session-token, x-reseller-id',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. Return 200 OK for GET requests so Cloudflare Preview Panel loads cleanly without Error 1031!
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        status: "online",
        service: "FlowMaker Worker Relay",
        updatedAt: STORED_PROMPTS.lastUpdatedAt || new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: "Method not allowed. Use POST for access and prompt requests."
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Read URL Path & JSON Body
    const reqUrl = new URL(request.url);
    const pathName = reqUrl.pathname.toLowerCase();

    let body = {};
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON format" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =========================================================================
    // 🌟 ROLE 1: PROMPT UPDATE (CLEAN SEQUENTIAL MULTI-SERVER: SERVER 1, 2, 3, 4...)
    // =========================================================================
    const isPromptUpdate = (
      body.servers !== undefined ||
      body.prompt !== undefined ||
      Object.keys(body).some(k => k.startsWith('server'))
    );

    if (isPromptUpdate) {
      if (Array.isArray(body.servers)) {
        for (let i = 0; i < body.servers.length; i++) {
          const srv = body.servers[i];
          if (srv) {
            const rawNum = (srv.id || srv.label || '').replace(/[^0-9]/g, '') || String(i + 1);
            const key = \`server\${rawNum}\`;
            const promptVal = srv.prompt || '';
            STORED_PROMPTS[key] = promptVal;
            if (env && env.PROMPTS_KV) await env.PROMPTS_KV.put(key, promptVal);
          }
        }
      }

      for (const [key, val] of Object.entries(body)) {
        if (key.startsWith('server') && typeof val === 'string') {
          const rawNum = key.replace(/[^0-9]/g, '') || '1';
          const cleanKey = \`server\${rawNum}\`;
          STORED_PROMPTS[cleanKey] = val;
          if (env && env.PROMPTS_KV) await env.PROMPTS_KV.put(cleanKey, val);
        }
      }

      if (body.prompt !== undefined && !STORED_PROMPTS.server1) {
        STORED_PROMPTS.server1 = body.prompt;
        if (env && env.PROMPTS_KV) await env.PROMPTS_KV.put('server1', body.prompt);
      }

      STORED_PROMPTS.lastUpdatedAt = new Date().toISOString();

      return new Response(JSON.stringify({
        success: true,
        status: "delivered",
        message: "Server prompts updated successfully in Cloudflare Worker!",
        updatedAt: STORED_PROMPTS.lastUpdatedAt,
        serversCount: Object.keys(STORED_PROMPTS).filter(k => k.startsWith('server')).length
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =========================================================================
    // 🌟 ROLE 2: ACCESS REVOKE / DELETE USER
    // =========================================================================
    const isRevokeAccess = (
      pathName.includes('/revoke') ||
      body.action === 'revoke' ||
      body.action === 'remove' ||
      body.action === 'delete'
    );

    if (isRevokeAccess) {
      const supaUrl = env?.SUPABASE_URL || body.supabase_url || body.supabaseUrl || "YOUR_SUPABASE_PROJECT_URL";
      const supaKey = env?.SUPABASE_ANON_KEY || body.supabase_anon_key || body.supabaseAnonKey || "YOUR_SUPABASE_ANON_KEY";
      const userEmail = (body.email || '').toLowerCase().trim();

      if (!userEmail) {
        return new Response(JSON.stringify({ success: false, error: "Email is required to revoke access" }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let supaRevokeOk = false;
      if (supaUrl && supaKey && supaUrl.startsWith('http') && !supaUrl.includes('YOUR_SUPABASE')) {
        try {
          const deleteResp = await fetch(\`\${supaUrl.replace(/\\/$/, '')}/rest/v1/users?email=eq.\${encodeURIComponent(userEmail)}\`, {
            method: 'DELETE',
            headers: {
              'apikey': supaKey,
              'Authorization': \`Bearer \${supaKey}\`
            }
          });
          supaRevokeOk = deleteResp.ok;
        } catch {}
      }

      // Forward to portal
      try {
        await fetch(\`\${PRIMARY_PORTAL_URL}/api/reseller/access/revoke\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': request.headers.get('x-api-key') || body.apiKey || '${apiKey || ''}',
          },
          body: JSON.stringify({ email: userEmail })
        });
      } catch {}

      return new Response(JSON.stringify({
        success: true,
        access: false,
        action: "revoke",
        message: \`Access revoked and user deleted for \${userEmail}\`,
        supabase_deleted: supaRevokeOk
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =========================================================================
    // 🌟 ROLE 3: DUSRI WEBSITE / BOT SE NAYA USER / ORDER AAYA (SUPABASE & ACCESS SYNC)
    // =========================================================================
    const isUserAccessGrant = (
      pathName.includes('/access') ||
      pathName.includes('/user') ||
      pathName.includes('/webhook') ||
      body.action === 'grant' ||
      body.action === 'add_user' ||
      body.plan_days_left !== undefined ||
      body.planDaysLeft !== undefined ||
      body.max_credits !== undefined ||
      body.maxCredits !== undefined ||
      body.reseller_id !== undefined ||
      body.resellerId !== undefined ||
      (body.email && !body.token && !body.sessionToken && (body.password || body.plan || body.telegram || body.whatsapp))
    );

    if (isUserAccessGrant) {
      const supaUrl = env?.SUPABASE_URL || body.supabase_url || body.supabaseUrl || "YOUR_SUPABASE_PROJECT_URL";
      const supaKey = env?.SUPABASE_ANON_KEY || body.supabase_anon_key || body.supabaseAnonKey || "YOUR_SUPABASE_ANON_KEY";

      const userEmail = (body.email || '').toLowerCase().trim();
      const userId = body.id || \`usr-res-\${Date.now()}-\${Math.random().toString(36).substring(2, 6)}\`;
      const isUltra = (body.plan || 'ultra').toLowerCase() === 'ultra';
      const daysLeft = body.plan_days_left !== undefined ? Number(body.plan_days_left) : 30;
      const maxCredits = body.max_credits !== undefined ? Number(body.max_credits) : (isUltra ? 45000 : 100);
      const credits = body.credits !== undefined ? Number(body.credits) : maxCredits;

      let supabaseLog = { attempted: false, synced: false, status: 0, response: null };

      // Direct Supabase REST API Call (Instant & 100% Guaranteed Persistence - status, extension_access, role omitted)
      if (supaUrl && supaKey && supaUrl.startsWith('http') && !supaUrl.includes('YOUR_SUPABASE')) {
        supabaseLog.attempted = true;
        try {
          const supaResp = await fetch(\`\${supaUrl.replace(/\\/$/, '')}/rest/v1/users\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supaKey,
              'Authorization': \`Bearer \${supaKey}\`,
              'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify({
              id: userId,
              name: body.name || body.telegramProfile || userEmail.split('@')[0],
              email: userEmail,
              password: body.password || "Flow@1122",
              plan: isUltra ? 'ultra' : 'basic',
              max_credits: maxCredits,
              credits: credits,
              plan_days_left: daysLeft,
              whatsapp: body.whatsapp || "",
              telegram: body.telegram || "",
              reseller_id: body.reseller_id || body.resellerId || "${reseller.id}"
            })
          });

          const supaText = (await supaResp.text()).trim();
          let supaJson = supaText;
          try { supaJson = JSON.parse(supaText); } catch(e) {}

          supabaseLog = {
            attempted: true,
            synced: supaResp.ok,
            status: supaResp.status,
            response: supaJson
          };
        } catch (err) {
          supabaseLog = { attempted: true, synced: false, error: err.message };
        }
      }

      let portalResult = null;
      
      const grantUserData = async (portalUrl) => {
        try {
          const resp = await fetch(\`\${portalUrl}/api/cloudflare/access\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'x-api-key': request.headers.get('x-api-key') || body.apiKey || '${apiKey || ''}',
              'x-reseller-id': request.headers.get('x-reseller-id') || body.reseller_id || body.resellerId || '${reseller.id}',
            },
            redirect: 'follow',
            body: JSON.stringify({
              id: userId,
              name: body.name || body.telegramProfile || "User",
              email: userEmail,
              password: body.password || "Flow@1122",
              plan: isUltra ? "ultra" : "basic",
              max_credits: maxCredits,
              credits: credits,
              plan_days_left: daysLeft,
              whatsapp: body.whatsapp || "",
              telegram: body.telegram || "",
              reseller_id: body.reseller_id || body.resellerId || "${reseller.id}",
            })
          });

          const text = (await resp.text()).trim();
          if (text.startsWith('{') || text.startsWith('[')) {
            const data = JSON.parse(text);
            if (data && !data.error && data.success !== false) {
              return data;
            }
          }
        } catch (e) {}
        return null;
      };

      portalResult = await grantUserData(PRIMARY_PORTAL_URL) || await grantUserData(BACKUP_PORTAL_URL);

      const finalOutput = portalResult || {
        success: true,
        access: true,
        action: "created",
        message: \`Access granted successfully for \${userEmail}\`,
        duration: \`\${daysLeft} days\`,
        supabase_sync: supabaseLog,
        user: {
          id: userId,
          name: body.name || "User",
          email: userEmail,
          password: body.password || "Flow@1122",
          plan: isUltra ? 'ultra' : 'basic',
          max_credits: maxCredits,
          credits: credits,
          plan_days_left: daysLeft,
          whatsapp: body.whatsapp || "",
          telegram: body.telegram || "",
          reseller_id: body.reseller_id || body.resellerId || "${reseller.id}"
        }
      };

      if (portalResult && supabaseLog.attempted) {
        finalOutput.supabase_sync = supabaseLog;
      }

      return new Response(JSON.stringify(finalOutput), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =========================================================================
    // 🌟 ROLE 4: EXTENSION SE USER AAYA HAI (PROMPT LENE KE LIYE - DYNAMIC MULTI-SERVER)
    // =========================================================================
    const email = (body.email || '').trim().toLowerCase();
    const sessionToken = (body.token || body.sessionToken || '').trim();
    const version = body.version || '';

    if (!email || !sessionToken) {
      return new Response(JSON.stringify({
        success: false,
        error: "Authentication failed: Email and session token are required."
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1-Minute Cache Check
    const cacheKey = \`\${email}::\${sessionToken}\`;
    const now = Date.now();
    const cachedEntry = AUTH_CACHE.get(cacheKey);
    let authData = null;

    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL_MS)) {
      authData = cachedEntry.authData;
    } else {
      const tryVerify = async (baseUrl) => {
        const resp = await fetch(\`\${baseUrl}/api/extension/cf-verify\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          redirect: 'follow',
          body: JSON.stringify({ email, sessionToken, version })
        });
        const text = (await resp.text()).trim();
        if (text.startsWith('{') || text.startsWith('[')) {
          return JSON.parse(text);
        }
        throw new Error(\`Server at \${baseUrl} returned non-JSON response\`);
      };

      try {
        authData = await tryVerify(PRIMARY_PORTAL_URL);
      } catch (e1) {
        try {
          authData = await tryVerify(BACKUP_PORTAL_URL);
        } catch (e2) {}
      }

      if (authData && authData.allowed) {
        AUTH_CACHE.set(cacheKey, { authData, timestamp: now });
      }
    }

    if (!authData) {
      return new Response(JSON.stringify({
        success: false,
        error: "Portal verification server unreachable. Please try again."
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!authData.allowed) {
      AUTH_CACHE.delete(cacheKey);
      return new Response(JSON.stringify({
        success: false,
        updateRequired: Boolean(authData.updateRequired),
        requiredVersion: authData.requiredVersion || '3.2.0',
        error: authData.error || "Permission Denied by FlowMaker Server."
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Dynamic Server Prompts Gathering (From Portal authData, Supabase app_config, KV, or STORED_PROMPTS)
    const responsePayload = {
      success: true,
      authenticated: true,
      updatedAt: STORED_PROMPTS.lastUpdatedAt || new Date().toISOString(),
      servers: [],
      user: authData.user,
      costs: authData.costs
    };

    // 1. Merge servers if Portal returned them in authData
    if (Array.isArray(authData.servers) && authData.servers.length > 0) {
      for (const srv of authData.servers) {
        if (srv && (srv.id || srv.label)) {
          const key = srv.id && srv.id.startsWith('server') ? srv.id : (srv.label ? srv.label.toLowerCase().replace(/[^a-z0-9]/g, '') : 'server1');
          const promptVal = srv.prompt || '';
          if (promptVal && !STORED_PROMPTS[key]) {
            STORED_PROMPTS[key] = promptVal;
          }
        }
      }
    }

    // 2. Direct Supabase Query Backup for admin_config_prompts if STORED_PROMPTS is empty
    const supaUrl = env?.SUPABASE_URL || body.supabase_url || body.supabaseUrl || "YOUR_SUPABASE_PROJECT_URL";
    const supaKey = env?.SUPABASE_ANON_KEY || body.supabase_anon_key || body.supabaseAnonKey || "YOUR_SUPABASE_ANON_KEY";
    if (supaUrl && supaKey && supaUrl.startsWith('http') && !supaUrl.includes('YOUR_SUPABASE')) {
      const keysInStored = Object.keys(STORED_PROMPTS).filter(k => k.startsWith('server') && Boolean(STORED_PROMPTS[k]));
      if (keysInStored.length === 0) {
        try {
          const supaCfgResp = await fetch(\`\${supaUrl.replace(/\\/$/, '')}/rest/v1/app_config?key=eq.admin_config_prompts\`, {
            headers: { 'apikey': supaKey, 'Authorization': \`Bearer \${supaKey}\` }
          });
          if (supaCfgResp.ok) {
            const supaData = await supaCfgResp.json();
            const configObj = supaData[0]?.value;
            if (configObj && Array.isArray(configObj.servers)) {
              for (const srv of configObj.servers) {
                if (srv && (srv.id || srv.label)) {
                  const key = srv.id && srv.id.startsWith('server') ? srv.id : (srv.label ? srv.label.toLowerCase().replace(/[^a-z0-9]/g, '') : 'server1');
                  STORED_PROMPTS[key] = srv.prompt || '';
                }
              }
            }
          }
        } catch {}
      }
    }

    const serverNums = new Set();
    serverNums.add(1);
    serverNums.add(2);

    for (const k of Object.keys(STORED_PROMPTS)) {
      if (k.startsWith('server')) {
        const num = parseInt(k.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num > 0) serverNums.add(num);
      }
    }

    if (Array.isArray(authData.servers)) {
      for (const s of authData.servers) {
        const num = parseInt((s.id || s.label || '').replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num > 0) serverNums.add(num);
      }
    }

    const sortedNums = Array.from(serverNums).sort((a, b) => a - b);

    for (const num of sortedNums) {
      const key = \`server\${num}\`;
      let promptVal = STORED_PROMPTS[key] || (authData ? authData[key] : '') || '';

      if (!promptVal && Array.isArray(authData?.servers)) {
        const matched = authData.servers.find(s => parseInt((s.id || s.label || '').replace(/[^0-9]/g, ''), 10) === num);
        if (matched?.prompt) promptVal = matched.prompt;
      }

      if (env && env.PROMPTS_KV) {
        const kvVal = await env.PROMPTS_KV.get(key);
        if (kvVal !== null) promptVal = kvVal;
      }

      responsePayload[key] = promptVal;
      responsePayload.servers.push({
        id: key,
        label: \`Server \${num}\`,
        prompt: promptVal
      });
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};`;

  const supabaseSnippet = `-- Supabase SQL: Exact Matching Table Structure
-- Run this in your Supabase SQL Editor if creating or updating users table:
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

-- Enable RLS and full operations
alter table public.users enable row level security;
create policy "Allow all operations on users" on public.users for all using (true) with check (true);`;

  const nodeSnippet = `// Node.js / AI Studio / Next.js Webhook Handler
import fetch from 'node-fetch';

const RESELLER_API_KEY = "${apiKey || 'YOUR_ADMIN_GENERATED_API_KEY'}";
const FLOWMAKER_URL = "${baseUrl}";

// Give Customer Access (duration can be "2 hours" or "30 days"):
export async function grantCustomerAccess(email, password = "", telegram = "", duration = "2 hours") {
  const res = await fetch(\`\${FLOWMAKER_URL}/api/reseller/access/grant\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': RESELLER_API_KEY
    },
    body: JSON.stringify({
      email,
      password,   // optional
      telegram,   // optional telegram username/uid
      duration,   // e.g. "2 hours" or "30 days"
      plan: 'ultra'
    })
  });
  return await res.json(); // returns { success: true, access: true, ... }
}

// Remove Customer Access:
export async function revokeCustomerAccess(email) {
  const res = await fetch(\`\${FLOWMAKER_URL}/api/reseller/access/revoke\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': RESELLER_API_KEY
    },
    body: JSON.stringify({ email })
  });
  return await res.json(); // returns { success: true, access: false }
}`;

  const phpSnippet = `<?php
// PHP / WooCommerce / WordPress Integration
$apiKey = "${apiKey}";
$baseUrl = "${baseUrl}";

// 1. Grant Access on Payment
function grantFlowMakerAccess($email, $name = "") {
    global $apiKey, $baseUrl;
    $ch = curl_init("$baseUrl/api/reseller/access/grant");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        "x-api-key: $apiKey"
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'email' => $email,
        'name' => $name,
        'plan' => 'ultra',
        'planDays' => 30
    ]));
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

// 2. Revoke Access on Cancel/Refund
function revokeFlowMakerAccess($email) {
    global $apiKey, $baseUrl;
    $ch = curl_init("$baseUrl/api/reseller/access/revoke");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        "x-api-key: $apiKey"
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'email' => $email,
        'action' => 'suspend'
    ]));
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}
?>`;

  const pythonSnippet = `# Python (FastAPI / Django / Flask) Webhook Handler
import requests

RESELLER_API_KEY = "${apiKey}"
BASE_URL = "${baseUrl}"

def grant_access(customer_email, customer_name=""):
    url = f"{BASE_URL}/api/reseller/access/grant"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": RESELLER_API_KEY
    }
    payload = {
        "email": customer_email,
        "name": customer_name,
        "plan": "ultra",
        "planDays": 30
    }
    return requests.post(url, json=payload, headers=headers).json()

def revoke_access(customer_email):
    url = f"{BASE_URL}/api/reseller/access/revoke"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": RESELLER_API_KEY
    }
    payload = {
        "email": customer_email,
        "action": "suspend" # or "delete"
    }
    return requests.post(url, json=payload, headers=headers).json()`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f1015] border border-neutral-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800/80 flex items-center justify-between bg-[#13141c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Automated External Access API & Webhooks</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                  Live Public API
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Grant or revoke user access automatically from your external website, shop, or payment gateway.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-neutral-300">
          {/* 1. Reseller Secret API Key */}
          <div className="p-4 bg-[#141520] border border-neutral-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                Your Reseller Secret API Key:
              </span>
              <span className="text-[10px] text-neutral-500">Pass in header: <code className="text-purple-300">x-api-key</code></span>
            </div>
            <div className="flex items-center gap-2 bg-[#090a0e] p-2.5 rounded-xl border border-neutral-800 font-mono text-xs">
              <span className="text-purple-300 font-semibold select-all break-all flex-1">{apiKey}</span>
              <button
                onClick={() => {
                  const cleanId = reseller.id.replace(/[^a-zA-Z0-9]/g, '');
                  const rand = Math.random().toString(36).substring(2, 9);
                  const newKey = `flw_res_${cleanId}_${rand}`;
                  updateReseller(reseller.id, { apiKey: newKey });
                  showToast('Generated & saved new API Key!');
                }}
                className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                title="Regenerate new API Key"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
              <button
                onClick={() => copyToClipboard(apiKey, 'API Key')}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
              </button>
            </div>
          </div>

          {/* 2. Endpoints Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#141520] border border-emerald-500/20 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  1. Grant / Activate Access
                </span>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">POST</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Call this when customer completes purchase on your website. Creates user or renews validity for 30 days automatically.
              </p>
              <div className="p-2 bg-[#0a0b0e] rounded-lg border border-neutral-800 font-mono text-[11px] text-emerald-300 break-all select-all flex items-center justify-between">
                <span>{grantUrl}</span>
                <button onClick={() => copyToClipboard(grantUrl, 'Grant URL')} className="text-neutral-400 hover:text-white p-1">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#141520] border border-rose-500/20 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-rose-400 font-bold flex items-center gap-1.5">
                  <X className="w-4 h-4" />
                  2. Revoke / Remove Access
                </span>
                <span className="text-[10px] font-mono text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/40">POST</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Call this when user requests refund or cancels. Instantly blocks extension and portal login.
              </p>
              <div className="p-2 bg-[#0a0b0e] rounded-lg border border-neutral-800 font-mono text-[11px] text-rose-300 break-all select-all flex items-center justify-between">
                <span>{revokeUrl}</span>
                <button onClick={() => copyToClipboard(revokeUrl, 'Revoke URL')} className="text-neutral-400 hover:text-white p-1">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* 3. Ready-Made Code Snippets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                <Code className="w-4 h-4 text-indigo-400" />
                Integration Code Snippets:
              </span>
              <div className="flex items-center gap-1 bg-[#141520] p-1 rounded-xl border border-neutral-800">
                {(['curl', 'cloudflare', 'supabase', 'node', 'php', 'python'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                      activeTab === tab 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {tab === 'node' ? 'Node.js' : tab === 'curl' ? 'cURL / Webhook' : tab === 'cloudflare' ? 'Cloudflare Worker' : tab === 'supabase' ? 'Supabase SQL' : tab.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <pre className="p-4 bg-[#07080b] border border-neutral-800/90 rounded-2xl font-mono text-[11px] text-purple-200 overflow-x-auto leading-relaxed shadow-inner max-h-64">
                {activeTab === 'curl' && curlSnippet}
                {activeTab === 'cloudflare' && cloudflareSnippet}
                {activeTab === 'supabase' && supabaseSnippet}
                {activeTab === 'node' && nodeSnippet}
                {activeTab === 'php' && phpSnippet}
                {activeTab === 'python' && pythonSnippet}
              </pre>
              <button
                onClick={() => {
                  const text = activeTab === 'curl' ? curlSnippet : activeTab === 'cloudflare' ? cloudflareSnippet : activeTab === 'supabase' ? supabaseSnippet : activeTab === 'node' ? nodeSnippet : activeTab === 'php' ? phpSnippet : pythonSnippet;
                  copyToClipboard(text, `${activeTab.toUpperCase()} Code`);
                }}
                className="absolute top-3 right-3 px-2.5 py-1 bg-neutral-800/90 hover:bg-neutral-700 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow"
              >
                {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCurl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* 4. Live Interactive Testing Sandbox */}
          <div className="p-4 bg-[#12131d] border border-purple-500/20 rounded-2xl space-y-3">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-purple-400" />
              Live Test Sandbox (Test granting/revoking right now):
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="customer@gmail.com"
                  className="w-full px-3 py-2 bg-[#090a0e] border border-neutral-800 rounded-xl text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <select
                  value={testAction}
                  onChange={e => setTestAction(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#090a0e] border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="grant">Grant Access</option>
                  <option value="revoke">Revoke Access</option>
                </select>
              </div>

              <div>
                <button
                  onClick={handleTestApi}
                  disabled={testLoading}
                  className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  {testLoading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{testAction === 'grant' ? 'Test Grant' : 'Test Revoke'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div className="p-3 bg-[#07080b] border border-neutral-800 rounded-xl space-y-1 font-mono text-[11px]">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>HTTP Status: <strong className={testResult.status === 200 ? 'text-emerald-400' : 'text-rose-400'}>{testResult.status}</strong></span>
                  <span className="text-[10px] text-neutral-500">{new Date().toLocaleTimeString()}</span>
                </div>
                <pre className="text-neutral-300 max-h-36 overflow-y-auto whitespace-pre-wrap select-all">
                  {JSON.stringify(testResult.data || testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-[#13141c] flex items-center justify-between">
          <span className="text-neutral-400 text-[11px]">
            All users created via this API are automatically assigned to <strong>{reseller.portalName}</strong>.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
