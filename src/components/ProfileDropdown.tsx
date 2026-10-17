import React, { useRef, useEffect, useState } from 'react';
import { 
  Settings, 
  CreditCard, 
  Share2, 
  History, 
  Shield, 
  Download, 
  LogOut, 
  Zap,
  ShieldAlert,
  Copy,
  Check,
  Terminal
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { triggerExtensionDownload } from '../utils/download';
import { getUserCreditStats, getUserValidityTime } from '../lib/userStats';

interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenPricing: () => void;
  onOpenReferral: () => void;
  onOpenHistory: () => void;
  onOpenDevices: () => void;
  onOpenExtension?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenPromptSettings?: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenPricing,
  onOpenReferral,
  onOpenHistory,
  onOpenDevices,
  onOpenAdminPanel,
  onOpenPromptSettings,
}) => {
  const { currentUser, logout, isAdmin, planExtensions } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [, setTick] = useState(0);

  // Real-time tick every 30 seconds so remaining time & progress update dynamically
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('#user-avatar-btn')) {
        return;
      }

      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !currentUser) return null;

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentUser.email) {
      navigator.clipboard.writeText(currentUser.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const userPlan = currentUser.plan || 'basic';
  const config = userPlan === 'ultra' ? planExtensions.ultra : planExtensions.basic;
  let extensionUrl = config.downloadUrl?.trim() || 'https://drive.google.com/uc?export=download&id=1ow7jqVhIgJZiJfXw9AsYMTNw_AzPZLwc';
  if (config.downloadType === 'file' && (!extensionUrl || extensionUrl === '')) {
    extensionUrl = `/api/extensions/download/${userPlan}`; 
  }
  if (extensionUrl && !extensionUrl.startsWith('http://') && !extensionUrl.startsWith('https://') && !extensionUrl.startsWith('/')) {
    extensionUrl = 'https://' + extensionUrl;
  }

  const stats = getUserCreditStats(currentUser);
  const validity = getUserValidityTime(currentUser);
  // Line represents Date / Plan Validity Remaining (decreases and empties as days decrease)
  const dateRemainingPercent = validity.percentageRemaining;

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute top-12 sm:top-13 right-0 sm:right-0 w-[calc(100vw-28px)] max-w-[285px] bg-[#121319] border border-neutral-800/90 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl text-white select-text"
    >
      {/* User Header & Info */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-white tracking-tight truncate select-text cursor-text">
              {currentUser.name}
            </h3>
            <p className="text-xs text-neutral-400 select-text cursor-text truncate mt-0.5">
              {currentUser.email}
            </p>
          </div>
          <button
            onClick={handleCopyEmail}
            title={copiedEmail ? 'Copied!' : 'Copy Email Address'}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors shrink-0 cursor-pointer mt-0.5"
          >
            {copiedEmail ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Credits Section (Matches Screenshot: ⚡ Credits    20,002/45,000) */}
        <div className="mt-4 select-text">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <Zap className="w-3.5 h-3.5 fill-[#0ea5e9] text-[#0ea5e9]" />
              <span className="text-white font-medium">Credits</span>
            </div>
            <div className="font-mono text-xs">
              <span className="font-bold text-white text-[13px]">{stats.totalUsed.toLocaleString()}</span>
              <span className="text-neutral-400 font-normal">/{stats.totalAllocated.toLocaleString()}</span>
            </div>
          </div>

          {/* Glowing Gradient Progress Bar: Represents Date / Validity Remaining (Empties as time passes) */}
          <div className="h-1 w-full bg-neutral-800/90 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-pink-500 rounded-full transition-all duration-300"
              style={{ width: `${dateRemainingPercent}%` }}
              title={validity.displayText === 'Lifetime' ? 'Lifetime access' : `${validity.displayText} remaining (${dateRemainingPercent.toFixed(0)}%)`}
            />
          </div>

          {/* Days Left in Plan / Lifetime access */}
          <p className="text-[11px] text-neutral-400 mt-1.5 font-normal">
            {validity.displayText === 'Lifetime' 
              ? 'Lifetime access' 
              : validity.isExpired
              ? 'Plan expired'
              : `${validity.profileDays} ${validity.profileDays === 1 ? 'day' : 'days'} left in plan`}
          </p>
        </div>
      </div>

      {/* Subtle Divider */}
      <div className="h-px bg-neutral-800/70 mx-3 my-1" />

      {/* Menu Options List (Matches Screenshot) */}
      <div className="px-2 py-1 space-y-0.5 text-xs">
        <button
          id="menu-settings"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer text-left font-medium"
        >
          <Settings className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>Settings</span>
        </button>

        <button
          id="menu-pricing"
          onClick={() => {
            onClose();
            onOpenPricing();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer text-left font-medium"
        >
          <CreditCard className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>Plan &amp; Pricing</span>
        </button>

        <button
          id="menu-referral"
          onClick={() => {
            onClose();
            onOpenReferral();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer text-left font-medium"
        >
          <Share2 className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>Refer &amp; Earn</span>
        </button>

        <button
          id="menu-history"
          onClick={() => {
            onClose();
            onOpenHistory();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer text-left font-medium"
        >
          <History className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>Generation History</span>
        </button>

        <button
          id="menu-devices"
          onClick={() => {
            onClose();
            onOpenDevices();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer text-left font-medium"
        >
          <Shield className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>My Devices</span>
        </button>

        <button
          id="menu-extension"
          onClick={() => {
            if (!extensionUrl) {
              alert("No extension link configured by admin.");
            } else {
              window.open(extensionUrl, '_blank', 'noopener,noreferrer');
              onClose();
            }
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer text-left font-medium"
        >
          <Download className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>Get Extension</span>
        </button>

        {/* Admin Dashboard (if admin) */}
        {isAdmin && onOpenAdminPanel && (
          <button
            id="dropdown-admin-panel-btn"
            onClick={() => {
              onClose();
              onOpenAdminPanel();
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-purple-300 hover:text-white hover:bg-purple-900/25 rounded-xl transition-colors cursor-pointer text-left font-medium"
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Admin Dashboard</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 bg-purple-600 text-white rounded-full uppercase tracking-wider font-bold">
              Admin
            </span>
          </button>
        )}

        {/* Prompt Settings (if admin or prompt editor) */}
        {(isAdmin || Boolean(currentUser?.canEditPrompts)) && onOpenPromptSettings && (
          <button
            id="menu-prompts"
            onClick={() => {
              onClose();
              onOpenPromptSettings();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-blue-300 hover:text-white hover:bg-blue-900/20 rounded-xl transition-colors cursor-pointer text-left font-medium"
          >
            <Terminal className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Prompt Server</span>
          </button>
        )}
      </div>

      {/* Sign Out (Red accent matching screenshot) */}
      <div className="p-2 pt-1 border-t border-neutral-800/70 mt-1">
        <button
          id="menu-signout"
          onClick={() => {
            onClose();
            logout();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-rose-500 hover:text-rose-400 hover:bg-rose-950/25 rounded-xl transition-colors cursor-pointer text-left text-xs sm:text-[13px] font-medium"
        >
          <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </motion.div>
  );
};
