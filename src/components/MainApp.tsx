import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  HelpCircle, 
  MoreVertical, 
  Play, 
  Sparkles, 
  ShieldAlert, 
  ChevronRight,
  Zap, 
  Film, 
  Download, 
  X, 
  Youtube, 
  Monitor, 
  Smartphone, 
  ExternalLink, 
  Settings, 
  Chrome,
  Menu,
  Bot,
  Flame,
  Clapperboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { ProfileDropdown } from './ProfileDropdown';
import { VideoStudio } from './VideoStudio';
import { SettingsModal } from './modals/SettingsModal';
import { PricingModal } from './modals/PricingModal';
import { ReferralModal } from './modals/ReferralModal';
import { HistoryModal } from './modals/HistoryModal';
import { DevicesModal } from './modals/DevicesModal';
import { HeroSettingsModal } from './modals/HeroSettingsModal';
import { TutorialSettingsModal } from './modals/TutorialSettingsModal';
import { getYouTubeEmbedUrl, getYouTubeVideoId } from '../utils/youtube';
import { AppSidebar, SidebarTab, GoogleFlowLogo, ChatGPTLogo, SuperGrokLogo, MuseAILogo, MetaAILogo } from './sidebar/AppSidebar';
import { LockedFeatureView } from './suites/LockedFeatureView';
import { ChatGPTSuite } from './suites/ChatGPTSuite';
import { SuperGrokSuite } from './suites/SuperGrokSuite';
import { MuseAISuite } from './suites/MuseAISuite';
import { MetaAISuite } from './suites/MetaAISuite';

interface MainAppProps {
  onOpenAdminPanel: () => void;
  onOpenSettings?: () => void;
  onOpenPromptServer?: () => void;
}

