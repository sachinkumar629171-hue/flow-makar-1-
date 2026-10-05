import React, { useState } from 'react';
import { X, Key, Copy, Check, Terminal, Globe, Send, ShieldCheck, Code, Zap } from 'lucide-react';
import { Reseller } from '../../types';

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
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'curl' | 'node' | 'php' | 'python'>('curl');

  // Interactive Test State
  const [testEmail, setTestEmail] = useState('testuser@gmail.com');
  const [testDays, setTestDays] = useState(30);
  const [testAction, setTestAction] = useState<'grant' | 'revoke'>('grant');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const apiKey = reseller.apiKey || '';
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
        },
        body: JSON.stringify(payload),
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

  const curlSnippet = `# 1. Give Access (supports 30 days OR 2 hours duration, password & telegram optional):
curl -X POST "${grantUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey || 'YOUR_ADMIN_GENERATED_API_KEY'}" \\
  -d '{
    "email": "customer@gmail.com",
    "password": "customerPass123",
    "telegram": "@customer_tg",
    "duration": "2 hours"
  }'

# 2. Revoke / Remove Access (completely removes customer):
curl -X POST "${revokeUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey || 'YOUR_ADMIN_GENERATED_API_KEY'}" \\
  -d '{"email": "customer@gmail.com"}'`;

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
            {apiKey ? (
              <div className="flex items-center gap-2 bg-[#090a0e] p-2.5 rounded-xl border border-neutral-800 font-mono text-xs">
                <span className="text-purple-300 font-semibold select-all break-all flex-1">{apiKey}</span>
                <button
                  onClick={() => copyToClipboard(apiKey, 'API Key')}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-center gap-2">
                <span>⚠️ <strong>Admin Key Required:</strong> Only the Administrator can generate your API Key from the Admin Control Center. Please ask your Admin to generate your portal API key.</span>
              </div>
            )}
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
                {(['curl', 'node', 'php', 'python'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                      activeTab === tab 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {tab === 'node' ? 'Node.js' : tab === 'curl' ? 'cURL' : tab.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <pre className="p-4 bg-[#07080b] border border-neutral-800/90 rounded-2xl font-mono text-[11px] text-purple-200 overflow-x-auto leading-relaxed shadow-inner max-h-56">
                {activeTab === 'curl' && curlSnippet}
                {activeTab === 'node' && nodeSnippet}
                {activeTab === 'php' && phpSnippet}
                {activeTab === 'python' && pythonSnippet}
              </pre>
              <button
                onClick={() => {
                  const text = activeTab === 'curl' ? curlSnippet : activeTab === 'node' ? nodeSnippet : activeTab === 'php' ? phpSnippet : pythonSnippet;
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
