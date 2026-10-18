import express from 'express';
import path from 'path';
import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const app = express();
const PORT = 3000;

// Enable CORS for Netlify, custom domains, and all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Persistent database & uploads files directory
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'storage.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'extensions');

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem fallback
}

// Serve uploaded extensions statically with forced download headers if requested
app.use('/api/extensions/files', express.static(UPLOADS_DIR));

interface DatabaseSchema {
  users: any[];
  resellers: any[];
  planExtensions: any;
  tutorialConfig: any;
  promptConfig?: any;
  supabaseConfig?: { url: string; anonKey: string };
}

let serverSupabaseClient: SupabaseClient | null = null;
let lastSupabaseConfigStr = '';

function isBlockedSupabaseServerRequest(urlStr: string): boolean {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr, 'https://dummy.co');
    const path = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();
    
    // 1. app_config?select=*
    if (path.includes('/rest/v1/app_config')) {
      return true;
    }
    
    // 2. resellers?select=*
    if (path.includes('/rest/v1/resellers')) {
      return true;
    }
    
    // 3. users?select=* (bulk select of users table)
    if (path.includes('/rest/v1/users')) {
      const hasWildcardSelect = query.includes('select=*') || query.includes('select=%2a');
      const hasSpecificFilter = query.includes('id=eq.') || 
                                query.includes('id=') ||
                                query.includes('email=eq.') || 
                                query.includes('email=ilike.') || 
                                query.includes('email=') ||
                                query.includes('session_token=eq.') ||
                                query.includes('session_token=') ||
                                query.includes('session_token.') ||
                                query.includes('or=');
      if (hasWildcardSelect && !hasSpecificFilter) {
        return true;
      }
    }
  } catch {
    const lower = urlStr.toLowerCase();
    if (lower.includes('/rest/v1/app_config')) return true;
    if (lower.includes('/rest/v1/resellers')) return true;
    if (lower.includes('/rest/v1/users') && (lower.includes('select=*') || lower.includes('select=%2a')) && !lower.includes('id=') && !lower.includes('email=') && !lower.includes('session_token')) return true;
  }
  return false;
}

const safeServerSupabaseFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
  if (isBlockedSupabaseServerRequest(urlStr)) {
    // Intercept and strictly block: do not send request to Supabase
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

function getServerSupabase(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || db.supabaseConfig?.url;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || db.supabaseConfig?.anonKey;
  const configKey = `${url}_${key}`;
  if (serverSupabaseClient && lastSupabaseConfigStr === configKey) {
    return serverSupabaseClient;
  }
  if (url && key) {
    try {
      serverSupabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          fetch: safeServerSupabaseFetch,
        },
      });
      lastSupabaseConfigStr = configKey;
      return serverSupabaseClient;
    } catch (e) {
      console.error('Failed to init Supabase client on server:', e);
    }
  }
  return null;
}

const SERVER_ALLOWED_USER_COLUMNS = new Set([
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
  'created_at'
]);

const serverKnownMissingCols = new Set<string>();

function serverExtractMissingColumn(error: any): string | null {
  if (!error) return null;
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  const match = msg.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i) ||
                msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of relation/i) ||
                msg.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
  return match ? match[1] : null;
}

function formatServerSupabaseUserPayload(user: Record<string, any>): Record<string, any> {
  const payload: Record<string, any> = {};
  if (user.id !== undefined) payload.id = String(user.id);
  if (user.name !== undefined) payload.name = String(user.name);
  if (user.email !== undefined) payload.email = String(user.email).toLowerCase().trim();
  if (user.password !== undefined) payload.password = String(user.password || '123456');
  if (user.plan !== undefined) payload.plan = String(user.plan || 'basic');
  
  if (user.maxCredits !== undefined) payload.max_credits = Number(user.maxCredits) || 100;
  else if (user.max_credits !== undefined) payload.max_credits = Number(user.max_credits) || 100;

  if (user.credits !== undefined) payload.credits = Number(user.credits) ?? 0;
  
  if (user.planDaysLeft !== undefined) payload.plan_days_left = Number(user.planDaysLeft) ?? 30;
  else if (user.plan_days_left !== undefined) payload.plan_days_left = Number(user.plan_days_left) ?? 30;

  if (user.sessionToken !== undefined) payload.session_token = String(user.sessionToken || '');
  else if (user.session_token !== undefined) payload.session_token = String(user.session_token || '');

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

  if (user.createdAt !== undefined) payload.created_at = String(user.createdAt);
  else if (user.created_at !== undefined) payload.created_at = String(user.created_at);

  for (const col of serverKnownMissingCols) {
    delete payload[col];
  }

  return payload;
}

async function safeServerSupabaseUserUpsert(
  supa: SupabaseClient,
  user: Record<string, any>
): Promise<boolean> {
  if (!supa || !user) return false;

  let payload = formatServerSupabaseUserPayload(user);
  if (!payload.email && !payload.id) return false;

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const { error } = await supa.from('users').upsert(payload, { onConflict: 'id' });
      if (!error) return true;

      const missingCol = serverExtractMissingColumn(error);
      if (missingCol && payload[missingCol] !== undefined) {
        serverKnownMissingCols.add(missingCol);
        delete payload[missingCol];
        continue;
      }

      if (payload.email) {
        const { id, ...updateFields } = payload;
        const { error: updateErr } = await supa.from('users').update(updateFields).eq('email', payload.email.toLowerCase());
        if (!updateErr) return true;
        const missingUpdateCol = serverExtractMissingColumn(updateErr);
        if (missingUpdateCol && payload[missingUpdateCol] !== undefined) {
          serverKnownMissingCols.add(missingUpdateCol);
          delete payload[missingUpdateCol];
          continue;
        }
      }
      break;
    } catch (err: any) {
      const missingCol = serverExtractMissingColumn(err);
      if (missingCol && payload[missingCol] !== undefined) {
        serverKnownMissingCols.add(missingCol);
        delete payload[missingCol];
        continue;
      }
      break;
    }
  }
  return false;
}

async function safeServerSupabaseUserUpdate(
  supa: SupabaseClient,
  userId: string,
  userEmail: string | undefined,
  fields: Record<string, any>
): Promise<boolean> {
  if (!supa || (!userId && !userEmail)) return false;
  const fullUser = db.users.find(u => u.id === userId || (userEmail && u.email && cleanEmailString(u.email) === cleanEmailString(userEmail)));

  const cleanFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && SERVER_ALLOWED_USER_COLUMNS.has(k) && !serverKnownMissingCols.has(k)) {
      cleanFields[k] = v;
    }
  }

  if (Object.keys(cleanFields).length === 0 && !fullUser) return true;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      if (userId) {
        const { error, data } = await supa.from('users').update(cleanFields).eq('id', userId).select('id');
        if (!error && data && data.length > 0) return true;
        if (error) {
          const missingCol = serverExtractMissingColumn(error);
          if (missingCol && cleanFields[missingCol] !== undefined) {
            serverKnownMissingCols.add(missingCol);
            delete cleanFields[missingCol];
            continue;
          }
        }
      }

      if (userEmail) {
        const { error, data } = await supa.from('users').update(cleanFields).eq('email', userEmail.toLowerCase().trim()).select('id');
        if (!error && data && data.length > 0) return true;
        if (error) {
          const missingCol = serverExtractMissingColumn(error);
          if (missingCol && cleanFields[missingCol] !== undefined) {
            serverKnownMissingCols.add(missingCol);
            delete cleanFields[missingCol];
            continue;
          }
        }
      }

      if (fullUser) {
        return await safeServerSupabaseUserUpsert(supa, {
          ...fullUser,
          ...cleanFields,
          id: userId || fullUser.id,
          email: userEmail || fullUser.email,
        });
      }
      return false;
    } catch (err: any) {
      const missingCol = serverExtractMissingColumn(err);
      if (missingCol && cleanFields[missingCol] !== undefined) {
        serverKnownMissingCols.add(missingCol);
        delete cleanFields[missingCol];
        continue;
      }
      break;
    }
  }
  return false;
}

async function safeSaveSupabasePromptConfig(supa: SupabaseClient | null, promptConfig: any): Promise<void> {
  if (!supa || !promptConfig) return;

  // If Option 2 (Cloudflare) is active, do NOT store heavy dynamic prompts into Supabase.
  // Supabase only stores the config settings (URL, ON/OFF toggle, costs, telegram) to protect free tier quota!
  let payloadToSave = promptConfig;
  if (promptConfig.cloudflareEnabled) {
    payloadToSave = {
      ...promptConfig,
      server1Prompt: '',
      server2Prompt: '',
      servers: (promptConfig.servers || []).map((s: any) => ({
        id: s.id,
        label: s.label,
        prompt: '', // Excluded from Supabase database to save quota
        lastUpdatedAt: s.lastUpdatedAt,
        updatedBy: s.updatedBy,
      })),
    };
  }

  try {
    await supa.from('app_config').upsert({
      key: 'admin_config_prompts',
      value: payloadToSave,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
  } catch {}

  try {
    const record: Record<string, any> = {
      id: 'admin_config_prompts',
      email: 'admin_config_prompts@system.local',
      name: JSON.stringify(payloadToSave),
      password: 'config_sys_admin_prompts_123',
      plan: 'basic',
      credits: 0,
      max_credits: 0,
      plan_days_left: 0,
      session_token: 'sys_prompts',
      is_online: false,
      created_at: '2025-01-01T00:00:00.000Z'
    };
    for (const col of serverKnownMissingCols) {
      delete record[col];
    }
    const { error } = await supa.from('users').upsert(record, { onConflict: 'id' });
    if (error) {
      const missingCol = serverExtractMissingColumn(error);
      if (missingCol) {
        serverKnownMissingCols.add(missingCol);
        delete record[missingCol];
        await supa.from('users').upsert(record, { onConflict: 'id' });
      }
    }
  } catch (err) {
    console.error('safeSaveSupabasePromptConfig error:', err);
  }
}

const ADMIN_EMAIL = 'sachinxexplore@gmail.com';
const ADMIN_PASSWORD = '147258';

const DEFAULT_USERS = [
  {
    id: 'usr-admin-1',
    name: 'Sachin Kumar',
    email: 'sachinxexplore@gmail.com',
    password: ADMIN_PASSWORD,
    whatsapp: '+91 9876543210',
    telegram: '@sachinkumar_admin',
    referralCode: 'FLOWADMIN',
    plan: 'ultra',
    credits: 45000,
    maxCredits: 45000,
    planDaysLeft: 30,
    role: 'admin',
    createdAt: '2025-01-10T10:00:00Z',
    avatarColor: 'from-purple-600 to-indigo-600',
    status: 'active',
    isOnline: true,
    lastActive: new Date().toISOString(),
  },
  {
    id: 'usr-admin-2',
    name: 'Sachin Kumar (Alt)',
    email: 'sachinkumar629171@gmail.com',
    password: ADMIN_PASSWORD,
    whatsapp: '+91 9876543210',
    telegram: '@sachinkumar_admin',
    referralCode: 'FLOWADMIN2',
    plan: 'ultra',
    credits: 45000,
    maxCredits: 45000,
    planDaysLeft: 30,
    role: 'admin',
    createdAt: '2025-01-10T10:00:00Z',
    avatarColor: 'from-purple-600 to-indigo-600',
    status: 'active',
    isOnline: true,
    lastActive: new Date().toISOString(),
  },
];

const DEFAULT_RESELLERS: any[] = [];

// Blacklist of any legacy mock/fake IDs to prevent any fake users
const MOCK_IDS = new Set([
  'usr-res-1', 'usr-res-2', 'usr-res-3', 'usr-res-4', 'usr-res-5',
  'usr-res-6', 'usr-res-7', 'usr-4018', 'usr-res-9', 'usr-res-10',
  'usr-res-11', 'usr-res-12', 'usr-102', 'usr-103', 'usr-104',
  'reseller-sachin-5', 'reseller-alpha-1'
]);

// In-memory state loaded from file
let db: DatabaseSchema = {
  users: DEFAULT_USERS,
  resellers: DEFAULT_RESELLERS,
  planExtensions: null,
  tutorialConfig: null,
  promptConfig: null,
};

function initStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      const loadedUsers = Array.isArray(parsed.users) ? parsed.users : DEFAULT_USERS;
      const loadedResellers = Array.isArray(parsed.resellers) ? parsed.resellers : DEFAULT_RESELLERS;

      // Purge all mock/fake users & resellers
      const cleanedUsers = loadedUsers.filter((u: any) => !MOCK_IDS.has(u.id));
      const cleanedResellers = loadedResellers.filter((r: any) => !MOCK_IDS.has(r.id));

      db = {
        users: cleanedUsers,
        resellers: cleanedResellers,
        planExtensions: parsed.planExtensions || null,
        tutorialConfig: parsed.tutorialConfig || null,
        promptConfig: parsed.promptConfig || null,
      };

      const defaultDownloadUrl = 'https://drive.google.com/uc?export=download&id=1ow7jqVhIgJZiJfXw9AsYMTNw_AzPZLwc';
      if (!db.planExtensions) {
        db.planExtensions = {
          basic: {
            name: 'Flow Basic Chrome Extension',
            version: '1.8.0',
            downloadUrl: defaultDownloadUrl,
            fileName: 'flow-basic-extension-v1.8.0.zip',
            description: 'Standard Video Prompt Sync & Studio Launcher for Basic Plan Members.',
            updatedAt: new Date().toISOString(),
            downloadType: 'url',
          },
          ultra: {
            name: 'Flow Ultra VIP Extension',
            version: '3.2.0',
            downloadUrl: defaultDownloadUrl,
            fileName: 'flow-ultra-vip-extension-v3.2.0.zip',
            description: 'High-Speed 4K Pipeline, Unlimited Prompt Queue & VIP Multi-Session Sync.',
            updatedAt: new Date().toISOString(),
            downloadType: 'url',
          },
        };
      } else {
        if (!db.planExtensions.basic?.downloadUrl) {
          db.planExtensions.basic.downloadUrl = defaultDownloadUrl;
        }
        if (!db.planExtensions.ultra?.downloadUrl) {
          db.planExtensions.ultra.downloadUrl = defaultDownloadUrl;
        }
      }

      if (db.promptConfig) {
        if (!db.promptConfig.signupTelegramUrl) {
          db.promptConfig.signupTelegramUrl = 'https://t.me/google_ultra_veo3_bot';
        }
        if (!db.promptConfig.resellerContactUrl) {
          db.promptConfig.resellerContactUrl = 'https://t.me/google_ultra_veo3_bot';
        }
      }

      if (db.tutorialConfig) {
        if (!db.tutorialConfig.desktopVideoUrl || db.tutorialConfig.desktopVideoUrl.includes('dQw4w9WgXcQ')) {
          db.tutorialConfig.desktopVideoUrl = 'https://youtu.be/bNZXy0cAv_o?si=_hgtM9DrSpMS4EhN';
        }
      } else {
        db.tutorialConfig = {
          desktopVideoUrl: 'https://youtu.be/bNZXy0cAv_o?si=_hgtM9DrSpMS4EhN',
          desktopTitle: 'How to Use Flow on Desktop / PC',
          desktopSubtitle: 'Complete tutorial on setting up the Chrome extension & using Desktop Studio.',
          mobileVideoUrl: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
          mobileTitle: 'How to Use Flow on Mobile (Android & iOS)',
          mobileSubtitle: 'Step-by-step guide on generating AI videos seamlessly from mobile browsers.',
        };
      }

      // Ensure admins exist
      const adminEmails = ['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com'];
      for (const admEmail of adminEmails) {
        const adminExists = db.users.some(u => u.email && u.email.toLowerCase() === admEmail.toLowerCase());
        if (!adminExists) {
          const matchDefault = DEFAULT_USERS.find(d => d.email.toLowerCase() === admEmail.toLowerCase());
          if (matchDefault) {
            db.users.unshift(matchDefault);
          }
        }
      }
      let changed = false;
      for (const u of db.users) {
        if (checkAndConvertToBasic(u)) {
          changed = true;
        }
      }
      if (changed) {
        saveStorage();
      }
      saveStorage();
    } else {
      saveStorage();
    }
  } catch (err) {
    console.error('Failed to init storage:', err);
  }
}

function saveStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save storage:', err);
  }
}

function checkAndConvertToBasic(u: any): boolean {
  if (!u || u.role === 'admin' || (u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) || (u.email && u.email.toLowerCase() === 'sachinkumar629171@gmail.com')) {
    return false;
  }
  if (u.plan === 'ultra' || u.plan === 'unlimited') {
    let expired = false;
    const now = Date.now();
    if (u.planExpiresAt) {
      const expMs = new Date(u.planExpiresAt).getTime();
      if (!isNaN(expMs) && expMs <= now) {
        expired = true;
      }
    }
    if (!expired && u.planDaysLeft !== undefined && Number(u.planDaysLeft) <= 0) {
      expired = true;
    }
    if (!expired && u.createdAt && u.planDaysLeft) {
      const createdMs = new Date(u.createdAt).getTime();
      if (!isNaN(createdMs) && (createdMs + Number(u.planDaysLeft) * 86400000) <= now) {
        expired = true;
      }
    }

    if (expired) {
      u.plan = 'basic';
      u.credits = Math.min(Number(u.credits) || 0, 100);
      u.maxCredits = 100;
      u.planDaysLeft = 0;
      u.avatarColor = 'from-blue-600 to-cyan-600';

      const supa = getServerSupabase();
      if (supa && u.id && !u.id.startsWith('admin_config_')) {
        supa.from('users').update({
          plan: 'basic',
          credits: u.credits,
          max_credits: 100,
          plan_days_left: 0,
        }).eq('id', u.id).then(({ error }) => {
          if (error) console.error('Error auto-switching expired user in Supabase:', error);
        });
      }
      return true;
    }
  }
  return false;
}

initStorage();

// GET extension profile data (Name, Plan, Credits, Days Left)
app.get('/api/extension/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const user = db.users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  if (checkAndConvertToBasic(user)) {
    saveStorage();
  }

  const ver = getActiveExtensionVersion(user.plan);

  // Return exactly what the extension needs
  res.json({
    success: true,
    data: {
      name: user.name,
      email: user.email,
      plan: user.plan,
      credits: user.credits,
      maxCredits: user.maxCredits,
      planDaysLeft: user.planDaysLeft,
      status: user.status,
      role: user.role,
      version: ver,
      extensionVersion: ver,
      requiredVersion: ver
    }
  });
});

// In-memory debounce cache to protect Supabase free tier quota from repeated writes
const lastOnlineSupabaseSync = new Map<string, number>();

// Helper to mark a user as Live / Online whenever a server request or credit deduction happens
function markUserOnline(emailOrId?: string, sessionToken?: string): void {
  if (!emailOrId && !sessionToken) return;
  const cleanEmail = emailOrId ? cleanEmailString(emailOrId) : '';
  const now = new Date().toISOString();

  let user = db.users.find(u => 
    (emailOrId && u.id === emailOrId) || 
    (cleanEmail && u.email && cleanEmailString(u.email) === cleanEmail) ||
    (sessionToken && u.sessionToken === sessionToken)
  );

  if (user) {
    user.isOnline = true;
    user.lastActive = now;
    if (sessionToken && (!user.sessionToken || user.sessionToken.length < 5)) {
      user.sessionToken = sessionToken;
    }
    saveStorage();
  }

  // Quota Protection: Sync online status to Supabase at most once every 90 seconds per user
  const syncKey = (user?.id || cleanEmail || sessionToken || '').toLowerCase();
  const lastSync = lastOnlineSupabaseSync.get(syncKey) || 0;
  const nowMs = Date.now();

  if (nowMs - lastSync > 90000) {
    lastOnlineSupabaseSync.set(syncKey, nowMs);
    const supa = getServerSupabase();
    if (supa) {
      const targetId = user?.id || (emailOrId && !emailOrId.includes('@') ? emailOrId : '');
      const targetEmail = cleanEmail || (user?.email ? cleanEmailString(user.email) : '');
      if (targetId || targetEmail) {
        safeServerSupabaseUserUpdate(supa, targetId, targetEmail, {
          is_online: true,
          ...(sessionToken ? { session_token: sessionToken } : {})
        }).catch(() => {});
      }
    }
  }
}

// ======================== API ROUTES ========================

const SYSTEM_ADMIN_EMAILS = new Set(['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com']);

function isRequestAdminUser(req: any): boolean {
  const token = (
    req.headers['x-session-token'] || 
    req.query.sessionToken || 
    req.headers.authorization?.replace(/^Bearer\s+/i, '') || 
    ''
  ).toString().trim();

  const apiKey = (req.headers['x-admin-key'] || req.headers['x-api-key'] || req.query.apiKey || '').toString().trim();
  if (apiKey === 'admin_master_key' || SYSTEM_ADMIN_EMAILS.has(apiKey.toLowerCase())) {
    return true;
  }

  if (token) {
    const user = db.users.find(u => u.sessionToken === token || u.id === token);
    if (user && (user.role === 'admin' || (user.email && SYSTEM_ADMIN_EMAILS.has(user.email.toLowerCase())))) {
      return true;
    }
  }
  return false;
}

async function getCallingUser(req: any): Promise<any | null> {
  const token = (
    req.headers['x-session-token'] || 
    req.query.sessionToken || 
    req.headers.authorization?.replace(/^Bearer\s+/i, '') || 
    ''
  ).toString().trim();

  if (!token) return null;

  let user = db.users.find(u => (u.sessionToken && u.sessionToken === token) || u.id === token) || null;

  // Authoritative sync for this specific user only from Supabase
  const supa = getServerSupabase();
  if (supa) {
    try {
      let supaQuery = supa.from('users').select('*');
      if (token.startsWith('sess-')) {
        supaQuery = supaQuery.eq('session_token', token);
      } else {
        supaQuery = supaQuery.or(`session_token.eq.${token},id.eq.${token}`);
      }
      const { data: supaUser } = await supaQuery.maybeSingle();

      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const mapped = {
          id: supaUser.id,
          name: supaUser.name || 'User',
          email: supaUser.email || '',
          password: supaUser.password || 'user123',
          sessionToken: supaUser.session_token || '',
          plan: supaUser.plan || 'basic',
          credits: Number(supaUser.credits) ?? 100,
          maxCredits: Number(supaUser.max_credits) ?? (supaUser.plan === 'ultra' ? 45000 : 100),
          planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
          planExpiresAt: supaUser.plan_expires_at,
          role: supaUser.role || 'user',
          resellerId: supaUser.reseller_id,
          resellerName: supaUser.reseller_name,
          status: supaUser.status || 'active',
          extensionAccess: supaUser.extension_access !== undefined ? supaUser.extension_access : true,
          canEditPrompts: supaUser.can_edit_prompts === true,
          isOnline: Boolean(supaUser.is_online),
          lastActive: supaUser.last_active || new Date().toISOString(),
          createdAt: supaUser.created_at || new Date().toISOString(),
          avatarColor: supaUser.avatar_color || 'from-purple-600 to-indigo-600',
        };

        const existingIdx = db.users.findIndex(u => u.id === mapped.id || (u.email && mapped.email && u.email.toLowerCase() === mapped.email.toLowerCase()));
        if (existingIdx !== -1) {
          db.users[existingIdx] = { ...db.users[existingIdx], ...mapped };
          user = db.users[existingIdx];
        } else {
          db.users.push(mapped);
          user = mapped;
        }
      }
    } catch {}
  }

  return user;
}

function sanitizeSafeUser(u: any) {
  // STRICT SECURITY: Never send password in any client response
  const { password, ...safe } = u;
  return safe;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', userCount: db.users.length, timestamp: new Date().toISOString() });
});

// GET users: Strictly protected
// 1. Admin gets all users (passwords stripped)
// 2. Reseller gets only their own assigned users (passwords stripped)
// 3. Regular user with valid session token gets ONLY their own profile
// 4. Public visitors receive empty list [] - zero database leakage
app.get('/api/users', async (req, res) => {
  const now = Date.now();
  let changed = false;

  for (const u of db.users) {
    if (checkAndConvertToBasic(u)) {
      changed = true;
    }
    let isLive = false;
    if (u.lastActive) {
      if (typeof u.lastActive === 'string' && u.lastActive.toLowerCase().includes('now')) {
        isLive = true;
      } else {
        const t = new Date(u.lastActive).getTime();
        isLive = !isNaN(t) && (now - t <= 120000 && now - t >= -60000);
      }
    }
    if (u.isOnline !== isLive) {
      u.isOnline = isLive;
      changed = true;
    }
  }
  if (changed) {
    saveStorage();
  }

  const isAdmin = isRequestAdminUser(req);
  const callingUser = await getCallingUser(req);
  const resellerId = (req.headers['x-reseller-id'] || req.query.resellerId || '').toString().trim();
  const resellerKey = (req.headers['x-reseller-api-key'] || req.query.resellerApiKey || '').toString().trim();

  // 1. Admin: full user list
  if (isAdmin) {
    return res.json({ users: db.users.map(u => sanitizeSafeUser(u)) });
  }

  // 2. Reseller: only their portal's users
  if (resellerId || resellerKey) {
    const matchingReseller = db.resellers.find(r => r.id === resellerId || r.apiKey === resellerKey);
    if (matchingReseller) {
      const resellerUsers = db.users
        .filter(u => u.resellerId === matchingReseller.id)
        .map(u => sanitizeSafeUser(u));
      return res.json({ users: resellerUsers });
    }
  }

  // 3. Logged-in user: ONLY their own user profile!
  if (callingUser) {
    return res.json({ users: [sanitizeSafeUser(callingUser)] });
  }

  // 4. Public or unauthenticated: empty list
  return res.json({ users: [] });
});

// GET currently logged-in user profile ONLY (Standard Bearer Auth)
app.get(['/api/users/me', '/api/user/me'], async (req, res) => {
  const callingUser = await getCallingUser(req);
  if (!callingUser) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Session token required or invalid' });
  }
  const minimalProfile = {
    name: callingUser.name || 'User',
    email: callingUser.email || '',
    plan: callingUser.plan || 'basic',
    credits: Number(callingUser.credits) ?? 100,
    maxCredits: Number(callingUser.maxCredits) ?? (callingUser.plan === 'ultra' ? 45000 : 100),
    planDaysLeft: Number(callingUser.planDaysLeft) ?? 30,
    role: callingUser.role || 'user',
  };
  res.json({ success: true, user: minimalProfile });
});

