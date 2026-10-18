import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Users, 
  Zap, 
  Sparkles, 
  Search, 
  Filter, 
  ArrowLeft, 
  Download, 
  UserPlus, 
  Edit, 
  Trash2, 
  Check, 
  ShieldCheck,
  ArrowUpRight, 
  ArrowDownRight,
  RefreshCw,
  Gift,
  Chrome,
  AlertTriangle,
  Youtube,
  Clock,
  Activity,
  Radio,
  Store,
  Database,
  Layout,
  Terminal,
  MessageSquare,
  Mail,
  Key,
  Lock,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { User, PlanType } from '../types';
import { isUserLive, formatUserLastActive, getUserCreditStats, getUserValidityTime, setUserExpiryMs } from '../lib/userStats';
import { AdminUserEditModal } from './modals/AdminUserEditModal';
import { AdminExtensionModal } from './modals/AdminExtensionModal';
import { TutorialSettingsModal } from './modals/TutorialSettingsModal';
import { HeroSettingsModal } from './modals/HeroSettingsModal';
import { CustomTimeModal } from './modals/CustomTimeModal';
import { AdminResellersTab } from './admin/AdminResellersTab';
import { ResellerSettingsModal } from './modals/ResellerSettingsModal';
import { PricingSettingsModal } from './modals/PricingSettingsModal';
import { HeaderEmailSettingsModal } from './modals/HeaderEmailSettingsModal';
import { ExtensionAdminDataTab } from './admin/ExtensionAdminDataTab';
import { ResellerPasswordModal } from './reseller/ResellerPasswordModal';
import { ResellerEmailModal } from './reseller/ResellerEmailModal';
import { SupabaseSettingsModal } from './modals/SupabaseSettingsModal';
import { SignupTelegramModal } from './modals/SignupTelegramModal';
import { ADMIN_EMAIL } from '../data/initialData';
import { apiUrl } from '../config/api';

