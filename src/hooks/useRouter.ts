import { useEffect, useState, useCallback } from 'react';

export type AppRoute = 
  | 'landing' 
  | 'login' 
  | 'signup' 
  | 'dashboard' 
  | 'settings' 
  | 'admin' 
  | 'reseller'
  | 'prompt-server';

interface RouterState {
  route: AppRoute;
  path: string;
}

function getRouteFromPath(pathname: string): AppRoute {
  const cleanPath = pathname.toLowerCase().replace(/\/+$/, '');
  if (cleanPath === '/settings') return 'settings';
  if (cleanPath === '/admin') return 'admin';
  if (cleanPath === '/reseller' || cleanPath === '/reseller-login' || cleanPath === '/reseller-portal') return 'reseller';
  if (cleanPath === '/dashboard') return 'dashboard';
  if (cleanPath === '/login' || cleanPath === '/signin') return 'login';
  if (cleanPath === '/signup' || cleanPath === '/register') return 'signup';
  if (cleanPath === '/promptserver' || cleanPath === '/prompt-server') return 'prompt-server';
  return 'landing';
}

function getPathForRoute(route: AppRoute): string {
  switch (route) {
    case 'settings':
      return '/settings';
    case 'admin':
      return '/admin';
    case 'reseller':
      return '/reseller';
    case 'dashboard':
      return '/dashboard';
    case 'login':
      return '/login';
    case 'signup':
      return window.location.pathname.toLowerCase().startsWith('/register') ? '/register' : '/signup';
    case 'prompt-server':
      return '/PromptServer';
    case 'landing':
    default: {
      const p = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (p === '/pricing' || p === '/extension' || p === '/ultra') return p;
      return '/';
    }
  }
}

interface RouteSeoMeta {
  title: string;
  description: string;
  canonicalPath: string;
}