export const MainApp: React.FC<MainAppProps> = ({ onOpenAdminPanel, onOpenSettings, onOpenPromptServer }) => {
  const { currentUser, isAdmin, planExtensions, tutorialConfig, heroConfig, promptConfig } = useAuth();

  // Active AI Engine Tab (Defaults to 'flow' matching the user's screenshot)
  const [activeTab, setActiveTab] = useState<SidebarTab>('flow');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Navigation & Dropdown states
  const [profileOpen, setProfileOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [activePromptForStudio, setActivePromptForStudio] = useState('');

  // Modals state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [tutorialSettingsOpen, setTutorialSettingsOpen] = useState(false);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

  // Hero Rotation
  useEffect(() => {
    if (!heroConfig?.items || heroConfig.items.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentHeroIndex(prev => (prev + 1) % heroConfig.items.length);
    }, heroConfig.rotationSpeed || 5000);

    return () => clearInterval(interval);
  }, [heroConfig?.items?.length, heroConfig?.rotationSpeed]);

  const activeHero = heroConfig?.items?.[currentHeroIndex] || heroConfig?.items?.[0] || {
    id: 'default',
    title: 'Nano Banana 2 is Here!',
    description: "We've updated the original Nano Banana model, with significant improvements in image generation, stylization, multiple references and editing.",
    mediaUrl: '',
    mediaType: 'image',
    buttonText: 'Generate Video',
    buttonUrl: '#'
  };

  if (!currentUser) return null;

  const userInitial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
  const isUltra = currentUser.plan === 'ultra' || currentUser.plan === 'unlimited';

  const desktopEmbedUrl = getYouTubeEmbedUrl(tutorialConfig.desktopVideoUrl);
  const mobileEmbedUrl = getYouTubeEmbedUrl(tutorialConfig.mobileVideoUrl);

  const userPlan = currentUser?.plan || 'basic';
  const config = userPlan === 'ultra' ? planExtensions.ultra : planExtensions.basic;
  let extensionUrl = config?.downloadUrl?.trim() || 'https://drive.google.com/uc?export=download&id=1ow7jqVhIgJZiJfXw9AsYMTNw_AzPZLwc';
  if (config?.downloadType === 'file' && (!extensionUrl || extensionUrl === '')) {
    extensionUrl = `/api/extensions/download/${userPlan}`; 
  }
  if (extensionUrl && !extensionUrl.startsWith('http://') && !extensionUrl.startsWith('https://') && !extensionUrl.startsWith('/')) {
    extensionUrl = 'https://' + extensionUrl;
  }

  const resolvedEmailOpacity = promptConfig?.headerEmailOpacityCustom
    ? (promptConfig?.headerEmailOpacity ?? 0)
    : 0;

  const handleLaunchStudioWithPrompt = (prompt: string) => {
    setActivePromptForStudio(prompt);
    setStudioOpen(true);
  };

  return (
    <div className="h-screen w-full bg-[#08090b] text-[#f1f2f4] flex flex-col select-none overflow-hidden">
      {/* Top Navigation Bar: FULL WIDTH across top of screen (Matches Screenshot) */}
      <header className="h-14 sm:h-16 shrink-0 z-40 bg-[#08090b]/95 backdrop-blur-md border-b border-neutral-900 px-3 sm:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 w-full">
        {/* Left: Mobile Drawer Button + Flow Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 z-10">
          {/* Mobile Sidebar Hamburger */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open AI platforms menu"
            className="flex md:hidden p-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <span
            onClick={() => setActiveTab('flow')}
            className="text-xl sm:text-2xl font-black tracking-tight font-display text-white cursor-pointer hover:opacity-90 transition-opacity"
          >
            Flow
          </span>

          {/* Admin Dashboard Pill */}
          {isAdmin && (
            <button
              onClick={onOpenAdminPanel}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-purple-950/70 hover:bg-purple-900 border border-purple-800/60 rounded-full text-purple-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              <span>Admin Dashboard</span>
            </button>
          )}
        </div>

          {/* Center: Rectangular Notification Box */}
          {promptConfig?.dashboardAnnouncement?.enabled && promptConfig?.dashboardAnnouncement?.text && (
            <div className="flex-1 md:flex-none md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center justify-center min-w-0 px-1 sm:px-3 z-20 pointer-events-auto">
              <div
                className={`inline-flex items-center justify-center gap-2.5 px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl border text-xs sm:text-sm font-bold tracking-wide min-w-[200px] sm:min-w-[320px] md:min-w-[380px] max-w-full sm:max-w-md md:max-w-lg transition-all ${
                  promptConfig.dashboardAnnouncement.type === 'success'
                    ? 'bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600 border-emerald-300/70 text-white shadow-[0_0_22px_rgba(16,185,129,0.5)]'
                    : promptConfig.dashboardAnnouncement.type === 'warning'
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border-yellow-200/90 text-neutral-950 shadow-[0_0_24px_rgba(250,204,21,0.55)]'
                    : 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 border-yellow-300/80 text-white shadow-[0_0_24px_rgba(239,68,68,0.55)]'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse ${
                    promptConfig.dashboardAnnouncement.type === 'warning'
                      ? 'bg-red-600 shadow-[0_0_8px_#dc2626]'
                      : 'bg-yellow-300 shadow-[0_0_8px_#fde047]'
                  }`}
                />
                <span className="truncate sm:whitespace-normal sm:line-clamp-1 leading-snug text-center drop-shadow-sm">
                  {promptConfig.dashboardAnnouncement.text}
                </span>
              </div>
            </div>
          )}

          {/* Right Action Icons & Profile (Matches Screenshot 4 & 6) */}
          <div className="relative flex items-center gap-2 sm:gap-4 shrink-0 z-10">
            {/* Header User Gmail ID - Default 0 opacity (stealth for extension) */}
            {currentUser && (
              <div
                id="header-user-email-container"
                data-user-email={currentUser.email}
                data-user-id={currentUser.id}
                data-user-name={currentUser.name}
                data-user-plan={currentUser.plan}
                data-user-credits={currentUser.credits}
                data-user-days-left={currentUser.planDaysLeft}
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-800/40 bg-black/40 transition-opacity duration-200 select-all ${
                  resolvedEmailOpacity === 0 ? 'md:absolute md:right-full md:mr-2 pointer-events-none' : ''
                }`}
                style={{
                  opacity: resolvedEmailOpacity / 100,
                  pointerEvents: resolvedEmailOpacity === 0 ? 'none' : 'auto',
                }}
                title={resolvedEmailOpacity === 0 ? undefined : currentUser.email}
              >
                <span
                  id="user-header-email"
                  className="text-xs sm:text-sm font-mono text-neutral-300 font-medium tracking-tight max-w-[140px] sm:max-w-[240px] md:max-w-[320px] truncate block"
                >
                  {currentUser.email}
                </span>
              </div>
            )}

            {/* Feedback Icon */}
            <button
              onClick={() => setPricingOpen(true)}
              aria-label="Feedback"
              title="Feedback & Support"
              className="hidden sm:flex p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Help Icon */}
            <button
              onClick={() => setPricingOpen(true)}
              aria-label="Help"
              title="Plan & Support"
              className="hidden sm:flex p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* More Options 3 Dots */}
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="More Options"
              title="Account Options"
              className="p-1.5 sm:p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Plan Badge Pill - Desktop view */}
            <div
              className={`hidden sm:flex px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide items-center gap-1.5 cursor-default ${
                isUltra
                  ? 'bg-purple-950/50 text-purple-200 border border-purple-700/60 shadow-[0_0_20px_rgba(168,85,247,0.3)] ring-1 ring-purple-500/30'
                  : 'bg-blue-950/50 text-blue-200 border border-blue-700/60'
              }`}
            >
              {isUltra ? (
                <motion.div 
                  className="flex items-center gap-1.5"
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>Flow Ultra</span>
                </motion.div>
              ) : (
                <>
                  <Zap className="w-3 h-3 text-blue-400" />
                  <span>Flow Basic</span>
                </>
              )}
            </div>

            {/* User Avatar Circle */}
            <div className="relative group shrink-0">
              {isUltra && (
                <motion.div
                  className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 opacity-75 blur-sm z-0"
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                />
              )}
              <button
                id="user-avatar-btn"
                onClick={() => setProfileOpen(!profileOpen)}
                className={`relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 hover:opacity-90 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer ring-2 shrink-0 ${isUltra ? 'ring-purple-400' : 'ring-white/10'}`}
              >
                {userInitial}
              </button>
            </div>

            {/* Profile Dropdown Component */}
            <AnimatePresence>
              {profileOpen && (
                <ProfileDropdown
                  isOpen={profileOpen}
                  onClose={() => setProfileOpen(false)}
                  onOpenSettings={() => {
                    setProfileOpen(false);
                    if (onOpenSettings) {
                      onOpenSettings();
                    } else {
                      setSettingsOpen(true);
                    }
                  }}
                  onOpenPricing={() => setPricingOpen(true)}
                  onOpenReferral={() => setReferralOpen(true)}
                  onOpenHistory={() => setHistoryOpen(true)}
                  onOpenDevices={() => setDevicesOpen(true)}
                  onOpenAdminPanel={isAdmin ? onOpenAdminPanel : undefined}
                  onOpenPromptSettings={onOpenPromptServer}
                />
              )}
            </AnimatePresence>
          </div>
        </header>

      {/* Mobile Sidebar Drawer Modal */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl"
            >
              <AppSidebar
                activeTab={activeTab}
                onSelectTab={(tab) => {
                  setActiveTab(tab);
                  setMobileDrawerOpen(false);
                }}
                collapsed={false}
                onToggleCollapse={() => setMobileDrawerOpen(false)}
                isMobileDrawer={true}
                onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
                onOpenSettings={() => {
                  setMobileDrawerOpen(false);
                  if (onOpenSettings) onOpenSettings();
                  else setSettingsOpen(true);
                }}
                onOpenPricing={() => {
                  setMobileDrawerOpen(false);
                  setPricingOpen(true);
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Body Area Underneath Header */}
      <div className="flex-1 flex flex-row w-full min-h-0 overflow-hidden">
        {/* Desktop Left Sidebar: Completely fixed and stationary! Never scrolls with page */}
        <div className="hidden md:flex h-full shrink-0 z-30">
          <AppSidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onOpenSettings={() => {
              if (onOpenSettings) onOpenSettings();
              else setSettingsOpen(true);
            }}
            onOpenPricing={() => setPricingOpen(true)}
          />
        </div>

        {/* Right Content Column: Only this side scrolls! */}
        <div className="flex-1 h-full overflow-y-auto flex flex-col min-w-0">
          {/* Mobile Quick Platform Selector Bar (Logos only so all 5 tools fit on screen without scrolling or cut-off) */}
          <div className="flex md:hidden items-center justify-between gap-1.5 px-2.5 py-2 bg-[#0e1017]/95 border-b border-neutral-800/80 shrink-0 sticky top-0 z-20 backdrop-blur-md w-full">
            {[
              { id: 'flow', label: 'Google Flow', renderLogo: () => <GoogleFlowLogo className="w-5.5 h-5.5" /> },
              { id: 'chatgpt', label: 'ChatGPT Plus', renderLogo: () => <ChatGPTLogo className="w-5.5 h-5.5" /> },
              { id: 'super-grok', label: 'Super Grok', renderLogo: () => <SuperGrokLogo className="w-5.5 h-5.5" /> },
              { id: 'muse-ai', label: 'Muse AI', renderLogo: () => <MuseAILogo className="w-5.5 h-5.5" /> },
              { id: 'meta-ai', label: 'Meta AI', renderLogo: () => <MetaAILogo className="w-5.5 h-5.5" /> },
            ].map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as SidebarTab)}
                  title={item.label}
                  aria-label={item.label}
                  className={`flex-1 h-10.5 flex items-center justify-center rounded-xl transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-gradient-to-b from-blue-600/25 to-purple-600/20 border border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.3)] ring-1 ring-blue-400/40'
                      : 'bg-[#12141c]/90 hover:bg-[#1a1d28] border border-neutral-800/80'
                  }`}
                >
                  {item.renderLogo()}
                  {isActive && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" />
                  )}
                </button>
              );
            })}
          </div>

        {/* Main Content Area: Switches between Flow (screenshot page), ChatGPT, Super Grok, and Muse AI */}
        <main className="flex-1 w-full px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-10">
          {activeTab === 'flow' && (
            <>
              {/* Main Hero Banner: Rotating Items (Matches Screenshot exactly) */}
              <section className="relative w-full">
                <div
                  key={activeHero.id || currentHeroIndex}
                  className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-[#0c101d] border border-blue-900/30 shadow-2xl min-h-[290px] sm:min-h-[420px] md:min-h-[480px] lg:min-h-[520px] flex items-center"
                >
                  {/* Background Media */}
                  <div className="absolute inset-0 z-0">
                    {activeHero.mediaType === 'video' ? (
                      <video
                        src={activeHero.mediaUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover brightness-90"
                      />
                    ) : (
                      <img
                        src={(activeHero.mediaUrl && !activeHero.mediaUrl.includes('unsplash.com')) ? activeHero.mediaUrl : "https://www.gstatic.com/aitestkitchen/website/flow/banners/io2026-banner-a1cad419-9d9f-49bb-8daf-825cf9d97f11-AppBanner.png"}
                        alt={activeHero.title}
                        className="w-full h-full object-cover object-center sm:object-center brightness-90"
                      />
                    )}
                    {/* Gradient Vignettes */}
                    <div className="absolute inset-0 bg-gradient-to-b from-[#08090d]/80 via-[#08090d]/35 to-transparent sm:bg-gradient-to-r sm:from-[#08090d]/95 sm:via-[#08090d]/65 sm:to-transparent z-10 w-full sm:w-2/3" />
                    <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-[#08090d]/80 via-transparent to-transparent z-10" />
                  </div>

                  {/* Text Overlay Content */}
                  <div className="relative z-20 p-5 sm:p-12 md:p-16 lg:p-20 max-w-2xl">
                    <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-tight text-white font-display leading-[1.12]">
                      {activeHero.title}
                    </h1>

                    <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base lg:text-lg text-neutral-300 font-normal leading-relaxed max-w-lg">
                      {activeHero.description}
                    </p>
                  </div>

                  {/* Banner Navigation Dots */}
                  {heroConfig?.items?.length > 1 && (
                    <div className="absolute top-3.5 right-3.5 sm:top-auto sm:bottom-6 sm:right-6 z-30 flex gap-1.5 sm:gap-2">
                      {heroConfig.items.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentHeroIndex(idx)}
                          className={`h-2 rounded-full transition-all cursor-pointer ${idx === currentHeroIndex ? 'bg-white w-5 sm:w-6' : 'bg-white/40 hover:bg-white/60 w-2'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Centered Pill Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-3.5 sm:-mt-7 relative z-30 px-4">
                  <motion.button
                    id="main-generate-video-btn"
                    onClick={() => {
                      if (activeHero.buttonUrl && activeHero.buttonUrl !== '#') {
                        window.open(activeHero.buttonUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        setStudioOpen(true);
                      }
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      forcedColorAdjust: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      colorScheme: 'light',
                    }}
                    className="px-7 sm:px-8 py-3.5 sm:py-4 bg-white hover:bg-neutral-100 active:bg-neutral-200 text-neutral-950 font-bold text-xs sm:text-sm rounded-full shadow-[0_4px_25px_rgba(255,255,255,0.3)] hover:shadow-[0_4px_35px_rgba(255,255,255,0.5)] border border-white transition-all duration-150 flex items-center gap-2.5 cursor-pointer select-none"
                  >
                    <div className="w-5 h-5 rounded-full border border-neutral-950/80 flex items-center justify-center shrink-0">
                      <Play className="w-2.5 h-2.5 fill-neutral-950 text-neutral-950 ml-0.5" />
                    </div>
                    <span className="tracking-wide font-bold text-neutral-950">{activeHero.buttonText || 'Generate Video'}</span>
                  </motion.button>
                </div>
              </section>

              {/* Section: 2 YouTube Tutorial Videos (Desktop & Mobile) */}
              <section className="space-y-5 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Youtube className="w-5 h-5 text-red-500" />
                      <h2 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                        How to Use Flow Extension (Tutorials)
                      </h2>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Watch these complete step-by-step video guides to install and generate AI videos on Desktop and Mobile.
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => setTutorialSettingsOpen(true)}
                      className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-950/70 hover:bg-red-900 border border-red-800/60 rounded-xl text-red-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Configure Video Links</span>
                    </button>
                  )}
                </div>

                {/* 2 YouTube Tutorial Video Players Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Video 1: Desktop Tutorial */}
                  <div className="rounded-2xl overflow-hidden bg-[#121318] border border-neutral-800 shadow-xl flex flex-col">
                    <div className="p-4 bg-gradient-to-r from-neutral-900 via-[#15161c] to-[#121318] border-b border-neutral-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-700/60 flex items-center justify-center text-blue-400">
                          <Monitor className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            {tutorialConfig.desktopTitle || 'Desktop & PC Tutorial'}
                          </h3>
                          <p className="text-[11px] text-neutral-400">Chrome, Brave, Edge & Opera Setup</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-950/70 text-blue-300 border border-blue-800/60 text-[10px] font-semibold">
                        Desktop
                      </span>
                    </div>

                    {/* Video Embed */}
                    <div className="relative aspect-video w-full bg-black">
                      {desktopEmbedUrl ? (
                        <iframe
                          src={desktopEmbedUrl}
                          title="Desktop Extension Tutorial"
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-neutral-500 space-y-2">
                          <Youtube className="w-10 h-10 text-red-500/40" />
                          <p className="text-xs">No YouTube link provided for Desktop tutorial.</p>
                          {isAdmin && (
                            <button
                              onClick={() => setTutorialSettingsOpen(true)}
                              className="text-xs text-red-400 underline font-medium cursor-pointer"
                            >
                              Add Desktop YouTube Link
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-[#0e0f14] flex-1">
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        {tutorialConfig.desktopDescription || 'Learn how to load the unpacked extension in developer mode on desktop browsers and start generating.'}
                      </p>
                    </div>
                  </div>

                  {/* Video 2: Mobile Tutorial */}
                  <div className="rounded-2xl overflow-hidden bg-[#121318] border border-neutral-800 shadow-xl flex flex-col">
                    <div className="p-4 bg-gradient-to-r from-neutral-900 via-[#15161c] to-[#121318] border-b border-neutral-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            {tutorialConfig.mobileTitle || 'Mobile Browser Tutorial'}
                          </h3>
                          <p className="text-[11px] text-neutral-400">Kiwi & Mises Browser (Android / iOS)</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 text-[10px] font-semibold">
                        Mobile
                      </span>
                    </div>

                    {/* Video Embed */}
                    <div className="relative aspect-video w-full bg-black">
                      {mobileEmbedUrl ? (
                        <iframe
                          src={mobileEmbedUrl}
                          title="Mobile Extension Tutorial"
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-neutral-500 space-y-2">
                          <Youtube className="w-10 h-10 text-red-500/40" />
                          <p className="text-xs">No YouTube link provided for Mobile tutorial.</p>
                          {isAdmin && (
                            <button
                              onClick={() => setTutorialSettingsOpen(true)}
                              className="text-xs text-red-400 underline font-medium cursor-pointer"
                            >
                              Add Mobile YouTube Link
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-[#0e0f14] flex-1">
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        {tutorialConfig.mobileDescription || 'Step-by-step guide on how to install and run the extension inside Kiwi or Mises Browser on Android or iOS devices.'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ChatGPT Plus: Centered Lock (Tala) */}
          {activeTab === 'chatgpt' && (
            <LockedFeatureView
              platformName="ChatGPT Plus"
              logo={<ChatGPTLogo className="w-5 h-5" />}
            />
          )}

          {/* Super Grok: Centered Lock (Tala) */}
          {activeTab === 'super-grok' && (
            <LockedFeatureView
              platformName="Super Grok"
              logo={<SuperGrokLogo className="w-5 h-5" />}
            />
          )}

          {/* Muse AI: Centered Lock (Tala) */}
          {activeTab === 'muse-ai' && (
            <LockedFeatureView
              platformName="Muse AI"
              logo={<MuseAILogo className="w-5 h-5" />}
            />
          )}

          {/* Meta AI: Centered Lock (Tala) */}
          {activeTab === 'meta-ai' && (
            <LockedFeatureView
              platformName="Meta AI"
              logo={<MetaAILogo className="w-5 h-5" />}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-neutral-900 bg-[#08090b] py-6 px-4 sm:px-8 text-center text-xs text-neutral-500 mt-auto">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© {new Date().getFullYear()} Flow AI Video Studio. Where the next wave of storytelling happens.</p>
            <div className="flex items-center gap-4 text-neutral-400">
              <button onClick={() => setPricingOpen(true)} className="hover:text-white cursor-pointer">Pricing</button>
              <a 
                href={extensionUrl || '#'}
                target={extensionUrl ? "_blank" : "_self"}
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!extensionUrl) {
                    e.preventDefault();
                    alert("No extension link configured by admin.");
                  }
                }}
                className="hover:text-white cursor-pointer"
              >
                Extension
              </a>
              <button onClick={() => setSettingsOpen(true)} className="hover:text-white cursor-pointer">Settings</button>
            </div>
          </div>
        </footer>
      </div>
    </div>

      {/* Interactive Video Studio Modal */}
      <VideoStudio
        isOpen={studioOpen}
        onClose={() => setStudioOpen(false)}
        initialPrompt={activePromptForStudio}
      />

      {/* Dropdown Modals */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} onOpenAdminPanel={isAdmin ? onOpenAdminPanel : undefined} />
      <ReferralModal isOpen={referralOpen} onClose={() => setReferralOpen(false)} />
      <HistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      <DevicesModal isOpen={devicesOpen} onClose={() => setDevicesOpen(false)} />
      <TutorialSettingsModal isOpen={tutorialSettingsOpen} onClose={() => setTutorialSettingsOpen(false)} />
    </div>
  );
};