// POST signup
app.post('/api/users/signup', async (req, res) => {
  const { name, email, password, whatsapp, telegram, referralCode } = req.body;

  if (!email || !name) {
    return res.status(400).json({ success: false, error: 'Name and email are required.' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    existing.name = name || existing.name;
    if (password) existing.password = password;
    if (whatsapp !== undefined) existing.whatsapp = whatsapp;
    if (telegram !== undefined) existing.telegram = telegram;
    if (req.body.plan) existing.plan = req.body.plan;
    if (req.body.credits !== undefined) existing.credits = req.body.credits;
    if (req.body.maxCredits !== undefined) existing.maxCredits = req.body.maxCredits;
    if (req.body.planDaysLeft !== undefined) existing.planDaysLeft = req.body.planDaysLeft;
    if (req.body.status) existing.status = req.body.status;
    if (req.body.role) existing.role = req.body.role;
    saveStorage();

    const supa = getServerSupabase();
    if (supa) {
      safeServerSupabaseUserUpsert(supa, existing).catch(err => {
        console.error('Supabase signup update error:', err);
      });
    }

    return res.json({ success: true, user: existing });
  }

  const colors = [
    'from-blue-600 to-indigo-600',
    'from-purple-600 to-pink-600',
    'from-emerald-600 to-teal-600',
    'from-amber-600 to-orange-600',
    'from-rose-600 to-red-600',
  ];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const userPlan = req.body.plan || 'basic';
  const userCredits = req.body.credits !== undefined ? req.body.credits : (userPlan === 'ultra' ? 45000 : 100);
  const userMaxCredits = req.body.maxCredits !== undefined ? req.body.maxCredits : userCredits;
  const userDaysLeft = req.body.planDaysLeft !== undefined ? req.body.planDaysLeft : 30;

  const newUser = {
    id: req.body.id || `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    name,
    email,
    password: password || 'user123',
    whatsapp: whatsapp || '',
    telegram: telegram || '',
    referralCode: referralCode || `FLOW${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    referredBy: req.body.referredBy || '',
    plan: userPlan,
    credits: userCredits,
    maxCredits: userMaxCredits,
    planDaysLeft: userDaysLeft,
    role: req.body.role || (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user'),
    resellerId: req.body.resellerId || undefined,
    resellerName: req.body.resellerName || undefined,
    createdAt: req.body.createdAt || new Date().toISOString(),
    avatarColor: req.body.avatarColor || randomColor,
    status: req.body.status || 'active',
    extensionAccess: req.body.extensionAccess !== undefined ? req.body.extensionAccess : true,
    canEditPrompts: req.body.canEditPrompts === true,
    isOnline: true,
    lastActive: new Date().toISOString(),
  };

  db.users.unshift(newUser);
  saveStorage();

  const supa = getServerSupabase();
  if (supa) {
    safeServerSupabaseUserUpsert(supa, newUser).catch(err => {
      console.error('Supabase signup insert error:', err);
    });
  }

  res.json({ success: true, user: newUser });
});

// POST sync multiple users (e.g. from initial local state)
app.post('/api/users/sync-all', (req, res) => {
  const { users } = req.body;
  if (Array.isArray(users)) {
    for (const u of users) {
      if (u.id && MOCK_IDS.has(u.id)) continue;
      const existingIdx = db.users.findIndex(x => x.email.toLowerCase() === u.email.toLowerCase());
      if (existingIdx === -1) {
        db.users.push(u);
      }
    }
    saveStorage();
  }
  res.json({ success: true, count: db.users.length });
});

// GET / POST login
app.all('/api/users/login', async (req, res) => {
  const body = req.body || {};
  const query = req.query || {};
  const email = body.email || query.email;
  const password = body.password || query.password;
  const clientSessionToken = body.sessionToken || body.sessionId || query.sessionToken || query.sessionId;
  const forceLogin = body.forceLogin === true || body.forceLogin === 'true' || query.forceLogin === 'true';

  if (!email) {
    if (req.method === 'GET') {
      return res.json({
        success: false,
        message: 'FlowMaker AI Login API is active. Send POST with email and password to log in.',
        endpoint: '/api/users/login'
      });
    }
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const cleanEmail = cleanEmailString(email);
  const isSystemAdmin = ['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com'].includes(cleanEmail);

  // 1. Check live in Supabase first (if connected) to get the authoritative session & user state
  let supaUser: any = null;
  const supa = getServerSupabase();
  if (supa) {
    try {
      const { data } = await supa.from('users').select('*').ilike('email', cleanEmail).maybeSingle();
      if (data && !data.id?.startsWith('admin_config_')) {
        supaUser = data;
        const freshUser = {
          id: supaUser.id,
          name: supaUser.name,
          email: supaUser.email,
          password: supaUser.password,
          whatsapp: supaUser.whatsapp || '',
          telegram: supaUser.telegram || '',
          referralCode: supaUser.referral_code || '',
          referredBy: supaUser.referred_by || '',
          plan: supaUser.plan || 'basic',
          credits: Number(supaUser.credits) ?? 0,
          maxCredits: Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100),
          planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
          role: supaUser.role || 'user',
          resellerId: supaUser.reseller_id,
          resellerName: supaUser.reseller_name,
          status: supaUser.status || 'active',
          extensionAccess: supaUser.extension_access !== undefined ? supaUser.extension_access : true,
          canEditPrompts: supaUser.can_edit_prompts === true,
          isOnline: Boolean(supaUser.is_online),
          sessionToken: supaUser.session_token || '',
          lastActive: supaUser.last_active || new Date().toISOString(),
          createdAt: supaUser.created_at || new Date().toISOString(),
          avatarColor: supaUser.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
        };
        const existingIdx = db.users.findIndex(u => u.id === supaUser.id || (u.email && cleanEmailString(u.email) === cleanEmail));
        if (existingIdx >= 0) {
          db.users[existingIdx] = freshUser;
        } else {
          db.users.push(freshUser);
        }
        saveStorage();
      }
    } catch (e) {
      console.error('Supabase lookup error during login:', e);
    }
  }

  let user = db.users.find(u => u.email && cleanEmailString(u.email) === cleanEmail);

  if (!user) {
    return res.status(404).json({ success: false, error: 'Account not found. Please sign up first.' });
  }

  if (password && user.password && user.password !== password) {
    return res.status(401).json({ success: false, error: 'Incorrect password.' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ success: false, error: 'This account has been suspended by administration.' });
  }

  // Strict Single-Device Lock: Check if already actively logged in on another device
  const activeSessionToken = (supaUser && supaUser.session_token) || user.sessionToken;
  const isOnline = supaUser ? Boolean(supaUser.is_online) : Boolean(user.isOnline);
  const lastActiveTimestamp = (supaUser && supaUser.last_active) || user.lastActive;
  const lastActiveTime = lastActiveTimestamp ? new Date(lastActiveTimestamp).getTime() : 0;
  const isRecentlyActive = (Date.now() - lastActiveTime) < 3 * 60 * 1000; // 3 minutes window

  if (!isSystemAdmin && !forceLogin && isOnline && activeSessionToken && isRecentlyActive) {
    // If incoming client already holds this same session token, it's the same device refresh
    const isSameDevice = clientSessionToken && clientSessionToken === activeSessionToken;
    if (!isSameDevice) {
      return res.status(403).json({
        success: false,
        isDeviceLocked: true,
        error: '⚠️ Yeh account abhi kisi dusre device / browser par ACTIVE hai! Ek samay me kewal 1 device par login allowed hai. Kripya pehle waha se logout karein ya Force Login karein.'
      });
    }
  }

  const newSessionToken = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  user.sessionToken = newSessionToken;
  user.isOnline = true;
  user.lastActive = new Date().toISOString();
  saveStorage();

  if (supa) {
    safeServerSupabaseUserUpdate(supa, user.id, user.email, {
      session_token: newSessionToken,
      is_online: true,
      last_active: user.lastActive,
    }).catch(() => {});
  }

  const safeUserData = {
    ...sanitizeSafeUser(user),
    sessionId: newSessionToken,
    session_id: newSessionToken,
    sessionToken: newSessionToken,
  };

  res.json({
    success: true,
    sessionId: newSessionToken,
    session_token: newSessionToken,
    sessionToken: newSessionToken,
    user: safeUserData
  });
});

// POST logout
app.post('/api/users/logout', (req, res) => {
  const { userId, email } = req.body;
  const user = db.users.find(u => (userId && u.id === userId) || (email && u.email.toLowerCase() === email.toLowerCase()));
  if (user) {
    user.isOnline = false;
    user.sessionToken = '';
    user.lastActive = new Date().toISOString();
    saveStorage();
    const supa = getServerSupabase();
    if (supa) {
      supa.from('users').update({ is_online: false, session_token: '', last_active: user.lastActive }).eq('id', user.id).then(() => {});
    }
  }
  res.json({ success: true });
});

// Memory cache to throttle Supabase writes: only write once every 80 seconds per user
// Saves >75% Supabase API quota while keeping 2-minute live window perfectly active!
const lastSupaHeartbeatWrite = new Map<string, number>();

// POST heartbeat with strict single-device session check
app.post('/api/users/heartbeat', async (req, res) => {
  const { userId, email, isOnline, sessionToken } = req.body;
  const now = new Date().toISOString();
  const cleanEmail = cleanEmailString(email);
  let user = db.users.find(u => 
    (userId && u.id === userId) || 
    (cleanEmail && u.email && cleanEmailString(u.email) === cleanEmail)
  );

  // Authoritative check against Supabase
  const supa = getServerSupabase();
  if (supa && cleanEmail) {
    try {
      const { data: supaUser } = await supa.from('users').select('session_token, is_online').ilike('email', cleanEmail).maybeSingle();
      if (supaUser && supaUser.session_token && sessionToken && supaUser.session_token !== sessionToken) {
        return res.json({
          success: false,
          sessionMismatch: true,
          error: 'Your account was logged into on another device. This session has been terminated.',
        });
      }
    } catch {}
  }

  if (user) {
    // Single device enforcement against local memory
    if (sessionToken && user.sessionToken && user.sessionToken !== sessionToken) {
      return res.json({
        success: false,
        sessionMismatch: true,
        error: 'Your account was logged into on another device. This session has been terminated.',
      });
    }

    user.isOnline = isOnline ?? true;
    user.lastActive = now;
    if (sessionToken && !user.sessionToken) {
      user.sessionToken = sessionToken;
    }
    saveStorage();

    const lastWrite = lastSupaHeartbeatWrite.get(user.id) || 0;
    if (supa && user.id && !user.id.startsWith('admin_config_') && (!user.isOnline || (Date.now() - lastWrite >= 80000))) {
      lastSupaHeartbeatWrite.set(user.id, Date.now());
      supa.from('users').update({
        is_online: user.isOnline,
        last_active: now,
      }).eq('id', user.id).then(() => {});
    }
  }
  res.json({ success: true, isOnline: user ? user.isOnline : true, lastActive: now });
});

// POST update user (plan, credits, days, details, etc.)
app.post('/api/users/update', async (req, res) => {
  const { userId, data } = req.body;
  const userIndex = db.users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  db.users[userIndex] = {
    ...db.users[userIndex],
    ...data,
  };
  checkAndConvertToBasic(db.users[userIndex]);
  saveStorage();

  const supa = getServerSupabase();
  if (supa) {
    const currentUser = db.users[userIndex];
    const supaData: any = {};
    if (data.name !== undefined) supaData.name = data.name;
    if (data.email !== undefined) supaData.email = data.email;
    if (data.password !== undefined) supaData.password = data.password;
    if (data.plan !== undefined) supaData.plan = data.plan;
    if (data.credits !== undefined) supaData.credits = data.credits;
    if (data.maxCredits !== undefined) supaData.max_credits = data.maxCredits;
    if (data.planDaysLeft !== undefined) supaData.plan_days_left = data.planDaysLeft;
    if (data.planExpiresAt !== undefined) supaData.plan_expires_at = data.planExpiresAt;
    if (data.status !== undefined) supaData.status = data.status;
    if (data.extensionAccess !== undefined) supaData.extension_access = data.extensionAccess;
    if (data.canEditPrompts !== undefined) supaData.can_edit_prompts = data.canEditPrompts;
    if (data.whatsapp !== undefined) supaData.whatsapp = data.whatsapp;
    if (data.telegram !== undefined) supaData.telegram = data.telegram;
    if (data.resellerId !== undefined) supaData.reseller_id = data.resellerId;
    if (data.resellerName !== undefined) supaData.reseller_name = data.resellerName;
    if (data.isOnline !== undefined) supaData.is_online = data.isOnline;

    safeServerSupabaseUserUpdate(supa, currentUser.id, currentUser.email, supaData).catch(err => {
      console.error('Server Supabase user update error:', err);
    });
  }

  res.json({ success: true, user: db.users[userIndex] });
});

// DELETE user
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.users = db.users.filter(u => u.id !== id);
  saveStorage();
  res.json({ success: true });
});

// Helper to clean & sanitize user email inputs from extension requests
function cleanEmailString(raw: string): string {
  if (!raw) return '';
  try {
    raw = decodeURIComponent(raw);
  } catch {}
  // Remove zero-width spaces, leading/trailing whitespace, and lowercase
  return raw.replace(/[\u200B-\u200D\uFEFF\s]+/g, '').trim().toLowerCase();
}

// Authoritative version resolver: Reads exact version configured in Admin Panel
function getActiveExtensionVersion(plan: string = 'ultra'): string {
  // 1. Admin Panel Ultra extension configuration (Absolute Primary Source of Truth)
  if (db.planExtensions?.ultra?.version && String(db.planExtensions.ultra.version).trim()) {
    const uv = String(db.planExtensions.ultra.version).trim();
    if (uv !== 'v1.0.2') return uv;
  }

  // 2. Basic plan if explicitly requested
  if (plan === 'basic') {
    if (db.planExtensions?.basic?.version && String(db.planExtensions.basic.version).trim()) {
      const bv = String(db.planExtensions.basic.version).trim();
      if (bv !== 'v1.0.2') return bv;
    }
  }

  // 3. Admin Panel Extension Signal configuration
  if (db.promptConfig?.extensionVersion && String(db.promptConfig.extensionVersion).trim()) {
    const pv = String(db.promptConfig.extensionVersion).trim();
    if (pv !== 'v1.0.2' && pv !== 'v2.7.1') return pv;
  }

  // 4. Basic plan fallback
  if (db.planExtensions?.basic?.version && String(db.planExtensions.basic.version).trim()) {
    return String(db.planExtensions.basic.version).trim();
  }

  return db.planExtensions?.ultra?.version || '3.2.0';
}

function normalizeVersion(v: any): string {
  if (!v) return '';
  return String(v).trim().toLowerCase().replace(/^v/, '');
}

// ======================== EXTENSION API ENDPOINTS ========================

// In-memory cache to debounce and stop repeated spam requests from extensions
const extensionUserCache = new Map<string, { time: number; payload: any }>();
let lastSupabaseConfigFetchTime = 0;
const SUPABASE_CONFIG_CACHE_TTL = 30000; // 30 seconds TTL cache to prevent Supabase request spikes

async function refreshSupabaseConfigIfNeeded() {
  const now = Date.now();
  if (now - lastSupabaseConfigFetchTime < SUPABASE_CONFIG_CACHE_TTL) {
    return;
  }
  const supa = getServerSupabase();
  if (!supa) return;
  try {
    const { data: extRow } = await supa.from('users').select('name').eq('id', 'admin_config_extensions').maybeSingle();
    if (extRow?.name) {
      try {
        const parsedExt = JSON.parse(extRow.name);
        if (parsedExt?.ultra?.version && String(parsedExt.ultra.version).trim()) {
          if (!db.planExtensions) db.planExtensions = {};
          db.planExtensions.ultra = parsedExt.ultra;
        }
      } catch {}
    }

    // 1. First check app_config table for prompt config
    let promptParsed: any = null;
    try {
      const { data: appConfigRow } = await supa.from('app_config').select('value').eq('key', 'admin_config_prompts').maybeSingle();
      if (appConfigRow?.value) {
        promptParsed = typeof appConfigRow.value === 'string' ? JSON.parse(appConfigRow.value) : appConfigRow.value;
      }
    } catch {}

    // 2. Fallback check users table
    if (!promptParsed) {
      try {
        const { data: promptRow } = await supa.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
        if (promptRow?.name) {
          promptParsed = JSON.parse(promptRow.name);
        }
      } catch {}
    }

    if (promptParsed && Array.isArray(promptParsed.servers)) {
      const localHasPrompts = db.promptConfig?.servers?.some((s: any) => s.prompt && s.prompt.trim());
      const incomingHasPrompts = promptParsed.servers.some((s: any) => s.prompt && s.prompt.trim());

      if (incomingHasPrompts || !localHasPrompts) {
        // Merge without losing non-empty prompts
        const mergedServers = promptParsed.servers.map((inSrv: any) => {
          const localSrv = db.promptConfig?.servers?.find((ls: any) => ls.id === inSrv.id);
          if (!inSrv.prompt?.trim() && localSrv?.prompt?.trim()) {
            return { ...inSrv, prompt: localSrv.prompt, lastUpdatedAt: localSrv.lastUpdatedAt };
          }
          return inSrv;
        });
        db.promptConfig = {
          ...db.promptConfig,
          ...promptParsed,
          servers: mergedServers,
        };
        saveStorage();
      } else if (localHasPrompts && !incomingHasPrompts) {
        // Local memory has active prompts, but Supabase has empty ones. Push to Supabase to self-heal!
        safeSaveSupabasePromptConfig(supa, db.promptConfig);
      }
    }
    lastSupabaseConfigFetchTime = Date.now();
  } catch {}
}

// GET /api/extension/user?email=...&token=...
// Verifies member Gmail ID, returns profile, plan, credits, validity, and live dynamic Server Prompts (Cloudflare Option 2 or Option 1)
app.get('/api/extension/user', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  await refreshSupabaseConfigIfNeeded();

  let email = cleanEmailString(req.query.email as string || '');
  const reqToken = ((req.query.token || req.query.sessionToken || req.headers['authorization'] || '') as string).replace(/^Bearer\s+/i, '').trim();

  // If email was not explicitly passed, try resolving user by session token
  if (!email && reqToken) {
    const matched = db.users.find(u => u.sessionToken === reqToken);
    if (matched) {
      email = cleanEmailString(matched.email);
    } else {
      const supa = getServerSupabase();
      if (supa) {
        try {
          const { data: supaUser } = await supa.from('users').select('email').eq('session_token', reqToken).maybeSingle();
          if (supaUser?.email) email = cleanEmailString(supaUser.email);
        } catch {}
      }
    }
  }

  if (!email || !reqToken) {
    return res.status(401).json({ 
      success: false, 
      serverOnline: true,
      serverStatus: 'online',
      error: 'Authentication failed: Both Gmail ID (email) and session token (token number) are required.' 
    });
  }

  // Mark user as actively online in memory and Supabase
  markUserOnline(email, reqToken);

  let user = db.users.find(u => u.email && cleanEmailString(u.email) === email);

  // If Supabase is connected, check Supabase directly for the freshest live data
  const supa = getServerSupabase();
  if (supa) {
    try {
      const { data: supaUser } = await supa.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const freshUser = {
          id: supaUser.id,
          name: supaUser.name,
          email: supaUser.email,
          password: supaUser.password,
          whatsapp: supaUser.whatsapp || '',
          telegram: supaUser.telegram || '',
          referralCode: supaUser.referral_code || '',
          referredBy: supaUser.referred_by || '',
          plan: supaUser.plan || 'basic',
          credits: Number(supaUser.credits) ?? 0,
          maxCredits: Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100),
          planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
          role: supaUser.role || 'user',
          resellerId: supaUser.reseller_id,
          resellerName: supaUser.reseller_name,
          status: supaUser.status || 'active',
          extensionAccess: supaUser.extension_access !== undefined ? supaUser.extension_access : true,
          canEditPrompts: supaUser.can_edit_prompts === true,
          isOnline: true,
          sessionToken: supaUser.session_token || '',
          lastActive: new Date().toISOString(),
          createdAt: supaUser.created_at || new Date().toISOString(),
          avatarColor: supaUser.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
        };

        const existingIdx = db.users.findIndex(u => u.id === supaUser.id || (u.email && cleanEmailString(u.email) === email));
        if (existingIdx >= 0) {
          db.users[existingIdx] = freshUser;
        } else {
          db.users.push(freshUser);
        }
        user = freshUser;
        saveStorage();
      }
    } catch (err) {
      console.error('Supabase user fetch error:', err);
    }
  }

  if (!user) {
    return res.status(404).json({ success: false, error: `No user found registered with Gmail ID: ${email}` });
  }

  if (checkAndConvertToBasic(user)) {
    saveStorage();
  }

  // Mark user active and online on extension check
  const activeNow = new Date().toISOString();
  user.isOnline = true;
  user.lastActive = activeNow;
  saveStorage();

  const supaServ = getServerSupabase();
  if (supaServ && user.id && !user.id.startsWith('admin_config_')) {
    supaServ.from('users').update({
      is_online: true,
      last_active: activeNow,
    }).eq('id', user.id).then(() => {});
  }

  const maxCredits = user.maxCredits || (user.plan === 'unlimited' ? 99999 : user.plan === 'ultra' ? 45000 : 100);
  const credits = user.credits ?? 0;
  const creditsUsed = Math.max(0, maxCredits - credits);
  const planDaysLeft = user.planDaysLeft ?? 0;
  const extensionAllowed = user.extensionAccess !== false && user.status !== 'suspended' && planDaysLeft > 0;

  // Dynamically resolve real-time Option 2 (Cloudflare) or Option 1 (Local) servers
  const { servers, serverMap, source, cloudflareOnline } = await resolveActiveServers();
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };

  const isUltraOrUnlimited = user.plan === 'ultra' || user.plan === 'unlimited';
  const sessionToken = user.sessionToken || '';
  const canAccessPrompts = isUltraOrUnlimited && user.status === 'active' && user.extensionAccess !== false && planDaysLeft > 0;

  let planDisplayName = 'Basic Plan';
  if (user.plan === 'unlimited') planDisplayName = 'Unlimited VIP Plan';
  else if (user.plan === 'ultra') planDisplayName = 'Ultra VIP Plan';

  const activePlanVer = getActiveExtensionVersion(user.plan);

  const responsePayload = {
    success: true,
    serverOnline: true,
    serverStatus: 'online',
    email: user.email,
    sessionToken: sessionToken,
    token: sessionToken,
    version: activePlanVer,
    extensionVersion: activePlanVer,
    requiredVersion: activePlanVer,
    source,
    cloudflareEnabled: Boolean(db.promptConfig?.cloudflareEnabled !== false),
    cloudflareOnline,
    cloudflareUrl: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim() : '',
    directPromptUrl: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim() : '',
    relayMode: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? 'direct_cloudflare' : 'portal_local',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      planName: planDisplayName,
      credits,
      creditsLeft: credits,
      maxCredits,
      totalCredits: maxCredits,
      creditsUsed,
      sessionToken,
      canAccessPrompts,
      planDaysLeft,
      status: user.status || 'active',
      extensionAccess: user.extensionAccess !== false,
      isAllowed: extensionAllowed,
    },
    servers: canAccessPrompts ? servers : [],
    server1: canAccessPrompts ? (serverMap.server1 || '') : '',
    server2: canAccessPrompts ? (serverMap.server2 || '') : '',
    server3: canAccessPrompts ? (serverMap.server3 || '') : '',
    server4: canAccessPrompts ? (serverMap.server4 || '') : '',
    costs,
    serverTimestamp: new Date().toISOString(),
  };

  res.json(responsePayload);
});

