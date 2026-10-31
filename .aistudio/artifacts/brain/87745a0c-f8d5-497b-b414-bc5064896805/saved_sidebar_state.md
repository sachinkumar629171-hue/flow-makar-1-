# Saved Sidebar Backup & State (Ready for Restore)

This document stores the exact specifications, asset paths, styling, and complete code for the current sidebar so it can be restored 1:1 at any time.

---

## 1. Specifications & Features
1. **Width & Positioning**:
   - Desktop sidebar width: `225px` (`w-[225px] px-3`)
   - Collapsed state: `64px` (`w-[64px] px-1.5`)
   - Mobile drawer: `w-72 max-w-[85vw]` with top close button (`X`)
   - Position: Placed strictly **underneath the top header** (`<header>` spans 100% full width across the top of the screen).
   - Fixed Layout: Placed in `hidden md:flex h-full shrink-0 z-30` inside `flex flex-row overflow-hidden`, ensuring the sidebar stays permanently stationary and **never scrolls** when the page or content scrolls.

2. **The 5 AI Platforms & Logos**:
   - **Google Flow**: Uses `/assets/aistudio/image_6723d83c.png`
   - **ChatGPT Plus**: Official OpenAI green spiral rosette SVG (`#10A37F`)
   - **Super Grok**: Uses `/assets/aistudio/image_6c182532.png`
   - **Muse AI**: Uses `/assets/aistudio/image_b129a80f.png`
   - **Meta AI**: Uses `/assets/aistudio/image_0c8b35cc.png`

3. **Typography & Spacing**:
   - Proper Capitalization: `Google Flow`, `ChatGPT Plus`, `Super Grok`, `Muse AI`, `Meta AI`
   - Font Size: `text-[14px]` font-semibold/bold
   - Active Indicator: Luminous gradient left bar (`w-1 rounded-r-full bg-gradient-to-b from-blue-400 via-indigo-400 to-purple-400 shadow-[0_0_12px_#60a5fa]`) plus blue glowing dot on the right side.

4. **Account Details at Bottom**:
   - Shows user avatar with tier ring (Gold for Unlimited, Purple for Ultra, Blue for Basic).
   - Shows actual active plan name:
     - `Flow Ultra VIP` (for Ultra plan)
     - `Unlimited VIP` (for Unlimited plan)
     - `Basic Plan` (for Basic plan)
   - Days remaining with glowing green dot: `30 Days` (from `currentUser.planDaysLeft`).
   - Click/tap opens account popover:
     - User email with 1-tap Copy button
     - Plan name & remaining days badge
     - Settings button
     - Plan & Upgrades button
     - Sign Out button

5. **Mobile Quick Platform Bar (Sticky Header)**:
   - Contains logos only (`w-5.5 h-5.5`) without long text labels so that all 5 platforms fit seamlessly on mobile screens without cut-offs or horizontal scrolling.

---

## 2. Complete File: `/src/components/sidebar/AppSidebar.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PanelLeftClose, 
  PanelLeft, 
  Settings, 
  CreditCard, 
  LogOut, 
  Check, 
  Copy,
  ChevronUp,
  Sparkles,
  Zap,
  Crown,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type SidebarTab = 'flow' | 'chatgpt' | 'super-grok' | 'muse-ai' | 'meta-ai';

interface AppSidebarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings?: () => void;
  onOpenPricing?: () => void;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
}

// 1. Google Flow Official Logo from user upload
export const GoogleFlowLogo: React.FC<{ className?: string }> = ({ className = 'w-5.5 h-5.5' }) => (
  <img
    src="/assets/aistudio/image_6723d83c.png"
    alt="Google Flow"
    className={`${className} rounded object-contain shrink-0`}
  />
);

