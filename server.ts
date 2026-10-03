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

function getServerSupabase(): SupabaseClient | null {
  if (serverSupabaseClient) return serverSupabaseClient;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || db.supabaseConfig?.url;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || db.supabaseConfig?.anonKey;
  if (url && key) {
    try {
      serverSupabaseClient = createClient(url, key);
      return serverSupabaseClient;
    } catch (e) {
      console.error('Failed to init Supabase client on server:', e);
    }
  }
  return null;
}

async function safeServerSupabaseUserUpdate(
  supa: SupabaseClient,
  userId: string,
  userEmail: string | undefined,
  fields: Record<string, any>
): Promise<boolean> {
  if (!supa || (!userId && !userEmail)) return false;
  const cleanFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) cleanFields[k] = v;
  }
  if (Object.keys(cleanFields).length === 0) return true;

  try {
    if (userId) {
      const { error, data } = await supa.from('users').update(cleanFields).eq('id', userId).select('id');
      if (!error && data && data.length > 0) return true;
    }
    if (userEmail) {
      const { error, data } = await supa.from('users').update(cleanFields).eq('email', userEmail.toLowerCase()).select('id');
      if (!error && data && data.length > 0) return true;
    }

    // Core fields fallback
    const coreFields: Record<string, any> = {};
    if (cleanFields.credits !== undefined) coreFields.credits = cleanFields.credits;
    if (cleanFields.plan_days_left !== undefined) coreFields.plan_days_left = cleanFields.plan_days_left;
    if (cleanFields.plan !== undefined) coreFields.plan = cleanFields.plan;
    if (cleanFields.name !== undefined) coreFields.name = cleanFields.name;
    if (cleanFields.email !== undefined) coreFields.email = cleanFields.email;
    if (cleanFields.password !== undefined) coreFields.password = cleanFields.password;
    if (cleanFields.status !== undefined) coreFields.status = cleanFields.status;

    if (Object.keys(coreFields).length > 0) {
      if (userId) {
        const { error, data } = await supa.from('users').update(coreFields).eq('id', userId).select('id');
        if (!error && data && data.length > 0) return true;
      }
      if (userEmail) {
        const { error, data } = await supa.from('users').update(coreFields).eq('email', userEmail.toLowerCase()).select('id');
        if (!error && data && data.length > 0) return true;
      }
    }

    // Single field updates fallback
    for (const [k, v] of Object.entries(cleanFields)) {
      try {
        if (userId) await supa.from('users').update({ [k]: v }).eq('id', userId);
        else if (userEmail) await supa.from('users').update({ [k]: v }).eq('email', userEmail.toLowerCase());
      } catch {}
    }
    return true;
  } catch (err) {
    console.error('safeServerSupabaseUserUpdate catch error:', err);
    return false;
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
  if (u.plan === 'ultra') {
    let expired = false;
    if (u.planDaysLeft !== undefined && Number(u.planDaysLeft) <= 0) {
      expired = true;
    } else if (u.planExpiresAt) {
      if (new Date(u.planExpiresAt).getTime() <= Date.now()) {
        expired = true;
      }
    }
    if (expired) {
      u.plan = 'basic';
      u.credits = 100;
      u.maxCredits = 100;
      u.planDaysLeft = 30;

      const supa = getServerSupabase();
      if (supa && u.id && !u.id.startsWith('admin_config_')) {
        supa.from('users').update({
          plan: 'basic',
          credits: 100,
          max_credits: 100,
          plan_days_left: 30,
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

  const ver = db.promptConfig?.extensionVersion || 'v2.4.1';

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

// GET required extension version signal (checks admin panel set version)
app.get('/api/extension/version', async (req, res) => {
  let ver = db.promptConfig?.extensionVersion;
  const supa = getServerSupabase();
  if (supa) {
    try {
      const { data: promptRow } = await supa.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
      if (promptRow?.name) {
        const parsed = JSON.parse(promptRow.name);
        if (parsed?.extensionVersion) {
          ver = parsed.extensionVersion;
        }
      }
    } catch {}
  }
  const finalVer = ver || db.promptConfig?.extensionVersion || 'v2.4.1';
  res.json({
    success: true,
    version: finalVer,
    extensionVersion: finalVer,
    requiredVersion: finalVer
  });
});

// ======================== API ROUTES ========================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', userCount: db.users.length, timestamp: new Date().toISOString() });
});

// GET all users
app.get('/api/users', async (req, res) => {
  const now = Date.now();
  let changed = false;

  const supa = getServerSupabase();
  if (supa) {
    try {
      const { data: supaUsers } = await supa.from('users').select('*');
      if (Array.isArray(supaUsers)) {
        for (const supaU of supaUsers) {
          if (!supaU.id || supaU.id.startsWith('admin_config_')) continue;
          const existingIdx = db.users.findIndex(u => u.id === supaU.id || (u.email && supaU.email && u.email.toLowerCase() === supaU.email.toLowerCase()));
          const mappedUser = {
            id: supaU.id,
            name: supaU.name || 'User',
            email: supaU.email || '',
            password: supaU.password || 'user123',
            sessionToken: supaU.session_token || supaU.sessionToken || (existingIdx !== -1 ? db.users[existingIdx]?.sessionToken : '') || '',
            plan: supaU.plan || 'basic',
            credits: Number(supaU.credits) ?? 100,
            maxCredits: Number(supaU.max_credits) ?? (supaU.plan === 'ultra' ? 45000 : 100),
            planDaysLeft: Number(supaU.plan_days_left) ?? 30,
            role: supaU.role || 'user',
            resellerId: supaU.reseller_id,
            resellerName: supaU.reseller_name,
            status: supaU.status || 'active',
            extensionAccess: supaU.extension_access !== undefined ? supaU.extension_access : true,
            canEditPrompts: supaU.can_edit_prompts === true,
            isOnline: true,
            lastActive: supaU.last_active || new Date().toISOString(),
            createdAt: supaU.created_at || new Date().toISOString(),
            avatarColor: supaU.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
          };
          if (existingIdx !== -1) {
            db.users[existingIdx] = {
              ...db.users[existingIdx],
              ...mappedUser,
              sessionToken: supaU.session_token || db.users[existingIdx].sessionToken || mappedUser.sessionToken,
              canEditPrompts: supaU.can_edit_prompts === true || db.users[existingIdx].canEditPrompts === true,
              extensionAccess: supaU.extension_access !== undefined ? supaU.extension_access : db.users[existingIdx].extensionAccess,
            };
          } else {
            db.users.push(mappedUser);
            changed = true;
          }
        }
      }
    } catch (err) {
      console.error('Supabase fetch users error:', err);
    }
  }

  const sanitizedUsers = db.users.map(u => {
    if (checkAndConvertToBasic(u)) {
      changed = true;
    }
    let isLive = false;
    if (u.isOnline) {
      if (!u.lastActive || (typeof u.lastActive === 'string' && u.lastActive.toLowerCase().includes('now'))) {
        isLive = true;
      } else {
        const t = new Date(u.lastActive).getTime();
        isLive = isNaN(t) || (now - t < 180000 && now - t > -60000);
      }
    } else if (u.lastActive) {
      if (typeof u.lastActive === 'string' && u.lastActive.toLowerCase().includes('now')) {
        isLive = true;
      } else {
        const t = new Date(u.lastActive).getTime();
        isLive = !isNaN(t) && (now - t < 120000 && now - t >= -60000);
      }
    }

    const maxCredits = u.maxCredits || (u.plan === 'ultra' ? 45000 : 100);
    const credits = u.credits ?? 0;
    const usedCredits = u.usedCredits !== undefined ? u.usedCredits : Math.max(0, maxCredits - credits);
    return {
      ...u,
      sessionToken: u.sessionToken || '',
      isOnline: isLive,
      maxCredits,
      credits,
      usedCredits,
    };
  });
  if (changed) {
    saveStorage();
  }
  res.json({ users: sanitizedUsers });
});

// POST signup
app.post('/api/users/signup', async (req, res) => {
  const { name, email, password, whatsapp, telegram, referralCode } = req.body;

  if (!email || !name) {
    return res.status(400).json({ success: false, error: 'Name and email are required.' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, error: 'User with this email already exists.' });
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
    try {
      await supa.from('users').upsert({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        password: newUser.password,
        plan: newUser.plan,
        credits: newUser.credits,
        max_credits: newUser.maxCredits,
        plan_days_left: newUser.planDaysLeft,
        role: newUser.role,
        status: newUser.status,
        extension_access: newUser.extensionAccess,
        can_edit_prompts: newUser.canEditPrompts,
        whatsapp: newUser.whatsapp,
        telegram: newUser.telegram,
        referral_code: newUser.referralCode,
        referred_by: newUser.referredBy,
        created_at: newUser.createdAt,
      });
    } catch (err) {
      console.error('Supabase signup insert error:', err);
    }
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

// POST login
app.post('/api/users/login', async (req, res) => {
  const { email, password, sessionToken: clientSessionToken, forceLogin } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const cleanEmail = cleanEmailString(email);

  // 1. Find user in memory or load from Supabase if missing
  let user = db.users.find(u => u.email && cleanEmailString(u.email) === cleanEmail);
  const supa = getServerSupabase();
  if (!user && supa) {
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
          canEditPrompts: supaUser.can_edit_prompts === true,
          isOnline: Boolean(supaUser.is_online),
          sessionToken: supaUser.session_token || '',
          lastActive: supaUser.last_active || new Date().toISOString(),
          createdAt: supaUser.created_at || new Date().toISOString(),
          avatarColor: supaUser.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
        };
        db.users.push(freshUser);
        user = freshUser;
        saveStorage();
      }
    } catch (e) {
      console.error('Supabase lookup error during login:', e);
    }
  }

  if (!user) {
    return res.status(404).json({ success: false, error: 'Account not found. Please sign up first.' });
  }

  if (password && user.password && user.password !== password) {
    return res.status(401).json({ success: false, error: 'Incorrect password.' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ success: false, error: 'This account has been suspended by administration.' });
  }

  // Strict Single-Device Lock: If user is active on another device, block concurrent login!
  const isSystemAdmin = ['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com'].includes(cleanEmail);
  if (!isSystemAdmin && !forceLogin && user.isOnline && user.sessionToken) {
    const lastActiveTime = user.lastActive ? new Date(user.lastActive).getTime() : 0;
    const isRecent = Date.now() - lastActiveTime < 5 * 60 * 1000; // Active within last 5 minutes
    
    // If incoming client already holds this same session token, it's the same device refresh
    const isSameDevice = clientSessionToken && clientSessionToken === user.sessionToken;
    if (isRecent && !isSameDevice) {
      return res.status(403).json({
        success: false,
        isDeviceLocked: true,
        error: '⚠️ Yeh account pehle se kisi dusre device / browser par login hai! Pehle purane device se logout karein ya Admin panel se Reset Device Session karwayein.'
      });
    }
  }

  const newSessionToken = clientSessionToken || ('sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9));
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

  res.json({ success: true, user });
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

// POST heartbeat with strict single-device session check
app.post('/api/users/heartbeat', (req, res) => {
  const { userId, email, isOnline, sessionToken } = req.body;
  const now = new Date().toISOString();
  let user = db.users.find(u => 
    (userId && u.id === userId) || 
    (email && u.email && u.email.toLowerCase() === email.toLowerCase())
  );
  if (user) {
    // Strict single device enforcement: If user has a newer sessionToken, terminate old session!
    if (sessionToken && user.sessionToken && user.sessionToken !== sessionToken) {
      return res.json({
        success: false,
        sessionMismatch: true,
        error: 'Your account was logged into on another device. This session has been terminated.',
      });
    }

    user.isOnline = isOnline ?? true;
    user.lastActive = now;
    saveStorage();
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

// ======================== EXTENSION API ENDPOINTS ========================

// GET /api/extension/user?email=...
// Verifies member Gmail ID, returns profile, plan, credits, validity, and Server 1 & Server 2 prompts
app.get('/api/extension/user', async (req, res) => {
  // Edge CDN Caching: Cache at Vercel Edge for 2 minutes to prevent request spikes from legacy extension loops
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');

  const email = cleanEmailString(req.query.email as string || '');
  if (!email) {
    return res.status(400).json({ success: false, error: 'Gmail ID (email) query parameter is required.' });
  }

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

  const maxCredits = user.maxCredits || (user.plan === 'unlimited' ? 99999 : user.plan === 'ultra' ? 45000 : 100);
  const credits = user.credits ?? 0;
  const creditsUsed = Math.max(0, maxCredits - credits);
  const planDaysLeft = user.planDaysLeft ?? 0;
  const extensionAllowed = user.extensionAccess !== false && user.status !== 'suspended' && planDaysLeft > 0;

  // Check if Supabase has fresher promptConfig
  if (supa) {
    try {
      const { data: promptRow } = await supa.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
      if (promptRow?.name) {
        try {
          db.promptConfig = JSON.parse(promptRow.name);
        } catch {}
      }
    } catch {}
  }

  const servers = db.promptConfig?.servers || [
    { id: 'server1', label: 'Server 1', prompt: '' },
    { id: 'server2', label: 'Server 2', prompt: '' },
  ];
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };

  const reqToken = ((req.query.token || req.query.sessionToken || req.headers['authorization'] || '') as string).replace(/^Bearer\s+/i, '').trim();
  const isUltraOrUnlimited = user.plan === 'ultra' || user.plan === 'unlimited';
  const sessionToken = user.sessionToken || '';
  const isTokenValid = Boolean(reqToken && sessionToken && reqToken === sessionToken);
  // Allow active Ultra / Unlimited users with remaining validity to access servers
  const canAccessPrompts = isUltraOrUnlimited && user.status === 'active' && user.extensionAccess !== false && planDaysLeft > 0;

  let planDisplayName = 'Basic Plan';
  if (user.plan === 'unlimited') planDisplayName = 'Unlimited VIP Plan';
  else if (user.plan === 'ultra') planDisplayName = 'Ultra VIP Plan';

  res.json({
    success: true,
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
      canAccessPrompts, // True ONLY if active ultra/unlimited user with matching valid sessionToken
      planDaysLeft,
      status: user.status || 'active',
      extensionAccess: user.extensionAccess !== false,
      isAllowed: extensionAllowed,
    },
    // PROMPT ENCRYPTION & SECURITY: Only return server prompts if sessionToken is valid and authenticated
    servers: canAccessPrompts ? servers : [],
    costs,
    serverTimestamp: new Date().toISOString(),
  });
});

// POST /api/extension/prompts
// High Security Dedicated Server Prompt Fetch Endpoint: Requires email + sessionToken
app.post('/api/extension/prompts', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  const email = cleanEmailString(req.body.email || '');
  const sessionToken = (req.body.sessionToken || req.body.token || '').trim();

  if (!email || !sessionToken) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed: Active email and sessionToken are required to access server prompts.',
      servers: [],
    });
  }

  let user = db.users.find(u => u.email && cleanEmailString(u.email) === email);
  const supa = getServerSupabase();
  if (supa) {
    try {
      const { data: supaUser } = await supa.from('users').select('*').ilike('email', email).maybeSingle();
      if (supaUser && !supaUser.id?.startsWith('admin_config_')) {
        const liveToken = supaUser.session_token || supaUser.sessionToken || '';
        if (liveToken !== sessionToken) {
          return res.status(403).json({
            success: false,
            error: 'Access Denied: Invalid or expired session token. Please log in to the portal.',
            servers: [],
          });
        }
        if (supaUser.status === 'suspended') {
          return res.status(403).json({ success: false, error: 'Account suspended.', servers: [] });
        }
        if (supaUser.plan !== 'ultra' && supaUser.role !== 'admin') {
          return res.status(403).json({ success: false, error: 'Prompts are exclusive to Ultra VIP members.', servers: [] });
        }
        
        let servers = [
          { id: 'server1', label: 'Server 1', prompt: '' },
          { id: 'server2', label: 'Server 2', prompt: '' },
        ];
        const { data: promptRow } = await supa.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
        if (promptRow?.name) {
          try {
            const parsed = JSON.parse(promptRow.name);
            if (parsed?.servers) servers = parsed.servers;
          } catch {}
        }
        return res.json({ success: true, servers, serverTimestamp: new Date().toISOString() });
      }
    } catch (e) {
      console.error('Prompt fetch error:', e);
    }
  }

  if (!user || user.sessionToken !== sessionToken || user.plan !== 'ultra') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: You must be logged into an Ultra account on the portal to access server prompts.',
      servers: [],
    });
  }

  const servers = db.promptConfig?.servers || [
    { id: 'server1', label: 'Server 1', prompt: '' },
    { id: 'server2', label: 'Server 2', prompt: '' },
  ];

  return res.json({ success: true, servers, serverTimestamp: new Date().toISOString() });
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

  const maxCredits = user.maxCredits || (user.plan === 'ultra' ? 45000 : 100);
  const credits = user.credits ?? 0;
  const creditsUsed = Math.max(0, maxCredits - credits);
  const planDaysLeft = user.planDaysLeft ?? 0;
  const extensionAllowed = user.extensionAccess !== false && user.status !== 'suspended' && planDaysLeft > 0;

  const servers = db.promptConfig?.servers || [
    { id: 'server1', label: 'Server 1', prompt: '' },
    { id: 'server2', label: 'Server 2', prompt: '' },
  ];
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
    servers: isUltraUser ? servers : [],
    costs,
    serverTimestamp: new Date().toISOString(),
  });
});