function getSeoMetaForPath(route: AppRoute, rawPathname: string): RouteSeoMeta {
  const cleanPath = rawPathname.toLowerCase().replace(/\/+$/, '') || '/';

  if (route === 'login' || cleanPath === '/login') {
    return {
      title: 'Member Login — FlowMaker AI | Flow Extension Basic & Ultra VIP Portal',
      description: 'Sign in to your FlowMaker AI account (flowmakerai.site) to access Flow Basic & Flow Ultra VIP Chrome Extension, Veo 3, Nano Banana 2, and live server prompts.',
      canonicalPath: '/login',
    };
  }
  if (cleanPath === '/register') {
    return {
      title: 'Register Account — FlowMaker AI | Flow Extension Basic & Ultra VIP',
      description: 'Register your FlowMaker AI account for Flow Extension Basic & Ultra VIP. Create 4K AI videos with Google Flow, Nano Banana 2, ChatGPT Plus & Super Grok.',
      canonicalPath: '/register',
    };
  }
  if (route === 'signup' || cleanPath === '/signup') {
    return {
      title: 'Sign Up — FlowMaker AI | Create Flow Basic & Ultra VIP Account',
      description: 'Create a new account on FlowMaker AI (flowmakerai.site) for Flow Extension Basic & Ultra VIP AI video creation and multi-server prompt access.',
      canonicalPath: '/signup',
    };
  }
  if (route === 'reseller' || cleanPath === '/reseller') {
    return {
      title: 'Reseller Portal Login — FlowMaker AI | Official Flow Ultra VIP Reseller Panel',
      description: 'Official FlowMaker AI Reseller Portal. Log in to create and manage Flow Ultra VIP member accounts, 45,000 credits, and 30-day plan validity.',
      canonicalPath: '/reseller',
    };
  }
  if (cleanPath === '/extension') {
    return {
      title: 'Flow Chrome Extension Download — Flow Basic & Flow Ultra VIP Extension',
      description: 'Download the official FlowMaker AI Chrome Extension (Flow Basic v1.8 & Flow Ultra VIP v3.2) with real-time 5-server prompt sync for Google Flow, ChatGPT Plus & Grok.',
      canonicalPath: '/extension',
    };
  }
  if (cleanPath === '/ultra') {
    return {
      title: 'Flow Ultra VIP Studio — Google Flow Veo 3, Nano Banana 2, ChatGPT Plus & Super Grok',
      description: 'Experience Flow Ultra VIP on FlowMaker AI with 45,000 credits, 5 high-speed servers, Google Flow Veo 3, Nano Banana 2, ChatGPT Plus, Muse AI, and Super Grok.',
      canonicalPath: '/ultra',
    };
  }
  if (cleanPath === '/pricing') {
    return {
      title: 'Plans & Pricing — Flow Extension Basic vs Flow Ultra VIP | FlowMaker AI',
      description: 'Compare Flow Basic Plan, Flow Ultra VIP Plan (45,000 credits), and Unlimited VIP Plan on FlowMaker AI (flowmakerai.site).',
      canonicalPath: '/pricing',
    };
  }
  if (route === 'dashboard') {
    return {
      title: 'Studio Dashboard — FlowMaker AI | Flow Basic & Ultra VIP',
      description: 'FlowMaker AI Studio Dashboard for AI video creation, Chrome Extension sync, and multi-platform AI suites.',
      canonicalPath: '/dashboard',
    };
  }
  if (route === 'settings') {
    return {
      title: 'Account Settings — FlowMaker AI',
      description: 'Manage your FlowMaker AI profile, plan validity, and Chrome Extension session settings.',
      canonicalPath: '/settings',
    };
  }
  if (route === 'admin') {
    return {
      title: 'Admin Control Center — FlowMaker AI',
      description: 'FlowMaker AI Administration & Reseller Control Center.',
      canonicalPath: '/admin',
    };
  }
  if (route === 'prompt-server') {
    return {
      title: 'Prompt Server Console — FlowMaker AI',
      description: 'Live Multi-Platform Server Console for Flow Ultra, ChatGPT Plus, Muse AI, and Super Grok.',
      canonicalPath: '/PromptServer',
    };
  }

  return {
    title: 'Flow - AI Video Creation & Storytelling Platform | FlowMaker AI Basic & Ultra Extension',
    description: 'FlowMaker AI (flowmakerai.site) — Official Flow Extension Basic & Ultra VIP AI Video Creation Platform with Nano Banana 2, Veo 3, Member Login, Register & Reseller Portal.',
    canonicalPath: '/',
  };
}

function applySeoMetaToDocument(route: AppRoute, rawPathname: string) {
  const meta = getSeoMetaForPath(route, rawPathname);
  document.title = meta.title;

  const setMetaContent = (selector: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  };

  setMetaContent('meta[name="description"]', meta.description);
  setMetaContent('meta[property="og:title"]', meta.title);
  setMetaContent('meta[property="og:description"]', meta.description);
  setMetaContent('meta[name="twitter:title"]', meta.title);
  setMetaContent('meta[name="twitter:description"]', meta.description);

  const canonicalUrl = `https://www.flowmakerai.site${meta.canonicalPath}`;
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (canonicalLink) {
    canonicalLink.href = canonicalUrl;
  }
}

export function useRouter() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    return getRouteFromPath(window.location.pathname);
  });

  useEffect(() => {
    applySeoMetaToDocument(currentRoute, window.location.pathname);
  }, [currentRoute]);

  const navigate = useCallback((targetRoute: AppRoute, replace = false) => {
    const targetPath = getPathForRoute(targetRoute);
    const seo = getSeoMetaForPath(targetRoute, targetPath);

    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({ route: targetRoute }, seo.title, targetPath);
      } else {
        window.history.pushState({ route: targetRoute }, seo.title, targetPath);
      }
    }
    applySeoMetaToDocument(targetRoute, targetPath);
    setCurrentRoute(targetRoute);
  }, []);

  // Listen to browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromPath(window.location.pathname);
      applySeoMetaToDocument(route, window.location.pathname);
      setCurrentRoute(route);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return {
    currentRoute,
    navigate,
    pathname: getPathForRoute(currentRoute),
  };
}