// 2. Official OpenAI ChatGPT Logo (Green Spiral Rosette)
export const ChatGPTLogo: React.FC<{ className?: string }> = ({ className = 'w-5.5 h-5.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3408 7.872zm16.5985 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4047-.6673zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.4063 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1636a.0804.0804 0 0 1-.038-.0567V6.0748a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.4598a.7948.7948 0 0 0-.3927.6813v6.7219zm1.145-2.0284l2.5484-1.4682 2.5484 1.4682v2.9364l-2.5484 1.4682-2.5484-1.4682z"
      fill="#10A37F"
    />
  </svg>
);

// 3. Super Grok Official Logo from user upload
export const SuperGrokLogo: React.FC<{ className?: string }> = ({ className = 'w-5.5 h-5.5' }) => (
  <img
    src="/assets/aistudio/image_6c182532.png"
    alt="Super Grok"
    className={`${className} rounded-md object-contain shrink-0`}
  />
);

// 4. Muse AI Official Logo from user upload
export const MuseAILogo: React.FC<{ className?: string }> = ({ className = 'w-5.5 h-5.5' }) => (
  <img
    src="/assets/aistudio/image_b129a80f.png"
    alt="Muse AI"
    className={`${className} rounded object-contain shrink-0`}
  />
);

// 5. Meta AI Official Logo from user upload
export const MetaAILogo: React.FC<{ className?: string }> = ({ className = 'w-5.5 h-5.5' }) => (
  <img
    src="/assets/aistudio/image_0c8b35cc.png"
    alt="Meta AI"
    className={`${className} rounded-full object-contain shrink-0`}
  />
);

interface NavItem {
  id: SidebarTab;
  name: string;
  renderLogo: (sizeClass?: string) => React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'flow',
    name: 'Google Flow',
    renderLogo: (s = 'w-[22px] h-[22px]') => <GoogleFlowLogo className={s} />,
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT Plus',
    renderLogo: (s = 'w-[22px] h-[22px]') => <ChatGPTLogo className={s} />,
  },
  {
    id: 'super-grok',
    name: 'Super Grok',
    renderLogo: (s = 'w-[22px] h-[22px]') => <SuperGrokLogo className={s} />,
  },
  {
    id: 'muse-ai',
    name: 'Muse AI',
    renderLogo: (s = 'w-[22px] h-[22px]') => <MuseAILogo className={s} />,
  },
  {
    id: 'meta-ai',
    name: 'Meta AI',
    renderLogo: (s = 'w-[22px] h-[22px]') => <MetaAILogo className={s} />,
  },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  onOpenSettings,
  onOpenPricing,
  isMobileDrawer = false,
  onCloseMobileDrawer,
}) => {
  const { currentUser, logout } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close account menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    if (accountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [accountMenuOpen]);

  const userInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
  const daysLeft = currentUser?.planDaysLeft ?? 30;

  // Professional plan presentation
  const isUltra = currentUser?.plan === 'ultra';
  const isUnlimited = currentUser?.plan === 'unlimited';
  const planDisplayName = isUnlimited
    ? 'Unlimited VIP'
    : isUltra
    ? 'Flow Ultra VIP'
    : 'Basic Plan';

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentUser?.email) {
      navigator.clipboard.writeText(currentUser.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <aside
      className={`h-full bg-gradient-to-b from-[#11131a] via-[#0e1017] to-[#0c0d14] border-r border-neutral-800/80 shadow-2xl flex flex-col py-3.5 transition-all duration-200 select-none ${
        isMobileDrawer
          ? 'w-full px-3'
          : collapsed
          ? 'w-[64px] px-1.5'
          : 'w-[225px] px-3'
      }`}
    >
      {/* Top Header / Collapse / Mobile Close Bar */}
      {isMobileDrawer ? (
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-neutral-800/80 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-sans">
              AI Platforms
            </span>
          </div>
          <button
            onClick={onCloseMobileDrawer || onToggleCollapse}
            title="Close menu"
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-neutral-300" />
          </button>
        </div>
      ) : (
        <div className={`flex items-center pb-3 mb-2 border-b border-neutral-800/80 ${collapsed ? 'justify-center' : 'justify-between px-1'}`}>
          {!collapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 font-sans">
              AI Platforms
            </span>
          )}
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar (Show names)' : 'Close sidebar (Icons only)'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
          >
            {collapsed ? (
              <PanelLeft className="w-4 h-4 text-neutral-300" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-neutral-400 hover:text-white" />
            )}
          </button>
        </div>
      )}

      {/* AI Options List with increased font size and prominent active indicator */}
      <div className="space-y-2 flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={collapsed ? item.name : undefined}
              className={`w-full flex items-center rounded-xl transition-all cursor-pointer relative font-sans ${
                collapsed
                  ? 'justify-center p-2.5'
                  : 'gap-3 px-3 py-2.5 text-left'
              } ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600/25 via-indigo-600/15 to-neutral-850/80 text-white font-bold border border-blue-500/40 shadow-[0_4px_20px_rgba(59,130,246,0.18)]'
                  : 'text-neutral-300 hover:text-white hover:bg-white/[0.05] border border-transparent font-semibold'
              }`}
            >
              {/* Luminous Active Left Border Indicator */}
              {isActive && (
                <motion.div
                  layoutId="luminousActiveIndicator"
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-gradient-to-b from-blue-400 via-indigo-400 to-purple-400 shadow-[0_0_12px_#60a5fa]"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}

              {/* Logo with subtle active scale */}
              <div className={`w-[22px] h-[22px] flex items-center justify-center shrink-0 transition-transform ${isActive ? 'scale-110 drop-shadow-md' : 'opacity-90'}`}>
                {item.renderLogo('w-[22px] h-[22px]')}
              </div>

              {/* Professional Clean Capitalized Typography */}
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className={`text-[14px] tracking-tight truncate ${isActive ? 'text-white font-bold drop-shadow' : 'text-neutral-200 font-semibold'}`}>
                    {item.name}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] ml-1 shrink-0" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Account Section: Professional Plan Badge & Days Remaining */}
      <div className="mt-auto pt-3 border-t border-neutral-800/80 relative" ref={accountMenuRef}>
        {/* Account Menu Popover */}
        <AnimatePresence>
          {accountMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute bottom-full left-0 mb-2 w-full min-w-[205px] max-w-[calc(100vw-32px)] bg-[#14161f] border border-neutral-800 rounded-2xl p-3 shadow-2xl z-50 space-y-2 text-left"
            >
              {/* Email / User Card */}
              <div className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold tracking-tight ${isUnlimited ? 'text-amber-300' : isUltra ? 'text-purple-300' : 'text-blue-300'}`}>
                    {planDisplayName}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">
                    {daysLeft} Days
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-mono text-neutral-300 truncate select-all">
                    {currentUser?.email || 'user@example.com'}
                  </span>
                  <button
                    onClick={handleCopyEmail}
                    title="Copy Email"
                    className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1 pt-1">
                {/* Setting */}
                <button
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onOpenSettings?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-neutral-400" />
                  <span>Settings</span>
                </button>

                {/* Plan */}
                <button
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onOpenPricing?.();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    <span>Plan & Upgrades</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-400 font-mono">
                    {daysLeft} Days
                  </span>
                </button>

                {/* Sign Out */}
                <button
                  onClick={() => {
                    setAccountMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Trigger Button: Shows Actual Plan (e.g. Ultra VIP / Basic) + Days Left */}
        <button
          onClick={() => setAccountMenuOpen(!accountMenuOpen)}
          title={collapsed ? `${planDisplayName} · ${daysLeft} Days remaining` : undefined}
          className={`w-full flex items-center rounded-xl p-2 transition-all cursor-pointer group ${
            accountMenuOpen
              ? 'bg-neutral-800/90 ring-1 ring-neutral-700'
              : 'hover:bg-neutral-800/50'
          } ${collapsed ? 'justify-center' : 'justify-between'}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Profile Avatar with Tier Ring */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0 ring-2 ${
                isUnlimited
                  ? 'bg-gradient-to-tr from-amber-600 to-yellow-500 ring-amber-400/50'
                  : isUltra
                  ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 ring-purple-400/50'
                  : 'bg-gradient-to-tr from-blue-600 to-cyan-600 ring-blue-400/50'
              }`}
            >
              {userInitial}
            </div>

            {/* Expanded: Actual Plan Name + Days Badge */}
            {!collapsed && (
              <div className="flex flex-col text-left min-w-0">
                <span
                  className={`text-[13px] font-bold tracking-tight truncate leading-tight ${
                    isUnlimited
                      ? 'text-amber-300'
                      : isUltra
                      ? 'text-purple-300'
                      : 'text-blue-300'
                  }`}
                >
                  {planDisplayName}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] shrink-0" />
                  <span className="text-[11px] font-bold text-emerald-400 font-mono tracking-tight">
                    {daysLeft} Days
                  </span>
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <ChevronUp className={`w-4 h-4 text-neutral-400 group-hover:text-white transition-transform shrink-0 ${accountMenuOpen ? 'rotate-180' : ''}`} />
          )}
        </button>
      </div>
    </aside>
  );
};
```