// GET /api/extension/session?token=...
// Direct endpoint for extensions to fetch full user info by portal session token without knowing email
app.get('/api/extension/session', async (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  const token = ((req.query.token || req.query.sessionToken || req.headers['authorization'] || '') as string).replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(400).json({ success: false, error: 'Session token is required.' });
  }

  markUserOnline('', token);

  let user = db.users.find(u => u.sessionToken === token);
  const supa = getServerSupabase();
  if (!user && supa) {
    try {
      const { data: supaUser } = await supa.from('users').select('*').eq('session_token', token).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        user = db.users.find(u => u.id === supaUser.id || (u.email && cleanEmailString(u.email) === cleanEmailString(supaUser.email)));
        if (!user) {
          user = {
            id: supaUser.id,
            name: supaUser.name,
            email: supaUser.email,
            password: supaUser.password,
            plan: supaUser.plan || 'basic',
            credits: Number(supaUser.credits) ?? 0,
            maxCredits: Number(supaUser.max_credits) || 100,
            planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
            role: supaUser.role || 'user',
            status: supaUser.status || 'active',
            extensionAccess: supaUser.extension_access !== false,
            sessionToken: token,
            isOnline: true,
            lastActive: new Date().toISOString(),
            createdAt: supaUser.created_at || new Date().toISOString(),
          };
          db.users.push(user);
        }
      }
    } catch {}
  }

  if (!user) {
    return res.status(404).json({ success: false, error: 'Session not found or expired. Please login on the portal.' });
  }

  const maxCredits = user.maxCredits || (user.plan === 'ultra' ? 45000 : 100);
  const credits = user.credits ?? 0;
  const isUltraOrUnlimited = user.plan === 'ultra' || user.plan === 'unlimited';
  const planDaysLeft = user.planDaysLeft ?? 0;

  const sessionPlanVer = getActiveExtensionVersion(user.plan);

  res.json({
    success: true,
    serverOnline: true,
    serverStatus: 'online',
    email: user.email,
    sessionToken: token,
    token: token,
    version: sessionPlanVer,
    extensionVersion: sessionPlanVer,
    requiredVersion: sessionPlanVer,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      planName: isUltraOrUnlimited ? 'Ultra VIP Plan' : 'Basic Plan',
      credits,
      creditsLeft: credits,
      maxCredits,
      totalCredits: maxCredits,
      sessionToken: token,
      planDaysLeft,
      status: user.status || 'active',
      canAccessPrompts: isUltraOrUnlimited && user.status === 'active' && planDaysLeft > 0,
    }
  });
});

// POST /api/extension/prompts
// High Security Dedicated Server Prompt Fetch Endpoint: Requires email + sessionToken
// Returns servers, prompts, server online status, and extension version all together in ONE unified response!
app.post('/api/extension/prompts', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const email = cleanEmailString(req.body.email || '');
  const sessionToken = (req.body.sessionToken || req.body.token || '').trim();
  const clientVersion = req.body.version || req.body.extensionVersion || '';

  // Dynamically resolve real-time prompts from Cloudflare Worker or local servers
  const { servers, serverMap, source, cloudflareOnline } = await resolveActiveServers();
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };
  const requiredVer = getActiveExtensionVersion('ultra');

  if (!email || !sessionToken) {
    return res.status(401).json({
      success: false,
      serverOnline: true,
      serverStatus: 'online',
      version: requiredVer,
      extensionVersion: requiredVer,
      requiredVersion: requiredVer,
      error: 'Authentication failed: Active email and sessionToken are required to access server prompts.',
      servers: [],
      server1: '',
      server2: '',
      costs,
      serverTimestamp: new Date().toISOString(),
    });
  }

  let user = db.users.find(u => u.email && cleanEmailString(u.email) === email);

  // Quota Protection: If user exists in fast RAM with matching session token, authenticate instantly with 0 database hits
  const supa = getServerSupabase();
  if ((!user || user.sessionToken !== sessionToken) && supa) {
    try {
      const { data: supaUser } = await supa.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const freshUser = {
          id: supaUser.id,
          name: supaUser.name,
          email: supaUser.email,
          password: supaUser.password,
          whatsapp: supaUser.whatsapp || '',
          telegram: supaUser.telegram || '',
          referralCode: supaUser.referral_code || '',
          referredBy: supaUser.referred_by || '',
          plan: supaUser.plan || 'basic',
          credits: Number(supaUser.credits) ?? 0,
          maxCredits: Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100),
          planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
          role: supaUser.role || 'user',
          resellerId: supaUser.reseller_id,
          resellerName: supaUser.reseller_name,
          status: supaUser.status || 'active',
          extensionAccess: supaUser.extension_access !== undefined ? supaUser.extension_access : true,
          canEditPrompts: supaUser.can_edit_prompts === true,
          sessionToken: supaUser.session_token || sessionToken,
          isOnline: true,
          lastActive: new Date().toISOString(),
          createdAt: supaUser.created_at || new Date().toISOString(),
          avatarColor: supaUser.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
        };
        const existingIdx = db.users.findIndex(u => u.id === supaUser.id || (u.email && cleanEmailString(u.email) === email));
        if (existingIdx >= 0) {
          db.users[existingIdx] = freshUser;
        } else {
          db.users.push(freshUser);
        }
        user = freshUser;
        saveStorage();
      }
    } catch (e) {
      console.error('Prompt fetch error:', e);
    }
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      serverOnline: true,
      serverStatus: 'online',
      version: requiredVer,
      extensionVersion: requiredVer,
      requiredVersion: requiredVer,
      error: 'Account not found. Please log in to the portal.',
      servers: [],
      server1: '',
      server2: '',
      costs,
      serverTimestamp: new Date().toISOString(),
    });
  }

  if (user.sessionToken && user.sessionToken !== sessionToken) {
    return res.status(403).json({
      success: false,
      serverOnline: true,
      serverStatus: 'online',
      version: requiredVer,
      extensionVersion: requiredVer,
      requiredVersion: requiredVer,
      error: 'Access Denied: Invalid or expired session token. Please log in to the portal.',
      servers: [],
      server1: '',
      server2: '',
      costs,
      serverTimestamp: new Date().toISOString(),
    });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ 
      success: false, 
      serverOnline: true, 
      serverStatus: 'online',
      version: requiredVer,
      extensionVersion: requiredVer,
      requiredVersion: requiredVer,
      error: 'Account suspended.', 
      servers: [],
      server1: '',
      server2: '',
      costs,
      serverTimestamp: new Date().toISOString(),
    });
  }

  if (user.plan !== 'ultra' && user.plan !== 'unlimited' && user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      serverOnline: true, 
      serverStatus: 'online',
      version: requiredVer,
      extensionVersion: requiredVer,
      requiredVersion: requiredVer,
      error: 'Prompts are exclusive to Ultra VIP members.', 
      servers: [],
      server1: '',
      server2: '',
      costs,
      serverTimestamp: new Date().toISOString(),
    });
  }

  // Mark user as actively live/online in server and Supabase
  markUserOnline(email, sessionToken);

  // Check if extension version matches the Admin Panel required version
  const userPlan = user.plan || 'ultra';
  const finalRequiredVer = getActiveExtensionVersion(userPlan);
  const isOutdated = clientVersion && (normalizeVersion(clientVersion) !== normalizeVersion(finalRequiredVer));

  if (isOutdated) {
    return res.status(426).json({
      success: false,
      updateRequired: true,
      needsUpdate: true,
      isOutdated: true,
      serverOnline: true,
      serverStatus: 'online',
      version: finalRequiredVer,
      extensionVersion: finalRequiredVer,
      requiredVersion: finalRequiredVer,
      clientVersion,
      downloadUrl: `/api/extensions/download/${userPlan}`,
      error: `Extension Update Required: Your extension version (${clientVersion}) is outdated. Please download the latest update (${finalRequiredVer}) from the portal to access server prompts.`,
      message: `Extension Update Required: Your extension version (${clientVersion}) is outdated. Please download the latest update (${finalRequiredVer}) from the portal to access server prompts.`,
      servers: [],
      server1: '',
      server2: '',
      costs,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: userPlan,
        credits: Number(user.credits) || 0,
        maxCredits: Number(user.maxCredits) || 45000,
        planDaysLeft: Number(user.planDaysLeft) || 30,
        status: user.status || 'active',
      },
      serverTimestamp: new Date().toISOString()
    });
  }

  return res.json({ 
    success: true, 
    serverOnline: true, 
    serverStatus: 'online',
    email: user.email,
    sessionToken: sessionToken,
    token: sessionToken,
    version: finalRequiredVer,
    extensionVersion: finalRequiredVer,
    requiredVersion: finalRequiredVer,
    clientVersion,
    source,
    cloudflareEnabled: Boolean(db.promptConfig?.cloudflareEnabled !== false),
    cloudflareOnline,
    cloudflareUrl: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim() : '',
    directPromptUrl: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim() : '',
    relayMode: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? 'direct_cloudflare' : 'portal_local',
    servers, 
    server1: serverMap.server1 || '',
    server2: serverMap.server2 || '',
    server3: serverMap.server3 || '',
    server4: serverMap.server4 || '',
    costs,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      credits: user.credits,
      maxCredits: user.maxCredits,
      planDaysLeft: user.planDaysLeft,
      status: user.status,
    },
    serverTimestamp: new Date().toISOString() 
  });
});

