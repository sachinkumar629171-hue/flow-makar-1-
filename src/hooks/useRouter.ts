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
  if (cleanPath === '/reseller') return 'reseller';
  if (cleanPath === '/dashboard') return 'dashboard';
  if (cleanPath === '/login') return 'login';
  if (cleanPath === '/signup') return 'signup';
  if (cleanPath === '/promptserver') return 'prompt-server';
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
      return '/signup';
    case 'prompt-server':
      return '/PromptServer';
    case 'landing':
    default:
      return '/';
  }
}

function getTitleForRoute(route: AppRoute): string {
  switch (route) {
    case 'dashboard':
      return 'Dashboard — Flow';
    case 'settings':
      return 'Settings — Flow';
    case 'admin':
      return 'Admin — Flow';
    case 'reseller':
      return 'Reseller Portal — Flow';
    case 'login':
      return 'Sign In — Flow';
    case 'signup':
      return 'Sign Up — Flow';
    case 'prompt-server':
      return 'Prompt Server — Flow';
    case 'landing':
    default:
      return 'Flow - AI Video Creation & Storytelling Platform';
  }
}

export function useRouter() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    return getRouteFromPath(window.location.pathname);
  });

  const navigate = useCallback((targetRoute: AppRoute, replace = false) => {
    const targetPath = getPathForRoute(targetRoute);
    const title = getTitleForRoute(targetRoute);
    document.title = title;

    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({ route: targetRoute }, title, targetPath);
      } else {
        window.history.pushState({ route: targetRoute }, title, targetPath);
      }
    }
    setCurrentRoute(targetRoute);
  }, []);

  // Listen to browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromPath(window.location.pathname);
      document.title = getTitleForRoute(route);
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