interface AdminPanelProps {
  onBackToApp: () => void;
  onOpenResellerPortal?: (reseller: any) => void;
  onOpenPromptServer?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToApp, onOpenResellerPortal, onOpenPromptServer }) => {
  const { 
    users, 
    currentUser, 
    resellers, 
    updateUserPlan, 
    updateUserCredits, 
    updateUserDetails, 
    updateUserEmail,
    deleteUser, 
    signup, 
    adminCreateUser,
    loginAsReseller, 
    promptConfig, 
    updatePromptConfig,
    refreshAdminData
  } = useAuth();
  
  const [activeAdminSection, setActiveAdminSection] = useState<'users' | 'resellers' | 'extension-admin'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'live' | 'basic' | 'ultra' | 'requests'>('all');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [selectedUserForEmail, setSelectedUserForEmail] = useState<User | null>(null);
  const [selectedUserForCustomTime, setSelectedUserForCustomTime] = useState<User | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showHeroModal, setShowHeroModal] = useState(false);
  const [showResellerSettingsModal, setShowResellerSettingsModal] = useState(false);
  const [showPricingSettingsModal, setShowPricingSettingsModal] = useState(false);
  const [showEmailOpacityModal, setShowEmailOpacityModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [showSignupTelegramModal, setShowSignupTelegramModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [, setTimeTick] = useState(0);

  // Auto-tick every 1 second for live dynamic countdown decreasing in real time
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all Supabase admin data on mount from single unified root /api/admin/data
  useEffect(() => {
    if (refreshAdminData) {
      refreshAdminData();
    }
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (refreshAdminData) {
        await refreshAdminData();
      }
      showToast('Live database refreshed! Latest members synced from Supabase.');
    } catch {
      showToast('Offline mode: reading local data.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Quick adjust days
  const handleQuickAdjustDays = (user: User, deltaDays: number) => {
    const current = user.planDaysLeft ?? 30;
    const updated = Math.max(0, current + deltaDays);
    const newExpiresAt = new Date(Date.now() + updated * 86400000).toISOString();
    setUserExpiryMs(user.id, updated, new Date(newExpiresAt).getTime());
    updateUserDetails(user.id, { planDaysLeft: updated, planExpiresAt: newExpiresAt });
    showToast(`${user.name}'s validity set to ${updated} days.`);
  };

  // Quick adjust credits
  const handleQuickAdjustCredits = (user: User, deltaCredits: number) => {
    const current = user.credits;
    const updated = Math.max(0, current + deltaCredits);
    updateUserCredits(user.id, updated);
    showToast(`${user.name}'s credits set to ${updated.toLocaleString()}.`);
  };

  // Quick reset device login session so user can log in on a new device
  const handleResetUserSession = (user: User) => {
    updateUserDetails(user.id, {
      isOnline: false,
      sessionToken: '',
    });
    fetch(apiUrl('/api/users/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, email: user.email }),
    }).catch(() => {});
    showToast(`🔓 Device session reset for ${user.email}! User can now log in on new device.`);
  };

  // New user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserWhatsApp, setNewUserWhatsApp] = useState('');
  const [newUserTelegram, setNewUserTelegram] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('password123');
  const [newUserPlan, setNewUserPlan] = useState<PlanType>('basic');
  const [addError, setAddError] = useState<string | null>(null);

  // Live Users Count (Accurate real-time online verification)
  const liveUsersCount = users.filter(u => isUserLive(u, currentUser?.id, currentUser?.email)).length;

  // Upgrade requests count
  const upgradeRequestsCount = users.filter(u => u.upgradeRequested && u.plan === 'basic').length;

  // Filtered users
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.whatsapp && u.whatsapp.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.telegram && u.telegram.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.referralCode && u.referralCode.toLowerCase().includes(searchTerm.toLowerCase()));

    if (planFilter === 'live') {
      return matchesSearch && isUserLive(u, currentUser?.id, currentUser?.email);
    }
    if (planFilter === 'requests') {
      return matchesSearch && u.upgradeRequested && u.plan === 'basic';
    }
    const matchesPlan = planFilter === 'all' || u.plan === planFilter;

    return matchesSearch && matchesPlan;
  });

  // Summary Metrics: Total Received (Mila), Total Used (Use Hua), and Remaining Balance (Bacha)
  const totalUsersCount = users.length;
  const ultraUsersCount = users.filter(u => u.plan === 'ultra').length;
  const basicUsersCount = users.filter(u => u.plan === 'basic').length;
  const totalCreditsAllocated = users.reduce((acc, u) => acc + getUserCreditStats(u).totalAllocated, 0);
  const totalCreditsUsed = users.reduce((acc, u) => acc + getUserCreditStats(u).totalUsed, 0);
  const totalCreditsRemaining = users.reduce((acc, u) => acc + getUserCreditStats(u).remaining, 0);

  // One click quick plan toggle
  const handleQuickPlanToggle = (user: User) => {
    const targetPlan: PlanType = user.plan === 'basic' ? 'ultra' : 'basic';
    updateUserDetails(user.id, {
      plan: targetPlan,
      credits: targetPlan === 'ultra' ? 45000 : 100,
      maxCredits: targetPlan === 'ultra' ? 45000 : 100,
      upgradeRequested: false
    });
    showToast(`User ${user.name} converted to ${targetPlan === 'ultra' ? 'Ultra VIP (45K Credits)' : 'Basic Plan (100 Credits)'}`);
  };

  const handleConfirmDeleteUser = () => {
    if (!userToDelete) return;
    const deletedName = userToDelete.name;
    deleteUser(userToDelete.id);
    setUserToDelete(null);
    showToast(`User "${deletedName}" was deleted successfully.`);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Email', 'Role', 'Plan', 'Credits', 'MaxCredits', 'DaysLeft', 'WhatsApp', 'Telegram', 'ReferralCode', 'CreatedDate'];
    const rows = users.map(u => [
      u.id,
      `"${u.name}"`,
      u.email,
      u.role,
      u.plan,
      u.credits,
      u.maxCredits,
      u.planDaysLeft ?? 30,
      `"${u.whatsapp || ''}"`,
      `"${u.telegram || ''}"`,
      u.referralCode || '',
      u.createdAt
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `flow_users_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add user submit
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    try {
      const plan = newUserPlan;
      const credits = plan === 'ultra' ? 45000 : 100;
      const res = await adminCreateUser({
        name: newUserName,
        email: newUserEmail,
        whatsapp: newUserWhatsApp,
        telegram: newUserTelegram,
        password: newUserPassword,
        plan,
        credits,
        planDaysLeft: 30,
        extensionAccess: true,
      });

      if (res.success) {
        setShowAddUserModal(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserWhatsApp('');
        setNewUserTelegram('');
        setNewUserPlan('basic');
        showToast('Member created and synced to Supabase & Central Database!');
      } else {
        setAddError(res.error || 'Failed to add user');
      }
    } catch {
      setAddError('Connection error while adding user.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0d] text-white flex flex-col">
      {/* Top Navbar - Clean & Sleek */}
      <header className="sticky top-0 z-30 bg-[#101116]/95 backdrop-blur-md border-b border-neutral-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Toggle Settings Sidebar"
          >
            {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <button
            onClick={onBackToApp}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-700/60 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Return to Studio</span>
            <span className="sm:hidden">Studio</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold font-display text-white">Flow Admin Control Center</h1>
              <p className="text-[10.5px] sm:text-[11px] text-neutral-400 hidden sm:block">Manage user registrations, credits, and Plan conversions</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-800/50 text-purple-300 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="max-w-[160px] sm:max-w-none truncate">Admin: {currentUser?.email || ADMIN_EMAIL}</span>
          </div>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-emerald-950 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Body Layout: Left Sidebar + Main Content */}
      <div className="flex-1 flex relative">
        {/* Mobile Backdrop Overlay */}
        {mobileSidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar (Settings & Tools) */}
        <aside
          className={`fixed md:sticky top-0 md:top-[57px] left-0 z-40 md:z-20 h-full md:h-[calc(100vh-57px)] w-60 lg:w-64 bg-[#0d0e14] border-r border-neutral-800/80 p-3.5 flex flex-col justify-between shrink-0 overflow-y-auto transition-transform duration-200 ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="space-y-4">
            {/* Mobile Header / Close Button */}
            <div className="flex items-center justify-between md:hidden pb-2 border-b border-neutral-800">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">Admin Menu</span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action: Add User */}
            <div>
              <button
                onClick={() => {
                  setShowAddUserModal(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-900/30 transition-all cursor-pointer active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add New User</span>
              </button>
            </div>

            {/* Navigation Section */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 py-0.5">
                Overview
              </div>
              <button
                onClick={() => {
                  setActiveAdminSection('users');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeAdminSection === 'users'
                    ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>User Accounts</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-300">
                  {users.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveAdminSection('resellers');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeAdminSection === 'resellers'
                    ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Store className="w-3.5 h-3.5 text-purple-400" />
                  <span>Reseller Portals</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-300">
                  {resellers.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveAdminSection('extension-admin');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeAdminSection === 'extension-admin'
                    ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Chrome className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Extension Admin Data</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  Live
                </span>
              </button>

              {onOpenPromptServer && (
                <button
                  onClick={() => {
                    onOpenPromptServer();
                    setMobileSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-300 hover:text-white hover:bg-purple-950/40 border border-purple-900/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    <span>Prompt Server Page</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60">
                    Console
                  </span>
                </button>
              )}
            </div>

            {/* Settings & Controls Section (Compact font size) */}
            <div className="space-y-1 pt-1 border-t border-neutral-800/60">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 py-0.5">
                Settings & Controls
              </div>

              {/* Signups Toggle */}
              <button
                onClick={() => updatePromptConfig({ signupEnabled: !promptConfig?.signupEnabled })}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900/60 hover:bg-neutral-800/90 border border-neutral-800/80 transition-all cursor-pointer group"
                title={promptConfig?.signupEnabled ? "Signups are ENABLED" : "Signups are DISABLED"}
              >
                <div className="flex items-center gap-2 text-neutral-300">
                  <ShieldCheck className={`w-3.5 h-3.5 ${promptConfig?.signupEnabled ? 'text-emerald-400' : 'text-rose-400'}`} />
                  <span>User Signups</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  promptConfig?.signupEnabled 
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' 
                    : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                }`}>
                  {promptConfig?.signupEnabled ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Sign Up Telegram Icon (Floating Support) */}
              <button
                onClick={() => {
                  setShowSignupTelegramModal(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900/60 hover:bg-neutral-800/90 border border-neutral-800/80 text-neutral-300 hover:text-white transition-all cursor-pointer group"
                title="Configure Sign Up Page Telegram Floating Icon (Toggle ON/OFF & Link URL)"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-sky-400 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  <span>Sign Up Telegram</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  promptConfig?.signupTelegramEnabled !== false 
                    ? 'bg-sky-950 text-sky-300 border border-sky-800/60' 
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700/60'
                }`}>
                  {promptConfig?.signupTelegramEnabled !== false ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Header Email Opacity */}
              <button
                onClick={() => {
                  setShowEmailOpacityModal(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900/60 hover:bg-neutral-800/90 border border-neutral-800/80 text-neutral-300 hover:text-white transition-all cursor-pointer"
                title="Configure Header User Email Opacity & Extension Stealth Mode (0% to 100%)"
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Header Email</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  {promptConfig?.headerEmailOpacity ?? 100}%
                </span>
              </button>

              {/* Extension Settings */}
              <button
                onClick={() => {
                  setShowExtensionModal(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900/60 hover:bg-neutral-800/90 border border-neutral-800/80 text-neutral-300 hover:text-white transition-all cursor-pointer"
                title="Manage Basic & Ultra Extension Files"
              >
                <Chrome className="w-3.5 h-3.5 text-purple-400" />
                <span>Extension Settings</span>
              </button>

              {/* Hero Banner Settings */}
              <button
                onClick={() => {
                  setShowHeroModal(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900/60 hover:bg-neutral-800/90 border border-neutral-800/80 text-neutral-300 hover:text-white transition-all cursor-pointer"
                title="Configure Main Hero Banner (Image/Video)"
              >
                <Layout className="w-3.5 h-3.5 text-blue-400" />
                <span>Hero Banner</span>
              </button>

              {/* Pricing Plans */}
              <button
                onClick={() => {
                  setShowPricingSettingsModal(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900/60 hover:bg-neutral-800/90 border border-neutral-800/80 text-neutral-300 hover:text-white transition-all cursor-pointer"
                title="Configure Pricing Plans (Credits, Videos, Features)"
              >
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>Pricing Plans</span>
              </button>

              {/* Support Link */}
              <button
                onClick={() => {
                  setShowResellerSettingsModal(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900/60 hover:bg-neutral-800/90 border border-neutral-800/80 text-neutral-300 hover:text-white transition-all cursor-pointer"
                title="Configure Contact Reseller Support Link"
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                <span>Support Link</span>
              </button>

              {/* Tutorial Videos */}
              <button
                onClick={() => {
                  setShowTutorialModal(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900/60 hover:bg-neutral-800/90 border border-neutral-800/80 text-neutral-300 hover:text-white transition-all cursor-pointer"
                title="Configure YouTube Tutorial Videos (Desktop & Mobile)"
              >
                <Youtube className="w-3.5 h-3.5 text-red-400" />
                <span>Tutorial Videos</span>
              </button>
            </div>

            {/* Data & Tools Section */}
            <div className="space-y-1 pt-1 border-t border-neutral-800/60">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 py-0.5">
                Data & Sync
              </div>

              {/* Live Sync / Refresh */}
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 transition-all cursor-pointer"
                title="Auto-syncs every 3 seconds from central server. Click to refresh immediately."
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Live Database</span>
                </div>
                <span className="text-[9.5px] font-semibold text-emerald-400 bg-emerald-900/50 px-1.5 py-0.5 rounded">
                  Auto-Sync
                </span>
              </button>

              {/* Supabase Cloud Settings */}
              <button
                onClick={() => {
                  setShowSupabaseModal(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-950/30 hover:bg-purple-950/60 border border-purple-800/40 text-purple-300 transition-all cursor-pointer"
                title="Configure Supabase Cloud Database URL & Anon Key"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-purple-400" />
                  <span>Supabase Cloud</span>
                </div>
                <span className="text-[9.5px] font-semibold text-purple-400 bg-purple-900/50 px-1.5 py-0.5 rounded">
                  Settings
                </span>
              </button>

              {/* Export CSV */}
              <button
                onClick={() => {
                  handleExportCSV();
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900/60 hover:bg-neutral-800/90 border border-neutral-800/80 text-neutral-300 hover:text-white transition-all cursor-pointer"
                title="Download Users List as CSV"
              >
                <Download className="w-3.5 h-3.5 text-neutral-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Sidebar Footer Info */}
          <div className="pt-3 mt-3 border-t border-neutral-800/60 text-[10.5px] text-neutral-400 flex items-center justify-between px-1">
            <span>Flow Admin</span>
            <span className="text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
          {/* Navigation Tabs between Users and Resellers */}
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <button
              onClick={() => setActiveAdminSection('users')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeAdminSection === 'users'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Accounts ({users.length})</span>
            </button>

          <button
            onClick={() => setActiveAdminSection('resellers')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeAdminSection === 'resellers'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Store className="w-4 h-4 text-purple-400" />
            <span>Reseller Portals ({resellers.length})</span>
          </button>

          <button
            onClick={() => setActiveAdminSection('extension-admin')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeAdminSection === 'extension-admin'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Chrome className="w-4 h-4 text-cyan-400" />
            <span>Extension Admin Data</span>
          </button>
        </div>

        {activeAdminSection === 'resellers' ? (
          <AdminResellersTab
            onOpenResellerPortal={reseller => {
              loginAsReseller(reseller);
              if (onOpenResellerPortal) {
                onOpenResellerPortal(reseller);
              }
            }}
          />
        ) : activeAdminSection === 'extension-admin' ? (
          <ExtensionAdminDataTab
            users={users}
            onUpdateUserDetails={updateUserDetails}
            showToast={showToast}
            onOpenPromptServer={onOpenPromptServer}
          />
        ) : (
          <>
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="p-4 sm:p-5 rounded-2xl bg-[#121318] border border-neutral-800/90 shadow-lg">
                <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
                  <span>Total Users</span>
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-white mt-2">
                  {totalUsersCount}
                </div>
                <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1.5">
                  <span className="text-purple-400 font-semibold">{ultraUsersCount} VIP</span>
                  <span>•</span>
                  <span className="text-blue-400">{basicUsersCount} Basic</span>
                </div>
              </div>

              {/* LIVE ONLINE NOW METRIC CARD */}
              <button
                onClick={() => setPlanFilter(planFilter === 'live' ? 'all' : 'live')}
                className={`p-4 sm:p-5 rounded-2xl text-left transition-all cursor-pointer ${
                  planFilter === 'live'
                    ? 'bg-emerald-950/80 border-2 border-emerald-500 shadow-xl shadow-emerald-950/40'
                    : 'bg-[#121318] border border-emerald-900/50 hover:border-emerald-600/80 shadow-lg'
                }`}
              >
                <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span>Live / Online Now</span>
                  </span>
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-emerald-300 mt-2 flex items-baseline gap-2">
                  <span>{liveUsersCount}</span>
                  <span className="text-xs font-normal text-emerald-400 font-sans">Active</span>
                </div>
                <div className="text-[11px] text-emerald-400/80 mt-1">
                  {liveUsersCount > 0 ? 'Click to view active members' : 'No active sessions'}
                </div>
              </button>

              {/* TOTAL CREDITS GIVEN (TOTAL MILA) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#121318] border border-neutral-800/90 shadow-lg">
                <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
                  <span>Total Credits Given</span>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-purple-300 mt-2">
                  {totalCreditsAllocated.toLocaleString()}
                </div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  Total plan allocation (Mila)
                </div>
              </div>

              {/* TOTAL CREDITS USED (KITNA USE HUA) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#121318] border border-rose-900/40 shadow-lg">
                <div className="flex items-center justify-between text-rose-300 text-xs font-medium">
                  <span>Total Credits Used</span>
                  <Zap className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-rose-400 mt-2">
                  {totalCreditsUsed.toLocaleString()}
                </div>
                <div className="text-[11px] text-rose-300/80 mt-1">
                  Total consumed (Use hua)
                </div>
              </div>

              {/* TOTAL CREDITS REMAINING (BACHA) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#121318] border border-emerald-900/40 shadow-lg col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-emerald-300 text-xs font-medium">
                  <span>Remaining Balance</span>
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-emerald-400 mt-2">
                  {totalCreditsRemaining.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-300/80 mt-1">
                  Total available (Bacha)
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#121318] p-4 rounded-2xl border border-neutral-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search user name, email, phone, telegram..."
                  className="w-full pl-9 pr-4 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                <span className="text-xs text-neutral-400 flex items-center gap-1 shrink-0">
                  <Filter className="w-3.5 h-3.5" /> Plan:
                </span>
                <button
                  onClick={() => setPlanFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                    planFilter === 'all'
                      ? 'bg-neutral-700 text-white font-semibold'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  All ({users.length})
                </button>

                {/* Live Online Filter Pill */}
                <button
                  onClick={() => setPlanFilter('live')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    planFilter === 'live'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-bold'
                      : 'bg-emerald-950/50 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-800/60'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <span>Live / Online ({liveUsersCount})</span>
                </button>

                <button
                  onClick={() => setPlanFilter('ultra')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                    planFilter === 'ultra'
                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  Ultra ({ultraUsersCount})
                </button>
                <button
                  onClick={() => setPlanFilter('basic')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                    planFilter === 'basic'
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  Basic ({basicUsersCount})
                </button>
                {upgradeRequestsCount > 0 && (
                  <button
                    onClick={() => setPlanFilter('requests')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      planFilter === 'requests'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-amber-950/60 text-amber-300 hover:bg-amber-900 border border-amber-800/60'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Pending Requests ({upgradeRequestsCount})</span>
                  </button>
                )}
              </div>
            </div>

        {/* Users Table */}
        <div className="bg-[#121318] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-[#0b0c0f]/80 text-neutral-400 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">User & Live Status</th>
                  <th className="py-3.5 px-4">Plan Status</th>
                  <th className="py-3.5 px-4">Validity (Days)</th>
                  <th className="py-3.5 px-4">Credits</th>
                  <th className="py-3.5 px-4 text-right">Admin Plan Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-neutral-400">
                      No users match the search filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    const isUserAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() || user.role === 'admin';
                    const isUltra = user.plan === 'ultra';
                    const daysLeft = user.planDaysLeft ?? 30;
                    const isOnlineLive = isUserLive(user, currentUser?.id, currentUser?.email);

                    return (
                      <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* User identity & Real-Time Online Status */}
                        <td className="py-4 px-4 sm:px-6 select-text">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm bg-gradient-to-tr ${user.avatarColor || 'from-purple-600 to-indigo-600'}`}>
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              {/* Live indicator dot directly on avatar */}
                              {isOnlineLive && (
                                <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-[#121318]"></span>
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 select-text">
                              <div className="font-bold text-white flex items-center gap-1.5 flex-wrap select-text">
                                <span className="truncate select-text cursor-text">{user.name}</span>
                                {isOnlineLive ? (
                                  <span className="text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/70 font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-950/60 select-text cursor-text">
                                    <span className="relative flex h-2 w-2 shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3] shrink-0" />
                                    <span className="tracking-wide">LIVE</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800 select-text cursor-text">
                                    {formatUserLastActive(user, currentUser?.id, currentUser?.email)}
                                  </span>
                                )}
                                {isUserAdmin && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 select-text cursor-text font-semibold">
                                    ADMIN
                                  </span>
                                )}
                                {user.resellerName && (
                                  <span 
                                    title={`Reseller: ${user.resellerName}`}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 flex items-center justify-center select-text cursor-pointer hover:bg-amber-900/90 transition-colors shadow-xs"
                                  >
                                    <Store className="w-3 h-3 text-amber-400" />
                                  </span>
                                )}
                                {user.canEditPrompts && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800 flex items-center gap-1 select-text cursor-text" title="User has access to Prompt Server">
                                    <Terminal className="w-2.5 h-2.5 text-purple-400" />
                                    <span>Prompt Editor</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-neutral-300 text-xs truncate mt-0.5 select-text cursor-text">
                                <span className="select-text cursor-text">{user.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Plan Status */}
                        <td className="py-4 px-4 select-text">
                          <div className="flex flex-col gap-1 items-start select-text">
                            <div className="inline-flex items-center gap-1.5">
                              {isUltra ? (
                                <span className="px-2.5 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-700/60 font-semibold flex items-center gap-1 select-text cursor-text">
                                  <Sparkles className="w-3 h-3 text-purple-400" />
                                  Ultra VIP
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-blue-950/80 text-blue-300 border border-blue-700/60 font-semibold flex items-center gap-1 select-text cursor-text">
                                  <Zap className="w-3 h-3 text-blue-400" />
                                  Basic Plan
                                </span>
                              )}
                            </div>
                            {user.upgradeRequested && !isUltra && (
                              <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 text-[10px] font-semibold animate-pulse select-text">
                                ⚡ Upgrade Requested
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Plan Days Left / Validity Controls (e.g. 24D 5h or 30D 0h) */}
                        <td className="py-4 px-4 select-text">
                          {(() => {
                            const validity = getUserValidityTime(user);
                            return (
                              <div className="flex items-center gap-1.5 select-text">
                                <button
                                  onClick={() => handleQuickAdjustDays(user, -5)}
                                  title="Decrease validity by 5 days"
                                  className="w-5 h-5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <button
                                  onClick={() => setSelectedUserForCustomTime(user)}
                                  title="Click to set exact custom validity time"
                                  className={`px-2 py-1 rounded-md text-xs font-semibold border transition-transform active:scale-95 cursor-pointer hover:ring-1 hover:ring-purple-500/50 whitespace-nowrap select-text ${
                                    validity.isExpired
                                      ? 'bg-red-950/80 text-red-300 border-red-800/80'
                                      : validity.days <= 5
                                      ? 'bg-red-950/80 text-red-300 border-red-800/80'
                                      : validity.days <= 15
                                      ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                                      : 'bg-neutral-900 text-emerald-300 border-neutral-700'
                                  }`}
                                >
                                  {validity.displayText}
                                </button>
                                <button
                                  onClick={() => handleQuickAdjustDays(user, +5)}
                                  title="Increase validity by 5 days"
                                  className="w-5 h-5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Credits (Used / Total Mila) */}
                        <td className="py-4 px-4 select-text">
                          {(() => {
                            const stats = getUserCreditStats(user);
                            return (
                              <div className="font-semibold text-xs sm:text-sm text-white select-text cursor-text whitespace-nowrap">
                                <span className="text-rose-400 select-text cursor-text">{stats.totalUsed.toLocaleString()}</span>
                                <span className="text-neutral-500 mx-1 select-text">/</span>
                                <span className="text-purple-300 select-text cursor-text">{stats.totalAllocated.toLocaleString()}</span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Actions & Plan Switchers */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Convert Basic to Ultra / Ultra to Basic */}
                            <button
                              onClick={() => handleQuickPlanToggle(user)}
                              title={isUltra ? 'Downgrade to Basic (100 credits)' : 'Upgrade to Ultra Plan (45,000 credits)'}
                              className={`px-2.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                isUltra
                                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700'
                                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-950/40'
                              }`}
                            >
                              {isUltra ? (
                                <>
                                  <ArrowDownRight className="w-3.5 h-3.5 text-neutral-400" />
                                  <span>Basic (100)</span>
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight className="w-3.5 h-3.5 text-purple-200" />
                                  <span>Ultra (45K)</span>
                                </>
                              )}
                            </button>

                            {/* Edit Credits & User Modal Trigger */}
                            <button
                              onClick={() => setSelectedUserForEdit(user)}
                              className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer border border-neutral-700/60 bg-[#161722]"
                              title="Edit User Plan, Days, Credits & Limits"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Change Password Quick Button */}
                            <button
                              onClick={() => setSelectedUserForPassword(user)}
                              className="p-1.5 text-purple-300 hover:text-white hover:bg-purple-950/70 rounded-lg transition-colors cursor-pointer border border-purple-800/60 bg-purple-950/30"
                              title="Change User Password"
                            >
                              <Key className="w-3.5 h-3.5 text-purple-400" />
                            </button>

                            {/* Change Gmail ID Quick Button */}
                            <button
                              onClick={() => setSelectedUserForEmail(user)}
                              className="p-1.5 text-blue-300 hover:text-white hover:bg-blue-950/70 rounded-lg transition-colors cursor-pointer border border-blue-800/60 bg-blue-950/30"
                              title="Change User Gmail ID"
                            >
                              <Mail className="w-3.5 h-3.5 text-blue-400" />
                            </button>

                            {/* Reset Device / Session Quick Button */}
                            <button
                              onClick={() => handleResetUserSession(user)}
                              className="p-1.5 text-amber-300 hover:text-white hover:bg-amber-950/70 rounded-lg transition-colors cursor-pointer border border-amber-800/60 bg-amber-950/30"
                              title="🔓 Reset Login Session (Allow user to login on new device)"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                            </button>

                            {/* Delete User */}
                            {!isUserAdmin && (
                              <button
                                onClick={() => setUserToDelete(user)}
                                className="p-1.5 text-red-400 hover:text-white hover:bg-red-950/60 rounded-lg transition-colors cursor-pointer border border-red-900/50 bg-red-950/20"
                                title="Delete User Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </main>
      </div>

      {/* Edit User Modal */}
      <AdminUserEditModal
        user={selectedUserForEdit}
        isOpen={!!selectedUserForEdit}
        onClose={() => setSelectedUserForEdit(null)}
        onResetSession={(userId) => {
          const target = users.find(u => u.id === userId);
          if (target) {
            handleResetUserSession(target);
          }
        }}
        onSave={(userId, newPlan, newCredits, newMax, newDaysLeft, newStatus, newCanEditPrompts) => {
          updateUserDetails(userId, {
            plan: newPlan,
            credits: newCredits,
            maxCredits: newMax,
            planDaysLeft: newDaysLeft,
            status: newStatus,
            canEditPrompts: newCanEditPrompts
          });
          showToast(`Updated user plan, permissions, days, and credits successfully.`);
        }}
      />

      {/* Custom Time / Days Modal */}
      <CustomTimeModal
        user={selectedUserForCustomTime}
        isOpen={!!selectedUserForCustomTime}
        onClose={() => setSelectedUserForCustomTime(null)}
        titlePrefix="Adjust Plan Validity (Admin)"
        onSave={(userId, newDaysLeft) => {
          const finalDays = Math.max(0, newDaysLeft);
          const newExpiresAt = new Date(Date.now() + finalDays * 86400000).toISOString();
          setUserExpiryMs(userId, finalDays, new Date(newExpiresAt).getTime());
          updateUserDetails(userId, { planDaysLeft: finalDays, planExpiresAt: newExpiresAt });
          showToast(`User validity successfully updated to ${finalDays} days.`);
        }}
      />

      {/* Change Password Modal for Admin */}
      <ResellerPasswordModal
        isOpen={!!selectedUserForPassword}
        onClose={() => setSelectedUserForPassword(null)}
        user={selectedUserForPassword}
        onUpdatePassword={(userId, newPass) => {
          updateUserDetails(userId, { password: newPass });
          showToast(`Password successfully updated for user ${selectedUserForPassword?.name}!`);
        }}
      />

      {/* Change Gmail ID Modal for Admin */}
      <ResellerEmailModal
        isOpen={!!selectedUserForEmail}
        onClose={() => setSelectedUserForEmail(null)}
        user={selectedUserForEmail}
        onUpdateEmail={async (userId, newEmail) => {
          const res = await updateUserEmail(userId, newEmail);
          if (res.success) {
            showToast(`User Gmail ID successfully changed to ${newEmail}!`);
          }
          return res;
        }}
      />

      {/* Extension Settings Modal */}
      <AdminExtensionModal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
      />

      {/* Tutorial Video Settings Modal */}
      <TutorialSettingsModal
        isOpen={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
      />

      {/* Hero Settings Modal */}
      <HeroSettingsModal
        isOpen={showHeroModal}
        onClose={() => setShowHeroModal(false)}
      />

      <ResellerSettingsModal
        isOpen={showResellerSettingsModal}
        onClose={() => setShowResellerSettingsModal(false)}
      />

      <PricingSettingsModal
        isOpen={showPricingSettingsModal}
        onClose={() => setShowPricingSettingsModal(false)}
      />

      <HeaderEmailSettingsModal
        isOpen={showEmailOpacityModal}
        onClose={() => setShowEmailOpacityModal(false)}
        onSavedToast={showToast}
      />

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl p-6 text-white space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold font-display text-white">Delete User Account?</h3>
              <p className="text-xs text-neutral-400 select-text">
                Are you sure you want to permanently delete user{' '}
                <span className="font-semibold text-white select-text cursor-text">{userToDelete.name}</span> (
                <span className="text-neutral-300 text-[11px] select-text cursor-text">{userToDelete.email}</span>)?
              </p>
              <p className="text-[11px] text-red-400/90 pt-1">
                This action cannot be undone. All credits and account history will be removed.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-lg shadow-red-950/40"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white">
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
              <h2 className="text-lg font-bold font-display text-white">Add New User</h2>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="p-6 space-y-3.5">
              {addError && (
                <div className="p-2.5 bg-red-950/80 border border-red-800 text-red-300 text-xs rounded-xl">
                  {addError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3.5 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="user@flowcreator.com"
                  className="w-full px-3.5 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    value={newUserWhatsApp}
                    onChange={e => setNewUserWhatsApp(e.target.value)}
                    placeholder="+123..."
                    className="w-full px-3 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Telegram</label>
                  <input
                    type="text"
                    value={newUserTelegram}
                    onChange={e => setNewUserTelegram(e.target.value)}
                    placeholder="@user"
                    className="w-full px-3 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Temporary Password</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3.5 py-2 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Initial Plan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewUserPlan('basic')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      newUserPlan === 'basic'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold'
                        : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400'
                    }`}
                  >
                    Basic (100 credits)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewUserPlan('ultra')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      newUserPlan === 'ultra'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 font-semibold'
                        : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400'
                    }`}
                  >
                    Ultra (45,000 credits)
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supabase Cloud Connection Modal */}
      <SupabaseSettingsModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
      />

      {/* Sign Up Telegram Floating Icon Settings Modal */}
      <SignupTelegramModal
        isOpen={showSignupTelegramModal}
        onClose={() => setShowSignupTelegramModal(false)}
        onSaved={showToast}
      />
    </div>
  );
};