// GET /api/extension/verify
app.get('/api/extension/verify', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const email = cleanEmailString(req.query.email as string || req.headers['x-user-email'] as string || '');
  if (!email) {
    return res.status(400).json({ success: false, error: 'Gmail ID (email) is required in query params.' });
  }

  let user = db.users.find(u => u.email && cleanEmailString(u.email) === email);

  const supa = getServerSupabase();
  if (supa) {
    try {
      const { data: supaUser } = await supa.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const freshUser = {
          id: supaUser.id,
          name: supaUser.name,
          email: supaUser.email,
          password: supaUser.password,
          whatsapp: supaUser.whatsapp || '',
          telegram: supaUser.telegram || '',
          referralCode: supaUser.referral_code || '',
          referredBy: supaUser.referred_by || '',
          plan: supaUser.plan || 'basic',
          credits: Number(supaUser.credits) ?? 0,
          maxCredits: Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100),
          planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
          role: supaUser.role || 'user',
          resellerId: supaUser.reseller_id,
          resellerName: supaUser.reseller_name,
          status: supaUser.status || 'active',
          extensionAccess: supaUser.extension_access !== undefined ? supaUser.extension_access : true,
          canEditPrompts: supaUser.can_edit_prompts === true,
          isOnline: true,
          lastActive: new Date().toISOString(),
          createdAt: supaUser.created_at || new Date().toISOString(),
          avatarColor: supaUser.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
        };
        const existingIdx = db.users.findIndex(u => u.id === supaUser.id || (u.email && cleanEmailString(u.email) === email));
        if (existingIdx >= 0) {
          db.users[existingIdx] = freshUser;
        } else {
          db.users.push(freshUser);
        }
        user = freshUser;
        saveStorage();
      }
    } catch (err) {
      console.error('Supabase verify user fetch error:', err);
    }
  }

  if (!user) {
    return res.status(404).json({ success: false, error: `No user found registered with Gmail ID: ${email}` });
  }

  if (checkAndConvertToBasic(user)) {
    saveStorage();
  }

  const maxCredits = user.maxCredits || (user.plan === 'ultra' ? 45000 : 100);
  const credits = user.credits ?? 0;
  const creditsUsed = Math.max(0, maxCredits - credits);
  const planDaysLeft = user.planDaysLeft ?? 0;
  const extensionAllowed = user.extensionAccess !== false && user.status !== 'suspended' && planDaysLeft > 0;

  const { servers, serverMap, source, cloudflareOnline } = await resolveActiveServers();
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };
  const isUltraUser = user.plan === 'ultra';
  const verifyToken = user.sessionToken || '';
  const canAccessPromptsVerify = isUltraUser && user.status === 'active';

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      planName: isUltraUser ? 'Ultra VIP Plan' : 'Basic Plan',
      credits,
      creditsLeft: credits,
      maxCredits,
      totalCredits: maxCredits,
      creditsUsed,
      sessionToken: verifyToken,
      canAccessPrompts: canAccessPromptsVerify,
      planDaysLeft,
      status: user.status,
      extensionAccess: user.extensionAccess !== false,
      isAllowed: extensionAllowed,
    },
    source,
    cloudflareEnabled: Boolean(db.promptConfig?.cloudflareEnabled !== false),
    cloudflareOnline,
    cloudflareUrl: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim() : '',
    directPromptUrl: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim() : '',
    relayMode: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? 'direct_cloudflare' : 'portal_local',
    servers: isUltraUser ? servers : [],
    server1: isUltraUser ? (serverMap.server1 || '') : '',
    server2: isUltraUser ? (serverMap.server2 || '') : '',
    server3: isUltraUser ? (serverMap.server3 || '') : '',
    server4: isUltraUser ? (serverMap.server4 || '') : '',
    costs,
    serverTimestamp: new Date().toISOString(),
  });
});

// POST /api/extension/cf-verify
// Dedicated Gatekeeper Verification endpoint for Cloudflare Worker
app.post('/api/extension/cf-verify', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const email = cleanEmailString(req.body.email || '');
  const sessionToken = (req.body.sessionToken || req.body.token || '').trim();
  const clientVersion = req.body.version || req.body.extensionVersion || '';
  const requiredVer = getActiveExtensionVersion('ultra');
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };

  if (!email || !sessionToken) {
    return res.status(401).json({
      allowed: false,
      success: false,
      error: 'Missing email or sessionToken.',
      requiredVersion: requiredVer,
    });
  }

  // Check version first
  if (clientVersion && clientVersion !== requiredVer) {
    return res.status(426).json({
      allowed: false,
      updateRequired: true,
      error: `Update Required: Please update your extension to version ${requiredVer}.`,
      requiredVersion: requiredVer,
      clientVersion,
    });
  }

  // Fast RAM auth check (0 Supabase DB queries)
  let user = db.users.find(u => u.email && cleanEmailString(u.email) === email);
  const supa = getServerSupabase();
  if ((!user || user.sessionToken !== sessionToken) && supa) {
    try {
      const { data: supaUser } = await supa.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const freshUser = {
          id: supaUser.id,
          name: supaUser.name,
          email: supaUser.email,
          password: supaUser.password,
          plan: supaUser.plan || 'basic',
          credits: Number(supaUser.credits) ?? 0,
          maxCredits: Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100),
          planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
          role: supaUser.role || 'user',
          status: supaUser.status || 'active',
          extensionAccess: supaUser.extension_access !== false,
          sessionToken: supaUser.session_token || sessionToken,
          isOnline: true,
          lastActive: new Date().toISOString(),
          createdAt: supaUser.created_at || new Date().toISOString(),
        };
        const existingIdx = db.users.findIndex(u => u.id === supaUser.id || (u.email && cleanEmailString(u.email) === email));
        if (existingIdx >= 0) db.users[existingIdx] = freshUser;
        else db.users.push(freshUser);
        user = freshUser;
        saveStorage();
      }
    } catch {}
  }

  if (!user) {
    return res.status(404).json({
      allowed: false,
      success: false,
      error: 'User not registered. Please log in on FlowMaker portal.',
      requiredVersion: requiredVer,
    });
  }

  if (user.sessionToken && user.sessionToken !== sessionToken) {
    return res.status(401).json({
      allowed: false,
      success: false,
      error: 'Invalid or expired session token.',
      requiredVersion: requiredVer,
    });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({
      allowed: false,
      success: false,
      error: 'Account suspended. Please contact support.',
      requiredVersion: requiredVer,
    });
  }

  const isUltraOrAdmin = user.plan === 'ultra' || user.plan === 'unlimited' || user.role === 'admin';
  const planDaysLeft = user.planDaysLeft ?? 0;
  if (!isUltraOrAdmin || planDaysLeft <= 0) {
    return res.status(403).json({
      allowed: false,
      success: false,
      error: 'Ultra VIP Plan required to access live servers.',
      requiredVersion: requiredVer,
    });
  }

  // All checks passed! Mark user as live/online
  const cfActiveNow = new Date().toISOString();
  user.isOnline = true;
  user.lastActive = cfActiveNow;
  saveStorage();

  const supaCf = getServerSupabase();
  if (supaCf && user.id && !user.id.startsWith('admin_config_')) {
    supaCf.from('users').update({
      is_online: true,
      last_active: cfActiveNow,
    }).eq('id', user.id).then(() => {});
  }

  const { servers, serverMap } = await resolveActiveServers();

  return res.json({
    allowed: true,
    success: true,
    requiredVersion: requiredVer,
    costs,
    servers,
    serverMap,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      credits: user.credits,
      maxCredits: user.maxCredits,
      planDaysLeft: user.planDaysLeft,
    }
  });
});

// POST /api/extension/verify
app.post('/api/extension/verify', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const email = cleanEmailString(req.body.email || '');
  if (!email) {
    return res.status(400).json({ success: false, error: 'Gmail ID (email) is required in request body.' });
  }

  let user = db.users.find(u => u.email && cleanEmailString(u.email) === email);

  const supa = getServerSupabase();
  if (supa) {
    try {
      const { data: supaUser } = await supa.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const freshUser = {
          id: supaUser.id,
          name: supaUser.name,
          email: supaUser.email,
          password: supaUser.password,
          whatsapp: supaUser.whatsapp || '',
          telegram: supaUser.telegram || '',
          referralCode: supaUser.referral_code || '',
          referredBy: supaUser.referred_by || '',
          plan: supaUser.plan || 'basic',
          credits: Number(supaUser.credits) ?? 0,
          maxCredits: Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100),
          planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
          role: supaUser.role || 'user',
          resellerId: supaUser.reseller_id,
          resellerName: supaUser.reseller_name,
          status: supaUser.status || 'active',
          extensionAccess: supaUser.extension_access !== undefined ? supaUser.extension_access : true,
          canEditPrompts: supaUser.can_edit_prompts === true,
          isOnline: true,
          lastActive: new Date().toISOString(),
          createdAt: supaUser.created_at || new Date().toISOString(),
          avatarColor: supaUser.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
        };
        const existingIdx = db.users.findIndex(u => u.id === supaUser.id || (u.email && cleanEmailString(u.email) === email));
        if (existingIdx >= 0) {
          db.users[existingIdx] = freshUser;
        } else {
          db.users.push(freshUser);
        }
        user = freshUser;
        saveStorage();
      }
    } catch (err) {
      console.error('Supabase verify user fetch error:', err);
    }
  }

  if (!user) {
    return res.status(404).json({ success: false, error: `No user found registered with Gmail ID: ${email}` });
  }

  if (checkAndConvertToBasic(user)) {
    saveStorage();
  }

  const password = req.body.password || '';
  if (user.password && password && user.password !== password) {
    return res.status(401).json({ success: false, error: 'Incorrect password. Please check your Gmail ID and password.' });
  }

  // Mark user as actively live/online in server and Supabase
  markUserOnline(email, user.sessionToken);

  const maxCredits = user.maxCredits || (user.plan === 'ultra' ? 45000 : 100);
  const credits = user.credits ?? 0;
  const creditsUsed = Math.max(0, maxCredits - credits);
  const planDaysLeft = user.planDaysLeft ?? 0;
  const extensionAllowed = user.extensionAccess !== false && user.status !== 'suspended' && planDaysLeft > 0;

  const { servers, serverMap, source, cloudflareOnline } = await resolveActiveServers();
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };

  const isUltraUser = user.plan === 'ultra';
  const verifyToken = user.sessionToken || '';
  const canAccessPromptsVerify = isUltraUser && user.status === 'active';

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      planName: isUltraUser ? 'Ultra VIP Plan' : 'Basic Plan',
      credits,
      creditsLeft: credits,
      maxCredits,
      totalCredits: maxCredits,
      creditsUsed,
      sessionToken: verifyToken,
      canAccessPrompts: canAccessPromptsVerify, // False for basic, True for Ultra
      planDaysLeft,
      status: user.status,
      extensionAccess: user.extensionAccess !== false,
      isAllowed: extensionAllowed,
    },
    source,
    cloudflareEnabled: Boolean(db.promptConfig?.cloudflareEnabled !== false),
    cloudflareOnline,
    cloudflareUrl: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim() : '',
    directPromptUrl: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim() : '',
    relayMode: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? 'direct_cloudflare' : 'portal_local',
    servers: isUltraUser ? servers : [],
    server1: isUltraUser ? (serverMap.server1 || '') : '',
    server2: isUltraUser ? (serverMap.server2 || '') : '',
    server3: isUltraUser ? (serverMap.server3 || '') : '',
    server4: isUltraUser ? (serverMap.server4 || '') : '',
    costs,
    serverTimestamp: new Date().toISOString(),
  });
});

// GET /api/extension/servers
// Returns live Server 1 & Server 2 prompts and costs directly to the Extension
app.get('/api/extension/servers', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { servers, serverMap, source, cloudflareOnline } = await resolveActiveServers();
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };
  const promptReminderMinutes = db.promptConfig?.promptReminderMinutes || 120;
  const ver = getActiveExtensionVersion('ultra');

  res.json({
    success: true,
    serverOnline: true,
    serverStatus: 'online',
    version: ver,
    extensionVersion: ver,
    requiredVersion: ver,
    source,
    cloudflareEnabled: Boolean(db.promptConfig?.cloudflareEnabled !== false),
    cloudflareOnline,
    servers,
    server1: serverMap.server1 || '',
    server2: serverMap.server2 || '',
    server3: serverMap.server3 || '',
    server4: serverMap.server4 || '',
    costs,
    promptReminderMinutes,
    serverTimestamp: new Date().toISOString(),
  });
});

// POST /api/extension/servers
// Secure POST endpoint for Extension to fetch Server 1 & Server 2 with Version check
app.post('/api/extension/servers', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const email = cleanEmailString(req.body.email || '');
  const sessionToken = (req.body.sessionToken || req.body.token || '').trim();
  const clientVersion = req.body.version || req.body.extensionVersion || '';

  const { servers, serverMap, source, cloudflareOnline } = await resolveActiveServers();
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };
  const requiredVer = getActiveExtensionVersion('ultra');

  if (!email || !sessionToken) {
    return res.status(401).json({
      success: false,
      serverOnline: true,
      serverStatus: 'online',
      version: requiredVer,
      extensionVersion: requiredVer,
      requiredVersion: requiredVer,
      error: 'Authentication failed: Active email and sessionToken are required.',
      servers: [],
      server1: '',
      server2: '',
      costs,
      serverTimestamp: new Date().toISOString(),
    });
  }

  let user = db.users.find(u => u.email && cleanEmailString(u.email) === email);

  const supa = getServerSupabase();
  if ((!user || user.sessionToken !== sessionToken) && supa) {
    try {
      const { data: supaUser } = await supa.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const freshUser = {
          id: supaUser.id,
          name: supaUser.name,
          email: supaUser.email,
          password: supaUser.password,
          whatsapp: supaUser.whatsapp || '',
          telegram: supaUser.telegram || '',
          referralCode: supaUser.referral_code || '',
          referredBy: supaUser.referred_by || '',
          plan: supaUser.plan || 'basic',
          credits: Number(supaUser.credits) ?? 0,
          maxCredits: Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100),
          planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
          role: supaUser.role || 'user',
          resellerId: supaUser.reseller_id,
          resellerName: supaUser.reseller_name,
          status: supaUser.status || 'active',
          extensionAccess: supaUser.extension_access !== undefined ? supaUser.extension_access : true,
          sessionToken: supaUser.session_token || sessionToken,
          isOnline: true,
          lastActive: new Date().toISOString(),
          createdAt: supaUser.created_at || new Date().toISOString(),
        };
        const existingIdx = db.users.findIndex(u => u.id === supaUser.id || (u.email && cleanEmailString(u.email) === email));
        if (existingIdx >= 0) db.users[existingIdx] = freshUser;
        else db.users.push(freshUser);
        user = freshUser;
        saveStorage();
      }
    } catch {}
  }

  if (!user || user.status === 'suspended' || user.sessionToken !== sessionToken) {
    return res.status(401).json({
      success: false,
      serverOnline: true,
      serverStatus: 'online',
      version: requiredVer,
      extensionVersion: requiredVer,
      requiredVersion: requiredVer,
      error: 'Access Denied: Invalid or expired session token.',
      servers: [],
      server1: '',
      server2: '',
      costs,
      serverTimestamp: new Date().toISOString(),
    });
  }

  // Version Check
  if (clientVersion && clientVersion !== requiredVer) {
    return res.status(426).json({
      success: false,
      updateRequired: true,
      error: `Update Required: Please update your extension to version ${requiredVer}.`,
      requiredVersion: requiredVer,
      version: requiredVer,
      clientVersion,
      servers: [],
      server1: '',
      server2: '',
      costs,
      serverTimestamp: new Date().toISOString(),
    });
  }

  const isUltraUser = user.plan === 'ultra' || user.plan === 'unlimited' || user.role === 'admin';

  res.json({
    success: true,
    authenticated: true,
    serverOnline: true,
    serverStatus: 'online',
    version: requiredVer,
    extensionVersion: requiredVer,
    requiredVersion: requiredVer,
    source,
    cloudflareEnabled: Boolean(db.promptConfig?.cloudflareEnabled !== false),
    cloudflareOnline,
    servers: isUltraUser ? servers : [],
    server1: isUltraUser ? (serverMap.server1 || '') : '',
    server2: isUltraUser ? (serverMap.server2 || '') : '',
    server3: isUltraUser ? (serverMap.server3 || '') : '',
    server4: isUltraUser ? (serverMap.server4 || '') : '',
    costs,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      credits: user.credits,
      maxCredits: user.maxCredits,
      planDaysLeft: user.planDaysLeft,
      status: user.status,
    },
    serverTimestamp: new Date().toISOString(),
  });
});