// GET /api/extension/servers
// Returns the latest live Server 1 & Server 2 prompts and credit deduction costs
app.get('/api/extension/servers', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const supa = getServerSupabase();
  if (supa) {
    try {
      const { data: configRow } = await supa.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
      if (configRow && configRow.name) {
        try {
          db.promptConfig = JSON.parse(configRow.name);
          saveStorage();
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  const servers = db.promptConfig?.servers || [
    { id: 'server1', label: 'Server 1', prompt: '' },
    { id: 'server2', label: 'Server 2', prompt: '' },
  ];
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };
  const promptReminderMinutes = db.promptConfig?.promptReminderMinutes || 120;

  const ver = db.promptConfig?.extensionVersion || 'v1.0.1';

  res.json({
    success: true,
    servers,
    costs,
    version: ver,
    extensionVersion: ver,
    requiredVersion: ver,
    promptReminderMinutes,
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
    supa.from('users').update({
      credits: newCredits,
      last_active: new Date().toISOString(),
    }).ilike('email', cleanEmail).then(({ error }) => {
      if (error) console.error('Supabase credit deduction update error:', error);
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

// GET /api/extension/prompts
// Returns current Server 1 & Server 2 prompts and costs
app.get('/api/extension/prompts', async (req, res) => {
  const supa = getServerSupabase();
  if (supa && (!db.promptConfig?.servers || db.promptConfig.servers.length === 0)) {
    try {
      const { data: promptRow } = await supa.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
      if (promptRow?.name) {
        db.promptConfig = JSON.parse(promptRow.name);
      }
    } catch {}
  }

  const servers = db.promptConfig?.servers || [
    { id: 'server1', label: 'Server 1', prompt: '' },
    { id: 'server2', label: 'Server 2', prompt: '' },
  ];
  const costs = db.promptConfig?.costs || { image: 20, video: 30 };

  res.json({
    success: true,
    servers,
    costs,
    timestamp: new Date().toISOString(),
  });
});

// GET resellers
app.get('/api/resellers', (req, res) => {
  res.json({ resellers: db.resellers });
});

// POST save reseller
app.post('/api/resellers', (req, res) => {
  const reseller = req.body;
  const idx = db.resellers.findIndex(r => r.id === reseller.id);
  if (idx >= 0) {
    db.resellers[idx] = { ...db.resellers[idx], ...reseller };
  } else {
    db.resellers.unshift(reseller);
  }
  saveStorage();
  res.json({ success: true, reseller });
});

// DELETE reseller
app.delete('/api/resellers/:id', (req, res) => {
  const { id } = req.params;
  db.resellers = db.resellers.filter(r => r.id !== id);
  saveStorage();
  res.json({ success: true });
});

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
      Promise.resolve(supa.from('users').upsert({
        id: 'admin_config_prompts',
        email: 'admin_config_prompts@system.local',
        name: JSON.stringify(db.promptConfig),
        plan: 'basic',
      }, { onConflict: 'id' })).catch(() => {});
    }
  }
}

// Sweep and mark inactive users as offline if no ping in > 2.5 minutes
function cleanUserOnlineStatus() {
  const now = Date.now();
  let dbChanged = false;
  for (const u of db.users) {
    if (u.isOnline) {
      if (!u.lastActive || (now - new Date(u.lastActive).getTime() > 150000)) {
        u.isOnline = false;
        dbChanged = true;
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
  if (planExtensions) db.planExtensions = planExtensions;
  if (tutorialConfig) db.tutorialConfig = tutorialConfig;
  
  if (promptConfig) {
    const oldPromptConfig = db.promptConfig;
    db.promptConfig = promptConfig;

    // Check for any server that was previously missed and has now been updated -> Send Recovery Telegram Alert!
    const tgConfig = promptConfig.telegramAlerts || oldPromptConfig?.telegramAlerts;
    if (tgConfig && tgConfig.enabled && tgConfig.botToken && tgConfig.chatId && Array.isArray(promptConfig.servers)) {
      const intervalMinutes = Math.max(1, Number(promptConfig.promptReminderMinutes) || 120);

      for (const newSrv of promptConfig.servers) {
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
      supa.from('users').upsert({
        id: 'admin_config_prompts',
        email: 'admin_config_prompts@system.local',
        name: JSON.stringify(promptConfig),
        plan: 'basic',
      }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.error("Server Supabase prompt sync error:", error);
      });
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
