import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, PlanType, Generation, ShowcaseVideo, ExtensionConfig, PlanExtensionsConfig, TutorialConfig, HeroConfig, Reseller, PromptConfig } from '../types';
import { INITIAL_USERS, ADMIN_EMAIL, ADMIN_PASSWORD, INITIAL_GENERATIONS, INITIAL_SHOWCASE, INITIAL_RESELLERS } from '../data/initialData';
import { apiUrl } from '../config/api';
import { getSupabase, getSupabaseConfig, saveSupabaseConfig, safeSupabaseUserUpdate, safeSupabaseUserUpsert } from '../lib/supabase';
import { sendTelegramNotification, generate20MinReminderMessage, generate5MinMissedAlertMessage } from '../lib/telegramNotifier';
import { setUserExpiryMs, checkAndDowngradeExpiredUser } from '../lib/userStats';
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
  loadAdminUsers: () => Promise<void>;
  loadAdminResellers: () => Promise<void>;
  loadResellerUsers: (resellerId: string) => Promise<void>;
  promptConfig: PromptConfig;
  sessionTerminatedNotice: boolean;
  dismissSessionTerminatedNotice: () => void;
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
    downloadUrl: '',
    fileName: 'flow-basic-extension-v1.8.0.zip',
    description: 'Standard Video Prompt Sync & Studio Launcher for Basic Plan Members.',
    updatedAt: new Date().toISOString(),
    downloadType: 'url',
  },
  ultra: {
    name: 'Flow Ultra VIP Extension',
    version: '3.2.0',
    downloadUrl: '',
    fileName: 'flow-ultra-vip-extension-v3.2.0.zip',
    description: 'High-Speed 4K Pipeline, Unlimited Prompt Queue & VIP Multi-Session Sync.',
    updatedAt: new Date().toISOString(),
    downloadType: 'url',
  },
};