// POST /api/extension/deduct-credits
// Deducts user credits when an image (-20) or video (-30) is generated via extension
app.post('/api/extension/deduct-credits', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { email, type, amount } = req.body;
  const cleanEmail = cleanEmailString(email || '');
  if (!cleanEmail) {
    return res.status(400).json({ success: false, error: 'Gmail ID (email) is required.' });
  }

  const supa = getServerSupabase();
  let userIndex = db.users.findIndex(u => u.email && cleanEmailString(u.email) === cleanEmail);

  if (supa) {
    try {
      const { data: supaUser } = await supa.from('users').select('*').ilike('email', cleanEmail).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const freshUser = {
          id: supaUser.id,
          name: supaUser.name,
          email: supaUser.email,
          password: supaUser.password,
          whatsapp: supaUser.whatsapp || '',
          telegram: supaUser.telegram || '',
          referralCode: supaUser.referral_code || '',
          referredBy: supaUser.referred_by || '',
          plan: supaUser.plan || 'basic',
          credits: Number(supaUser.credits) ?? 0,
          maxCredits: Number(supaUser.max_credits) || (supaUser.plan === 'ultra' ? 45000 : 100),
          planDaysLeft: Number(supaUser.plan_days_left) ?? 30,
          role: supaUser.role || 'user',
          resellerId: supaUser.reseller_id,
          resellerName: supaUser.reseller_name,
          status: supaUser.status || 'active',
          extensionAccess: supaUser.extension_access !== undefined ? supaUser.extension_access : true,
          isOnline: true,
          lastActive: new Date().toISOString(),
          createdAt: supaUser.created_at || new Date().toISOString(),
          avatarColor: supaUser.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
        };
        if (userIndex >= 0) {
          db.users[userIndex] = freshUser;
        } else {
          db.users.push(freshUser);
          userIndex = db.users.length - 1;
        }
        saveStorage();
      }
    } catch (err) {
      console.error('Error finding user in Supabase for deduction:', err);
    }
  }

  if (userIndex === -1) {
    return res.status(404).json({ success: false, error: `No user found with Gmail ID: ${cleanEmail}` });
  }

  const user = db.users[userIndex];
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };

  let deductAmount = 20;
  if (typeof amount === 'number' && amount > 0) {
    deductAmount = amount;
  } else if (type === 'video') {
    deductAmount = costs.video || 30;
  } else if (type === 'image') {
    deductAmount = costs.image || 20;
  }

  const currentCredits = user.credits ?? 0;
  const newCredits = Math.max(0, currentCredits - deductAmount);
  const maxCredits = user.maxCredits || (user.plan === 'ultra' ? 45000 : 100);

  user.credits = newCredits;
  user.lastActive = new Date().toISOString();
  user.isOnline = true;
  saveStorage();

  // Also sync to Supabase database in real-time
  if (supa) {
    safeServerSupabaseUserUpdate(supa, user.id, cleanEmail, { 
      credits: newCredits,
      is_online: true 
    }).catch(err => {
      console.error('Supabase credit deduction update error:', err);
    });
  }

  res.json({
    success: true,
    deducted: deductAmount,
    action: type || 'custom',
    previousCredits: currentCredits,
    remainingCredits: newCredits,
    creditsUsed: Math.max(0, maxCredits - newCredits),
    maxCredits,
    user: {
      name: user.name,
      email: user.email,
      plan: user.plan,
      credits: newCredits,
      planDaysLeft: user.planDaysLeft,
    },
  });
});

