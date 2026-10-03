/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { MainApp } from './components/MainApp';
import { AdminPanel } from './components/AdminPanel';
import { SettingsPage } from './components/SettingsPage';
import { PromptServerPage } from './components/PromptServerPage';
import { ResellerPortal } from './components/reseller/ResellerPortal';
import { ResellerLoginModal } from './components/reseller/ResellerLoginModal';
import { PricingModal } from './components/modals/PricingModal';
import { useRouter, AppRoute } from './hooks/useRouter';

function AppContent() {
  const { currentUser, currentReseller, isAdmin, promptConfig, users, sessionTerminatedNotice, dismissSessionTerminatedNotice } = useAuth();
  const { currentRoute, navigate } = useRouter();
  const [showResellerLoginModal, setShowResellerLoginModal] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  // Sync Favicon and Tab Title dynamically from promptConfig or default
  useEffect(() => {
    const faviconUrl = promptConfig?.websiteFaviconUrl?.trim() || '/favicon.svg';
    const existingIcons = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon']");
    if (existingIcons.length > 0) {
      existingIcons.forEach(icon => {
        (icon as HTMLLinkElement).href = faviconUrl;
      });
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = faviconUrl;
      document.head.appendChild(link);
    }
    if (promptConfig?.websiteTitle?.trim()) {
      document.title = promptConfig.websiteTitle.trim();
    }
  }, [promptConfig?.websiteFaviconUrl, promptConfig?.websiteTitle]);

  // Sync user data for browser extensions
  useEffect(() => {
    if (currentUser) {
      const sessionToken = currentUser.sessionToken || localStorage.getItem('flowmaker_session_token') || '';
      const isUltra = currentUser.plan === 'ultra' || currentUser.plan === 'unlimited';
      const planDisplayName = currentUser.plan === 'unlimited' ? 'Unlimited VIP Plan' : currentUser.plan === 'ultra' ? 'Ultra VIP Plan' : 'Basic Plan';

      const extensionData = {
        id: currentUser.id,
        userId: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        plan: currentUser.plan,
        planName: planDisplayName,
        credits: currentUser.credits,
        creditsLeft: currentUser.credits,
        maxCredits: currentUser.maxCredits,
        totalCredits: currentUser.maxCredits,
        planDaysLeft: currentUser.planDaysLeft,
        sessionToken: sessionToken,
        token: sessionToken,
        status: currentUser.status,
        canAccessPrompts: isUltra && currentUser.status !== 'suspended',
        portalUrl: window.location.origin,
        timestamp: Date.now()
      };
      
      // Store across all standard local storage keys used by extensions
      localStorage.setItem('google_flow_user_data', JSON.stringify(extensionData));
      localStorage.setItem('flow_extension_bridge_v3', JSON.stringify(extensionData));
      localStorage.setItem('flow_user', JSON.stringify(extensionData));
      localStorage.setItem('portalUser', JSON.stringify(extensionData));
      localStorage.setItem('sessionToken', sessionToken);
      
      // Dispatch custom events for extensions listening
      window.dispatchEvent(new CustomEvent('google_flow_auth_sync', { detail: extensionData }));
      window.dispatchEvent(new CustomEvent('FLOW_EXTENSION_SYNC', { detail: extensionData }));
      window.postMessage({ type: 'FLOW_PORTAL_USER_SYNC', data: extensionData }, '*');
      
      // Global window object
      (window as any).GoogleFlowUser = extensionData;
    } else {
      localStorage.removeItem('google_flow_user_data');
      (window as any).GoogleFlowUser = null;
    }
  }, [currentUser]);

  // Sync route on login/logout
  useEffect(() => {
    if (currentReseller) {
      if (currentRoute !== 'reseller') {
        navigate('reseller', true);
      }
      return;
    }

    if (currentUser) {
      // If user is logged in, ensure route isn't landing or auth
      if (currentRoute === 'landing' || currentRoute === 'login' || currentRoute === 'signup') {
        navigate('dashboard', true);
      }
    } else {
      // If user is logged out, ensure protected routes bounce to landing or login
      if (currentRoute === 'dashboard' || currentRoute === 'settings' || currentRoute === 'admin') {
        navigate('landing', true);
      }
    }
  }, [currentUser, currentReseller, currentRoute, navigate]);

  // Handle global modals
  const globalModals = (
    <>
      <PricingModal 
        isOpen={pricingOpen} 
        onClose={() => setPricingOpen(false)} 
        onOpenAdminPanel={isAdmin ? () => navigate('admin') : undefined}
      />
      <ResellerLoginModal
        isOpen={showResellerLoginModal}
        onClose={() => setShowResellerLoginModal(false)}
        onSuccess={() => {
          setShowResellerLoginModal(false);
          navigate('reseller');
        }}
      />
      {sessionTerminatedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 select-text">
          <div className="bg-[#12131a] border border-neutral-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-5">
            <div className="text-xl font-bold text-white tracking-wide flex items-center justify-center gap-2">
              <span>⚠️</span>
              <span>Session Terminated</span>
            </div>
            <button
              onClick={() => {
                dismissSessionTerminatedNotice();
                navigate('login');
              }}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );

  // If a reseller is logged in directly, or route is reseller
  if (currentReseller || currentRoute === 'reseller') {
    return <ResellerPortal onBackToApp={() => navigate('dashboard')} />;
  }

  // If user is logged in
  if (currentUser) {
    if (currentRoute === 'admin') {
      return (
        <>
          <AdminPanel
            onBackToApp={() => navigate('dashboard')}
            onOpenResellerPortal={() => navigate('reseller')}
            onOpenPromptServer={() => navigate('prompt-server')}
          />
          {globalModals}
        </>
      );
    }

    if (currentRoute === 'settings') {
      return (
        <>
          <SettingsPage
            onBack={() => navigate('dashboard')}
          />
          {globalModals}
        </>
      );
    }

    const dbUser = users.find(u => u.id === currentUser?.id || (u.email && currentUser?.email && u.email.toLowerCase() === currentUser.email.toLowerCase()));
    const canAccessPromptServer = isAdmin || Boolean(currentUser?.canEditPrompts || dbUser?.canEditPrompts);

    if (currentRoute === 'prompt-server') {
      if (!canAccessPromptServer) {
        return <DashboardRedirect navigate={navigate} isAdmin={isAdmin} />;
      }
      return (
        <>
          <PromptServerPage
            onBack={() => navigate('dashboard')}
          />
          {globalModals}
        </>
      );
    }

    return (
      <MainApp
        onOpenAdminPanel={isAdmin ? () => navigate('admin') : undefined}
        onOpenSettings={() => navigate('settings')}
        onOpenPromptServer={canAccessPromptServer ? () => navigate('prompt-server') : undefined}
      />
    );
  }

  // If not logged in
  if (currentRoute === 'login' || currentRoute === 'signup') {
    return (
      <>
        <AuthModal
          initialMode={currentRoute}
          onModeChange={(mode) => navigate(mode)}
          onBackToLanding={() => navigate('landing')}
        />
        {globalModals}
      </>
    );
  }

  return (
    <>
      <LandingPage
        onOpenAuth={(mode) => navigate(mode)}
        onOpenPricing={() => setPricingOpen(true)}
        onOpenResellerLogin={() => setShowResellerLoginModal(true)}
      />
      {globalModals}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const DashboardRedirect: React.FC<{ navigate: (route: AppRoute, replace?: boolean) => void; isAdmin: boolean }> = ({ navigate, isAdmin }) => {
  useEffect(() => {
    navigate('dashboard', true);
  }, [navigate]);
  return (
    <MainApp
      onOpenAdminPanel={isAdmin ? () => navigate('admin') : undefined}
      onOpenSettings={() => navigate('settings')}
      onOpenPromptServer={undefined}
    />
  );
};
