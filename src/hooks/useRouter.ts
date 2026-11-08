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
      if (p === '/pricing') return p;
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
      title: 'Google Flow Login — Member Sign In | FlowMaker AI (Flow Ultra, ChatGPT Plus, Super Grok & Muse AI)',
      description: 'Sign in to FlowMaker AI (flowmakerai.site) to access Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI via our extension-based platform.',
      canonicalPath: '/login',
    };
  }
  if (cleanPath === '/register') {
    return {
      title: 'Register Account — FlowMaker AI | Google Flow Ultra, ChatGPT Plus, Super Grok & Muse AI',
      description: 'Create your FlowMaker AI account for extension-based access to Google Flow Ultra (AI video generator), ChatGPT Plus, Super Grok, and Muse AI.',
      canonicalPath: '/register',
    };
  }
  if (route === 'signup' || cleanPath === '/signup') {
    return {
      title: 'Sign Up — FlowMaker AI | Google Flow Maker Free & Ultra Extension Platform',
      description: 'Join FlowMaker AI (flowmakerai.site) to use Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI with our Chrome Extension.',
      canonicalPath: '/signup',
    };
  }
  if (route === 'reseller' || cleanPath === '/reseller') {
    return {
      title: 'Reseller Portal Login — FlowMaker AI | Official Flow Ultra Reseller Panel',
      description: 'Official FlowMaker AI Reseller Portal. Log in to create and manage member accounts for Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI.',
      canonicalPath: '/reseller',
    };
  }
  if (cleanPath === '/pricing') {
    return {
      title: 'Pricing & Plans — FlowMaker AI | Google Flow Ultra, ChatGPT Plus, Super Grok & Muse AI',
      description: 'Explore FlowMaker AI membership plans and pricing for extension-based access to Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI.',
      canonicalPath: '/pricing',
    };
  }
  if (route === 'dashboard') {
    return {
      title: 'Member Dashboard — FlowMaker AI | Google Flow Ultra, ChatGPT Plus, Super Grok & Muse AI',
      description: 'FlowMaker AI Member Dashboard to launch Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI extension tools.',
      canonicalPath: '/dashboard',
    };
  }
  if (route === 'settings') {
    return {
      title: 'Account Settings — FlowMaker AI',
      description: 'Manage your FlowMaker AI account, plan validity, and extension session settings.',
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
    title: 'Flow - AI Video Creation & Storytelling Platform | Google Flow Ultra, ChatGPT Plus, Super Grok & Muse AI Extension',
    description: 'FlowMaker AI (flowmakerai.site) — Extension-based AI platform where members access Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI. Google Flow login, Google Flow AI video generator, Google flow maker free online & pricing plans.',
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