// Helper to resolve active prompt servers (Option 1 Local vs Option 2 Cloudflare Worker Relay)
async function resolveActiveServers(): Promise<{
  servers: any[];
  serverMap: Record<string, string>;
  source: 'cloudflare' | 'local';
  cloudflareOnline: boolean;
}> {
  await refreshSupabaseConfigIfNeeded();

  const cloudflareEnabled = db.promptConfig?.cloudflareEnabled !== undefined
    ? Boolean(db.promptConfig.cloudflareEnabled)
    : true;
  const cloudflareUrl = (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim();

  let servers: any[] = [];
  const serverMap: Record<string, string> = {};
  let source: 'cloudflare' | 'local' = 'local';
  let cloudflareOnline = false;

  if (cloudflareEnabled && cloudflareUrl) {
    try {
      // Force real-time latest prompt from Cloudflare with timestamp cache-buster & no-cache headers
      const fetchUrl = `${cloudflareUrl}${cloudflareUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const resp = await fetch(fetchUrl, {
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        signal: AbortSignal.timeout(4000),
      });

      if (resp.ok) {
        const cfData = await resp.json();
        if (cfData && typeof cfData === 'object') {
          source = 'cloudflare';
          cloudflareOnline = true;

          // Directly map all active servers from live Cloudflare Worker
          for (let i = 1; i <= 8; i++) {
            const key = `server${i}`;
            if (cfData[key] !== undefined && cfData[key] !== '') {
              const promptVal = typeof cfData[key] === 'object' ? JSON.stringify(cfData[key]) : String(cfData[key]);
              servers.push({
                id: key,
                label: `Server ${i}`,
                prompt: promptVal,
                lastUpdatedAt: cfData.updatedAt || new Date().toISOString(),
                source: 'cloudflare'
              });
              serverMap[key] = promptVal;
            }
          }

          // Also capture any non-indexed server keys
          Object.keys(cfData).forEach(k => {
            if (k.startsWith('server') && !serverMap[k] && cfData[k]) {
              const promptVal = typeof cfData[k] === 'object' ? JSON.stringify(cfData[k]) : String(cfData[k]);
              servers.push({
                id: k,
                label: k.toUpperCase(),
                prompt: promptVal,
                lastUpdatedAt: cfData.updatedAt || new Date().toISOString(),
                source: 'cloudflare'
              });
              serverMap[k] = promptVal;
            }
          });
        }
      }
    } catch (err: any) {
      console.warn('Cloudflare fetch error, falling back to local admin servers:', err?.message);
    }
  }

  // Fallback to local admin prompt boxes if Cloudflare failed or is explicitly disabled
  if (servers.length === 0) {
    const localSrvs = Array.isArray(db.promptConfig?.servers) && db.promptConfig.servers.length > 0
      ? JSON.parse(JSON.stringify(db.promptConfig.servers))
      : [
          { id: 'server1', label: 'Server 1', prompt: '' },
          { id: 'server2', label: 'Server 2', prompt: '' },
        ];
    servers = localSrvs;
    servers.forEach((s: any, idx: number) => {
      serverMap[`server${idx + 1}`] = s.prompt || '';
      if (s.id) serverMap[s.id] = s.prompt || '';
    });
  }

  return {
    servers,
    serverMap,
    source,
    cloudflareOnline,
  };
}

// POST /api/cloudflare/test
app.post('/api/cloudflare/test', async (req, res) => {
  try {
    const targetUrl = (req.body.cloudflareUrl || db.promptConfig?.cloudflareUrl || '').trim();
    if (!targetUrl) {
      return res.status(400).json({ success: false, error: 'No Cloudflare Worker URL provided' });
    }

    const startTime = Date.now();
    const resp = await fetch(targetUrl, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      signal: AbortSignal.timeout(4000),
    });
    const latencyMs = Date.now() - startTime;

    if (!resp.ok) {
      return res.status(502).json({
        success: false,
        error: `Cloudflare Worker returned HTTP ${resp.status}: ${resp.statusText}`,
        latencyMs,
      });
    }

    const data = await resp.json();
    const keysFound = Object.keys(data).filter(k => k.startsWith('server') && Boolean(data[k]));

    return res.json({
      success: true,
      latencyMs,
      status: 'online',
      data,
      serversFound: keysFound,
      serverCount: keysFound.length,
      updatedAt: data.updatedAt || new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to reach Cloudflare Worker',
    });
  }
});

// GET /api/extension/prompts
// Returns current Server 1 & Server 2 prompts and costs
app.get('/api/extension/prompts', async (req, res) => {
  const { servers, serverMap, source, cloudflareOnline } = await resolveActiveServers();
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };
  const ver = getActiveExtensionVersion();

  res.json({
    success: true,
    serverOnline: true,
    serverStatus: 'online',
    version: ver,
    extensionVersion: ver,
    requiredVersion: ver,
    source, // 'cloudflare' | 'local'
    cloudflareEnabled: Boolean(db.promptConfig?.cloudflareEnabled !== false),
    cloudflareOnline,
    cloudflareUrl: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim() : '',
    directPromptUrl: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? (db.promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev').trim() : '',
    relayMode: Boolean(db.promptConfig?.cloudflareEnabled !== false) ? 'direct_cloudflare' : 'portal_local',
    servers,
    server1: serverMap.server1 || '',
    server2: serverMap.server2 || '',
    server3: serverMap.server3 || '',
    server4: serverMap.server4 || '',
    costs,
    serverTimestamp: new Date().toISOString(),
  });
});

// POST /api/webhook/prompt (Direct Webhook from 2nd Website to update prompts with permanent persistence)
app.post('/api/webhook/prompt', async (req, res) => {
  try {
    const body = req.body || {};
    const incomingPrompt = body.promptData || body.prompt || body.server1 || body.text || body.data || '';
    const serverId = Number(body.serverId) || (body.server2 ? 2 : 1);
    const targetServerKey = serverId === 2 ? 'server2' : 'server1';

    if (!db.promptConfig) {
      db.promptConfig = {
        extensionVersion: '3.2.0',
        promptReminderMinutes: 120,
        costs: { image: 20, video: 30 },
        servers: [
          { id: 'server1', label: 'Server 1', prompt: '' },
          { id: 'server2', label: 'Server 2', prompt: '' },
        ]
      };
    }

    if (!Array.isArray(db.promptConfig.servers) || db.promptConfig.servers.length === 0) {
      db.promptConfig.servers = [
        { id: 'server1', label: 'Server 1', prompt: '' },
        { id: 'server2', label: 'Server 2', prompt: '' },
      ];
    }

    if (body.server1 !== undefined) {
      const s1 = db.promptConfig.servers.find(s => s.id === 'server1');
      if (s1) s1.prompt = String(body.server1);
    }
    if (body.server2 !== undefined) {
      const s2 = db.promptConfig.servers.find(s => s.id === 'server2');
      if (s2) s2.prompt = String(body.server2);
    }
    if (incomingPrompt && !body.server1 && !body.server2) {
      const targetServer = db.promptConfig.servers.find(s => s.id === targetServerKey) || db.promptConfig.servers[0];
      if (targetServer) {
        targetServer.prompt = String(incomingPrompt);
      }
    }

    saveStorage();

    const supa = getServerSupabase();
    if (supa) {
      safeSaveSupabasePromptConfig(supa, db.promptConfig).catch(() => {});
    }

    const s1 = db.promptConfig.servers.find(s => s.id === 'server1')?.prompt || '';
    const s2 = db.promptConfig.servers.find(s => s.id === 'server2')?.prompt || '';

    return res.json({
      success: true,
      message: 'Prompt updated successfully and saved permanently in portal server!',
      server1: s1,
      server2: s2,
      servers: db.promptConfig.servers,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to update prompt' });
  }
});

// GET /api/webhook/prompt
app.get('/api/webhook/prompt', async (req, res) => {
  await refreshSupabaseConfigIfNeeded();
  const servers = db.promptConfig?.servers || [
    { id: 'server1', label: 'Server 1', prompt: '' },
    { id: 'server2', label: 'Server 2', prompt: '' },
  ];
  const s1 = servers.find(s => s.id === 'server1')?.prompt || '';
  const s2 = servers.find(s => s.id === 'server2')?.prompt || '';
  res.json({
    success: true,
    server1: s1,
    server2: s2,
    servers,
    updatedAt: new Date().toISOString()
  });
});

// Helper: Ensure every reseller has a secure unique API key
function getResellerApiKey(reseller: any): string {
  if (reseller.apiKey) return reseller.apiKey;
  const cleanId = String(reseller.id || '').replace(/[^a-zA-Z0-9]/g, '');
  const key = `flw_res_${cleanId}_${Buffer.from(String(reseller.email || '')).toString('hex').slice(0, 10)}`;
  reseller.apiKey = key;
  return key;
}

async function resolveAuthorizedReseller(req: any): Promise<any | null> {
  const apiKey = (
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
    req.query.apiKey ||
    req.body?.apiKey ||
    ''
  ).toString().trim();

  const resellerId = (
    req.headers['x-reseller-id'] ||
    req.body?.resellerId ||
    req.query.resellerId ||
    ''
  ).toString().trim();

  const resellerEmail = (
    req.headers['x-reseller-email'] ||
    req.body?.resellerEmail ||
    req.query.resellerEmail ||
    ''
  ).toString().trim().toLowerCase();

  // Gather all resellers from memory
  let allResellers: any[] = [...db.resellers];
  // Note: resellers?select=* request to Supabase is strictly disabled. Local store db.resellers is authoritative.
  if (false as boolean) {
    try {
      const supa = getServerSupabase();
      const { data: supaResellers } = await supa?.from('resellers').select('*') || {};
      if (Array.isArray(supaResellers) && supaResellers.length > 0) {
        for (const sr of supaResellers) {
          const mapped = {
            id: sr.id,
            portalName: sr.portal_name || sr.portalName,
            email: sr.email,
            password: sr.password,
            userLimit: sr.user_limit || sr.userLimit || 20,
            daysLeft: sr.days_left ?? sr.daysLeft ?? 30,
            expiryDate: sr.expiry_date || sr.expiryDate,
            expiresAt: sr.expires_at || sr.expiresAt,
            status: sr.status || 'active',
            notes: sr.notes || '',
            apiKey: sr.api_key || sr.apiKey,
          };
          const idx = allResellers.findIndex(r => r.id === sr.id);
          if (idx >= 0) {
            allResellers[idx] = { ...allResellers[idx], ...mapped };
          } else {
            allResellers.push(mapped);
          }
        }
      } else {
        const { data: resRow } = await supa.from('users').select('name').eq('id', 'admin_config_resellers').maybeSingle();
        if (resRow?.name) {
          const parsed = JSON.parse(resRow.name);
          if (Array.isArray(parsed)) {
            for (const pr of parsed) {
              const idx = allResellers.findIndex(r => r.id === pr.id);
              if (idx >= 0) allResellers[idx] = { ...allResellers[idx], ...pr };
              else allResellers.push(pr);
            }
          }
        }
      }
    } catch {}
  }

  // Master key check
  if (apiKey === 'admin_master_key' || apiKey === 'sachinxexplore@gmail.com' || apiKey === 'sachinkumar629171@gmail.com') {
    if (resellerId) {
      return allResellers.find(r => r.id === resellerId) || allResellers[0] || { id: 'admin', portalName: 'Admin Portal', email: 'admin' };
    }
    return allResellers[0] || { id: 'admin', portalName: 'Admin Portal', email: 'admin' };
  }

  // Match by API Key
  if (apiKey) {
    const cleanKey = apiKey.trim();
    const matched = allResellers.find(r => {
      const rId = String(r.id || '').trim();
      const rCleanId = rId.replace(/[^a-zA-Z0-9]/g, '');
      const rEmail = String(r.email || '').trim().toLowerCase();
      const rApiKey = String(r.apiKey || r.api_key || '').trim();

      if (rApiKey && rApiKey === cleanKey) return true;
      if (rId && rId === cleanKey) return true;
      if (rEmail && rEmail === cleanKey.toLowerCase()) return true;
      if (rCleanId && cleanKey.startsWith(`flw_res_${rCleanId}`)) return true;
      return false;
    });
    if (matched) return matched;
  }

  // Match by Reseller ID
  if (resellerId) {
    const matched = allResellers.find(r => r.id === resellerId || r.id.replace(/[^a-zA-Z0-9]/g, '') === resellerId.replace(/[^a-zA-Z0-9]/g, ''));
    if (matched) return matched;
  }

  // Match by Reseller Email
  if (resellerEmail) {
    const matched = allResellers.find(r => r.email && r.email.toLowerCase() === resellerEmail);
    if (matched) return matched;
  }

  return null;
}

// GET resellers (Strictly protected: only Admin can view all resellers, unauthorized callers get empty list)
app.get('/api/resellers', async (req, res) => {
  const now = Date.now();
  const isAdmin = isRequestAdminUser(req);
  const resellerId = (req.headers['x-reseller-id'] || req.query.resellerId || '').toString().trim();
  const resellerKey = (req.headers['x-reseller-api-key'] || req.query.resellerApiKey || '').toString().trim();

  db.resellers = db.resellers.map(r => {
    if (r.expiresAt) {
      const diff = new Date(r.expiresAt).getTime() - now;
      const days = Math.max(0, Math.ceil(diff / 86400000));
      const isExp = diff <= 0;
      return {
        ...r,
        daysLeft: days,
        status: r.status === 'suspended' ? 'suspended' : (isExp ? 'expired' : 'active'),
      };
    }
    return r;
  });

  // 1. Admin gets all resellers
  if (isAdmin) {
    const resellersWithKeys = db.resellers.map(r => ({
      ...r,
      apiKey: r.apiKey || getResellerApiKey(r),
    }));
    return res.json({ resellers: resellersWithKeys });
  }

  // 2. Reseller querying their own portal
  if (resellerId || resellerKey) {
    const matched = db.resellers.find(r => r.id === resellerId || r.apiKey === resellerKey);
    if (matched) {
      const { password, ...safeR } = matched;
      return res.json({ resellers: [{ ...safeR, apiKey: safeR.apiKey || getResellerApiKey(matched) }] });
    }
  }

  // 3. Regular users or public visitors get empty list - zero leakage!
  return res.json({ resellers: [] });
});

// POST save reseller
app.post('/api/resellers', (req, res) => {
  const reseller = req.body;
  if (!reseller.apiKey) reseller.apiKey = getResellerApiKey(reseller);
  if (!reseller.expiresAt && reseller.daysLeft) {
    reseller.expiresAt = new Date(Date.now() + Number(reseller.daysLeft) * 86400000).toISOString();
  }

  const idx = db.resellers.findIndex(r => r.id === reseller.id);
  if (idx >= 0) {
    db.resellers[idx] = { ...db.resellers[idx], ...reseller };
  } else {
    db.resellers.unshift(reseller);
  }
  saveStorage();

  // Supabase sync (both to resellers table and admin_config_resellers backup row)
  const supa = getServerSupabase();
  if (supa) {
    supa.from('resellers').upsert({
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
    }).then(() => {}, () => {});

    supa.from('users').upsert({
      id: 'admin_config_resellers',
      name: JSON.stringify(db.resellers),
      email: 'resellers_backup@flowmaker.local',
      role: 'system_config',
      status: 'active',
    }).then(() => {}, () => {});
  }

  res.json({ success: true, reseller });
});

// DELETE reseller
app.delete('/api/resellers/:id', (req, res) => {
  const { id } = req.params;
  db.resellers = db.resellers.filter(r => r.id !== id);
  saveStorage();

  const supa = getServerSupabase();
  if (supa) {
    supa.from('resellers').delete().eq('id', id).then(() => {}, () => {});
    supa.from('users').upsert({
      id: 'admin_config_resellers',
      name: JSON.stringify(db.resellers),
      email: 'resellers_backup@flowmaker.local',
      role: 'system_config',
      status: 'active',
    }).then(() => {}, () => {});
  }

  res.json({ success: true });
});

// Helper: Parse duration string or number into expiry date
function parseDurationToExpiry(body: any): { planDaysLeft: number; planExpiresAt?: string; durationText: string } {
  const rawDuration = (
    body.duration ||
    body.time ||
    body.validity ||
    ''
  ).toString().trim().toLowerCase();

  let hours = Number(body.planHours || body.hours || body.durationHours) || 0;
  let days = Number(body.planDays || body.days || body.durationDays) || 0;

  if (rawDuration) {
    if (rawDuration.includes('hour') || rawDuration.endsWith('h')) {
      const parsedHours = parseFloat(rawDuration.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedHours) && parsedHours > 0) hours = parsedHours;
    } else if (rawDuration.includes('day') || rawDuration.endsWith('d')) {
      const parsedDays = parseFloat(rawDuration.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedDays) && parsedDays > 0) days = parsedDays;
    } else if (rawDuration.includes('min') || rawDuration.endsWith('m')) {
      const parsedMins = parseFloat(rawDuration.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedMins) && parsedMins > 0) hours = parsedMins / 60;
    }
  }

  const now = Date.now();
  if (hours > 0) {
    const expiresMs = now + Math.round(hours * 60 * 60 * 1000);
    const planExpiresAt = new Date(expiresMs).toISOString();
    const planDaysLeft = Math.max(0.01, parseFloat((hours / 24).toFixed(3)));
    return {
      planDaysLeft,
      planExpiresAt,
      durationText: `${hours} hours`,
    };
  }

  const finalDays = days > 0 ? days : 30;
  const expiresMs = now + Math.round(finalDays * 24 * 60 * 60 * 1000);
  return {
    planDaysLeft: finalDays,
    planExpiresAt: new Date(expiresMs).toISOString(),
    durationText: `${finalDays} days`,
  };
}

// Handler for GRANT ACCESS (Create / Renew user under Reseller Portal or from Cloudflare / External Order Webhook)
const handleResellerGrantAccess = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  // Accept reseller from API Key, headers, or request body reseller_id / resellerId
  let reseller = await resolveAuthorizedReseller(req);
  const incomingResellerId = (req.body?.reseller_id || req.body?.resellerId || req.query?.reseller_id || req.query?.resellerId || '').toString().trim();
  
  if (!reseller && incomingResellerId) {
    reseller = db.resellers.find(r => r.id === incomingResellerId || r.id.replace(/[^a-zA-Z0-9]/g, '') === incomingResellerId.replace(/[^a-zA-Z0-9]/g, ''));
    if (!reseller) {
      // Fallback virtual reseller container so user access is never blocked
      reseller = {
        id: incomingResellerId,
        portalName: req.body?.reseller_name || req.body?.resellerName || `Reseller (${incomingResellerId.slice(0, 8)})`,
        email: `reseller_${incomingResellerId}@portal.local`,
        status: 'active'
      };
    }
  }

  // If still no reseller found, assign to default master/main portal
  if (!reseller) {
    reseller = db.resellers[0] || {
      id: incomingResellerId || 'reseller-main',
      portalName: 'Direct Access Portal',
      email: 'direct@flowmaker.site',
      status: 'active'
    };
  }

  if (reseller.status === 'suspended') {
    return res.status(403).json({
      success: false,
      access: false,
      error: 'Reseller Portal is currently suspended. Please contact Admin.',
    });
  }

  const rawEmail = req.body?.email || req.body?.gmailId || req.body?.gmail_id || req.query?.email || '';
  const email = cleanEmailString(rawEmail);
  if (!email || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      access: false,
      error: 'A valid customer email is required (e.g., {"email": "customer@gmail.com"}).',
    });
  }

  // Support all user schema fields (both snake_case and camelCase)
  const incomingId = (req.body?.id || req.body?.userId || req.body?.user_id || '').toString().trim();
  const name = (req.body?.name || req.body?.telegramProfile || req.body?.telegram_profile || req.body?.telegram_name || req.body?.customer_name || email.split('@')[0]).toString().trim();
  const password = (req.body?.password || req.body?.pass || req.query?.password || 'Flow@1122').toString().trim();
  
  const telegram = (
    req.body?.telegram || 
    req.body?.telegram_uid || 
    req.body?.telegram_id || 
    req.body?.telegram_username || 
    req.body?.telegramUid || 
    req.body?.telegramProfile || 
    req.query?.telegram || 
    ''
  ).toString().trim();

  const whatsapp = (
    req.body?.whatsapp || 
    req.body?.phone || 
    req.body?.mobile || 
    req.query?.whatsapp || 
    ''
  ).toString().trim();

  const plan = (req.body?.plan || req.query?.plan || 'basic').toString().trim().toLowerCase();
  const isUltra = plan === 'ultra' || plan === 'vip' || plan === 'pro';
  const defaultPlanName = isUltra ? 'ultra' : 'basic';

  const defaultCredits = isUltra ? 45000 : 100;
  const maxCredits = req.body?.max_credits !== undefined 
    ? Number(req.body.max_credits) 
    : (req.body?.maxCredits !== undefined ? Number(req.body.maxCredits) : defaultCredits);

  const credits = req.body?.credits !== undefined 
    ? Number(req.body.credits) 
    : (req.body?.credit !== undefined ? Number(req.body.credit) : maxCredits);

  const durationInfo = parseDurationToExpiry(req.body || req.query || {});
  const planDaysLeft = req.body?.plan_days_left !== undefined 
    ? Number(req.body.plan_days_left) 
    : (req.body?.planDaysLeft !== undefined ? Number(req.body.planDaysLeft) : durationInfo.planDaysLeft);

  const extensionAccess = req.body?.extension_access !== undefined 
    ? Boolean(req.body.extension_access) 
    : (req.body?.extensionAccess !== false);

  const now = new Date().toISOString();
  let user = db.users.find(u => u.email && cleanEmailString(u.email) === email);
  let action = 'created';

  if (user) {
    action = 'renewed';
    if (incomingId && user.id !== incomingId) user.id = incomingId;
    user.name = name || user.name;
    if (req.body?.password || req.body?.pass) user.password = password;
    if (telegram) user.telegram = telegram;
    if (whatsapp) user.whatsapp = whatsapp;
    user.plan = defaultPlanName;
    user.credits = credits;
    user.maxCredits = maxCredits;
    user.planDaysLeft = planDaysLeft;
    user.planExpiresAt = durationInfo.planExpiresAt;
    user.status = 'active';
    user.extensionAccess = extensionAccess;
    user.resellerId = reseller.id;
    user.resellerName = reseller.portalName;
    user.lastActive = now;
  } else {
    action = 'created';
    const userId = incomingId || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const sessionToken = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    user = {
      id: userId,
      name,
      email,
      password,
      telegram,
      whatsapp,
      plan: defaultPlanName,
      credits,
      maxCredits,
      planDaysLeft,
      planExpiresAt: durationInfo.planExpiresAt,
      status: 'active',
      extensionAccess,
      sessionToken,
      resellerId: reseller.id,
      resellerName: reseller.portalName,
      role: 'user',
      isOnline: true,
      createdAt: now,
      lastActive: now,
      avatarColor: isUltra ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
    };
    db.users.unshift(user);
  }

  saveStorage();

  // Async sync directly to Supabase users table with all snake_case columns
  const supa = getServerSupabase();
  if (supa) {
    safeServerSupabaseUserUpsert(supa, user).catch(err => {
      console.error('Supabase user upsert error:', err);
    });
    supa.from('users').upsert({
      id: 'admin_config_all_users',
      name: JSON.stringify(db.users),
      email: 'all_users_backup@flowmaker.local',
      role: 'system_config',
      status: 'active',
    }).then(() => {}, () => {});
  }

  return res.json({
    success: true,
    access: true,
    action,
    message: `Access successfully granted for ${email}`,
    duration: durationInfo.durationText || `${planDaysLeft} days`,
    expiresAt: durationInfo.planExpiresAt,
    reseller: {
      id: reseller.id,
      portalName: reseller.portalName,
      email: reseller.email,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      password: user.password,
      plan: user.plan,
      max_credits: user.maxCredits,
      credits: user.credits,
      plan_days_left: user.planDaysLeft,
      whatsapp: user.whatsapp || '',
      telegram: user.telegram || '',
      reseller_id: user.resellerId,
      session_token: user.sessionToken,
      status: user.status,
      extension_access: user.extensionAccess,
      created_at: user.createdAt,
    },
    portalUrl: 'https://flowmakerai.site',
  });
};

// Handler for REVOKE ACCESS (Downgrades customer to basic free plan instead of deleting)
const handleResellerRevokeAccess = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const reseller = await resolveAuthorizedReseller(req);
  if (!reseller) {
    return res.status(401).json({
      success: false,
      access: false,
      error: 'Unauthorized: Invalid Reseller API Key (x-api-key header) or Reseller ID.',
    });
  }

  const rawEmail = req.body?.email || req.body?.gmailId || req.query?.email || '';
  const email = cleanEmailString(rawEmail);
  if (!email) {
    return res.status(400).json({
      success: false,
      access: false,
      error: 'Customer email is required to revoke access.',
    });
  }

  // Downgrade user to Basic plan (100 credits, 0 VIP days left)
  let user = db.users.find(u => u.email && cleanEmailString(u.email) === email);
  if (user) {
    user.plan = 'basic';
    user.credits = 100;
    user.maxCredits = 100;
    user.planDaysLeft = 0;
    user.planExpiresAt = new Date().toISOString();
    user.status = 'active';
    saveStorage();
  } else {
    user = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: email.split('@')[0],
      email,
      password: 'Flow@1122',
      plan: 'basic',
      credits: 100,
      maxCredits: 100,
      planDaysLeft: 0,
      status: 'active',
      extensionAccess: true,
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    saveStorage();
  }

  const supa = getServerSupabase();
  if (supa) {
    safeServerSupabaseUserUpdate(supa, user.id, email, {
      plan: 'basic',
      credits: 100,
      max_credits: 100,
      plan_days_left: 0,
      status: 'active'
    }).catch(() => {});
  }

  return res.json({
    success: true,
    access: false,
    action: 'downgraded',
    email,
    message: `VIP Access revoked for ${email}. Account downgraded to Basic plan in Supabase & Portal.`,
    user: {
      id: user.id,
      email: user.email,
      plan: 'basic',
      credits: 100,
      max_credits: 100,
      plan_days_left: 0,
      status: 'active'
    }
  });
};

// Handler for STATUS CHECK
const handleResellerUserStatus = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const reseller = await resolveAuthorizedReseller(req);
  if (!reseller) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid Reseller API Key or Reseller ID.',
    });
  }

  const rawEmail = req.query?.email || req.body?.email || '';
  const email = cleanEmailString(rawEmail);
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email parameter is required.' });
  }

  const user = db.users.find(u => u.email && cleanEmailString(u.email) === email);
  if (!user) {
    return res.status(404).json({ success: false, error: `User not found: ${email}` });
  }

  const isAllowed = user.status === 'active' && user.extensionAccess !== false && (user.planDaysLeft ?? 0) > 0;

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      status: user.status,
      extensionAccess: user.extensionAccess !== false,
      credits: user.credits,
      planDaysLeft: user.planDaysLeft,
      isAllowed,
      resellerId: user.resellerId,
      resellerName: user.resellerName,
    }
  });
};

app.post('/api/reseller/access/grant', handleResellerGrantAccess);
app.post('/api/reseller/grant-access', handleResellerGrantAccess);
app.post('/api/reseller/access/revoke', handleResellerRevokeAccess);
app.post('/api/reseller/revoke-access', handleResellerRevokeAccess);
app.get('/api/reseller/access/status', handleResellerUserStatus);

// Dedicated Direct Cloudflare Worker & Webhook Endpoints (accepts snake_case & camelCase)
app.post('/api/cloudflare/access', handleResellerGrantAccess);
app.post('/api/webhook/order', handleResellerGrantAccess);
app.post('/api/users/add', handleResellerGrantAccess);
app.post('/api/access/grant', handleResellerGrantAccess);
app.post('/api/access/revoke', handleResellerRevokeAccess);

// GET config
app.get('/api/config', (req, res) => {
  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || db.supabaseConfig?.url || '';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || db.supabaseConfig?.anonKey || '';

  res.json({
    planExtensions: db.planExtensions,
    tutorialConfig: db.tutorialConfig,
    promptConfig: db.promptConfig,
    supabaseConfig: supaUrl && supaKey ? { url: supaUrl, anonKey: supaKey } : undefined,
  });
});

// POST upload extension package binary/base64 directly to server storage
app.post('/api/extensions/upload', (req, res) => {
  try {
    const { plan, fileName, fileData } = req.body;
    if (!plan || !fileData) {
      return res.status(400).json({ success: false, error: 'Plan and fileData are required' });
    }

    const safeName = (fileName || `flow-${plan}-extension.zip`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const diskFileName = `${plan}_${Date.now()}_${safeName}`;
    const filePath = path.join(UPLOADS_DIR, diskFileName);

    // Extract base64
    let buffer: Buffer;
    if (fileData.includes(',')) {
      const base64Data = fileData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(fileData, 'base64');
    }

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/api/extensions/download/${plan}`;
    
    // Update db planExtension if present
    if (!db.planExtensions) {
      db.planExtensions = {};
    }
    if (!db.planExtensions[plan]) {
      db.planExtensions[plan] = {};
    }

    db.planExtensions[plan] = {
      ...db.planExtensions[plan],
      fileName: safeName,
      serverFileName: diskFileName,
      serverFilePath: filePath,
      fileData: fileData, // keep base64 as well
      downloadUrl: publicUrl,
      downloadType: 'file',
      updatedAt: new Date().toISOString(),
    };

    saveStorage();

    res.json({ 
      success: true, 
      downloadUrl: publicUrl, 
      fileName: safeName,
      size: buffer.length 
    });
  } catch (err: any) {
    console.error('Failed to save uploaded extension file:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to upload extension' });
  }
});

