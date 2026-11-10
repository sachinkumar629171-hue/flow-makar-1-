import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, PlanType, Generation, ShowcaseVideo, ExtensionConfig, PlanExtensionsConfig, TutorialConfig, HeroConfig, Reseller, PromptConfig } from '../types';
import { INITIAL_USERS, INITIAL_GENERATIONS, INITIAL_SHOWCASE, INITIAL_RESELLERS } from '../data/initialData';
import { apiUrl } from '../config/api';
import { getSupabase, getSupabaseConfig, saveSupabaseConfig, safeSupabaseUserUpdate, safeSupabaseUserUpsert, safeSupabaseResellerUpsert } from '../lib/supabase';
import { sendTelegramNotification, generate20MinReminderMessage, generate5MinMissedAlertMessage } from '../lib/telegramNotifier';
import { setUserExpiryMs, checkAndDowngradeExpiredUser, getUserMaxExpiryMs, getUserMaxRemainingDays } from '../lib/userStats';
import { calculateResellerExpiry, getOrCreateResellerApiKey } from '../lib/resellerUtils';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  resellers: Reseller[];
  currentReseller: Reseller | null;
  generations: Generation[];
  showcaseVideos: ShowcaseVideo[];
  extensionConfig: ExtensionConfig;
  planExtensions: PlanExtensionsConfig;
  tutorialConfig: TutorialConfig;
  heroConfig: HeroConfig;
  isAdmin: boolean;
  login: (email: string, pass: string, forceLogin?: boolean) => Promise<{ success: boolean; isDeviceLocked?: boolean; error?: string }>;
  resellerLogin: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginAsReseller: (reseller: Reseller) => void;
  logoutReseller: () => void;
  createReseller: (data: {
    portalName: string;
    email: string;
    password: string;
    userLimit: number;
    daysLeft: number;
    notes?: string;
    perUserRate?: number;
    rateCurrency?: 'INR' | 'USD';
    pendingPayment?: number;
    paidPayment?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  updateReseller: (resellerId: string, data: Partial<Reseller>) => void;
  deleteReseller: (resellerId: string) => void;
  addUserByReseller: (
    resellerId: string,
    userData: {
      name: string;
      email: string;
      password?: string;
      plan: PlanType;
      credits: number;
      daysLeft?: number;
      durationValue?: number;
      durationUnit?: 'hours' | 'days';
      planExpiresAt?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  rotateUserCredentials: (userId: string) => { email: string; password?: string } | null;
  renewResellerUser: (userId: string, days?: number) => void;
  reloadResellerUserCredits: (userId: string) => void;
  signup: (data: {
    name: string;
    email: string;
    password?: string;
    whatsapp?: string;
    telegram?: string;
    referralCode?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  adminCreateUser: (data: {
    name: string;
    email: string;
    password?: string;
    whatsapp?: string;
    telegram?: string;
    plan?: PlanType;
    credits?: number;
    planDaysLeft?: number;
    canEditPrompts?: boolean;
    extensionAccess?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUserPlan: (userId: string, newPlan: PlanType, days?: number) => void;
  updateUserCredits: (userId: string, newCredits: number, newMax?: number) => void;
  updateUserDetails: (
    userId: string,
    data: {
      name?: string;
      password?: string;
      plan?: PlanType;
      credits?: number;
      maxCredits?: number;
      planDaysLeft?: number;
      planExpiresAt?: string;
      status?: 'active' | 'suspended';
      email?: string;
      extensionAccess?: boolean;
    }
  ) => void;
  updateUserEmail: (userId: string, newEmail: string) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => void;
  addGeneration: (gen: Omit<Generation, 'id' | 'createdAt'>) => Promise<Generation>;
  deductCredits: (amount: number) => boolean;
  updateProfile: (data: Partial<User>) => void;
  requestUpgrade: () => void;
  updateExtensionConfig: (config: Partial<ExtensionConfig>) => void;
  updatePlanExtensionConfig: (plan: PlanType, config: Partial<ExtensionConfig>) => void;
  updateTutorialConfig: (config: Partial<TutorialConfig>) => void;
  updateHeroConfig: (config: Partial<HeroConfig>) => void;
  updatePromptConfig: (config: Partial<PromptConfig>) => void;
  promptConfig: PromptConfig;
  sessionTerminatedNotice: boolean;
  dismissSessionTerminatedNotice: () => void;
  refreshAdminData: (force?: boolean) => Promise<boolean>;
  syncServerUsers: (serverUsers: User[], forResellerId?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_STORAGE_KEY = 'flow_users_v3';
const RESELLERS_STORAGE_KEY = 'flow_resellers_v3';
const CURRENT_USER_KEY = 'flow_current_user_v3';
const CURRENT_RESELLER_KEY = 'flow_current_reseller_v3';
const GENERATIONS_STORAGE_KEY = 'flow_generations_v3';
const PLAN_EXTENSIONS_STORAGE_KEY = 'flow_plan_extensions_v3';
const TUTORIAL_STORAGE_KEY = 'flow_tutorial_config_v3';
const HERO_STORAGE_KEY = 'flow_hero_config_v3';
const PROMPT_CONFIG_STORAGE_KEY = 'flow_prompt_config_v3';

const DEFAULT_PLAN_EXTENSIONS: PlanExtensionsConfig = {
  basic: {
    name: 'Flow Basic Chrome Extension',
    version: '1.8.0',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1ow7jqVhIgJZiJfXw9AsYMTNw_AzPZLwc',
    fileName: 'flow-basic-extension-v1.8.0.zip',
    description: 'Standard Video Prompt Sync & Studio Launcher for Basic Plan Members.',
    updatedAt: new Date().toISOString(),
    downloadType: 'url',
  },
  ultra: {
    name: 'Flow Ultra VIP Extension',
    version: '3.2.0',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1ow7jqVhIgJZiJfXw9AsYMTNw_AzPZLwc',
    fileName: 'flow-ultra-vip-extension-v3.2.0.zip',
    description: 'High-Speed 4K Pipeline, Unlimited Prompt Queue & VIP Multi-Session Sync.',
    updatedAt: new Date().toISOString(),
    downloadType: 'url',
  },
};

const DEFAULT_TUTORIAL_CONFIG: TutorialConfig = {
  desktopVideoUrl: 'https://youtu.be/bNZXy0cAv_o?si=_hgtM9DrSpMS4EhN',
  desktopTitle: 'How to Use Flow on Desktop / PC',
  desktopSubtitle: 'Complete tutorial on setting up the Chrome extension & using Desktop Studio.',
  mobileVideoUrl: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
  mobileTitle: 'How to Use Flow on Mobile (Android & iOS)',
  mobileSubtitle: 'Step-by-step guide on generating AI videos seamlessly from mobile browsers.',
};

const DEFAULT_HERO_CONFIG: HeroConfig = {
  items: [
    {
      id: '1',
      title: 'Nano Banana 2 is Here!',
      description: "We've updated the original Nano Banana model, with significant improvements in image generation, stylization, multiple references and editing.",
      mediaUrl: 'https://www.gstatic.com/aitestkitchen/website/flow/banners/io2026-banner-a1cad419-9d9f-49bb-8daf-825cf9d97f11-AppBanner.png',
      mediaType: 'image',
      buttonText: 'Generate Video',
      buttonUrl: 'https://flow.google.com/',
    }
  ],
  rotationSpeed: 5000,
};

export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  servers: [
    {
      id: 'server1',
      label: 'Server 1',
      prompt: '',
    }
  ],
  costs: {
    image: 20,
    video: 30
  },
  headerEmailOpacity: 0,
  signupEnabled: false,
  signupTelegramEnabled: true,
  signupTelegramUrl: 'https://t.me/google_ultra_veo3_bot',
  resellerContactUrl: 'https://t.me/google_ultra_veo3_bot',
  resellerContactUrlEnabled: true,
  customPlanContactUrl: '',
  pricing: {
    plans: [
      {
        id: 'basic',
        name: 'Basic',
        label: 'BASIC',
        subtitle: 'Contact Your Reseller',
        credits: '100',
        videos: '5',
        features: [
          '100 credits per month',
          '5 AI videos / month',
          'Google Flow managed access',
          '15–day satisfaction warranty',
          'Session auto-rotation every 24h',
          'Credit tracking dashboard',
          'Reseller support'
        ],
        buttonText: 'Get Pro — Contact Your Reseller',
        color: 'blue'
      },
      {
        id: 'ultra',
        name: 'Ultra',
        label: 'ULTRA',
        subtitle: 'Contact Your Reseller',
        credits: '45,000',
        videos: '2,250',
        features: [
          '45,000 credits per month',
          '2,250 AI videos / month',
          'Google Flow managed access',
          'Priority session pool',
          'Session auto-rotation every 24h',
          'Full generation history',
          'Credit tracking dashboard',
          'Priority reseller support',
          'Early access to new features',
          'Unlimited image generation'
        ],
        buttonText: 'Get Ultra — Contact Your Reseller',
        badge: 'MOST POPULAR',
        color: 'purple'
      },
      {
        id: 'unlimited',
        name: 'Flow Unlimited',
        label: 'UNLIMITED',
        subtitle: 'Contact Your Reseller',
        credits: '∞',
        videos: '∞',
        features: [
          'Unlimited credits',
          'Unlimited AI videos',
          'Google Flow managed access',
          'Priority session pool',
          'Session auto-rotation every 24h',
          'Full generation history',
          'Credit tracking dashboard',
          'Priority reseller support',
          'Early access to new features',
          'Dedicated account manager',
          'Custom session allocation',
          'Unlimited image generation',
          'omni flash use credit base'
        ],
        buttonText: 'Get Unlimited — Contact Your Reseller',
        badge: 'BEST VALUE',
        color: 'amber'
      }
    ]
  }
};

const PURGED_MOCK_IDS = new Set([
  'usr-res-1', 'usr-res-2', 'usr-res-3', 'usr-res-4', 'usr-res-5',
  'usr-res-6', 'usr-res-7', 'usr-4018', 'usr-res-9', 'usr-res-10',
  'usr-res-11', 'usr-res-12', 'usr-102', 'usr-103', 'usr-104',
  'reseller-sachin-5', 'reseller-alpha-1'
]);

function dedupeUsersByEmail(list: User[]): User[] {
  const planRank = (p?: string) => (p === 'unlimited' ? 3 : p === 'ultra' ? 2 : 1);
  const byEmail = new Map<string, User>();
  for (const u of list) {
    if (!u) continue;
    const key = String(u.email || u.id || '').trim().toLowerCase();
    if (!key) continue;
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, u);
    } else {
      const rankDiff = planRank(u.plan) - planRank(existing.plan);
      const uBetter =
        rankDiff > 0 ||
        (rankDiff === 0 && (Number(u.credits) || 0) > (Number(existing.credits) || 0)) ||
        (rankDiff === 0 && (Number(u.planDaysLeft) || 0) > (Number(existing.planDaysLeft) || 0));
      if (uBetter) {
        byEmail.set(key, u);
      }
    }
  }
  return Array.from(byEmail.values());
}

// Strict single-execution session guards: ensures me, heartbeat, and data fire ONLY ONCE on login and page refresh
let globalFetchedMeToken = '';
let globalSentHeartbeatToken = '';
let globalFetchedAdminDataToken = '';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = dedupeUsersByEmail(parsed.filter(u => !PURGED_MOCK_IDS.has(u.id)));
          return cleaned.length > 0 ? cleaned : INITIAL_USERS;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_USERS;
  });

  const [resellers, setResellers] = useState<Reseller[]>(() => {
    try {
      const saved = localStorage.getItem(RESELLERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(r => !PURGED_MOCK_IDS.has(r.id));
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_RESELLERS;
  });

  const [sessionTerminatedNotice, setSessionTerminatedNotice] = useState(false);
  const dismissSessionTerminatedNotice = () => setSessionTerminatedNotice(false);

  const [currentReseller, setCurrentReseller] = useState<Reseller | null>(() => {
    try {
      const saved = localStorage.getItem(CURRENT_RESELLER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const sessionToken = parsed?.sessionId || localStorage.getItem('flow_reseller_session_id') || '';
        if (parsed && parsed.id && sessionToken) {
          return { ...parsed, sessionId: sessionToken };
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          let token = parsed.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
          if (token.startsWith('asess_YWRtaW58') || token.startsWith('asess_YWRtf')) {
            token = '';
            try {
              localStorage.removeItem('flowmaker_session_token');
            } catch {}
          }
          if (token) {
            parsed.sessionToken = token;
          }
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [generations, setGenerations] = useState<Generation[]>(() => {
    try {
      const saved = localStorage.getItem(GENERATIONS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return INITIAL_GENERATIONS;
  });

  const [showcaseVideos] = useState<ShowcaseVideo[]>(INITIAL_SHOWCASE);

  const [planExtensions, setPlanExtensions] = useState<PlanExtensionsConfig>(() => {
    try {
      const saved = localStorage.getItem(PLAN_EXTENSIONS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return DEFAULT_PLAN_EXTENSIONS;
  });

  const [tutorialConfig, setTutorialConfig] = useState<TutorialConfig>(() => {
    try {
      const saved = localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.desktopVideoUrl || parsed.desktopVideoUrl.includes('dQw4w9WgXcQ')) {
          parsed.desktopVideoUrl = DEFAULT_TUTORIAL_CONFIG.desktopVideoUrl;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_TUTORIAL_CONFIG;
  });

  const [heroConfig, setHeroConfig] = useState<HeroConfig>(() => {
    try {
      const saved = localStorage.getItem(HERO_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration check for old single-item structure
        if (parsed.title) {
          return {
            items: [{
              id: '1',
              title: parsed.title,
              description: parsed.description,
              mediaUrl: parsed.mediaUrl,
              mediaType: parsed.mediaType,
              buttonText: parsed.buttonText,
              buttonUrl: parsed.buttonUrl
            }],
            rotationSpeed: 5000
          };
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_HERO_CONFIG;
  });

  const [promptConfig, setPromptConfig] = useState<PromptConfig>(() => {
    try {
      const saved = localStorage.getItem(PROMPT_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const resolvedOpacity = parsed.headerEmailOpacityCustom ? (parsed.headerEmailOpacity ?? 0) : 0;
        // Merge with defaults to ensure new keys like 'pricing' are present
        return {
          ...DEFAULT_PROMPT_CONFIG,
          ...parsed,
          headerEmailOpacity: resolvedOpacity,
          pricing: parsed.pricing || DEFAULT_PROMPT_CONFIG.pricing
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROMPT_CONFIG;
  });

  // Track timestamps of locally updated entities to prevent polling from reverting rapid changes
  const lastUpdatedUsersRef = useRef<Map<string, { timestamp: number; data: Partial<User> }>>(new Map());
  const lastUpdatedResellersRef = useRef<Map<string, { timestamp: number; data: Partial<Reseller> }>>(new Map());
  const lastConfigUpdateRef = useRef<number>(0);
  const lastAdminDataFetchRef = useRef<number>(0);
  const adminDataInFlightRef = useRef<Promise<boolean> | null>(null);

  // Industry-Standard Authenticated Profile Sync: On load/refresh or login, fetch once with Bearer token
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/reseller')) return;
    const token = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
    if (!token) return;
    if (globalFetchedMeToken === token) return;
    globalFetchedMeToken = token;

    fetch(apiUrl('/api/users/me'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-session-token': token,
        'x-admin-session-id': token,
      },
    })
      .then(async res => {
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setCurrentUser(prev => {
              const preservedId = prev?.id || data.user.id || 'usr-admin-1';
              const fresh: User = {
                ...(prev || {}),
                ...data.user,
                id: preservedId,
                sessionToken: prev?.sessionToken || token,
                role: data.user.role === 'admin' ? 'admin' : (data.user.role || 'user'),
              };
              try {
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(fresh));
              } catch {}
              return fresh;
            });

            // Sync website notification banner directly from /api/users/me response
            const notifMsg = typeof data.notification === 'string'
              ? data.notification
              : (data.notification?.message || '');
            const notifEnabled = data.showNotification === true && Boolean(notifMsg.trim());
            const notifType = (data.notification?.type || 'info') as 'info' | 'warning' | 'success';

            setPromptConfig(prev => {
              const nextAnnouncement = notifEnabled
                ? { enabled: true, text: notifMsg.trim(), type: notifType }
                : {
                    enabled: false,
                    text: prev?.dashboardAnnouncement?.text || '',
                    type: (prev?.dashboardAnnouncement?.type || 'info') as 'info' | 'warning' | 'success',
                  };
              const updated = {
                ...prev,
                dashboardAnnouncement: nextAnnouncement,
              };
              try {
                localStorage.setItem(PROMPT_CONFIG_STORAGE_KEY, JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        } else if (res.status === 401 || res.status === 403) {
          console.warn('[Auth] Session token invalid or user removed from database. Logging out.');
          logout();
        }
      })
      .catch(() => {});
  }, [currentUser?.id, currentUser?.sessionToken]);

  // Current user's plan extension (fallback to basic)
  const activePlan = currentUser?.plan || 'basic';
  const extensionConfig = planExtensions[activePlan] || planExtensions.basic;

  // Sync plan extensions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PLAN_EXTENSIONS_STORAGE_KEY, JSON.stringify(planExtensions));
    } catch {
      // ignore
    }
  }, [planExtensions]);

  // Sync tutorial config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(tutorialConfig));
    } catch {
      // ignore
    }
  }, [tutorialConfig]);

  // Sync hero config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(heroConfig));
    } catch {
      // ignore
    }
  }, [heroConfig]);

  // Sync prompt config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PROMPT_CONFIG_STORAGE_KEY, JSON.stringify(promptConfig));
    } catch {
      // ignore
    }
  }, [promptConfig]);

  // Sync resellers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(RESELLERS_STORAGE_KEY, JSON.stringify(resellers));
    } catch {
      // ignore
    }
  }, [resellers]);

  // Sync current reseller to localStorage (never store password or apiKey)
  useEffect(() => {
    try {
      if (currentReseller) {
        const { password: _p, apiKey: _k, ...safeResellerForStorage } = currentReseller;
        localStorage.setItem(CURRENT_RESELLER_KEY, JSON.stringify({ ...safeResellerForStorage, password: '' }));
      } else {
        localStorage.removeItem(CURRENT_RESELLER_KEY);
      }
    } catch {
      // ignore
    }
  }, [currentReseller]);

  // Sync users to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch {
      // ignore
    }
  }, [users]);

  // Sync current user to localStorage & Extension Bridge
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
        
        const isUltraOrUnlimited = currentUser.plan === 'ultra' || currentUser.plan === 'unlimited';
        const sessionToken = currentUser.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
        const canAccessPrompts = isUltraOrUnlimited && currentUser.status !== 'suspended';

        let planDisplayName = 'Basic Plan';
        if (currentUser.plan === 'unlimited') planDisplayName = 'Unlimited VIP Plan';
        else if (currentUser.plan === 'ultra') planDisplayName = 'Ultra VIP Plan';

        const extensionBridgeData = {
          id: currentUser.id,
          userId: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          plan: currentUser.plan,
          planName: planDisplayName,
          credits: currentUser.credits,
          creditsLeft: currentUser.credits,
          maxCredits: currentUser.maxCredits,
          totalCredits: currentUser.maxCredits,
          sessionToken: sessionToken,
          token: sessionToken,
          canAccessPrompts: canAccessPrompts, // Basic plan = false (no prompt access), Ultra/Unlimited = true
          status: currentUser.status || 'active',
          planDaysLeft: currentUser.planDaysLeft,
          extensionAccess: currentUser.extensionAccess !== false,
          isConnected: true,
          portalDomain: window.location.hostname || 'flowmakerai.site',
          portalUrl: window.location.origin,
          lastSynced: new Date().toISOString()
        };

        localStorage.setItem('flow_extension_bridge_v3', JSON.stringify(extensionBridgeData));
        localStorage.setItem('flow_portal_session_v3', JSON.stringify(extensionBridgeData));
        localStorage.setItem('google_flow_user_data', JSON.stringify(extensionBridgeData));
        localStorage.setItem('flow_user', JSON.stringify(extensionBridgeData));
        localStorage.setItem('portalUser', JSON.stringify(extensionBridgeData));
        localStorage.setItem('flowmaker_user', JSON.stringify(extensionBridgeData));
        localStorage.setItem('sessionToken', sessionToken);
        localStorage.setItem('token', sessionToken);
        
        // Also set a document cookie so extensions using chrome.cookies or document.cookie get fresh data
        try {
          document.cookie = `flow_user_email=${encodeURIComponent(currentUser.email)}; path=/; max-age=2592000; SameSite=Lax`;
          document.cookie = `flow_user_token=${encodeURIComponent(sessionToken)}; path=/; max-age=2592000; SameSite=Lax`;
        } catch {}

        // Hidden DOM bridge element for foolproof extension content script discovery
        try {
          let bridgeEl = document.getElementById('flow-portal-bridge');
          if (!bridgeEl) {
            bridgeEl = document.createElement('div');
            bridgeEl.id = 'flow-portal-bridge';
            bridgeEl.style.display = 'none';
            document.body.appendChild(bridgeEl);
          }
          bridgeEl.setAttribute('data-user', JSON.stringify(extensionBridgeData));
          bridgeEl.setAttribute('data-token', sessionToken);
          bridgeEl.setAttribute('data-email', currentUser.email);
          bridgeEl.setAttribute('data-name', currentUser.name);
          bridgeEl.setAttribute('data-plan', currentUser.plan);
          bridgeEl.setAttribute('data-credits', String(currentUser.credits));
          bridgeEl.setAttribute('data-days', String(currentUser.planDaysLeft));
        } catch {}

        // Notify any active chrome extension content scripts on flowmakerai.site
        window.dispatchEvent(new CustomEvent('FLOW_EXTENSION_SYNC', { detail: extensionBridgeData }));
        window.dispatchEvent(new CustomEvent('google_flow_auth_sync', { detail: extensionBridgeData }));
        window.postMessage({ type: 'FLOW_PORTAL_USER_SYNC', data: extensionBridgeData }, '*');
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
        localStorage.removeItem('flow_extension_bridge_v3');
        localStorage.removeItem('flow_portal_session_v3');
        localStorage.removeItem('flowmaker_session_token');
        localStorage.removeItem('google_flow_user_data');
        localStorage.removeItem('flow_user');
        localStorage.removeItem('portalUser');
        localStorage.removeItem('flowmaker_user');
        try {
          const bridgeEl = document.getElementById('flow-portal-bridge');
          if (bridgeEl) bridgeEl.remove();
        } catch {}
        try {
          document.cookie = 'flow_user_email=; path=/; max-age=0';
          document.cookie = 'flow_user_token=; path=/; max-age=0';
        } catch {}
        window.dispatchEvent(new CustomEvent('FLOW_EXTENSION_DISCONNECT', { detail: { action: 'logout' } }));
        window.postMessage({ type: 'FLOW_PORTAL_DISCONNECT' }, '*');
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  // Reply to extension sync & multi-datatype server requests on demand
  useEffect(() => {
    const handleMsg = async (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      const msgType = e.data.type;

      if (
        msgType === 'FLOW_REQUEST_USER_SYNC' ||
        msgType === 'GET_PORTAL_USER' ||
        msgType === 'FLOW_REQUEST_SERVER_DATA' ||
        msgType === 'GET_SERVER_DATA'
      ) {
        if (!currentUser) return;
        const sessionToken = currentUser.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
        const canAccess = (currentUser.plan === 'ultra' || currentUser.plan === 'unlimited' || currentUser.role === 'admin') && currentUser.status !== 'suspended';
        const bridgeData: Record<string, any> = {
          id: currentUser.id,
          userId: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          plan: currentUser.plan,
          planName: currentUser.plan === 'ultra' ? 'Ultra VIP Plan' : currentUser.plan === 'unlimited' ? 'Unlimited VIP Plan' : 'Basic Plan',
          credits: currentUser.credits,
          creditsLeft: currentUser.credits,
          maxCredits: currentUser.maxCredits,
          totalCredits: currentUser.maxCredits,
          sessionToken: sessionToken,
          token: sessionToken,
          planDaysLeft: currentUser.planDaysLeft,
          status: currentUser.status,
          extensionAccess: currentUser.extensionAccess !== false,
          canAccessPrompts: canAccess,
          portalUrl: window.location.origin,
          lastSynced: new Date().toISOString()
        };

        const reqDataType = e.data.dataType || e.data.datatype || e.data.platform || e.data.service;
        const reqDropdown = e.data.dropdown || e.data.server || e.data.serverId;

        if (canAccess && (msgType === 'FLOW_REQUEST_SERVER_DATA' || msgType === 'GET_SERVER_DATA' || reqDataType || reqDropdown)) {
          const targetDataType = String(reqDataType || 'Flow ultra lower priority').trim();
          const targetDropdown = String(reqDropdown || '').trim();
          try {
            const resp = await fetch(apiUrl('/api/extension/cf-verify'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: currentUser.email,
                sessionToken,
                dataType: targetDataType,
                dropdown: targetDropdown || undefined,
              }),
            });
            if (resp.ok) {
              const srvData = await resp.json();
              window.postMessage({
                type: 'FLOW_PORTAL_SERVER_DATA',
                success: true,
                dataType: targetDataType,
                dropdown: targetDropdown || undefined,
                selectedServer: srvData.selectedServer,
                prompt: srvData.prompt,
                servers: srvData.servers || [],
                user: bridgeData,
              }, '*');
              bridgeData.dataType = targetDataType;
              bridgeData.dropdown = targetDropdown || undefined;
              bridgeData.servers = srvData.servers || [];
              if (srvData.prompt !== undefined) bridgeData.prompt = srvData.prompt;
            }
          } catch {}
        }

        window.postMessage({ type: 'FLOW_PORTAL_USER_SYNC', data: bridgeData }, '*');
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [currentUser]);

  // Sync generations
  useEffect(() => {
    try {
      localStorage.setItem(GENERATIONS_STORAGE_KEY, JSON.stringify(generations));
    } catch {
      // ignore
    }
  }, [generations]);

  // Real-time Central Server Sync & Polling
  useEffect(() => {
    let isMounted = true;

    const pollCentralServer = async () => {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/reseller')) return;
      // Strictly disabled for non-admin users: normal users do not create any background polling requests
      const isUserAdmin = currentUser?.role === 'admin';
      if (!isUserAdmin) return;

      try {
        // NOTE: Requests to app_config?select=*, resellers?select=*, and users?select=* are strictly blocked and disabled.
        // Central server endpoints /api/users, /api/resellers, /api/config handle all syncing cleanly.
        const supabase: any = null;
        if (false as boolean) {
          // 0. Fetch dedicated app_config table if present in Supabase
          try {
            const { data: appConfigs } = await supabase.from('app_config').select('*');
            if (appConfigs && Array.isArray(appConfigs) && isMounted) {
              const nowTime = Date.now();
              const configUpdateSafe = nowTime - lastConfigUpdateRef.current > 10000;
              if (configUpdateSafe) {
                for (const cfg of appConfigs) {
                  if (cfg.key === 'admin_config_prompts' && cfg.value) {
                    setPromptConfig(prev => (JSON.stringify(prev) === JSON.stringify(cfg.value) ? prev : cfg.value));
                  } else if (cfg.key === 'admin_config_hero' && cfg.value) {
                    setHeroConfig(prev => (JSON.stringify(prev) === JSON.stringify(cfg.value) ? prev : cfg.value));
                  } else if (cfg.key === 'admin_config_tutorial' && cfg.value) {
                    setTutorialConfig(prev => (JSON.stringify(prev) === JSON.stringify(cfg.value) ? prev : cfg.value));
                  } else if (cfg.key === 'admin_config_extensions' && cfg.value) {
                    setPlanExtensions(prev => (JSON.stringify(prev) === JSON.stringify(cfg.value) ? prev : cfg.value));
                  }
                }
              }
            }
          } catch {}

          // 1. Fetch from Supabase Cloud (Users table for user accounts & config rows)
          const { data: supaUsers, error: userErr } = await supabase.from('users').select('*');
          if (!userErr && supaUsers && Array.isArray(supaUsers) && isMounted) {
            const nowTime = Date.now();
            const configUpdateSafe = nowTime - lastConfigUpdateRef.current > 10000;

            const sysConfigExtensions = supaUsers.find((u: any) => u.id === 'admin_config_extensions');
            if (sysConfigExtensions && sysConfigExtensions.name && configUpdateSafe) {
              try {
                const parsed = JSON.parse(sysConfigExtensions.name);
                if (parsed.basic && parsed.ultra) {
                  setPlanExtensions(prev => (JSON.stringify(prev) === JSON.stringify(parsed) ? prev : parsed));
                }
              } catch (e) {
                console.error("Failed to parse plan extensions from Supabase", e);
              }
            }

            const sysConfigTutorial = supaUsers.find((u: any) => u.id === 'admin_config_tutorial');
            if (sysConfigTutorial && sysConfigTutorial.name && configUpdateSafe) {
              try {
                const parsed = JSON.parse(sysConfigTutorial.name);
                if (parsed.desktopVideoUrl !== undefined) {
                  setTutorialConfig(prev => (JSON.stringify(prev) === JSON.stringify(parsed) ? prev : parsed));
                }
              } catch (e) {
                console.error("Failed to parse tutorial config from Supabase", e);
              }
            }

            const sysConfigHero = supaUsers.find((u: any) => u.id === 'admin_config_hero');
            if (sysConfigHero && sysConfigHero.name && configUpdateSafe) {
              try {
                const parsed = JSON.parse(sysConfigHero.name);
                if (parsed.items !== undefined || parsed.title !== undefined) {
                  setHeroConfig(prev => (JSON.stringify(prev) === JSON.stringify(parsed) ? prev : parsed));
                }
              } catch (e) {
                console.error("Failed to parse hero config from Supabase", e);
              }
            }

            const sysConfigPrompts = supaUsers.find((u: any) => u.id === 'admin_config_prompts');
            if (sysConfigPrompts && sysConfigPrompts.name && configUpdateSafe) {
              try {
                const parsed = JSON.parse(sysConfigPrompts.name);
                if (parsed && Array.isArray(parsed.servers)) {
                  setPromptConfig(prev => {
                    const localHasPrompts = prev.servers?.some(s => s.prompt && s.prompt.trim());
                    const incomingHasPrompts = parsed.servers.some((s: any) => s.prompt && s.prompt.trim());
                    if (!incomingHasPrompts && localHasPrompts) {
                      return prev;
                    }
                    const mergedServers = parsed.servers.map((inSrv: any) => {
                      const localSrv = prev.servers?.find(ls => ls.id === inSrv.id);
                      if (!inSrv.prompt?.trim() && localSrv?.prompt?.trim()) {
                        return { ...inSrv, prompt: localSrv.prompt, lastUpdatedAt: localSrv.lastUpdatedAt };
                      }
                      return inSrv;
                    });
                    const merged = { ...prev, ...parsed, servers: mergedServers };
                    return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
                  });
                }
              } catch (e) {
                console.error("Failed to parse prompt config from Supabase", e);
              }
            }

            // Auto-initialize missing configs to Supabase only if filled to prevent overwriting with blanks
            if (currentUser?.role === 'admin') {
              const hasPrompts = promptConfig.servers?.some(s => s.prompt && s.prompt.trim());
              if (!sysConfigPrompts && hasPrompts) {
                syncConfigToSupabase('admin_config_prompts', promptConfig);
              }
              if (!sysConfigHero) {
                syncConfigToSupabase('admin_config_hero', heroConfig);
              }
              if (!sysConfigTutorial) {
                syncConfigToSupabase('admin_config_tutorial', tutorialConfig);
              }
              if (!sysConfigExtensions) {
                syncConfigToSupabase('admin_config_extensions', planExtensions);
              }
            }

            const mappedUsers: User[] = supaUsers
              .filter((su: any) => 
                su.id && 
                !su.id.startsWith('admin_config_') && 
                !su.id.startsWith('sys_config_') && 
                !su.email?.includes('@system.local')
              )
              .map((su: any) => {
                const lastActiveTime = su.last_active ? new Date(su.last_active).getTime() : NaN;
                const isRecent = !isNaN(lastActiveTime) && (Date.now() - lastActiveTime <= 120000 && Date.now() - lastActiveTime >= -60000);
                const baseUser: User = {
                  id: su.id,
                  name: su.name,
                  email: su.email,
                  password: su.password,
                  sessionToken: su.session_token || su.sessionToken || '',
                  whatsapp: su.whatsapp || '',
                  telegram: su.telegram || '',
                  referralCode: su.referral_code || '',
                  referredBy: su.referred_by || '',
                  plan: (su.plan as PlanType) || 'basic',
                  credits: Number(su.credits) !== undefined && !isNaN(Number(su.credits)) ? Number(su.credits) : (su.plan === 'unlimited' ? 99999 : su.plan === 'ultra' ? 45000 : 100),
                  maxCredits: Number(su.max_credits) || (su.plan === 'unlimited' ? 99999 : su.plan === 'ultra' ? 45000 : 100),
                  planDaysLeft: Number(su.plan_days_left) ?? 30,
                  planExpiresAt: su.plan_expires_at || (su.created_at ? new Date(new Date(su.created_at).getTime() + (Number(su.plan_days_left) || 30) * 86400000).toISOString() : undefined),
                  role: (su.role as any) || 'user',
                  resellerId: su.reseller_id,
                  resellerName: su.reseller_name,
                  createdAt: su.created_at || new Date().toISOString(),
                  avatarColor: su.plan === 'unlimited' ? 'from-amber-500 to-yellow-500' : su.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
                  status: (su.status as any) || 'active',
                  extensionAccess: su.extension_access !== undefined ? su.extension_access : true,
                  canEditPrompts: su.can_edit_prompts === true,
                  isOnline: isRecent,
                  lastActive: su.last_active || '',
                };

                const { user: finalUser, changed } = checkAndDowngradeExpiredUser(baseUser);
                if (changed) {
                  const supaClient = getSupabase();
                  if (supaClient) {
                    safeSupabaseUserUpdate(supaClient, finalUser.id, finalUser.email, {
                      plan: 'basic',
                      credits: finalUser.credits,
                      max_credits: 100,
                      plan_days_left: 0,
                    }).catch(() => {});
                  }
                }
                return finalUser;
              });
            
            const now = Date.now();
            const mergedUsers = mappedUsers.map((su: User) => {
              if (currentUser && (su.id === currentUser.id || (su.email && su.email.toLowerCase() === currentUser.email.toLowerCase()))) {
                return { ...su, isOnline: true, lastActive: new Date().toISOString() };
              }
              const pending = lastUpdatedUsersRef.current.get(su.id) || (su.email ? lastUpdatedUsersRef.current.get(su.email.toLowerCase()) : undefined);
              if (pending && now - pending.timestamp < 30000) {
                return { ...su, ...pending.data };
              }
              return su;
            });

            setUsers(prev => {
              const supaUserIds = new Set(mergedUsers.map(u => u.id));
              const supaUserEmails = new Set(mergedUsers.map(u => u.email.toLowerCase()));
              const preservedLocalUsers = prev.filter(u => !supaUserIds.has(u.id) && !supaUserEmails.has(u.email.toLowerCase()) && !u.id.startsWith('admin_config_'));

              const prevUserMap = new Map<string, User>(prev.map(u => [u.id, u]));
              const prevEmailMap = new Map<string, User>(prev.map(u => [u.email.toLowerCase(), u]));

              const enrichedMerged = mergedUsers.map(u => {
                const prevU = prevUserMap.get(u.id) || (u.email ? prevEmailMap.get(u.email.toLowerCase()) : undefined);
                if (prevU?.resellerId && !u.resellerId) {
                  return {
                    ...u,
                    resellerId: prevU.resellerId,
                    resellerName: prevU.resellerName || u.resellerName,
                  };
                }
                return u;
              });

              return [...enrichedMerged, ...preservedLocalUsers];
            });
            if (currentUser) {
              const currentInList = mergedUsers.find((u: User) => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase());
              const localToken = localStorage.getItem('flowmaker_session_token') || currentUser.sessionToken;
              
              if (currentInList && (
                currentInList.status === 'suspended' || 
                currentInList.status === 'inactive' || 
                (currentInList.sessionToken && localToken && currentInList.sessionToken !== localToken)
              )) {
                console.warn('[SingleSession] Newer login on another device detected during Supabase poll! Terminating session.');
                setSessionTerminatedNotice(true);
                logout();
              } else if (currentInList && (
                currentInList.plan !== currentUser.plan || 
                currentInList.credits !== currentUser.credits || 
                currentInList.maxCredits !== currentUser.maxCredits ||
                currentInList.planDaysLeft !== currentUser.planDaysLeft ||
                currentInList.status !== currentUser.status ||
                Boolean(currentInList.canEditPrompts) !== Boolean(currentUser.canEditPrompts) ||
                currentInList.role !== currentUser.role ||
                currentInList.extensionAccess !== currentUser.extensionAccess
              )) {
                setCurrentUser(prev => prev ? { ...prev, ...currentInList } : null);
              }
            }
          }

          let rawResellersList: any[] = [];
          const { data: supaResellers, error: resErr } = await supabase.from('resellers').select('*');
          if (!resErr && supaResellers && Array.isArray(supaResellers) && supaResellers.length > 0) {
            rawResellersList = supaResellers;
          } else {
            // Robust fallback: check admin_config_resellers row in users table
            try {
              const { data: resRow } = await supabase.from('users').select('name').eq('id', 'admin_config_resellers').maybeSingle();
              if (resRow?.name) {
                const parsed = JSON.parse(resRow.name);
                if (Array.isArray(parsed) && parsed.length > 0) rawResellersList = parsed;
              }
            } catch {}
          }

          if (rawResellersList.length > 0 && isMounted) {
            const mappedResellers: Reseller[] = rawResellersList.map((sr: any) => {
              const baseReseller: Reseller = {
                id: sr.id,
                portalName: sr.portal_name || sr.portalName,
                email: sr.email,
                password: sr.password,
                userLimit: sr.user_limit || sr.userLimit || sr.max_users || 20,
                daysLeft: sr.days_left !== undefined ? sr.days_left : (sr.daysLeft !== undefined ? sr.daysLeft : 30),
                expiryDate: sr.expiry_date || sr.expiryDate || '30/10/2026',
                expiresAt: sr.expires_at || sr.expiresAt,
                status: sr.status || 'active',
                createdAt: sr.created_at || sr.createdAt || new Date().toISOString(),
                notes: sr.notes || '',
                apiKey: getOrCreateResellerApiKey(sr),
              };
              const expiryInfo = calculateResellerExpiry(baseReseller);
              return {
                ...baseReseller,
                daysLeft: expiryInfo.daysLeft,
                expiryDate: expiryInfo.expiryDate,
                expiresAt: expiryInfo.expiresAt,
                status: expiryInfo.status,
              };
            });
            const now = Date.now();
            const mergedResellers = mappedResellers.map((sr: Reseller) => {
              const pending = lastUpdatedResellersRef.current.get(sr.id);
              if (pending && now - pending.timestamp < 10000) {
                return { ...sr, ...pending.data };
              }
              return sr;
            });
            setResellers(mergedResellers);
          }
        }

        // 2. Fetch config & fallback server (Strictly token-authenticated: users only fetch their own profile)
        const activeToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
        const isUserAdmin = currentUser?.role === 'admin';

        const userHeaders: Record<string, string> = {
          ...(activeToken ? {
            'x-session-token': activeToken,
            'x-admin-session-id': activeToken,
            'Authorization': `Bearer ${activeToken}`,
          } : {}),
        };

        // 1. Single Route: All Supabase data in one request (/api/admin/data) - strictly requires admin sessionId
        if (isUserAdmin) {
          if (!activeToken) return;
          await refreshAdminData();
          return;
        }

        const [usersRes, resellersRes, configRes] = await Promise.all([
          activeToken 
            ? fetch(apiUrl('/api/users'), { headers: userHeaders }).catch(() => new Response(JSON.stringify({ users: [] }), { status: 200 }))
            : Promise.resolve(new Response(JSON.stringify({ users: [] }), { status: 200 })),
          isUserAdmin && activeToken
            ? fetch(apiUrl('/api/resellers'), { headers: userHeaders }).catch(() => new Response(JSON.stringify({ resellers: [] }), { status: 200 }))
            : Promise.resolve(new Response(JSON.stringify({ resellers: [] }), { status: 200 })),
          isUserAdmin
            ? fetch(apiUrl('/api/config')).catch(() => new Response(JSON.stringify({}), { status: 200 }))
            : Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          if (data.users && Array.isArray(data.users) && isMounted) {
            const now = Date.now();
            if (true) {
              const mergedUsers = data.users.map((u: User) => {
                const pending = lastUpdatedUsersRef.current.get(u.id);
                if (pending && now - pending.timestamp < 10000) {
                  return { ...u, ...pending.data };
                }
                return u;
              });
              setUsers(mergedUsers);
            } else {
              // Merge real-time server online status, credit deductions, and NEW API-created users into current users list
              const serverUsersMap = new Map<string, User>(data.users.map((u: User) => [u.id, u]));
              const serverUsersEmailMap = new Map<string, User>(data.users.map((u: User) => [(u.email || '').toLowerCase(), u]));
              
              setUsers(prev => {
                const existingIds = new Set(prev.map(u => u.id));
                const existingEmails = new Set(prev.map(u => (u.email || '').toLowerCase()));

                const updatedExisting = prev.map((u: User) => {
                  const srv: User | undefined = serverUsersMap.get(u.id) || (u.email ? serverUsersEmailMap.get(u.email.toLowerCase()) : undefined);
                  if (srv) {
                    return {
                      ...u,
                      ...srv,
                      resellerId: srv.resellerId || u.resellerId,
                      resellerName: srv.resellerName || u.resellerName,
                      isOnline: Boolean(srv.isOnline || u.isOnline),
                      lastActive: srv.lastActive || u.lastActive || '',
                      credits: srv.credits !== undefined ? srv.credits : u.credits,
                      sessionToken: srv.sessionToken || u.sessionToken,
                    };
                  }
                  return u;
                });

                // Add any users from server that aren't in local state yet (e.g. created via Reseller API)
                const newServerUsers = data.users.filter((su: User) => 
                  su.id && 
                  !existingIds.has(su.id) && 
                  (!su.email || !existingEmails.has(su.email.toLowerCase())) &&
                  !su.id.startsWith('admin_config_')
                );

                return [...updatedExisting, ...newServerUsers];
              });
            }
            // If current user is logged in, refresh their status if updated from admin
            if (currentUser && activeToken) {
              const currentInList = data.users.find((u: User) => u.id === currentUser.id || (u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()));
              const localToken = localStorage.getItem('flowmaker_session_token') || currentUser.sessionToken;
              
              if (!currentInList) {
                console.warn('[Session] User session token not found or deleted from database. Terminating session.');
                logout();
                return;
              }

              if (currentInList && (
                currentInList.status === 'suspended' || 
                currentInList.status === 'inactive' || 
                (currentInList.sessionToken && localToken && currentInList.sessionToken !== localToken)
              )) {
                console.warn('[SingleSession] Newer login on another device detected during server poll! Terminating session.');
                setSessionTerminatedNotice(true);
                logout();
              } else if (currentInList && (
                currentInList.plan !== currentUser.plan || 
                currentInList.credits !== currentUser.credits || 
                currentInList.maxCredits !== currentUser.maxCredits ||
                currentInList.planDaysLeft !== currentUser.planDaysLeft ||
                currentInList.status !== currentUser.status ||
                Boolean(currentInList.canEditPrompts) !== Boolean(currentUser.canEditPrompts) ||
                currentInList.role !== currentUser.role ||
                currentInList.extensionAccess !== currentUser.extensionAccess
              )) {
                setCurrentUser(prev => prev ? { ...prev, ...currentInList } : null);
              }
            }
          }
        }

        if (resellersRes.ok) {
          const resData = await resellersRes.json();
          if (resData.resellers && Array.isArray(resData.resellers) && isMounted) {
            const now = Date.now();
            setResellers(prev => {
              const resMap = new Map<string, Reseller>(resData.resellers.map((r: Reseller) => [r.id, r]));
              const updated = prev.map(r => {
                const srv = resMap.get(r.id);
                const pending = lastUpdatedResellersRef.current.get(r.id);
                if (pending && now - pending.timestamp < 10000) return { ...r, ...pending.data };
                return srv ? { ...r, ...srv } : r;
              });
              const existingIds = new Set(prev.map(r => r.id));
              const newResellers = resData.resellers.filter((r: Reseller) => !existingIds.has(r.id));
              return [...updated, ...newResellers];
            });
          }
        }

        if (configRes.ok) {
          const cfgData = await configRes.json();
          if (cfgData.supabaseConfig && cfgData.supabaseConfig.url && cfgData.supabaseConfig.anonKey) {
            const currentCfg = getSupabaseConfig();
            if (!currentCfg.isConnected || currentCfg.url !== cfgData.supabaseConfig.url || currentCfg.anonKey !== cfgData.supabaseConfig.anonKey) {
              saveSupabaseConfig(cfgData.supabaseConfig.url, cfgData.supabaseConfig.anonKey);
            }
          }
          if (cfgData.planExtensions && isMounted) {
            setPlanExtensions(prev => (JSON.stringify(prev) === JSON.stringify(cfgData.planExtensions) ? prev : cfgData.planExtensions));
          }
          if (cfgData.tutorialConfig && isMounted) {
            setTutorialConfig(prev => (JSON.stringify(prev) === JSON.stringify(cfgData.tutorialConfig) ? prev : cfgData.tutorialConfig));
          }
          if (cfgData.promptConfig && isMounted && Date.now() - lastConfigUpdateRef.current > 10000) {
            setPromptConfig(prev => {
              const localHasPrompts = prev.servers?.some(s => s.prompt && s.prompt.trim());
              const incomingHasPrompts = cfgData.promptConfig.servers?.some((s: any) => s.prompt && s.prompt.trim());
              if (!incomingHasPrompts && localHasPrompts) {
                return prev;
              }
              const mergedServers = (cfgData.promptConfig.servers || prev.servers || []).map((inSrv: any) => {
                const localSrv = prev.servers?.find(ls => ls.id === inSrv.id);
                if (!inSrv.prompt?.trim() && localSrv?.prompt?.trim()) {
                  return { ...inSrv, prompt: localSrv.prompt, lastUpdatedAt: localSrv.lastUpdatedAt };
                }
                return inSrv;
              });
              const merged = {
                ...DEFAULT_PROMPT_CONFIG,
                ...prev,
                ...cfgData.promptConfig,
                headerEmailOpacity: cfgData.promptConfig.headerEmailOpacityCustom
                  ? (cfgData.promptConfig.headerEmailOpacity ?? 0)
                  : (prev?.headerEmailOpacityCustom ? (prev.headerEmailOpacity ?? 0) : 0),
                servers: mergedServers,
              };
              if (prev && JSON.stringify(prev) === JSON.stringify(merged)) {
                return prev;
              }
              return merged;
            });
          }
        }
      } catch {
        // network or offline fallback
      }
    };

    const isUserAdmin = currentUser?.role === 'admin';
    if (isUserAdmin) {
      pollCentralServer();
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.sessionToken]);

  // Live countdown timer: naturally decreases reseller validity and auto-converts expired Ultra users to Basic plan (0D 0h)
  useEffect(() => {
    const liveTimer = setInterval(() => {
      // 1. Reseller validity countdown
      setResellers(prev => {
        let changed = false;
        const next = prev.map(r => {
          const info = calculateResellerExpiry(r);
          if (info.daysLeft !== r.daysLeft || info.status !== r.status) {
            changed = true;
            return {
              ...r,
              daysLeft: info.daysLeft,
              status: info.status,
              expiryDate: info.expiryDate,
              expiresAt: info.expiresAt,
            };
          }
          return r;
        });
        return changed ? next : prev;
      });

      // 2. User plan auto-conversion in UI only (never overwrite Supabase plan from browser timer)
      setUsers(prevUsers => {
        let usersChanged = false;
        const nextUsers = prevUsers.map(u => {
          const { user: downgradedUser, changed } = checkAndDowngradeExpiredUser(u);
          if (changed) {
            usersChanged = true;
            return downgradedUser;
          }
          return u;
        });
        return usersChanged ? dedupeUsersByEmail(nextUsers) : prevUsers;
      });

      // 3. Current logged in user UI check (authoritative plan is managed by server)
      setCurrentUser(prevUser => {
        if (!prevUser) return null;
        const { user: downgraded, changed } = checkAndDowngradeExpiredUser(prevUser);
        if (changed) {
          return downgraded;
        }
        return prevUser;
      });
    }, 30000); // Check every 30 seconds
    return () => clearInterval(liveTimer);
  }, []);

  // Cross-tab broadcast channel for instant multi-tab presence & single-session sync
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('flow_user_presence');
        bc.onmessage = (event) => {
          const { type, userId, email, isOnline, lastActive, sessionToken } = event.data || {};
          if (type === 'HEARTBEAT' && (userId || email)) {
            setUsers(prev => prev.map(u => {
              if ((userId && u.id === userId) || (email && u.email && u.email.toLowerCase() === email.toLowerCase())) {
                return { ...u, isOnline: isOnline ?? true, lastActive: lastActive || new Date().toISOString() };
              }
              return u;
            }));
          }
          if (type === 'NEW_LOGIN' && email && currentUser) {
            const isCurrentUserAdmin = currentUser.role === 'admin';
            const localToken = localStorage.getItem('flowmaker_session_token');
            if (!isCurrentUserAdmin && currentUser.email.toLowerCase() === email.toLowerCase() && sessionToken && localToken && sessionToken !== localToken) {
              console.warn('[SingleSession] BroadcastChannel: new login detected on another tab/window! Logging out old session.');
              logout();
              setSessionTerminatedNotice(true);
            }
          }
        };
      }
    } catch {
      // fallback
    }

    return () => {
      if (bc) {
        bc.close();
      }
    };
  }, [currentUser?.email]);

  // Heartbeat: fires strictly ONCE on login or page refresh (no automatic background polling loop)
  useEffect(() => {
    if (!currentUser) return;
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/reseller')) return;

    const activeToken = currentUser.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
    if (!activeToken) return;

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('flow_user_presence');
      }
    } catch {}

    if (globalSentHeartbeatToken !== activeToken) {
      globalSentHeartbeatToken = activeToken;
      const now = new Date().toISOString();

      setUsers(prev =>
        prev.map(u => (u.id === currentUser.id || (u.email && u.email.toLowerCase() === currentUser.email.toLowerCase())
          ? { ...u, isOnline: true, lastActive: now } 
          : u
        ))
      );

      // Broadcast to other tabs on same machine
      if (bc) {
        try {
          bc.postMessage({
            type: 'HEARTBEAT',
            userId: currentUser.id,
            email: currentUser.email,
            isOnline: true,
            lastActive: now,
          });
        } catch {}
      }

      // Central server sync once on login / page load
      fetch(apiUrl('/api/users/heartbeat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
          isOnline: true,
          sessionToken: activeToken
        }),
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.sessionMismatch) {
          console.warn('[SingleSession] Heartbeat detected session mismatch! Terminating old session.');
          setSessionTerminatedNotice(true);
          logout();
        }
      })
      .catch(() => {});
    }

    const handleUnload = () => {
      if (currentUser) {
        if (bc) {
          try {
            bc.postMessage({
              type: 'HEARTBEAT',
              userId: currentUser.id,
              email: currentUser.email,
              isOnline: false,
              lastActive: new Date().toISOString(),
            });
          } catch {}
        }
        const supabase = getSupabase();
        if (supabase && currentUser.email) {
          supabase.from('users')
            .update({ is_online: false })
            .eq('email', currentUser.email.toLowerCase())
            .then(() => {}, () => {});
        }
        navigator.sendBeacon(
          apiUrl('/api/users/heartbeat'),
          JSON.stringify({ userId: currentUser.id, email: currentUser.email, isOnline: false })
        );
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      if (bc) bc.close();
    };
  }, [currentUser?.id, currentUser?.email, currentUser?.sessionToken]);

  // Active Telegram Alert Monitor (Runs continuously in browser so reminders & overdue alerts work 100% on live portal / Vercel / Netlify)
  useEffect(() => {
    const checkTelegramAlerts = async () => {
      const tg = promptConfig?.telegramAlerts;
      if (!tg || !tg.enabled || !tg.botToken?.trim() || !tg.chatId?.trim() || !Array.isArray(promptConfig.servers) || promptConfig.servers.length === 0) {
        return;
      }

      const cycleMinutes = Number(promptConfig.promptReminderMinutes) || 120;
      const cycleMs = cycleMinutes * 60 * 1000;
      const reminderMinutesBefore = Number(tg.reminderMinutesBefore) || 20;
      const missedMinutesAfter = Number(tg.missedAlertMinutesAfter) || 5;
      const now = Date.now();
      let updatedServers = [...promptConfig.servers];
      let hasChange = false;

      for (let i = 0; i < updatedServers.length; i++) {
        const srv = { ...updatedServers[i] };
        if (!srv.lastUpdatedAt) continue;
        const lastUpdatedMs = new Date(srv.lastUpdatedAt).getTime();
        if (isNaN(lastUpdatedMs)) continue;

        const expiryTime = lastUpdatedMs + cycleMs;
        const remainingMs = expiryTime - now;
        const remainingMinutes = Math.floor(remainingMs / 60000);

        // 1. 20-Minutes Pre-Expiry Reminder
        if (remainingMinutes <= reminderMinutesBefore && remainingMinutes > 0 && !srv.reminded20MinSent) {
          const msg = generate20MinReminderMessage(
            srv.label || `Server ${i + 1}`,
            srv.id,
            Math.max(1, remainingMinutes),
            srv.updatedBy
          );
          const res = await sendTelegramNotification(tg.botToken.trim(), tg.chatId.trim(), msg);
          if (res.success) {
            srv.reminded20MinSent = true;
            updatedServers[i] = srv;
            hasChange = true;
          }
        }

        // 2. 5-Minutes Post-Expiry Missed Alert with exact IST Time
        const overdueMs = now - expiryTime;
        const overdueMinutes = Math.floor(overdueMs / 60000);
        if (overdueMinutes >= missedMinutesAfter && !srv.missed5MinSent) {
          const msg = generate5MinMissedAlertMessage(
            srv.label || `Server ${i + 1}`,
            srv.id,
            overdueMinutes,
            srv.updatedBy
          );
          const res = await sendTelegramNotification(tg.botToken.trim(), tg.chatId.trim(), msg);
          if (res.success) {
            srv.missed5MinSent = true;
            srv.wasMissed = true;
            srv.missedAlertSentAt = new Date().toISOString();
            updatedServers[i] = srv;
            hasChange = true;
          }
        }
      }

      if (hasChange) {
        updatePromptConfig({ servers: updatedServers });
      }
    };

    const alertTimer = setInterval(checkTelegramAlerts, 25000);
    const initTimer = setTimeout(checkTelegramAlerts, 4000);

    return () => {
      clearInterval(alertTimer);
      clearTimeout(initTimer);
    };
  }, [promptConfig]);

  const isAdmin = currentUser?.role === 'admin';

  const ensureSupabaseClientReady = async () => {
    let supa = getSupabase();
    if (supa) return supa;
    try {
      const token = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
      const cfgRes = await fetch(apiUrl('/api/config'), {
        headers: token
          ? {
              'Authorization': `Bearer ${token}`,
              'x-admin-session-id': token,
              'x-session-token': token,
            }
          : undefined,
      });
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        if (cfgData?.supabaseConfig?.url && cfgData?.supabaseConfig?.anonKey) {
          saveSupabaseConfig(cfgData.supabaseConfig.url, cfgData.supabaseConfig.anonKey);
          supa = getSupabase();
        }
      }
    } catch {}
    return supa;
  };

  const mapRawResellerRecord = (sr: any): Reseller => {
    const baseReseller: Reseller = {
      id: sr.id,
      portalName: sr.portal_name || sr.portalName || 'Reseller Portal',
      email: (sr.email || '').trim(),
      password: sr.password || '',
      userLimit: Number(sr.user_limit ?? sr.userLimit ?? sr.max_users) || 20,
      daysLeft: sr.days_left !== undefined ? Number(sr.days_left) : (sr.daysLeft !== undefined ? Number(sr.daysLeft) : 30),
      expiryDate: sr.expiry_date || sr.expiryDate || '30/10/2026',
      expiresAt: sr.expires_at || sr.expiresAt,
      status: sr.status || 'active',
      createdAt: sr.created_at || sr.createdAt || new Date().toISOString(),
      notes: sr.notes || '',
      apiKey: getOrCreateResellerApiKey(sr),
      perUserRate: Number(sr.per_user_rate ?? sr.perUserRate ?? 0) || 0,
      rateCurrency: (sr.rate_currency || sr.rateCurrency || 'INR') as 'INR' | 'USD',
      pendingPayment: Number(sr.pending_payment ?? sr.pendingPayment ?? 0) || 0,
      paidPayment: Number(sr.paid_payment ?? sr.paidPayment ?? 0) || 0,
    };
    const expiryInfo = calculateResellerExpiry(baseReseller);
    return {
      ...baseReseller,
      daysLeft: expiryInfo.daysLeft,
      expiryDate: expiryInfo.expiryDate,
      expiresAt: expiryInfo.expiresAt,
      status: expiryInfo.status,
    };
  };

  const syncServerUsers = React.useCallback((serverUsers: User[], forResellerId?: string) => {
    if (!Array.isArray(serverUsers)) return;
    const now = Date.now();
    setUsers(prev => {
      const prevByEmail = new Map<string, User>();
      const prevById = new Map<string, User>();
      for (const pu of prev) {
        if (pu?.id) prevById.set(pu.id, pu);
        if (pu?.email) prevByEmail.set(pu.email.trim().toLowerCase(), pu);
      }

      const incomingById = new Map<string, User>();
      const incomingByEmail = new Map<string, User>();

      for (const su of serverUsers) {
        if (!su || (!su.id && !su.email)) continue;
        if (su.id && (su.id.startsWith('admin_config_') || su.id.startsWith('sys_config_'))) continue;

        const cleanEmail = (su.email || '').trim().toLowerCase();
        const existingLocal = (su.id ? prevById.get(su.id) : undefined) || (cleanEmail ? prevByEmail.get(cleanEmail) : undefined);
        const resolvedId = su.id || existingLocal?.id || `usr-${cleanEmail}`;

        const pending = lastUpdatedUsersRef.current.get(resolvedId) || (cleanEmail ? lastUpdatedUsersRef.current.get(cleanEmail) : undefined);
        const normalizedUser: User = {
          ...(existingLocal || {}),
          ...su,
          id: resolvedId,
          name: su.name || existingLocal?.name || 'User',
          email: su.email || existingLocal?.email || '',
          plan: (su.plan as PlanType) || existingLocal?.plan || 'basic',
          credits: su.credits !== undefined ? Number(su.credits) : (existingLocal?.credits ?? 100),
          maxCredits: su.maxCredits !== undefined ? Number(su.maxCredits) : (existingLocal?.maxCredits ?? (su.plan === 'ultra' ? 45000 : 100)),
          planDaysLeft: su.planDaysLeft !== undefined ? Number(su.planDaysLeft) : (existingLocal?.planDaysLeft ?? 30),
          planExpiresAt: su.planExpiresAt !== undefined ? (su.planExpiresAt || undefined) : existingLocal?.planExpiresAt,
          planStartedAt: su.planStartedAt || existingLocal?.planStartedAt || su.createdAt || existingLocal?.createdAt || new Date().toISOString(),
          createdAt: su.createdAt || su.planStartedAt || existingLocal?.createdAt || new Date().toISOString(),
          role: su.role || existingLocal?.role || 'user',
          status: su.status || existingLocal?.status || 'active',
          resellerId: su.resellerId || forResellerId || existingLocal?.resellerId,
          isOnline: Boolean(su.isOnline),
          lastActive: su.lastActive !== undefined ? su.lastActive : (existingLocal?.lastActive || ''),
        };

        const mergedItem: User = (pending && now - pending.timestamp < 10000)
          ? { ...normalizedUser, ...pending.data }
          : normalizedUser;

        incomingById.set(mergedItem.id, mergedItem);
        if (cleanEmail) incomingByEmail.set(cleanEmail, mergedItem);
      }

      if (forResellerId) {
        const cleanTargetResId = forResellerId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const otherUsers = prev.filter(u => {
          if (!u) return false;
          const uEmail = (u.email || '').trim().toLowerCase();
          if (incomingById.has(u.id) || (uEmail && incomingByEmail.has(uEmail))) return false;
          const uResId = (u.resellerId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (uResId && uResId === cleanTargetResId) {
            const pending = lastUpdatedUsersRef.current.get(u.id) || (uEmail ? lastUpdatedUsersRef.current.get(uEmail) : undefined);
            return Boolean(pending && now - pending.timestamp < 10000);
          }
          return true;
        });
        return [...Array.from(incomingById.values()), ...otherUsers];
      }

      const updatedExisting = prev.map(u => {
        const match = incomingById.get(u.id) || (u.email ? incomingByEmail.get(u.email.toLowerCase()) : undefined);
        if (match) {
          return {
            ...u,
            ...match,
            password: match.password || u.password,
            resellerId: match.resellerId || u.resellerId || forResellerId,
            resellerName: match.resellerName || u.resellerName,
          };
        }
        return u;
      });

      const existingIds = new Set(updatedExisting.map(u => u.id));
      const existingEmails = new Set(updatedExisting.map(u => (u.email || '').toLowerCase()));
      const newIncoming = Array.from(incomingById.values()).filter(
        su => !existingIds.has(su.id) && (!su.email || !existingEmails.has(su.email.toLowerCase()))
      );

      return [...newIncoming, ...updatedExisting];
    });
  }, []);

  const lastFetchedResellerRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  const fetchResellerUsers = React.useCallback(async (reseller: Reseller | null, force = false) => {
    if (!reseller || !reseller.id) return;
    const targetResId = reseller.id.trim();
    const now = Date.now();
    if (!force && lastFetchedResellerRef.current.id === targetResId && now - lastFetchedResellerRef.current.time < 2000) {
      return;
    }
    lastFetchedResellerRef.current = { id: targetResId, time: now };
    const resellerSessionId = reseller.sessionId || localStorage.getItem('flow_reseller_session_id') || '';

    // Single authoritative API call for this reseller's users
    try {
      const res = await fetch(
        apiUrl(`/api/users?resellerId=${encodeURIComponent(targetResId)}`),
        {
          headers: {
            'x-reseller-id': targetResId,
            ...(resellerSessionId ? { 'x-reseller-session-id': resellerSessionId } : {}),
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.users && Array.isArray(data.users)) {
          syncServerUsers(data.users, targetResId);
        }
        if (data?.resellerStats) {
          const rs = data.resellerStats;
          setCurrentReseller(prev => {
            if (!prev || prev.id !== targetResId) return prev;
            return {
              ...prev,
              totalUsersCreated: rs.totalUsersCreated !== undefined ? Number(rs.totalUsersCreated) : prev.totalUsersCreated,
              userLimit: rs.userLimit !== undefined ? Number(rs.userLimit) : prev.userLimit,
              perUserRate: rs.perUserRate !== undefined ? Number(rs.perUserRate) : prev.perUserRate,
              rateCurrency: rs.rateCurrency || prev.rateCurrency || 'INR',
              pendingPayment: rs.pendingPayment !== undefined ? Number(rs.pendingPayment) : prev.pendingPayment,
              paidPayment: rs.paidPayment !== undefined ? Number(rs.paidPayment) : prev.paidPayment,
            };
          });
          setResellers(prev =>
            prev.map(r =>
              r.id === targetResId
                ? {
                    ...r,
                    totalUsersCreated: rs.totalUsersCreated !== undefined ? Number(rs.totalUsersCreated) : r.totalUsersCreated,
                    userLimit: rs.userLimit !== undefined ? Number(rs.userLimit) : r.userLimit,
                    perUserRate: rs.perUserRate !== undefined ? Number(rs.perUserRate) : r.perUserRate,
                    rateCurrency: rs.rateCurrency || r.rateCurrency || 'INR',
                    pendingPayment: rs.pendingPayment !== undefined ? Number(rs.pendingPayment) : r.pendingPayment,
                    paidPayment: rs.paidPayment !== undefined ? Number(rs.paidPayment) : r.paidPayment,
                  }
                : r
            )
          );
        }
      }
    } catch (err) {
      console.warn('API reseller users fetch error:', err);
    }
  }, [syncServerUsers]);

  // Load reseller's users ONLY once on login or page refresh
  useEffect(() => {
    if (!currentReseller?.id) return;
    fetchResellerUsers(currentReseller);
  }, [currentReseller?.id, fetchResellerUsers]);

  const resellerLogin = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    try {
      const res = await fetch(apiUrl('/api/resellers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        return {
          success: false,
          error: 'Too many login attempts',
        };
      }

      if (!res.ok || !data.success || !data.reseller) {
        return {
          success: false,
          error:
            data.error ||
            (res.status === 404
              ? 'No reseller portal found with this email. Contact main administrator.'
              : res.status === 401
              ? 'Incorrect portal password.'
              : 'Invalid reseller credentials.'),
        };
      }

      const sr = data.reseller;
      const assignedSessionId = data.sessionId || sr.sessionId || '';
      if (assignedSessionId) {
        try {
          localStorage.setItem('flow_reseller_session_id', assignedSessionId);
        } catch {}
      }

      const baseReseller: Reseller = {
        id: sr.id,
        portalName: sr.portalName || sr.portal_name || 'Reseller Portal',
        email: (sr.email || cleanEmail).trim(),
        password: '',
        userLimit: Number(sr.userLimit ?? sr.user_limit) || 20,
        totalUsersCreated: Number(sr.totalUsersCreated ?? sr.total_users_created ?? 0) || 0,
        daysLeft: sr.daysLeft !== undefined ? Number(sr.daysLeft) : 30,
        expiryDate: sr.expiryDate || '30/10/2026',
        expiresAt: sr.expiresAt,
        status: sr.status || 'active',
        createdAt: sr.createdAt || new Date().toISOString(),
        notes: '',
        sessionId: assignedSessionId,
        perUserRate: Number(sr.perUserRate ?? sr.per_user_rate ?? 0) || 0,
        rateCurrency: (sr.rateCurrency || sr.rate_currency || 'INR') as 'INR' | 'USD',
        pendingPayment: Number(sr.pendingPayment ?? sr.pending_payment ?? 0) || 0,
        paidPayment: Number(sr.paidPayment ?? sr.paid_payment ?? 0) || 0,
      };
      const expiryInfo = calculateResellerExpiry(baseReseller);
      const safeReseller: Reseller = {
        ...baseReseller,
        daysLeft: expiryInfo.daysLeft,
        expiryDate: expiryInfo.expiryDate,
        expiresAt: expiryInfo.expiresAt,
        status: expiryInfo.status,
        sessionId: assignedSessionId,
      };

      setResellers(prev => {
        const exists = prev.some(x => x.id === safeReseller.id);
        return exists ? prev.map(x => (x.id === safeReseller.id ? safeReseller : x)) : [safeReseller, ...prev];
      });
      // Setting currentReseller triggers the useEffect above to call fetchResellerUsers ONCE
      setCurrentReseller(safeReseller);

      return { success: true };
    } catch (err) {
      console.error('Error connecting to reseller login service:', err);
      return { success: false, error: 'Failed to connect to reseller authentication service.' };
    }
  };

  const loginAsReseller = (reseller: Reseller) => {
    const { password: _p, apiKey: _k, ...safeReseller } = reseller;
    setCurrentReseller({ ...safeReseller, password: '' });
  };

  const logoutReseller = () => {
    try {
      localStorage.removeItem('flow_reseller_session_id');
    } catch {}
    setCurrentReseller(null);
  };

  const createReseller = async (data: {
    portalName: string;
    email: string;
    password: string;
    userLimit: number;
    daysLeft: number;
    notes?: string;
    perUserRate?: number;
    rateCurrency?: 'INR' | 'USD';
    pendingPayment?: number;
    paidPayment?: number;
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = data.email.trim().toLowerCase();
    if (!data.portalName.trim()) {
      return { success: false, error: 'Please enter a portal store name.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!data.password.trim()) {
      return { success: false, error: 'Please enter a password for this reseller portal.' };
    }

    const exists = resellers.some(r => r.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, error: 'A reseller with this email already exists.' };
    }

    const targetDays = Math.max(1, data.daysLeft || 30);
    const nowMs = Date.now();
    const expiresMs = nowMs + targetDays * 86400000;
    const expDate = new Date(expiresMs);
    const formattedExp = `${String(expDate.getDate()).padStart(2, '0')}/${String(expDate.getMonth() + 1).padStart(2, '0')}/${expDate.getFullYear()}`;
    const isoExpiresAt = expDate.toISOString();
    const resellerId = `reseller-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const apiKey = `flw_res_${resellerId.replace(/[^a-zA-Z0-9]/g, '')}`;

    const newReseller: Reseller = {
      id: resellerId,
      portalName: data.portalName.trim(),
      email: cleanEmail,
      password: data.password.trim(),
      userLimit: Math.max(1, data.userLimit || 20),
      daysLeft: targetDays,
      expiryDate: formattedExp,
      expiresAt: isoExpiresAt,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes: data.notes?.trim() || '',
      apiKey,
      perUserRate: Number(data.perUserRate) || 0,
      rateCurrency: data.rateCurrency || 'INR',
      pendingPayment: Number(data.pendingPayment) || 0,
      paidPayment: Number(data.paidPayment) || 0,
    };

    const updatedList = [newReseller, ...resellers];
    setResellers(updatedList);

    // 1. Direct resilient sync to Supabase resellers table + backup row
    const supabase = await ensureSupabaseClientReady();
    if (supabase) {
      safeSupabaseResellerUpsert(supabase, newReseller).catch(err => {
        console.warn('Supabase resellers table upsert error:', err);
      });

      safeSupabaseUserUpsert(supabase, {
        id: 'admin_config_resellers',
        name: JSON.stringify(updatedList),
        email: 'resellers_backup@flowmaker.local',
        password: 'config_no_login_123',
        plan: 'basic',
        credits: 0,
        max_credits: 0,
        plan_days_left: 0,
        role: 'user',
        status: 'active',
      }).catch(err => {
        console.warn('Backup resellers row insert error:', err);
      });
    }

    const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
    try {
      await fetch(apiUrl('/api/resellers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? {
            'x-session-token': adminToken,
            'x-admin-session-id': adminToken,
            'Authorization': `Bearer ${adminToken}`,
          } : {}),
        },
        body: JSON.stringify({
          ...newReseller,
          ...(adminToken ? { sessionId: adminToken } : {}),
        }),
      });
    } catch (err) {
      console.error('Error creating reseller on server:', err);
    }
    return { success: true };
  };

  const updateReseller = async (resellerId: string, data: Partial<Reseller>) => {
    let updatedList: Reseller[] = [];
    setResellers(prev => {
      updatedList = prev.map(r => {
        if (r.id === resellerId) {
          const updatedDays = data.daysLeft !== undefined ? Math.max(0, data.daysLeft) : r.daysLeft;
          let expiresAt = data.expiresAt || r.expiresAt;
          if (data.daysLeft !== undefined) {
            expiresAt = new Date(Date.now() + updatedDays * 86400000).toISOString();
          }
          const base: Reseller = {
            ...r,
            ...data,
            daysLeft: updatedDays,
            expiresAt,
          };
          const expiryInfo = calculateResellerExpiry(base);
          return {
            ...base,
            daysLeft: expiryInfo.daysLeft,
            expiryDate: data.expiryDate || expiryInfo.expiryDate,
            expiresAt: expiryInfo.expiresAt,
            status: data.status || expiryInfo.status,
          };
        }
        return r;
      });
      return updatedList;
    });

    if (currentReseller && currentReseller.id === resellerId) {
      setCurrentReseller(prev => (prev ? { ...prev, ...data } : null));
    }

    const updatedReseller = updatedList.find(r => r.id === resellerId);
    if (updatedReseller) {
      lastUpdatedResellersRef.current.set(resellerId, {
        timestamp: Date.now(),
        data: updatedReseller,
      });

      const supa = getSupabase();
      if (supa) {
        safeSupabaseResellerUpsert(supa, updatedReseller).catch(() => {});
        safeSupabaseUserUpsert(supa, {
          id: 'admin_config_resellers',
          name: JSON.stringify(updatedList),
          email: 'resellers_backup@flowmaker.local',
          password: 'config_no_login_123',
          plan: 'basic',
          credits: 0,
          max_credits: 0,
          plan_days_left: 0,
          role: 'user',
          status: 'active',
        }).catch(() => {});
      }

      const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
      fetch(apiUrl('/api/resellers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? {
            'x-session-token': adminToken,
            'x-admin-session-id': adminToken,
            'Authorization': `Bearer ${adminToken}`,
          } : {}),
        },
        body: JSON.stringify({
          ...updatedReseller,
          ...(adminToken ? { sessionId: adminToken } : {}),
        }),
      }).catch(() => {});
    }
  };

  const deleteReseller = (resellerId: string) => {
    const updatedList = resellers.filter(r => r.id !== resellerId);
    setResellers(updatedList);
    if (currentReseller?.id === resellerId) {
      setCurrentReseller(null);
    }
    const supa = getSupabase();
    if (supa) {
      supa.from('resellers').delete().eq('id', resellerId).then(() => {}, () => {});
      safeSupabaseUserUpsert(supa, {
        id: 'admin_config_resellers',
        name: JSON.stringify(updatedList),
        email: 'resellers_backup@flowmaker.local',
        password: 'config_no_login_123',
        plan: 'basic',
        credits: 0,
        max_credits: 0,
        plan_days_left: 0,
        role: 'user',
        status: 'active',
      }).catch(() => {});
    }
    const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
    const adminHeaders: Record<string, string> = adminToken ? {
      'x-session-token': adminToken,
      'x-admin-session-id': adminToken,
      'Authorization': `Bearer ${adminToken}`,
    } : {};
    fetch(apiUrl(`/api/resellers?id=${encodeURIComponent(resellerId)}`), { method: 'DELETE', headers: adminHeaders }).catch(() => {});
    fetch(apiUrl(`/api/resellers/${resellerId}`), { method: 'DELETE', headers: adminHeaders }).catch(() => {});
  };

  const addUserByReseller = async (
    resellerId: string,
    userData: {
      name: string;
      email: string;
      password?: string;
      plan: PlanType;
      credits: number;
      daysLeft?: number;
      durationValue?: number;
      durationUnit?: 'hours' | 'days';
      planExpiresAt?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    const targetReseller = resellers.find(r => r.id === resellerId) || (currentReseller && currentReseller.id === resellerId ? currentReseller : undefined);
    if (!targetReseller) {
      return { success: false, error: 'Reseller not found.' };
    }

    if (targetReseller.daysLeft <= 0 || targetReseller.status === 'expired') {
      return { success: false, error: 'Your reseller portal has expired. Contact administrator to renew.' };
    }

    const currentResellerUsersCount = users.filter(u => u.resellerId === resellerId).length;
    if (currentResellerUsersCount >= targetReseller.userLimit) {
      return {
        success: false,
        error: `User limit of ${targetReseller.userLimit} reached. Request admin to increase limit.`,
      };
    }

    const cleanEmail = userData.email.trim().toLowerCase();
    if (!userData.name.trim()) {
      return { success: false, error: 'Please enter full name.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const existingUser = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existingUser) {
      return { success: false, error: 'This Gmail ID is already registered! Please use a different Gmail.' };
    }

    const resellerSessionId = currentReseller?.sessionId || targetReseller.sessionId || localStorage.getItem('flow_reseller_session_id') || '';
    if (!resellerSessionId) {
      return { success: false, error: 'Reseller session expired. Please sign out and sign in again.' };
    }

    const initialPassword = userData.password?.trim() || 'Aass1122';
    const credits = userData.credits || (userData.plan === 'ultra' ? 45000 : 100);
    const maxCredits = credits;

    let planDaysLeft = 30;
    let planExpiresAt: string | undefined = undefined;

    if (userData.durationUnit === 'hours') {
      const hours = Math.max(0.5, Number(userData.durationValue || 2));
      const expiresMs = Date.now() + Math.round(hours * 3600000);
      planExpiresAt = new Date(expiresMs).toISOString();
      planDaysLeft = Math.max(0.01, parseFloat((hours / 24).toFixed(3)));
    } else {
      const requestedDays = userData.durationValue !== undefined ? userData.durationValue : (userData.daysLeft !== undefined ? userData.daysLeft : 30);
      const days = Math.min(30, Math.max(1, requestedDays));
      const expiresMs = Date.now() + Math.round(days * 86400000);
      planExpiresAt = new Date(expiresMs).toISOString();
      planDaysLeft = days;
    }

    const newUser: User = {
      id: `usr-res-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      name: userData.name.trim(),
      email: cleanEmail,
      password: initialPassword,
      plan: userData.plan,
      credits,
      maxCredits,
      planDaysLeft,
      planExpiresAt,
      role: 'user',
      resellerId: targetReseller.id,
      resellerName: targetReseller.portalName,
      createdAt: new Date().toISOString(),
      avatarColor: userData.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
      status: 'active',
      isOnline: false,
      lastActive: new Date().toISOString(),
    };

    const userBodyPayload = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
      plan: newUser.plan,
      credits: newUser.credits,
      maxCredits: newUser.maxCredits,
      planDaysLeft: newUser.planDaysLeft,
      planExpiresAt: newUser.planExpiresAt,
      role: newUser.role,
      resellerId: targetReseller.id,
      reseller_id: targetReseller.id,
      sessionId: resellerSessionId,
      resellerName: targetReseller.portalName,
      reseller_name: targetReseller.portalName,
      createdAt: newUser.createdAt,
      avatarColor: newUser.avatarColor,
      status: newUser.status,
    };

    try {
      const res = await fetch(apiUrl('/api/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-reseller-id': targetReseller.id,
          'x-reseller-session-id': resellerSessionId,
        },
        body: JSON.stringify(userBodyPayload),
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || resData.success === false) {
        return {
          success: false,
          error: resData.error || 'Failed to add member. Please check your reseller session.',
        };
      }
    } catch (err) {
      console.error('Error saving reseller user to central server:', err);
      return { success: false, error: 'Failed to connect to server.' };
    }

    const updatedUsersList = [newUser, ...users.filter(u => u.id !== newUser.id)];
    setUsers(updatedUsersList);

    lastUpdatedUsersRef.current.set(newUser.id, {
      timestamp: Date.now(),
      data: newUser,
    });
    if (newUser.email) {
      lastUpdatedUsersRef.current.set(newUser.email.toLowerCase(), {
        timestamp: Date.now(),
        data: newUser,
      });
    }

    return { success: true };
  };

  const rotateUserCredentials = (userId: string): { email: string; password?: string } | null => {
    const user = users.find(u => u.id === userId);
    if (!user) return null;

    const newPass = `flow${Math.floor(100000 + Math.random() * 900000)}`;
    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, password: newPass } : u))
    );

    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => (prev ? { ...prev, password: newPass } : null));
    }

    const resellerId = currentReseller?.id;
    const sessionId = currentReseller?.sessionId || localStorage.getItem('flow_reseller_session_id') || '';

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(resellerId ? { 'x-reseller-id': resellerId } : {}),
        ...(sessionId ? { 'x-reseller-session-id': sessionId } : {}),
      },
      body: JSON.stringify({
        userId,
        email: user.email,
        ...(resellerId ? { resellerId, sessionId } : {}),
        data: { password: newPass },
      }),
    }).catch(() => {});

    return { email: user.email, password: newPass };
  };

  const renewResellerUser = (userId: string, days = 30) => {
    const user = users.find(u => u.id === userId);
    const userEmail = user?.email;
    const maxRemaining = getUserMaxRemainingDays(user);
    const maxExpiryMs = getUserMaxExpiryMs(user);
    const newDays = Math.min(maxRemaining, Math.max(0, (user?.planDaysLeft || 0) + days));
    const computedExpMs = Math.min(Date.now() + newDays * 86400000, maxExpiryMs);
    const calculatedExpiresAt = new Date(computedExpMs).toISOString();
    setUserExpiryMs(userId, newDays, computedExpMs);

    lastUpdatedUsersRef.current.set(userId, {
      timestamp: Date.now(),
      data: { planDaysLeft: newDays, planExpiresAt: calculatedExpiresAt },
    });
    if (userEmail) {
      lastUpdatedUsersRef.current.set(userEmail.toLowerCase(), {
        timestamp: Date.now(),
        data: { planDaysLeft: newDays, planExpiresAt: calculatedExpiresAt },
      });
    }

    setUsers(prev =>
      prev.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            planDaysLeft: newDays,
            planExpiresAt: calculatedExpiresAt,
          };
        }
        return u;
      })
    );

    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => (prev ? { ...prev, planDaysLeft: newDays, planExpiresAt: calculatedExpiresAt } : null));
    }

    const resellerId = currentReseller?.id;
    const sessionId = currentReseller?.sessionId || localStorage.getItem('flow_reseller_session_id') || '';

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(resellerId ? { 'x-reseller-id': resellerId } : {}),
        ...(sessionId ? { 'x-reseller-session-id': sessionId } : {}),
      },
      body: JSON.stringify({
        userId,
        email: userEmail,
        ...(resellerId ? { resellerId, sessionId } : {}),
        data: { planDaysLeft: newDays, planExpiresAt: calculatedExpiresAt },
      }),
    }).catch(() => {});
  };

  const reloadResellerUserCredits = (userId: string) => {
    const user = users.find(u => u.id === userId);
    const userEmail = user?.email;
    const targetCredits = user?.maxCredits || (user?.plan === 'ultra' ? 45000 : 100);

    lastUpdatedUsersRef.current.set(userId, {
      timestamp: Date.now(),
      data: { credits: targetCredits },
    });
    if (userEmail) {
      lastUpdatedUsersRef.current.set(userEmail.toLowerCase(), {
        timestamp: Date.now(),
        data: { credits: targetCredits },
      });
    }

    setUsers(prev =>
      prev.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            credits: targetCredits,
          };
        }
        return u;
      })
    );

    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => (prev ? { ...prev, credits: targetCredits } : null));
    }

    const resellerId = currentReseller?.id;
    const sessionId = currentReseller?.sessionId || localStorage.getItem('flow_reseller_session_id') || '';

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(resellerId ? { 'x-reseller-id': resellerId } : {}),
        ...(sessionId ? { 'x-reseller-session-id': sessionId } : {}),
      },
      body: JSON.stringify({
        userId,
        email: userEmail,
        ...(resellerId ? { resellerId, sessionId } : {}),
        data: { credits: targetCredits },
      }),
    }).catch(() => {});
  };

  const login = async (email: string, pass: string, forceLogin = false): Promise<{ success: boolean; isDeviceLocked?: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    // 1. Consult central server login (payload only contains email, password, forceLogin - no sessionToken sent)
    try {
      const serverRes = await fetch(apiUrl('/api/users/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass, forceLogin }),
      });
      const serverData = await serverRes.json().catch(() => ({}));
      if (!serverRes.ok) {
        if (serverRes.status === 429) {
          return {
            success: false,
            error: 'Too many login attempts',
          };
        }
        if (serverRes.status === 403) {
          return {
            success: false,
            isDeviceLocked: serverData.isDeviceLocked || false,
            error: serverData.error || '⚠️ Yeh account pehle se kisi dusre device / browser par login hai! Kripya pehle waha se logout karein.'
          };
        }
        if (serverRes.status === 401) {
          return { success: false, error: serverData.error || 'Incorrect password. Please try again.' };
        }
        if (serverRes.status === 404) {
          return { success: false, error: serverData.error || 'Account not found. Please sign up first.' };
        }
      } else if (serverData.success && serverData.user) {
        const sUser: User = serverData.user;
        const assignedSession = serverData.sessionId || serverData.session_token || serverData.sessionToken || sUser.sessionToken;
        globalFetchedMeToken = '';
        globalSentHeartbeatToken = '';
        globalFetchedAdminDataToken = '';
        if (assignedSession) {
          sUser.sessionToken = assignedSession;
          localStorage.setItem('flowmaker_session_token', assignedSession);
          try {
            const bc = new BroadcastChannel('flow_user_presence');
            bc.postMessage({
              type: 'NEW_LOGIN',
              email: sUser.email,
              sessionToken: assignedSession,
            });
            setTimeout(() => bc.close(), 1000);
          } catch {}
        }
        setUsers(prev => {
          const exists = prev.some(u => u.id === sUser.id || u.email.toLowerCase() === sUser.email.toLowerCase());
          return exists ? prev.map(u => (u.id === sUser.id || u.email.toLowerCase() === sUser.email.toLowerCase()) ? sUser : u) : [sUser, ...prev];
        });
        setCurrentUser(sUser);
        return { success: true };
      }
    } catch (err) {
      console.warn('Central server login attempt error, checking fallback:', err);
    }

    // 2. Direct Supabase Database check if central server was unreachable
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: supaUser, error: supaErr } = await supabase
          .from('users')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (!supaErr && supaUser) {
          if (supaUser.password && supaUser.password !== cleanPass) {
            return { success: false, error: 'Incorrect password. Please try again.' };
          }
          if (supaUser.status === 'suspended') {
            return { success: false, error: 'This account has been suspended by administration.' };
          }

          // Single-Device Lock: If account is active on another device, block new login until old device logs out
          const isSystemAdmin = supaUser.role === 'admin';
          const currentLocalToken = localStorage.getItem('flowmaker_session_token');
          if (!isSystemAdmin && !forceLogin && supaUser.is_online && supaUser.session_token) {
            const lastActiveTime = supaUser.last_active ? new Date(supaUser.last_active).getTime() : 0;
            const isRecent = Date.now() - lastActiveTime < 3 * 60 * 1000; // 3 mins window
            if (isRecent && currentLocalToken !== supaUser.session_token) {
              return {
                success: false,
                isDeviceLocked: true,
                error: '⚠️ Yeh account abhi kisi dusre device / browser par ACTIVE hai! Kripya pehle purane device se logout karein ya Force Login karein.'
              };
            }
          }

          const mappedUser: User = {
            id: supaUser.id,
            name: supaUser.name,
            email: supaUser.email,
            password: supaUser.password,
            whatsapp: supaUser.whatsapp || '',
            telegram: supaUser.telegram || '',
            referralCode: supaUser.referral_code || '',
            referredBy: supaUser.referred_by || '',
            plan: (supaUser.plan as PlanType) || 'basic',
            credits: Number(supaUser.credits) || 0,
            maxCredits: Number(supaUser.max_credits) || 100,
            planDaysLeft: Number(supaUser.plan_days_left) || 30,
            role: (supaUser.role as any) || 'user',
            resellerId: supaUser.reseller_id,
            resellerName: supaUser.reseller_name,
            createdAt: supaUser.created_at || new Date().toISOString(),
            avatarColor: supaUser.plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
            status: (supaUser.status as any) || 'active',
            isOnline: true,
            lastActive: new Date().toISOString(),
          };

          const sessionToken = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
          mappedUser.sessionToken = sessionToken;
          localStorage.setItem('flowmaker_session_token', sessionToken);

          try {
            const bc = new BroadcastChannel('flow_user_presence');
            bc.postMessage({
              type: 'NEW_LOGIN',
              email: mappedUser.email,
              sessionToken: sessionToken,
            });
            setTimeout(() => bc.close(), 1000);
          } catch {}

          setUsers(prev => {
            const exists = prev.some(u => u.id === mappedUser.id || u.email.toLowerCase() === mappedUser.email.toLowerCase());
            return exists ? prev.map(u => (u.id === mappedUser.id || u.email.toLowerCase() === mappedUser.email.toLowerCase()) ? mappedUser : u) : [mappedUser, ...prev];
          });
          setCurrentUser(mappedUser);

          // Update online status & session token in supabase
          safeSupabaseUserUpdate(supabase, mappedUser.id, mappedUser.email, {
            session_token: sessionToken,
            is_online: true,
            last_active: new Date().toISOString(),
          }).catch(() => {});

          return { success: true };
        }
      } catch (err) {
        console.warn('Supabase login check error:', err);
      }
    }

    // 2. Direct login via central online server endpoint
    try {
      const res = await fetch(apiUrl('/api/users/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const serverUser: User = data.user;
          if (serverUser.sessionToken) {
            localStorage.setItem('flowmaker_session_token', serverUser.sessionToken);
            try {
              const bc = new BroadcastChannel('flow_user_presence');
              bc.postMessage({
                type: 'NEW_LOGIN',
                email: serverUser.email,
                sessionToken: serverUser.sessionToken,
              });
              setTimeout(() => bc.close(), 1000);
            } catch {}
          }
          // Update local memory and current user
          setUsers(prev => {
            const exists = prev.some(u => u.id === serverUser.id || u.email.toLowerCase() === serverUser.email.toLowerCase());
            if (exists) {
              return prev.map(u => (u.id === serverUser.id || u.email.toLowerCase() === serverUser.email.toLowerCase()) ? serverUser : u);
            }
            return [serverUser, ...prev];
          });
          setCurrentUser(serverUser);
          return { success: true };
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          return { success: false, error: 'Too many login attempts' };
        }
        if (res.status === 401) {
          return { success: false, error: errData.error || 'Incorrect password. Please try again.' };
        }
        if (res.status === 403) {
          return { success: false, error: errData.error || 'This account has been suspended by administration.' };
        }
        // If 404 or other, fallback to check local cache
      }
    } catch (err) {
      console.warn('Direct server login call error, checking local/sync fallback:', err);
    }

    // 2. Fallback: Check local memory or fetch latest users list from server
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      try {
        const res = await fetch(apiUrl('/api/users'));
        if (res.ok) {
          const data = await res.json();
          if (data.users && Array.isArray(data.users)) {
            setUsers(data.users);
            user = data.users.find((u: User) => u.email.toLowerCase() === cleanEmail);
          }
        }
      } catch (err) {
        console.error('Error fetching live users on login:', err);
      }
    }

    if (!user) {
      return { success: false, error: 'No account found with this email. Please sign up.' };
    }

    if (user.password && user.password !== cleanPass) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    if (user.status === 'suspended') {
      return { success: false, error: 'This account has been suspended by administration.' };
    }

    const sessionToken = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('flowmaker_session_token', sessionToken);

    const updatedUser: User = {
      ...user,
      sessionToken,
      isOnline: true,
      lastActive: new Date().toISOString(),
    };

    setUsers(prev => prev.map(u => (u.id === user.id ? updatedUser : u)));
    setCurrentUser(updatedUser);

    // Update Supabase with session token
    const supa = getSupabase();
    if (supa) {
      supa.from('users').update({ session_token: sessionToken, is_online: true, last_active: new Date().toISOString() }).eq('id', user.id).then(() => {});
    }

    return { success: true };
  };

  const signup = async (data: {
    name: string;
    email: string;
    password?: string;
    whatsapp?: string;
    telegram?: string;
    referralCode?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = data.email.trim().toLowerCase();
    
    if (!data.name.trim()) {
      return { success: false, error: 'Please enter your name.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!data.password || data.password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters.' };
    }

    const exists = users.some(u => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, error: 'An account with this email already exists. Please log in.' };
    }

    // Double check Supabase for absolute certainty
    const supa = getSupabase();
    if (supa) {
      const { data: supaExists } = await supa.from('users').select('id').eq('email', cleanEmail).maybeSingle();
      if (supaExists) {
        return { success: false, error: 'Email already registered. Please login.' };
      }
    }

    const sessionToken = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('flowmaker_session_token', sessionToken);

    const newUser: User = {
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      email: cleanEmail,
      password: data.password,
      sessionToken,
      whatsapp: data.whatsapp?.trim() || '',
      telegram: data.telegram?.trim() || '',
      referralCode: `FLOW${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      referredBy: data.referralCode?.trim() || '',
      plan: 'basic',
      credits: 100,
      maxCredits: 100,
      planDaysLeft: 30,
      role: 'user',
      createdAt: new Date().toISOString(),
      avatarColor: 'from-blue-600 to-indigo-600',
      status: 'active',
      isOnline: true,
      lastActive: new Date().toISOString(),
    };

    setUsers(prev => [newUser, ...prev]);
    setCurrentUser(newUser);

    // Supabase direct database insert
    const supabase = getSupabase();
    if (supabase) {
      safeSupabaseUserUpsert(supabase, newUser).catch(err => {
        console.error('Supabase user insert error:', err);
      });
    }

    // Send to central server database immediately
    try {
      const res = await fetch(apiUrl('/api/users/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          whatsapp: newUser.whatsapp,
          telegram: newUser.telegram,
          referralCode: newUser.referralCode,
          referredBy: newUser.referredBy,
          plan: newUser.plan,
          credits: newUser.credits,
          maxCredits: newUser.maxCredits,
          planDaysLeft: newUser.planDaysLeft,
          role: newUser.role,
          createdAt: newUser.createdAt,
          avatarColor: newUser.avatarColor,
          status: newUser.status,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUsers(prev => prev.map(u => u.email === newUser.email ? { ...u, id: data.user.id } : u));
        }
      }
    } catch (err) {
      console.error('Error sending signup to central server:', err);
    }

    return { success: true };
  };

  const adminCreateUser = async (data: {
    name: string;
    email: string;
    password?: string;
    whatsapp?: string;
    telegram?: string;
    plan?: PlanType;
    credits?: number;
    planDaysLeft?: number;
    canEditPrompts?: boolean;
    extensionAccess?: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = data.email.trim().toLowerCase();
    if (!data.name.trim() || !cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter valid name and email.' };
    }
    const exists = users.some(u => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, error: 'A user with this email already exists.' };
    }

    const plan = data.plan || 'ultra';
    const credits = data.credits !== undefined ? data.credits : (plan === 'ultra' ? 45000 : 100);
    const planDaysLeft = data.planDaysLeft !== undefined ? data.planDaysLeft : 30;
    const newUser: User = {
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      email: cleanEmail,
      password: data.password || '123456',
      whatsapp: data.whatsapp?.trim() || '',
      telegram: data.telegram?.trim() || '',
      referralCode: `FLOW${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      plan,
      credits,
      maxCredits: credits,
      planDaysLeft,
      role: 'user',
      canEditPrompts: Boolean(data.canEditPrompts),
      extensionAccess: data.extensionAccess !== false,
      createdAt: new Date().toISOString(),
      avatarColor: plan === 'ultra' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600',
      status: 'active',
      isOnline: false,
      lastActive: new Date().toISOString(),
    };

    setUsers(prev => [newUser, ...prev]);

    const supabase = getSupabase();
    if (supabase) {
      safeSupabaseUserUpsert(supabase, newUser).catch(err => {
        console.error("Supabase user create error:", err);
      });
    }

    fetch(apiUrl('/api/users/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).catch(() => {});

    return { success: true };
  };

  const logout = () => {
    globalFetchedMeToken = '';
    globalSentHeartbeatToken = '';
    globalFetchedAdminDataToken = '';
    if (currentUser) {
      const now = new Date().toISOString();
      const supa = getSupabase();
      if (supa && currentUser.id) {
        supa.from('users').update({ is_online: false, session_token: '', last_active: now }).eq('id', currentUser.id).then(() => {});
      }
      fetch(apiUrl('/api/users/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, email: currentUser.email }),
      }).catch(() => {});
      setUsers(prev =>
        prev.map(u => (u.id === currentUser.id ? { ...u, isOnline: false, sessionToken: '', lastActive: now } : u))
      );
    }
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem('flowmaker_session_token');
    localStorage.removeItem('flow_extension_bridge_v3');
    localStorage.removeItem('flow_portal_session_v3');
    localStorage.removeItem('google_flow_user_data');
    setCurrentUser(null);
  };

  const updateUserPlan = (userId: string, newPlan: PlanType, days?: number) => {
    const defaultCredits = newPlan === 'unlimited' ? 99999 : newPlan === 'ultra' ? 45000 : 100;
    const targetDays = days !== undefined ? days : 30;

    lastUpdatedUsersRef.current.set(userId, {
      timestamp: Date.now(),
      data: {
        plan: newPlan,
        credits: defaultCredits,
        maxCredits: defaultCredits,
        planDaysLeft: targetDays,
        upgradeRequested: false,
      },
    });

    setUsers(prev =>
      prev.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            plan: newPlan,
            credits: defaultCredits,
            maxCredits: defaultCredits,
            planDaysLeft: targetDays,
            upgradeRequested: false,
          };
        }
        return u;
      })
    );

    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev =>
        prev
          ? {
              ...prev,
              plan: newPlan,
              credits: defaultCredits,
              maxCredits: defaultCredits,
              planDaysLeft: targetDays,
              upgradeRequested: false,
            }
          : null
      );
    }

    const targetUser = users.find(u => u.id === userId);
    const userEmail = targetUser?.email;
    const resellerId = currentReseller?.id;
    const sessionId = currentReseller?.sessionId || localStorage.getItem('flow_reseller_session_id') || '';
    const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(resellerId ? { 'x-reseller-id': resellerId } : {}),
        ...(sessionId ? { 'x-reseller-session-id': sessionId } : {}),
        ...(adminToken ? {
          'x-session-token': adminToken,
          'x-admin-session-id': adminToken,
          'Authorization': `Bearer ${adminToken}`,
        } : {}),
      },
      body: JSON.stringify({
        userId,
        email: userEmail,
        ...(resellerId ? { resellerId, sessionId } : (adminToken ? { sessionId: adminToken } : {})),
        data: {
          plan: newPlan,
          credits: defaultCredits,
          maxCredits: defaultCredits,
          planDaysLeft: targetDays,
          upgradeRequested: false,
        },
      }),
    }).catch(() => {});
  };

  const updateUserDetails = (
    userId: string,
    data: {
      name?: string;
      password?: string;
      plan?: PlanType;
      credits?: number;
      maxCredits?: number;
      planDaysLeft?: number;
      planExpiresAt?: string;
      status?: 'active' | 'suspended';
      email?: string;
      extensionAccess?: boolean;
      canEditPrompts?: boolean;
      isOnline?: boolean;
      sessionToken?: string;
    }
  ) => {
    const userToUpdate = users.find(u => u.id === userId);
    const userEmail = data.email || userToUpdate?.email;
    const existingPending = lastUpdatedUsersRef.current.get(userId)?.data || {};
    const maxRemaining = getUserMaxRemainingDays(userToUpdate);
    const maxExpiryMs = getUserMaxExpiryMs(userToUpdate);
    const clampedDays = data.planDaysLeft !== undefined
      ? Math.min(maxRemaining, Math.max(0, data.planDaysLeft))
      : undefined;

    let calculatedExpiresAt: string | undefined = data.planExpiresAt;
    if (clampedDays !== undefined) {
      const reqExpMs = data.planExpiresAt ? new Date(data.planExpiresAt).getTime() : NaN;
      const candExpMs = !isNaN(reqExpMs) ? reqExpMs : (Date.now() + clampedDays * 86400000);
      const finalExpMs = Math.min(candExpMs, maxExpiryMs);
      calculatedExpiresAt = new Date(finalExpMs).toISOString();
      setUserExpiryMs(userId, clampedDays, finalExpMs);
    } else if (data.planExpiresAt) {
      const reqExpMs = new Date(data.planExpiresAt).getTime();
      if (!isNaN(reqExpMs)) {
        calculatedExpiresAt = new Date(Math.min(reqExpMs, maxExpiryMs)).toISOString();
      }
    }

    const normalizedData = {
      ...data,
      ...(clampedDays !== undefined ? { planDaysLeft: clampedDays } : {}),
      ...(calculatedExpiresAt ? { planExpiresAt: calculatedExpiresAt } : {}),
    };

    const mergedData = {
      ...existingPending,
      ...normalizedData,
    };

    lastUpdatedUsersRef.current.set(userId, {
      timestamp: Date.now(),
      data: mergedData,
    });
    if (userEmail) {
      lastUpdatedUsersRef.current.set(userEmail.toLowerCase(), {
        timestamp: Date.now(),
        data: mergedData,
      });
    }

    setUsers(prev =>
      prev.map(u => {
        if (u.id === userId) {
          const updated: User = {
            ...u,
            ...normalizedData,
            name: normalizedData.name !== undefined ? normalizedData.name : u.name,
            email: normalizedData.email !== undefined ? normalizedData.email : u.email,
            password: normalizedData.password !== undefined ? normalizedData.password : u.password,
            plan: normalizedData.plan !== undefined ? normalizedData.plan : u.plan,
            credits: normalizedData.credits !== undefined ? normalizedData.credits : u.credits,
            maxCredits: normalizedData.maxCredits !== undefined ? normalizedData.maxCredits : u.maxCredits,
            planDaysLeft: clampedDays !== undefined ? clampedDays : u.planDaysLeft,
            planExpiresAt: calculatedExpiresAt || u.planExpiresAt,
            status: normalizedData.status !== undefined ? normalizedData.status : (clampedDays !== undefined && clampedDays <= 0 ? 'suspended' : u.status),
            extensionAccess: normalizedData.extensionAccess !== undefined ? normalizedData.extensionAccess : (u.extensionAccess !== undefined ? u.extensionAccess : true),
            canEditPrompts: normalizedData.canEditPrompts !== undefined ? normalizedData.canEditPrompts : (u.canEditPrompts !== undefined ? u.canEditPrompts : false),
            isOnline: normalizedData.isOnline !== undefined ? normalizedData.isOnline : u.isOnline,
            sessionToken: normalizedData.sessionToken !== undefined ? normalizedData.sessionToken : u.sessionToken,
            upgradeRequested: normalizedData.plan === 'ultra' ? false : u.upgradeRequested,
          };
          return updated;
        }
        return u;
      })
    );

    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev =>
        prev
          ? {
              ...prev,
              ...normalizedData,
              name: normalizedData.name !== undefined ? normalizedData.name : prev.name,
              email: normalizedData.email !== undefined ? normalizedData.email : prev.email,
              password: normalizedData.password !== undefined ? normalizedData.password : prev.password,
              plan: normalizedData.plan !== undefined ? normalizedData.plan : prev.plan,
              credits: normalizedData.credits !== undefined ? normalizedData.credits : prev.credits,
              maxCredits: normalizedData.maxCredits !== undefined ? normalizedData.maxCredits : prev.maxCredits,
              planDaysLeft: clampedDays !== undefined ? clampedDays : prev.planDaysLeft,
              planExpiresAt: calculatedExpiresAt || prev.planExpiresAt,
              status: normalizedData.status !== undefined ? normalizedData.status : (clampedDays !== undefined && clampedDays <= 0 ? 'suspended' : prev.status),
              extensionAccess: normalizedData.extensionAccess !== undefined ? normalizedData.extensionAccess : (prev.extensionAccess !== undefined ? prev.extensionAccess : true),
              canEditPrompts: normalizedData.canEditPrompts !== undefined ? normalizedData.canEditPrompts : (prev.canEditPrompts !== undefined ? prev.canEditPrompts : false),
              isOnline: normalizedData.isOnline !== undefined ? normalizedData.isOnline : prev.isOnline,
              sessionToken: normalizedData.sessionToken !== undefined ? normalizedData.sessionToken : prev.sessionToken,
              upgradeRequested: normalizedData.plan === 'ultra' ? false : prev.upgradeRequested,
            }
          : null
      );
    }

    const resellerId = currentReseller?.id;
    const sessionId = currentReseller?.sessionId || localStorage.getItem('flow_reseller_session_id') || '';
    const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';

    const payload = {
      userId,
      email: userToUpdate?.email,
      ...(resellerId ? { resellerId, sessionId } : (adminToken ? { sessionId: adminToken } : {})),
      data: normalizedData,
    };

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(resellerId ? { 'x-reseller-id': resellerId } : {}),
        ...(sessionId ? { 'x-reseller-session-id': sessionId } : {}),
        ...(adminToken ? {
          'x-session-token': adminToken,
          'x-admin-session-id': adminToken,
          'Authorization': `Bearer ${adminToken}`,
        } : {}),
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  };

  const updateUserEmail = async (userId: string, newEmail: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid Gmail address.' };
    }

    const currentUserObj = users.find(u => u.id === userId);
    if (!currentUserObj) {
      return { success: false, error: 'User not found.' };
    }

    if (currentUserObj.email.toLowerCase() === cleanEmail) {
      return { success: false, error: 'New Gmail is the same as current Gmail.' };
    }

    // Check duplicate locally
    const exists = users.some(u => u.id !== userId && u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, error: 'This Gmail ID is already registered!' };
    }

    updateUserDetails(userId, { email: cleanEmail });
    return { success: true };
  };

  const requestUpgrade = () => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    updateProfile({ upgradeRequested: true, upgradeRequestedAt: now });
  };

  const updateUserCredits = (userId: string, newCredits: number, newMax?: number) => {
    const userToUpdate = users.find(u => u.id === userId);
    const userEmail = userToUpdate?.email;
    const max = newMax !== undefined ? newMax : (userToUpdate ? Math.max(userToUpdate.maxCredits, newCredits) : newCredits);
    
    lastUpdatedUsersRef.current.set(userId, {
      timestamp: Date.now(),
      data: {
        credits: newCredits,
        maxCredits: max,
      },
    });
    if (userEmail) {
      lastUpdatedUsersRef.current.set(userEmail.toLowerCase(), {
        timestamp: Date.now(),
        data: {
          credits: newCredits,
          maxCredits: max,
        },
      });
    }

    setUsers(prev =>
      prev.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            credits: newCredits,
            maxCredits: max,
          };
        }
        return u;
      })
    );

    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev =>
        prev
          ? {
              ...prev,
              credits: newCredits,
              maxCredits: newMax !== undefined ? newMax : Math.max(prev.maxCredits, newCredits),
            }
          : null
      );
    }

    const resellerId = currentReseller?.id;
    const sessionId = currentReseller?.sessionId || localStorage.getItem('flow_reseller_session_id') || '';
    const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(resellerId ? { 'x-reseller-id': resellerId } : {}),
        ...(sessionId ? { 'x-reseller-session-id': sessionId } : {}),
        ...(adminToken ? {
          'x-session-token': adminToken,
          'x-admin-session-id': adminToken,
          'Authorization': `Bearer ${adminToken}`,
        } : {}),
      },
      body: JSON.stringify({
        userId,
        email: userEmail,
        ...(resellerId ? { resellerId, sessionId } : (adminToken ? { sessionId: adminToken } : {})),
        data: {
          credits: newCredits,
          maxCredits: newMax !== undefined ? newMax : Math.max(newCredits),
        },
      }),
    }).catch(() => {});
  };

  const deleteUser = (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    const targetEmail = (targetUser?.email || (userId.startsWith('usr-') && userId.includes('@') ? userId.slice(4) : '')).trim().toLowerCase();
    setUsers(prev => prev.filter(u => u.id !== userId && (!targetEmail || u.email.trim().toLowerCase() !== targetEmail)));
    if (currentUser?.id === userId) {
      setCurrentUser(null);
    }
    const resellerId = currentReseller?.id;
    const sessionId = currentReseller?.sessionId || localStorage.getItem('flow_reseller_session_id') || '';
    const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
    const queryParams = new URLSearchParams({ id: userId });
    if (targetEmail) queryParams.set('email', targetEmail);
    if (resellerId) queryParams.set('resellerId', resellerId);
    if (sessionId) queryParams.set('sessionId', sessionId);

    fetch(apiUrl(`/api/users?${queryParams.toString()}`), {
      method: 'DELETE',
      headers: {
        ...(resellerId ? { 'x-reseller-id': resellerId } : {}),
        ...(sessionId ? { 'x-reseller-session-id': sessionId } : {}),
        ...(adminToken ? {
          'x-session-token': adminToken,
          'x-admin-session-id': adminToken,
          'Authorization': `Bearer ${adminToken}`,
        } : {}),
      },
    }).catch(() => {});
  };

  const deductCredits = (amount: number): boolean => {
    if (!currentUser) return false;
    if (currentUser.credits < amount) return false;

    const newCredits = currentUser.credits - amount;
    updateUserCredits(currentUser.id, newCredits);
    return true;
  };

  const addGeneration = async (genData: Omit<Generation, 'id' | 'createdAt'>): Promise<Generation> => {
    const newGen: Generation = {
      ...genData,
      id: `gen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    setGenerations(prev => [newGen, ...prev]);
    return newGen;
  };

  const updateProfile = (data: Partial<User>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...data };
    setCurrentUser(updated);
    setUsers(prev => prev.map(u => (u.id === currentUser.id ? updated : u)));
  };

  const syncConfigToSupabase = (key: string, data: any) => {
    const supa = getSupabase();
    if (!supa) return;
    try {
      supa.from('app_config').upsert({
        key,
        value: data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' }).then(() => {});
    } catch {}

    try {
      safeSupabaseUserUpsert(supa, {
        id: key,
        email: `${key}@system.local`,
        name: JSON.stringify(data),
        password: 'config_no_login_123',
        plan: 'basic',
        credits: 0,
        max_credits: 0,
        plan_days_left: 0,
        session_token: 'sys_config',
        is_online: false,
        created_at: '2025-01-01T00:00:00.000Z'
      }).catch(err => {
        console.error(`Supabase ${key} config update error:`, err);
      });
    } catch {}
  };

  const updateExtensionConfig = (newConfig: Partial<ExtensionConfig>) => {
    const targetPlan = currentUser?.plan || 'basic';
    updatePlanExtensionConfig(targetPlan, newConfig);
  };

  const updatePlanExtensionConfig = (plan: PlanType, newConfig: Partial<ExtensionConfig>) => {
    lastConfigUpdateRef.current = Date.now() + 30000;
    setPlanExtensions(prev => {
      const mergedConfig: ExtensionConfig = {
        ...prev[plan],
        ...newConfig,
        updatedAt: new Date().toISOString(),
      };
      const updated = {
        ...prev,
        [plan]: mergedConfig,
      };

      syncConfigToSupabase('admin_config_extensions', updated);

      const newVer = newConfig.version?.trim();
      if (newVer) {
        setPromptConfig(p => ({ ...p, extensionVersion: newVer }));
        syncConfigToSupabase('admin_config_prompts', { ...promptConfig, extensionVersion: newVer });
      }

      const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
      fetch(apiUrl('/api/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? {
            'Authorization': `Bearer ${adminToken}`,
            'x-admin-session-id': adminToken,
            'x-session-token': adminToken,
          } : {}),
        },
        body: JSON.stringify({
          sessionId: adminToken,
          planExtensions: updated,
          promptConfig: newVer ? { extensionVersion: newVer } : undefined,
        }),
      }).catch(() => {});

      return updated;
    });
  };

  const updateTutorialConfig = (newConfig: Partial<TutorialConfig>) => {
    lastConfigUpdateRef.current = Date.now() + 30000;
    const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
    setTutorialConfig(prev => {
      const updated = {
        ...prev,
        ...newConfig,
      };

      syncConfigToSupabase('admin_config_tutorial', updated);

      fetch(apiUrl('/api/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? {
            'Authorization': `Bearer ${adminToken}`,
            'x-admin-session-id': adminToken,
            'x-session-token': adminToken,
          } : {}),
        },
        body: JSON.stringify({ sessionId: adminToken, tutorialConfig: updated }),
      }).catch(() => {});

      return updated;
    });
  };

  const updateHeroConfig = (newConfig: Partial<HeroConfig>) => {
    lastConfigUpdateRef.current = Date.now() + 30000;
    const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
    setHeroConfig(prev => {
      const updated = {
        ...prev,
        ...newConfig,
      };

      syncConfigToSupabase('admin_config_hero', updated);

      fetch(apiUrl('/api/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? {
            'Authorization': `Bearer ${adminToken}`,
            'x-admin-session-id': adminToken,
            'x-session-token': adminToken,
          } : {}),
        },
        body: JSON.stringify({ sessionId: adminToken, heroConfig: updated }),
      }).catch(() => {});

      return updated;
    });
  };

  const updatePromptConfig = (newConfig: Partial<PromptConfig>) => {
    lastConfigUpdateRef.current = Date.now() + 30000;
    const nowTs = Date.now();
    const adminToken = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
    setPromptConfig(prev => {
      const updated: any = {
        ...prev,
        ...newConfig,
        _updatedAt: nowTs,
        ...(newConfig.dashboardAnnouncement
          ? {
              dashboardAnnouncement: {
                ...newConfig.dashboardAnnouncement,
                enabled: Boolean(newConfig.dashboardAnnouncement.enabled),
                updatedAt: nowTs,
              },
            }
          : {}),
      };

      try {
        localStorage.setItem(PROMPT_CONFIG_STORAGE_KEY, JSON.stringify(updated));
      } catch {}

      syncConfigToSupabase('admin_config_prompts', updated);

      fetch(apiUrl('/api/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? {
            'Authorization': `Bearer ${adminToken}`,
            'x-admin-session-id': adminToken,
            'x-session-token': adminToken,
          } : {}),
        },
        body: JSON.stringify({ sessionId: adminToken, promptConfig: updated }),
      }).catch(() => {});

      return updated;
    });
  };

  const refreshAdminData = React.useCallback(async (force = false) => {
    const token = currentUser?.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
    if (!token) return false;
    if (adminDataInFlightRef.current) {
      return adminDataInFlightRef.current;
    }
    // Automatic calls only execute ONCE per session token (on login or page reload)
    if (!force && globalFetchedAdminDataToken === token) {
      return true;
    }
    if (!force && Date.now() - lastAdminDataFetchRef.current < 1500) return true;
    globalFetchedAdminDataToken = token;
    lastAdminDataFetchRef.current = Date.now();

    const promise = (async () => {
      try {
        const res = await fetch(apiUrl('/api/admin/data'), {
          headers: {
            'x-session-token': token,
            'x-admin-session-id': token,
            'Authorization': `Bearer ${token}`,
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            if (Array.isArray(data.users)) {
              const now = Date.now();
              const mergedUsers = data.users.map((u: User) => {
                const pending = lastUpdatedUsersRef.current.get(u.id);
                if (pending && now - pending.timestamp < 10000) {
                  return { ...u, ...pending.data };
                }
                return u;
              });
              setUsers(mergedUsers);
            }
            if (Array.isArray(data.resellers)) {
              setResellers(data.resellers);
            }
            if (data.promptConfig) {
              const normalizedPromptCfg = {
                ...data.promptConfig,
                headerEmailOpacity: data.promptConfig.headerEmailOpacityCustom
                  ? (data.promptConfig.headerEmailOpacity ?? 0)
                  : 0,
              };
              setPromptConfig(prev => (JSON.stringify(prev) === JSON.stringify(normalizedPromptCfg) ? prev : normalizedPromptCfg));
            }
            if (data.planExtensions) {
              setPlanExtensions(prev => (JSON.stringify(prev) === JSON.stringify(data.planExtensions) ? prev : data.planExtensions));
            }
            if (data.tutorialConfig) {
              setTutorialConfig(prev => (JSON.stringify(prev) === JSON.stringify(data.tutorialConfig) ? prev : data.tutorialConfig));
            }
            return true;
          }
        }
      } catch {}
      return false;
    })();

    adminDataInFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      adminDataInFlightRef.current = null;
    }
  }, [currentUser?.sessionToken]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        resellers,
        currentReseller,
        generations,
        showcaseVideos,
        extensionConfig,
        planExtensions,
        tutorialConfig,
        isAdmin,
        login,
        resellerLogin,
        loginAsReseller,
        logoutReseller,
        createReseller,
        updateReseller,
        deleteReseller,
        addUserByReseller,
        rotateUserCredentials,
        renewResellerUser,
        reloadResellerUserCredits,
        signup,
        adminCreateUser,
        logout,
        updateUserPlan,
        updateUserCredits,
        updateUserDetails,
        updateUserEmail,
        deleteUser,
        addGeneration,
        deductCredits,
        updateProfile,
        requestUpgrade,
        updateExtensionConfig,
        updatePlanExtensionConfig,
        updateTutorialConfig,
        updateHeroConfig,
        updatePromptConfig,
        heroConfig,
        promptConfig,
        sessionTerminatedNotice,
        dismissSessionTerminatedNotice,
        refreshAdminData,
        syncServerUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