const DEFAULT_TUTORIAL_CONFIG: TutorialConfig = {
  desktopVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
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
      mediaUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=2400&auto=format&fit=crop&q=95',
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
  headerEmailOpacity: 100,
  signupEnabled: true,
  signupTelegramEnabled: true,
  signupTelegramUrl: '',
  resellerContactUrl: '',
  resellerContactUrlEnabled: true,
  customPlanContactUrl: '',
  pricing: {
    plans: [
      {
        id: 'pro',
        name: 'Pro',
        label: 'PRO',
        subtitle: 'Contact Your Reseller',
        credits: '25,000',
        videos: '750',
        features: [
          '25,000 credits per month',
          '750 AI videos / month',
          'Google Flow managed access',
          '15-day satisfaction warranty',
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
        videos: '1,250',
        features: [
          '45,000 credits per month',
          '1,250 AI videos / month',
          'Google Flow managed access',
          'Priority session pool',
          'Session auto-rotation every 24h',
          'Full generation history',
          'Credit tracking dashboard',
          'Priority reseller support',
          'Early access to new features'
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
          'Custom session allocation'
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(u => !PURGED_MOCK_IDS.has(u.id));
          const hasAdmin = cleaned.some(u => u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
          if (!hasAdmin) {
            return [...INITIAL_USERS, ...cleaned];
          }
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
        return JSON.parse(saved);
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
        return JSON.parse(saved);
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
        return JSON.parse(saved);
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
        // Merge with defaults to ensure new keys like 'pricing' are present
        return {
          ...DEFAULT_PROMPT_CONFIG,
          ...parsed,
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

  // Current user's plan extension (fallback to basic)
  const activePlan = currentUser?.plan || 'basic';
  const extensionConfig = planExtensions[activePlan] || planExtensions.basic;

  // Sync plan extensions to localStorage & central server
  useEffect(() => {
    try {
      localStorage.setItem(PLAN_EXTENSIONS_STORAGE_KEY, JSON.stringify(planExtensions));
    } catch {
      // ignore
    }

    fetch(apiUrl('/api/config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planExtensions }),
    }).catch(() => {});
  }, [planExtensions]);

  // Sync tutorial config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(tutorialConfig));
    } catch {
      // ignore
    }

    fetch(apiUrl('/api/config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutorialConfig }),
    }).catch(() => {});
  }, [tutorialConfig]);

  // Sync hero config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(heroConfig));
    } catch {
      // ignore
    }

    fetch(apiUrl('/api/config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroConfig }),
    }).catch(() => {});
  }, [heroConfig]);

  // Sync prompt config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PROMPT_CONFIG_STORAGE_KEY, JSON.stringify(promptConfig));
    } catch {
      // ignore
    }

    fetch(apiUrl('/api/config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptConfig }),
    }).catch(() => {});
  }, [promptConfig]);

  // Sync resellers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(RESELLERS_STORAGE_KEY, JSON.stringify(resellers));
    } catch {
      // ignore
    }
  }, [resellers]);

  // Sync current reseller to localStorage
  useEffect(() => {
    try {
      if (currentReseller) {
        const safeRes = { ...currentReseller };
        delete (safeRes as any).password;
        localStorage.setItem(CURRENT_RESELLER_KEY, JSON.stringify(safeRes));
      } else {
        localStorage.removeItem(CURRENT_RESELLER_KEY);
      }
    } catch {
      // ignore
    }
  }, [currentReseller]);

  // Sync users to localStorage (stripped of passwords)
  useEffect(() => {
    try {
      const sanitized = users.map(u => {
        const copy = { ...u };
        delete (copy as any).password;
        return copy;
      });
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore
    }
  }, [users]);

  // Sync current user to localStorage & Extension Bridge (stripped of password)
  useEffect(() => {
    try {
      if (currentUser) {
        const safeCurrentUser = { ...currentUser };
        delete (safeCurrentUser as any).password;
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeCurrentUser));
        
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

  // Reply to extension sync requests on demand
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data && (e.data.type === 'FLOW_REQUEST_USER_SYNC' || e.data.type === 'GET_PORTAL_USER')) {
        if (currentUser) {
          const sessionToken = currentUser.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
          const bridgeData = {
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
            canAccessPrompts: (currentUser.plan === 'ultra' || currentUser.plan === 'unlimited') && currentUser.status !== 'suspended',
            portalUrl: window.location.origin,
            lastSynced: new Date().toISOString()
          };
          window.postMessage({ type: 'FLOW_PORTAL_USER_SYNC', data: bridgeData }, '*');
        }
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

  // Real-time Central Server Sync & Polling (Secure: Never leaks all users or passwords)
  useEffect(() => {
    let isMounted = true;

    const pollCentralServer = async () => {
      try {
        // 1. Fetch public application configs (tutorials, extensions, hero, prompts)
        try {
          const configRes = await fetch(apiUrl('/api/config'));
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
                  servers: mergedServers,
                };
                if (prev && JSON.stringify(prev) === JSON.stringify(merged)) {
                  return prev;
                }
                return merged;
              });
            }
          }
        } catch {}

        // 2. If a user is logged in, refresh ONLY their own user profile (NO all-users fetch!)
        if (currentUser && isMounted) {
          try {
            const profRes = await fetch(apiUrl('/api/users/profile'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: currentUser.id,
                email: currentUser.email,
                sessionToken: currentUser.sessionToken,
              }),
            });
            if (profRes.ok) {
              const profData = await profRes.json();
              if (profData.user && isMounted) {
                const u = profData.user;
                if (u.status === 'suspended' || u.status === 'inactive') {
                  setSessionTerminatedNotice(true);
                  logout();
                } else {
                  setCurrentUser(prev => {
                    if (!prev) return null;
                    if (
                      prev.credits !== u.credits ||
                      prev.maxCredits !== u.maxCredits ||
                      prev.plan !== u.plan ||
                      prev.planDaysLeft !== u.planDaysLeft ||
                      prev.status !== u.status ||
                      prev.extensionAccess !== u.extensionAccess ||
                      Boolean(prev.canEditPrompts) !== Boolean(u.canEditPrompts)
                    ) {
                      return { ...prev, ...u };
                    }
                    return prev;
                  });
                }
              }
            }
          } catch {}
        }

        // 3. ONLY if current user is an authenticated Master Admin, fetch users and resellers for Admin Panel
        const isMasterAdmin = Boolean(
          currentUser && (
            currentUser.role === 'admin' ||
            ['sachinxexplore@gmail.com', 'sachinkumar629171@gmail.com'].includes(currentUser.email?.toLowerCase())
          )
        );

        if (isMasterAdmin && currentUser && isMounted) {
          try {
            const [usersRes, resellersRes] = await Promise.all([
              fetch(apiUrl(`/api/users?adminEmail=${encodeURIComponent(currentUser.email)}`)),
              fetch(apiUrl(`/api/resellers?adminEmail=${encodeURIComponent(currentUser.email)}`)),
            ]);
            if (usersRes.ok) {
              const uData = await usersRes.json();
              if (Array.isArray(uData.users) && isMounted) {
                setUsers(uData.users);
              }
            }
            if (resellersRes.ok) {
              const rData = await resellersRes.json();
              if (Array.isArray(rData.resellers) && isMounted) {
                setResellers(rData.resellers);
              }
            }
          } catch {}
        }

        // 4. If logged in as Reseller in Reseller Portal, fetch ONLY assigned users for that reseller
        if (currentReseller && !isMasterAdmin && isMounted) {
          try {
            const rUsersRes = await fetch(apiUrl(`/api/reseller/users?resellerId=${encodeURIComponent(currentReseller.id)}`));
            if (rUsersRes.ok) {
              const rUData = await rUsersRes.json();
              if (Array.isArray(rUData.users) && isMounted) {
                setUsers(rUData.users);
              }
            }
          } catch {}
        }
      } catch {
        // network fallback
      }
    };

    pollCentralServer();
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      pollCentralServer();
    }, 60000);

    const handleTabFocus = () => {
      pollCentralServer();
    };
    window.addEventListener('focus', handleTabFocus);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleTabFocus);
    };
  }, [currentUser?.id, currentUser?.email, currentUser?.role, currentReseller?.id]);

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

      // 2. User plan auto-conversion (Ultra -> Basic when 0 Day 0 Hour reached)
      setUsers(prevUsers => {
        let usersChanged = false;
        const supaClient = getSupabase();
        const nextUsers = prevUsers.map(u => {
          const { user: downgradedUser, changed } = checkAndDowngradeExpiredUser(u);
          if (changed) {
            usersChanged = true;
            if (supaClient) {
              safeSupabaseUserUpdate(supaClient, downgradedUser.id, downgradedUser.email, {
                plan: 'basic',
                credits: downgradedUser.credits,
                max_credits: 100,
                plan_days_left: 0,
              }).catch(() => {});
            }
            return downgradedUser;
          }
          return u;
        });
        return usersChanged ? nextUsers : prevUsers;
      });

      // 3. Current logged in user auto-downgrade check
      setCurrentUser(prevUser => {
        if (!prevUser) return null;
        const { user: downgraded, changed } = checkAndDowngradeExpiredUser(prevUser);
        if (changed) {
          const supaClient = getSupabase();
          if (supaClient) {
            safeSupabaseUserUpdate(supaClient, downgraded.id, downgraded.email, {
              plan: 'basic',
              credits: downgraded.credits,
              max_credits: 100,
              plan_days_left: 0,
            }).catch(() => {});
          }
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
            const lastLogin = Number(localStorage.getItem('flow_login_timestamp') || '0');
            if (Date.now() - lastLogin < 10000) return; // Ignore during 10s login grace period

            const isCurrentUserAdmin = currentUser.email.toLowerCase() === 'sachinxexplore@gmail.com' || currentUser.email.toLowerCase() === 'sachinkumar629171@gmail.com' || currentUser.role === 'admin';
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

  // Supabase Realtime subscription for immediate (< 500ms) cross-device session termination
  useEffect(() => {
    if (!currentUser) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase.channel(`user-session-${currentUser.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${currentUser.id}`,
      }, (payload: any) => {
        const lastLogin = Number(localStorage.getItem('flow_login_timestamp') || '0');
        if (Date.now() - lastLogin < 10000) return; // Ignore during 10s login grace period

        const newSupaUser = payload.new;
        const localToken = localStorage.getItem('flowmaker_session_token') || currentUser.sessionToken;
        if (newSupaUser && newSupaUser.session_token && localToken && newSupaUser.session_token !== localToken) {
          console.warn('[Realtime] Newer session detected on another device! Logging out old session.');
          setSessionTerminatedNotice(true);
          logout();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.email]);

  // Heartbeat to keep currentUser active/online & enforce single-session exclusivity
  useEffect(() => {
    if (!currentUser) return;

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('flow_user_presence');
      }
    } catch {}

    const heartbeat = () => {
      const now = new Date().toISOString();
      const localToken = localStorage.getItem('flowmaker_session_token');

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

      // Central server sync with session token verification (throttled smart quota saver)
      fetch(apiUrl('/api/users/heartbeat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
          isOnline: true,
          sessionToken: localToken || currentUser.sessionToken
        }),
      })
      .then(res => res.json())
      .then(data => {
        const lastLogin = Number(localStorage.getItem('flow_login_timestamp') || '0');
        if (Date.now() - lastLogin < 10000) return; // Ignore during 10s grace period

        if (data && data.sessionMismatch) {
          console.warn('[SingleSession] Heartbeat detected session mismatch! Terminating old session.');
          setSessionTerminatedNotice(true);
          logout();
        }
      })
      .catch(() => {});
    };

    heartbeat();
    // Heartbeat every 35 seconds (server throttles Supabase writes to 80s)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      heartbeat();
    }, 35000);

    const onUserActivity = () => {
      (window as any)._lastSupaSessionCheck = 0; // Force immediate check on tab focus/activity
      heartbeat();
    };
    window.addEventListener('focus', onUserActivity);
    window.addEventListener('visibilitychange', onUserActivity);

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
      clearInterval(interval);
      window.removeEventListener('focus', onUserActivity);
      window.removeEventListener('beforeunload', handleUnload);
      if (bc) bc.close();
    };
  }, [currentUser?.id, currentUser?.email]);

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

  const adminEmails = [ADMIN_EMAIL.toLowerCase(), 'sachinkumar629171@gmail.com', 'sachinxexplore@gmail.com'];
  const isAdmin = (currentUser?.email && adminEmails.includes(currentUser.email.toLowerCase())) || currentUser?.role === 'admin';

  const resellerLogin = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    try {
      const res = await fetch(apiUrl('/api/reseller/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Invalid reseller credentials.' };
      }
      if (data.reseller) {
        setCurrentReseller(data.reseller);
        // Fetch only this reseller's assigned users
        try {
          const uRes = await fetch(apiUrl(`/api/reseller/users?resellerId=${encodeURIComponent(data.reseller.id)}`));
          if (uRes.ok) {
            const uData = await uRes.json();
            if (Array.isArray(uData.users)) {
              setUsers(uData.users);
            }
          }
        } catch {}
        return { success: true };
      }
      return { success: false, error: 'Failed to authenticate reseller.' };
    } catch {
      return { success: false, error: 'Could not connect to authentication server.' };
    }
  };

  const loginAsReseller = (reseller: Reseller) => {
    setCurrentReseller(reseller);
  };

  const logoutReseller = () => {
    setCurrentReseller(null);
  };

  const createReseller = async (data: {
    portalName: string;
    email: string;
    password: string;
    userLimit: number;
    daysLeft: number;
    notes?: string;
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
    };

    const updatedList = [newReseller, ...resellers];
    setResellers(updatedList);

    // 1. Direct sync to Supabase resellers table
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('resellers').upsert({
          id: newReseller.id,
          portal_name: newReseller.portalName,
          email: newReseller.email,
          password: newReseller.password,
          user_limit: newReseller.userLimit,
          days_left: newReseller.daysLeft,
          expiry_date: newReseller.expiryDate,
          expires_at: newReseller.expiresAt,
          status: newReseller.status,
          created_at: newReseller.createdAt,
          notes: newReseller.notes,
          api_key: newReseller.apiKey,
        });
      } catch (err) {
        console.warn('Supabase resellers table upsert error:', err);
      }

      // 2. Also back up all resellers to admin_config_resellers row in users table (guaranteed persistence!)
      try {
        await supabase.from('users').upsert({
          id: 'admin_config_resellers',
          name: JSON.stringify(updatedList),
          email: 'resellers_backup@flowmaker.local',
          role: 'user',
          status: 'active',
        });
      } catch (err) {
        console.warn('Backup resellers row insert error:', err);
      }
    }

    try {
      await fetch(apiUrl('/api/resellers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReseller),
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
        const supaUpdatePayload: any = {
          id: resellerId,
          portal_name: updatedReseller.portalName,
          email: updatedReseller.email,
          password: updatedReseller.password,
          user_limit: updatedReseller.userLimit,
          days_left: updatedReseller.daysLeft,
          expiry_date: updatedReseller.expiryDate,
          expires_at: updatedReseller.expiresAt,
          status: updatedReseller.status,
          notes: updatedReseller.notes,
          api_key: updatedReseller.apiKey,
        };
        supa.from('resellers').upsert(supaUpdatePayload).then(() => {}, () => {});
        supa.from('users').upsert({
          id: 'admin_config_resellers',
          name: JSON.stringify(updatedList),
          email: 'resellers_backup@flowmaker.local',
          role: 'user',
          status: 'active',
        }).then(() => {}, () => {});
      }

      fetch(apiUrl('/api/resellers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedReseller),
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
      supa.from('users').upsert({
        id: 'admin_config_resellers',
        name: JSON.stringify(updatedList),
        email: 'resellers_backup@flowmaker.local',
        role: 'user',
        status: 'active',
      }).then(() => {}, () => {});
    }
    fetch(apiUrl(`/api/resellers/${resellerId}`), { method: 'DELETE' }).catch(() => {});
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
    const targetReseller = resellers.find(r => r.id === resellerId);
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

    // Double check Supabase for absolute certainty
    const supa = getSupabase();
    if (supa) {
      const { data: supaExists } = await supa.from('users').select('id').eq('email', cleanEmail).maybeSingle();
      if (supaExists) {
        return { success: false, error: 'This Gmail ID is already registered! Please use a different Gmail.' };
      }
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

    // Supabase direct database insert
    const supabase = getSupabase();
    if (supabase) {
      safeSupabaseUserUpsert(supabase, newUser).catch(err => {
        console.error('Supabase reseller user insert error:', err);
      });
    }

    // Send to central server database immediately
    try {
      await fetch(apiUrl('/api/users/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          plan: newUser.plan,
          credits: newUser.credits,
          maxCredits: newUser.maxCredits,
          planDaysLeft: newUser.planDaysLeft,
          role: newUser.role,
          resellerId: newUser.resellerId,
          resellerName: targetReseller.portalName,
          createdAt: newUser.createdAt,
          avatarColor: newUser.avatarColor,
          status: newUser.status,
        }),
      });
    } catch (err) {
      console.error('Error saving reseller user to central server:', err);
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

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, data: { password: newPass } }),
    }).catch(() => {});

    return { email: user.email, password: newPass };
  };

  const renewResellerUser = (userId: string, days = 30) => {
    const user = users.find(u => u.id === userId);
    const userEmail = user?.email;
    const newDays = (user?.planDaysLeft || 0) + days;
    const calculatedExpiresAt = new Date(Date.now() + newDays * 24 * 60 * 60 * 1000).toISOString();
    setUserExpiryMs(userId, newDays, new Date(calculatedExpiresAt).getTime());

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

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, data: { planDaysLeft: newDays, planExpiresAt: calculatedExpiresAt } }),
    }).catch(() => {});

    const supabase = getSupabase();
    if (supabase) {
      safeSupabaseUserUpdate(supabase, userId, userEmail, {
        plan_days_left: newDays,
      }, user).catch(() => {});
    }
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

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, data: { credits: targetCredits } }),
    }).catch(() => {});

    const supabase = getSupabase();
    if (supabase) {
      safeSupabaseUserUpdate(supabase, userId, userEmail, {
        credits: targetCredits,
      }, user).catch(() => {});
    }
  };

  const login = async (email: string, pass: string, forceLogin = false): Promise<{ success: boolean; isDeviceLocked?: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    const adminEmails = [ADMIN_EMAIL.toLowerCase(), 'sachinkumar629171@gmail.com', 'sachinxexplore@gmail.com'];
    // Special Check for configured Admin credentials
    if (adminEmails.includes(cleanEmail) && cleanPass === ADMIN_PASSWORD) {
      let adminUser = users.find(u => adminEmails.includes(u.email.toLowerCase()));
      if (!adminUser) {
        adminUser = {
          id: 'usr-admin-1',
          name: 'Sachin Kumar',
          email: cleanEmail,
          password: ADMIN_PASSWORD,
          whatsapp: '+91 9876543210',
          telegram: '@sachinkumar_admin',
          referralCode: 'FLOWADMIN',
          plan: 'ultra',
          credits: 45000,
          maxCredits: 45000,
          planDaysLeft: 30,
          role: 'admin',
          createdAt: new Date().toISOString(),
          status: 'active',
          isOnline: true,
          lastActive: new Date().toISOString(),
        };
        setUsers(prev => [adminUser!, ...prev]);
      }
      const sessionToken = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      adminUser.sessionToken = sessionToken;
      localStorage.setItem('flowmaker_session_token', sessionToken);
      localStorage.setItem('flow_login_timestamp', String(Date.now()));
      setCurrentUser(adminUser);

      // Broadcast across tabs
      try {
        const bc = new BroadcastChannel('flow_user_presence');
        bc.postMessage({
          type: 'NEW_LOGIN',
          email: adminUser.email,
          sessionToken: sessionToken,
        });
        setTimeout(() => bc.close(), 1000);
      } catch {}

      // Update Supabase & server database so older devices running this account immediately terminate
      const supa = getSupabase();
      if (supa) {
        supa.from('users').update({ session_token: sessionToken, is_online: true, last_active: new Date().toISOString() }).ilike('email', cleanEmail).then(() => {});
      }
      fetch(apiUrl('/api/users/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass, sessionToken, forceLogin }),
      }).catch(() => {});

      return { success: true };
    }

    // Consult central server login for strict authoritative single-device lock and credentials verification
    try {
      const supaConfig = getSupabaseConfig();
      const serverRes = await fetch(apiUrl('/api/users/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass, forceLogin, supabaseConfig: supaConfig.isConnected ? supaConfig : undefined }),
      });
      const serverData = await serverRes.json().catch(() => ({}));
      if (!serverRes.ok) {
        // Fallback: If server returned 404 but Supabase is connected, check Supabase directly from client
        if (serverRes.status === 404 && supaConfig.isConnected) {
          const clientSupa = getSupabase();
          if (clientSupa) {
            try {
              const { data: supaData, error: supaErr } = await clientSupa.from('users').select('*').ilike('email', cleanEmail);
              if (!supaErr && supaData && supaData.length > 0) {
                const foundU = supaData.find((u: any) => u && !u.id?.startsWith('admin_config_')) || supaData[0];
                if (foundU) {
                  const loggedUser: User = {
                    id: foundU.id,
                    name: foundU.name || 'User',
                    email: foundU.email,
                    password: foundU.password || cleanPass,
                    whatsapp: foundU.whatsapp || '',
                    telegram: foundU.telegram || '',
                    referralCode: foundU.referral_code || '',
                    plan: foundU.plan || 'basic',
                    credits: Number(foundU.credits) ?? 100,
                    maxCredits: Number(foundU.max_credits) || 100,
                    planDaysLeft: Number(foundU.plan_days_left) ?? 30,
                    role: foundU.role || 'user',
                    status: foundU.status || 'active',
                    isOnline: true,
                    createdAt: foundU.created_at || new Date().toISOString(),
                  };
                  const sessionToken = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
                  loggedUser.sessionToken = sessionToken;
                  localStorage.setItem('flowmaker_session_token', sessionToken);
                  localStorage.setItem('flow_login_timestamp', String(Date.now()));
                  setCurrentUser(loggedUser);
                  setUsers(prev => [loggedUser, ...prev.filter(u => u.email.toLowerCase() !== cleanEmail)]);
                  
                  // Sync to server in background
                  fetch(apiUrl('/api/users/signup'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loggedUser),
                  }).catch(() => {});

                  return { success: true };
                }
              }
            } catch (fallbackErr) {
              console.error('Client direct Supabase login fallback error:', fallbackErr);
            }
          }
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
        return { success: false, error: serverData.error || 'Account not found. Please sign up first.' };
      }

      if (serverData.success && serverData.user) {
        const sUser: User = serverData.user;
        if (sUser.sessionToken) {
          localStorage.setItem('flowmaker_session_token', sUser.sessionToken);
          localStorage.setItem('flow_login_timestamp', String(Date.now()));
          try {
            const bc = new BroadcastChannel('flow_user_presence');
            bc.postMessage({
              type: 'NEW_LOGIN',
              email: sUser.email,
              sessionToken: sUser.sessionToken,
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
      return { success: false, error: 'Login failed. Please check credentials.' };
    } catch {
      return { success: false, error: 'Could not connect to authentication server.' };
    }
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

    const isSystemAdmin = cleanEmail === ADMIN_EMAIL.toLowerCase();
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
      plan: isSystemAdmin ? 'ultra' : 'basic',
      credits: isSystemAdmin ? 45000 : 100,
      maxCredits: isSystemAdmin ? 45000 : 100,
      planDaysLeft: 30,
      role: isSystemAdmin ? 'admin' : 'user',
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

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        data: {
          plan: newPlan,
          credits: defaultCredits,
          maxCredits: defaultCredits,
          planDaysLeft: targetDays,
          upgradeRequested: false,
        },
      }),
    }).catch(() => {});

    const supabase = getSupabase();
    if (supabase) {
      safeSupabaseUserUpdate(supabase, userId, userEmail, {
        plan: newPlan,
        credits: defaultCredits,
        max_credits: defaultCredits,
        plan_days_left: targetDays,
      }, targetUser).catch(() => {});
    }
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
    const calculatedExpiresAt = data.planDaysLeft !== undefined ? new Date(Date.now() + Math.max(0, data.planDaysLeft) * 24 * 60 * 60 * 1000).toISOString() : undefined;
    if (data.planDaysLeft !== undefined) {
      setUserExpiryMs(userId, data.planDaysLeft, calculatedExpiresAt ? new Date(calculatedExpiresAt).getTime() : undefined);
    }

    const mergedData = {
      ...existingPending,
      ...data,
      ...(calculatedExpiresAt ? { planExpiresAt: calculatedExpiresAt } : {}),
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
            ...data,
            name: data.name !== undefined ? data.name : u.name,
            email: data.email !== undefined ? data.email : u.email,
            password: data.password !== undefined ? data.password : u.password,
            plan: data.plan !== undefined ? data.plan : u.plan,
            credits: data.credits !== undefined ? data.credits : u.credits,
            maxCredits: data.maxCredits !== undefined ? data.maxCredits : u.maxCredits,
            planDaysLeft: data.planDaysLeft !== undefined ? Math.max(0, data.planDaysLeft) : u.planDaysLeft,
            planExpiresAt: calculatedExpiresAt || u.planExpiresAt,
            status: data.status !== undefined ? data.status : (data.planDaysLeft !== undefined && data.planDaysLeft <= 0 ? 'suspended' : u.status),
            extensionAccess: data.extensionAccess !== undefined ? data.extensionAccess : (u.extensionAccess !== undefined ? u.extensionAccess : true),
            canEditPrompts: data.canEditPrompts !== undefined ? data.canEditPrompts : (u.canEditPrompts !== undefined ? u.canEditPrompts : false),
            isOnline: data.isOnline !== undefined ? data.isOnline : u.isOnline,
            sessionToken: data.sessionToken !== undefined ? data.sessionToken : u.sessionToken,
            upgradeRequested: data.plan === 'ultra' ? false : u.upgradeRequested,
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
              ...data,
              name: data.name !== undefined ? data.name : prev.name,
              email: data.email !== undefined ? data.email : prev.email,
              password: data.password !== undefined ? data.password : prev.password,
              plan: data.plan !== undefined ? data.plan : prev.plan,
              credits: data.credits !== undefined ? data.credits : prev.credits,
              maxCredits: data.maxCredits !== undefined ? data.maxCredits : prev.maxCredits,
              planDaysLeft: data.planDaysLeft !== undefined ? Math.max(0, data.planDaysLeft) : prev.planDaysLeft,
              planExpiresAt: calculatedExpiresAt || prev.planExpiresAt,
              status: data.status !== undefined ? data.status : (data.planDaysLeft !== undefined && data.planDaysLeft <= 0 ? 'suspended' : prev.status),
              extensionAccess: data.extensionAccess !== undefined ? data.extensionAccess : (prev.extensionAccess !== undefined ? prev.extensionAccess : true),
              canEditPrompts: data.canEditPrompts !== undefined ? data.canEditPrompts : (prev.canEditPrompts !== undefined ? prev.canEditPrompts : false),
              isOnline: data.isOnline !== undefined ? data.isOnline : prev.isOnline,
              sessionToken: data.sessionToken !== undefined ? data.sessionToken : prev.sessionToken,
              upgradeRequested: data.plan === 'ultra' ? false : prev.upgradeRequested,
            }
          : null
      );
    }

    const payload = {
      userId,
      data: {
        ...data,
        ...(calculatedExpiresAt ? { planExpiresAt: calculatedExpiresAt } : {}),
      }
    };

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});

    const supabase = getSupabase();
    if (supabase) {
      const supaData: any = {};
      if (data.name !== undefined) supaData.name = data.name;
      if (data.email !== undefined) supaData.email = data.email;
      if (data.password !== undefined) supaData.password = data.password;
      if (data.plan !== undefined) supaData.plan = data.plan;
      if (data.credits !== undefined) supaData.credits = data.credits;
      if (data.maxCredits !== undefined) supaData.max_credits = data.maxCredits;
      if (data.planDaysLeft !== undefined) supaData.plan_days_left = data.planDaysLeft;
      if (data.isOnline !== undefined) supaData.is_online = data.isOnline;
      if (data.sessionToken !== undefined) supaData.session_token = data.sessionToken;

      safeSupabaseUserUpdate(supabase, userId, userEmail, supaData, userToUpdate).catch(err => {
        console.error('Failed to sync update to Supabase:', err);
      });
    }
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

    // Check Supabase for duplicate
    const supa = getSupabase();
    if (supa) {
      try {
        const { data: supaExists } = await supa.from('users').select('id').eq('email', cleanEmail).neq('id', userId).maybeSingle();
        if (supaExists) {
          return { success: false, error: 'This Gmail ID is already registered!' };
        }
      } catch {}
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

    fetch(apiUrl('/api/users/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        data: {
          credits: newCredits,
          maxCredits: newMax !== undefined ? newMax : Math.max(newCredits),
        },
      }),
    }).catch(() => {});

    const supabase = getSupabase();
    if (supabase) {
      safeSupabaseUserUpdate(supabase, userId, userEmail, {
        credits: newCredits,
        ...(newMax !== undefined ? { max_credits: newMax } : {}),
      }, userToUpdate).catch(() => {});
    }
  };

  const deleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    if (currentUser?.id === userId) {
      setCurrentUser(null);
    }
    const supabase = getSupabase();
    if (supabase) {
      supabase.from('users').delete().eq('id', userId).then(() => {});
    }
    fetch(apiUrl(`/api/users/${userId}`), { method: 'DELETE' }).catch(() => {});
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

      fetch(apiUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planExtensions: updated,
          promptConfig: newVer ? { extensionVersion: newVer } : undefined,
        }),
      }).catch(() => {});

      return updated;
    });
  };

  const updateTutorialConfig = (newConfig: Partial<TutorialConfig>) => {
    lastConfigUpdateRef.current = Date.now() + 30000;
    setTutorialConfig(prev => {
      const updated = {
        ...prev,
        ...newConfig,
      };

      syncConfigToSupabase('admin_config_tutorial', updated);

      fetch(apiUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorialConfig: updated }),
      }).catch(() => {});

      return updated;
    });
  };

  const updateHeroConfig = (newConfig: Partial<HeroConfig>) => {
    lastConfigUpdateRef.current = Date.now() + 30000;
    setHeroConfig(prev => {
      const updated = {
        ...prev,
        ...newConfig,
      };

      syncConfigToSupabase('admin_config_hero', updated);

      fetch(apiUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroConfig: updated }),
      }).catch(() => {});

      return updated;
    });
  };

  const updatePromptConfig = (newConfig: Partial<PromptConfig>) => {
    lastConfigUpdateRef.current = Date.now() + 30000;
    setPromptConfig(prev => {
      const updated = {
        ...prev,
        ...newConfig,
      };

      syncConfigToSupabase('admin_config_prompts', updated);

      fetch(apiUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptConfig: updated }),
      }).catch(() => {});

      return updated;
    });
  };

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