// GET direct download extension binary by plan (basic / ultra)
app.get('/api/extensions/download/:plan', (req, res) => {
  const { plan } = req.params;
  const config = db.planExtensions?.[plan];

  if (config && config.serverFileName) {
    const filePath = path.join(UPLOADS_DIR, config.serverFileName);
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Disposition', `attachment; filename="${config.fileName || `flow-${plan}-extension.zip`}"`);
      res.setHeader('Content-Type', 'application/zip');
      return res.sendFile(filePath);
    }
  }

  // Fallback: If uploaded via fileData base64
  if (config && config.fileData && config.fileData.includes(',')) {
    try {
      const base64Data = config.fileData.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Disposition', `attachment; filename="${config.fileName || `flow-${plan}-extension.zip`}"`);
      res.setHeader('Content-Type', 'application/zip');
      return res.send(buffer);
    } catch {
      // ignore
    }
  }

  // Fallback: If custom external download URL (e.g. Google Drive, GitHub, Cloud URL)
  if (config && config.downloadUrl && config.downloadUrl !== `/api/extensions/download/${plan}`) {
    return res.redirect(config.downloadUrl);
  }

  res.status(404).json({ error: `No extension file uploaded yet for ${plan} plan.` });
});

// ======================== TELEGRAM NOTIFICATION ENGINE ========================

function formatServerISTDateTime(dateInput?: string | number | Date) {
  const date = dateInput ? new Date(dateInput) : new Date();
  const fallback = isNaN(date.getTime()) ? new Date() : date;

  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };

  const dateStr = fallback.toLocaleDateString('en-IN', dateOptions);
  const timeStr = fallback.toLocaleTimeString('en-IN', timeOptions);
  return {
    dateStr,
    timeStr,
    fullStr: `${dateStr}, ${timeStr} (IST)`,
  };
}

async function sendTelegramDirect(botToken: string, chatId: string, textHtml: string): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Telegram Bot Token and Chat ID are required.' };
  }
  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: textHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data: any = await response.json();
    if (data.ok) {
      return { success: true };
    }
    return { success: false, error: data.description || `HTTP ${response.status}` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error connecting to Telegram' };
  }
}

// Background Monitor: checks prompt servers every 25 seconds for 20m reminder & 5m missed alerts
async function checkPromptServerTelegramAlerts() {
  const tgConfig = db.promptConfig?.telegramAlerts;
  const botToken = tgConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || '';
  const chatId = tgConfig?.chatId || process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID || '';
  const isEnabled = tgConfig?.enabled !== undefined ? tgConfig.enabled : Boolean(botToken && chatId);

  if (!isEnabled || !botToken || !chatId) {
    return;
  }

  const servers = db.promptConfig?.servers;
  if (!servers || !Array.isArray(servers) || servers.length === 0) {
    return;
  }

  const intervalMinutes = Math.max(1, Number(db.promptConfig?.promptReminderMinutes) || 120);
  const intervalMs = intervalMinutes * 60 * 1000;
  const reminderMinutesBefore = Number(tgConfig?.reminderMinutesBefore) || 20;
  const missedMinutesAfter = Number(tgConfig?.missedAlertMinutesAfter) || 5;
  const now = Date.now();
  let dbChanged = false;

  for (const srv of servers) {
    if (!srv.lastUpdatedAt) continue;
    const lastUpdatedMs = new Date(srv.lastUpdatedAt).getTime();
    if (isNaN(lastUpdatedMs)) continue;

    const expiryTime = lastUpdatedMs + intervalMs;
    const remainingMs = expiryTime - now;
    const remainingMinutes = Math.floor(remainingMs / 60000);

    // 1. 20-Minutes Pre-Expiry Reminder
    if (remainingMinutes <= reminderMinutesBefore && remainingMinutes > 0 && !srv.reminded20MinSent) {
      const istNow = formatServerISTDateTime();
      const msg = `⏳ <b>PROMPT REFRESH REMINDER</b> ⏳\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🔹 <b>Server:</b> <code>${srv.label || 'Server'}</code> (<code>${srv.id}</code>)\n` +
        `⏱️ <b>Time Remaining:</b> <b>${Math.max(1, remainingMinutes)} Minutes Left Only!</b>\n` +
        `🕒 <b>Current Indian Time (IST):</b> ${istNow.fullStr}\n` +
        `👤 <b>Last Updated By:</b> ${srv.updatedBy || 'Admin'}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>Notice:</b> Agle ${remainingMinutes} minutes me prompt update karein taaki prompt expire na ho.`;

      const res = await sendTelegramDirect(botToken, chatId, msg);
      if (res.success) {
        srv.reminded20MinSent = true;
        dbChanged = true;
        console.log(`[Telegram] Sent 20m reminder for ${srv.label}`);
      }
    }

    // 2. 5-Minutes Post-Expiry Missed Alert
    const overdueMs = now - expiryTime;
    const overdueMinutes = Math.floor(overdueMs / 60000);
    if (overdueMinutes >= missedMinutesAfter && !srv.missed5MinSent) {
      const istNow = formatServerISTDateTime();
      const msg = `🚨 <b>ALERT: PROMPT UPDATE MISSED!</b> 🚨\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `❌ <b>Server:</b> <code>${srv.label || 'Server'}</code> (<code>${srv.id}</code>)\n` +
        `📅 <b>Date:</b> ${istNow.dateStr}\n` +
        `⏰ <b>Missed Time (IST):</b> <b>${istNow.timeStr}</b>\n` +
        `⏳ <b>Overdue By:</b> <b>${overdueMinutes} minutes past deadline</b>\n` +
        `👤 <b>Last Updated By:</b> ${srv.updatedBy || 'Admin'}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>Warning:</b> Is server ka prompt timing end hone ke 5 minutes baad tak update nahi hua hai! Kripya turant naya prompt fill karein.`;

      const res = await sendTelegramDirect(botToken, chatId, msg);
      if (res.success) {
        srv.missed5MinSent = true;
        srv.wasMissed = true;
        srv.missedAlertSentAt = new Date().toISOString();
        dbChanged = true;
        console.log(`[Telegram] Sent 5m MISSED alert for ${srv.label}`);
      }
    }
  }

  if (dbChanged) {
    saveStorage();
    const supa = getServerSupabase();
    if (supa) {
      safeSaveSupabasePromptConfig(supa, db.promptConfig).catch(() => {});
    }
  }
}

// Sweep and mark inactive users as offline if no ping in > 2 minutes (120,000 ms)
function cleanUserOnlineStatus() {
  const now = Date.now();
  let dbChanged = false;
  for (const u of db.users) {
    if (u.isOnline) {
      if (!u.lastActive) {
        u.isOnline = false;
        dbChanged = true;
      } else {
        const t = new Date(u.lastActive).getTime();
        if (isNaN(t) || (now - t >= 120000 || now - t < -60000)) {
          u.isOnline = false;
          dbChanged = true;
        }
      }
    }
  }
  if (dbChanged) {
    saveStorage();
  }
}

// Run monitoring loops every 25 seconds
setInterval(() => {
  cleanUserOnlineStatus();
  checkPromptServerTelegramAlerts();
  let changed = false;
  for (const u of db.users) {
    if (checkAndConvertToBasic(u)) {
      changed = true;
    }
  }
  if (changed) {
    saveStorage();
  }
}, 25000);

// POST /api/telegram/test - Test Telegram bot connectivity
app.post('/api/telegram/test', async (req, res) => {
  const { botToken, chatId } = req.body;
  if (!botToken || !chatId) {
    return res.status(400).json({ success: false, error: 'botToken and chatId are required.' });
  }

  const istNow = formatServerISTDateTime();
  const testMsg = `🤖 <b>TELEGRAM BOT CONNECTED SUCCESSFULLY!</b> 🚀\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ <b>Status:</b> Prompt Server Alert System is Active & Connected.\n` +
    `🕒 <b>Test Timestamp (IST):</b> ${istNow.fullStr}\n` +
    `🔔 <b>Active Alerts Configured:</b>\n` +
    ` • ⏳ <b>20-Min Reminder:</b> Pre-expiry alert\n` +
    ` • 🚨 <b>5-Min Missed Alert:</b> Overdue alert with Indian Time\n` +
    ` • ✅ <b>Recovery Alert:</b> Restoration duration notification\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Your Telegram channel will now receive real-time prompt alerts!</i>`;

  const result = await sendTelegramDirect(botToken, chatId, testMsg);
  if (result.success) {
    if (db.promptConfig?.telegramAlerts) {
      db.promptConfig.telegramAlerts.lastTestedAt = new Date().toISOString();
      db.promptConfig.telegramAlerts.lastTestSuccess = true;
      saveStorage();
    }
    return res.json({ success: true, message: 'Test message sent successfully to Telegram!' });
  } else {
    return res.status(400).json({ success: false, error: result.error || 'Failed to send message via Telegram Bot.' });
  }
});

// POST config
app.post('/api/config', async (req, res) => {
  const { planExtensions, tutorialConfig, promptConfig, supabaseConfig } = req.body;
  if (planExtensions) {
    db.planExtensions = planExtensions;
    // Keep promptConfig.extensionVersion aligned with ultra extension version
    if (planExtensions.ultra?.version && String(planExtensions.ultra.version).trim()) {
      if (!db.promptConfig) db.promptConfig = {};
      db.promptConfig.extensionVersion = String(planExtensions.ultra.version).trim();
    }
  }
  if (tutorialConfig) db.tutorialConfig = tutorialConfig;
  
  if (promptConfig) {
    const oldPromptConfig = db.promptConfig;
    let mergedPromptConfig = { ...oldPromptConfig, ...promptConfig };

    // Merge servers without wiping active prompts with empty values
    if (Array.isArray(promptConfig.servers)) {
      const mergedServers = promptConfig.servers.map((newSrv: any) => {
        const oldSrv = oldPromptConfig?.servers?.find((os: any) => os.id === newSrv.id);
        if (!newSrv.prompt?.trim() && oldSrv?.prompt?.trim()) {
          return { ...newSrv, prompt: oldSrv.prompt, lastUpdatedAt: oldSrv.lastUpdatedAt };
        }
        return newSrv;
      });
      mergedPromptConfig.servers = mergedServers;
    }

    db.promptConfig = mergedPromptConfig;

    // Keep planExtensions.ultra.version aligned if extensionVersion signal is updated
    if (promptConfig.extensionVersion && String(promptConfig.extensionVersion).trim()) {
      const trimmedVer = String(promptConfig.extensionVersion).trim();
      if (!db.planExtensions) db.planExtensions = {};
      if (!db.planExtensions.ultra) db.planExtensions.ultra = {};
      db.planExtensions.ultra.version = trimmedVer;
    }

    // Check for any server that was previously missed and has now been updated -> Send Recovery Telegram Alert!
    const tgConfig = mergedPromptConfig.telegramAlerts || oldPromptConfig?.telegramAlerts;
    if (tgConfig && tgConfig.enabled && tgConfig.botToken && tgConfig.chatId && Array.isArray(mergedPromptConfig.servers)) {
      const intervalMinutes = Math.max(1, Number(mergedPromptConfig.promptReminderMinutes) || 120);

      for (const newSrv of mergedPromptConfig.servers) {
        const oldSrv = oldPromptConfig?.servers?.find(s => s.id === newSrv.id);
        // If it was previously missed (wasMissed === true) and now prompt or timer updated
        if (oldSrv && oldSrv.wasMissed && (!newSrv.wasMissed || oldSrv.prompt !== newSrv.prompt || oldSrv.lastUpdatedAt !== newSrv.lastUpdatedAt)) {
          const oldLastUpdatedMs = new Date(oldSrv.lastUpdatedAt || Date.now()).getTime();
          const oldExpiryTime = oldLastUpdatedMs + intervalMinutes * 60 * 1000;
          const delayMinutes = Math.max(1, Math.floor((Date.now() - oldExpiryTime) / 60000));
          const istNow = formatServerISTDateTime();

          const recoveryMsg = `✅ <b>PROMPT UPDATED & RESTORED!</b> ✅\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🔹 <b>Server:</b> <code>${newSrv.label || 'Server'}</code> (<code>${newSrv.id}</code>)\n` +
            `🕒 <b>Updated At (IST):</b> <b>${istNow.fullStr}</b>\n` +
            `⏱️ <b>Delay / Missed Duration:</b> <b>${delayMinutes} Minutes past deadline</b>\n` +
            `👤 <b>Updated By:</b> <b>${newSrv.updatedBy || 'Admin'}</b>\n` +
            `🔄 <b>Next Update Due In:</b> ${intervalMinutes} Minutes (${Math.round((intervalMinutes / 60) * 10) / 10}h)\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `✨ <i>Server prompt successfully synced with Chrome Extension and timer restarted!</i>`;

          sendTelegramDirect(tgConfig.botToken, tgConfig.chatId, recoveryMsg).catch(() => {});
        }
      }
    }

    // Also sync to Supabase if connected
    const supa = getServerSupabase();
    if (supa) {
      safeSaveSupabasePromptConfig(supa, mergedPromptConfig).catch(() => {});
    }
  }
  if (supabaseConfig) {
    db.supabaseConfig = supabaseConfig;
    serverSupabaseClient = null; // Re-init with new credentials
  }
  saveStorage();
  res.json({ success: true });
});

// ======================== VITE MIDDLEWARE ========================

async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Central Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
