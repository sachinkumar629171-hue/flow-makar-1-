import React, { useState } from 'react';
import { 
  Store, 
  LogOut, 
  Users, 
  UserX, 
  Zap, 
  Calendar, 
  RotateCw, 
  Plus, 
  Edit3, 
  Key, 
  RefreshCw, 
  CalendarPlus, 
  Repeat, 
  Mail, 
  Lock,
  Trash2, 
  Check, 
  AlertTriangle,
  Search,
  ArrowLeft,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { User, PlanType } from '../../types';
import { isUserLive, formatUserLastActive, getUserCreditStats, getUserValidityTime } from '../../lib/userStats';
import { calculateResellerExpiry } from '../../lib/resellerUtils';
import { ResellerNewUserModal } from './ResellerNewUserModal';
import { ResellerEditUserModal } from './ResellerEditUserModal';
import { ResellerPasswordModal } from './ResellerPasswordModal';
import { ResellerEmailModal } from './ResellerEmailModal';
import { CustomTimeModal } from '../modals/CustomTimeModal';
import { ResellerApiDocsModal } from './ResellerApiDocsModal';

interface ResellerPortalProps {
  onBackToApp?: () => void;
}

export const ResellerPortal: React.FC<ResellerPortalProps> = ({ onBackToApp }) => {
  const { 
    currentUser,
    currentReseller, 
    logoutReseller, 
    resellerLogin,
    users, 
    addUserByReseller, 
    updateUserDetails, 
    updateUserEmail,
    deleteUser, 
    isAdmin
  } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [selectedUserForEmail, setSelectedUserForEmail] = useState<User | null>(null);
  const [selectedUserForCustomTime, setSelectedUserForCustomTime] = useState<User | null>(null);
  const [showApiDocs, setShowApiDocs] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [, setTimeTick] = useState(0);

  // Auto-tick every 10 seconds for live dynamic countdown and online updates
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(t => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-poll every 3 seconds while on Reseller Portal to catch API key requests immediately
  React.useEffect(() => {
    if (!currentReseller) return;
    const interval = setInterval(() => {
      fetch('/api/users')
        .then(res => res.json())
        .then(data => {
          if (data?.users && Array.isArray(data.users)) {
            // Context will automatically merge or state will update
            setTimeTick(t => t + 1);
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [currentReseller]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        showToast('Reseller data refreshed successfully!');
      }
    } catch {}
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Direct login state when accessing /reseller via URL
  const [resellerEmail, setResellerEmail] = useState('');
  const [resellerPassword, setResellerPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await resellerLogin(resellerEmail, resellerPassword);
      if (!res.success) {
        setLoginError(res.error || 'Invalid reseller credentials');
      }
    } catch {
      setLoginError('Failed to connect to reseller authentication service.');
    } finally {
      setLoginLoading(false);
    }
  };

  if (!currentReseller) {
    return (
      <div className="min-h-screen bg-[#08090b] text-white flex items-center justify-center p-4 select-text">
        <div className="bg-[#12131a] border border-neutral-800 rounded-3xl p-7 max-w-md w-full shadow-2xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-1">
              <Store className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">Reseller Portal</h2>
            <p className="text-xs text-neutral-400">
              Sign in with your authorized reseller credentials to manage member slots and accounts.
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/70 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleDirectLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Reseller Portal Email / ID
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="email"
                  required
                  value={resellerEmail}
                  onChange={e => setResellerEmail(e.target.value)}
                  placeholder="reseller@flow.ai"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0a0b0e] border border-neutral-800 rounded-xl text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Access Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="password"
                  required
                  value={resellerPassword}
                  onChange={e => setResellerPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0a0b0e] border border-neutral-800 rounded-xl text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
            >
              {loginLoading ? 'Signing in...' : 'Sign In to Portal'}
            </button>
          </form>

          {onBackToApp && (
            <div className="text-center pt-2">
              <button
                onClick={onBackToApp}
                className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                ← Back to Flow Studio
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const expiryInfo = calculateResellerExpiry(currentReseller);
  const isPortalExpired = expiryInfo.isExpired || currentReseller.status === 'suspended' || currentReseller.status === 'expired';

  // Reseller's assigned users (Multi-tier flexible matching so no API user is missed)
  const cleanCurrentId = (currentReseller.id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const currentPortalName = (currentReseller.portalName || '').trim().toLowerCase();
  const currentEmail = (currentReseller.email || '').trim().toLowerCase();

  const resellerUsers = users.filter(u => {
    if (!u) return false;
    if (u.resellerId && u.resellerId === currentReseller.id) return true;
    const cleanUserResId = (u.resellerId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (cleanCurrentId && cleanUserResId && cleanCurrentId === cleanUserResId) return true;
    if (u.resellerName && currentPortalName && u.resellerName.trim().toLowerCase() === currentPortalName) return true;
    if ((u as any).resellerEmail && currentEmail && (u as any).resellerEmail.trim().toLowerCase() === currentEmail) return true;
    return false;
  });
  const filteredUsers = resellerUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Metrics (Accurate Real-Time Online & Credit Calculations)
  const totalCreated = resellerUsers.length;
  const activeCount = resellerUsers.filter(u => (u.planDaysLeft ?? 30) > 0 && u.status === 'active').length;
  const expiredCount = resellerUsers.filter(u => (u.planDaysLeft ?? 30) <= 0 || u.status === 'suspended').length;
  const liveCount = resellerUsers.filter(u => isUserLive(u, currentUser?.id, currentUser?.email)).length;
  const totalCreditsGiven = resellerUsers.reduce((sum, u) => sum + getUserCreditStats(u).totalAllocated, 0);
  const totalCreditsUsed = resellerUsers.reduce((sum, u) => sum + getUserCreditStats(u).totalUsed, 0);
  const totalCreditsRemaining = resellerUsers.reduce((sum, u) => sum + getUserCreditStats(u).remaining, 0);

  const handleDeleteConfirm = () => {
    if (!userToDelete) return;
    deleteUser(userToDelete.id);
    showToast(`Deleted member ${userToDelete.name} and their access data.`);
    setUserToDelete(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-neutral-100 flex flex-col font-sans select-text">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header matching Layout with inner container */}
      <header className="border-b border-neutral-800/80 bg-[#0e0f14]/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">{currentReseller.portalName}</h1>
                {isAdmin && (
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] rounded-full font-mono font-semibold">
                    Admin View
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 font-mono">{currentReseller.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowApiDocs(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800/80 hover:to-indigo-800/80 border border-purple-500/40 text-purple-200 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
              title="Automated API and Webhooks to grant/revoke access from external website"
            >
              <Key className="w-3.5 h-3.5 text-purple-400" />
              <span>API & Webhooks</span>
            </button>

            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to App</span>
              </button>
            )}

            <button
              onClick={logoutReseller}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Expired Warning Banner */}
        {isPortalExpired && (
          <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-center gap-3 text-red-300 text-sm">
            <AlertTriangle className="w-6 h-6 shrink-0 text-red-400" />
            <div className="flex-1">
              <span className="font-semibold text-white">Reseller Portal Expired!</span> Your 30-day allocation has expired. Member creation and updates are currently locked. Please contact the primary administrator to renew your reseller store.
            </div>
          </div>
        )}

        {/* 6 Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* USERS */}
          <div className="bg-[#12131a] border border-neutral-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] font-semibold tracking-wider uppercase">
              <Users className="w-3.5 h-3.5 text-neutral-500" />
              <span>Users</span>
            </div>
            <div className="mt-2 text-xl font-bold text-white tracking-tight">
              {totalCreated} <span className="text-sm font-normal text-neutral-500">/ {currentReseller.userLimit}</span>
            </div>
          </div>

          {/* ACTIVE USERS */}
          <div className="bg-[#12131a] border border-neutral-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] font-semibold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Active Users</span>
            </div>
            <div className="mt-2 text-xl font-bold text-emerald-400 tracking-tight">
              {activeCount}
            </div>
          </div>

          {/* LIVE NOW (REAL-TIME ONLINE) */}
          <div className="bg-[#12131a] border border-emerald-900/50 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-emerald-400 text-[11px] font-semibold tracking-wider uppercase">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Now</span>
              </span>
            </div>
            <div className="mt-2 text-xl font-bold text-emerald-300 tracking-tight flex items-baseline gap-1.5">
              <span>{liveCount}</span>
              <span className="text-[11px] font-normal text-emerald-400/80">Online</span>
            </div>
          </div>

          {/* TOTAL GIVEN (MILAA) */}
          <div className="bg-[#12131a] border border-purple-900/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center gap-1.5 text-purple-300 text-[11px] font-semibold tracking-wider uppercase">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Total Mila</span>
            </div>
            <div className="mt-2 text-xl font-bold text-purple-300 tracking-tight">
              {totalCreditsGiven.toLocaleString()}
            </div>
          </div>

          {/* CREDITS USED (KITNA USE HUA) */}
          <div className="bg-[#12131a] border border-rose-900/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center gap-1.5 text-rose-300 text-[11px] font-semibold tracking-wider uppercase">
              <Zap className="w-3.5 h-3.5 text-rose-400" />
              <span>Total Used</span>
            </div>
            <div className="mt-2 text-xl font-bold text-rose-400 tracking-tight">
              {totalCreditsUsed.toLocaleString()}
            </div>
          </div>

          {/* EXPIRES (DAYS) */}
          <div className="bg-[#12131a] border border-neutral-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] font-semibold tracking-wider uppercase">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
              <span>Validity ({expiryInfo.timeRemainingText})</span>
            </div>
            <div className={`mt-2 text-sm font-bold tracking-tight ${isPortalExpired ? 'text-red-400' : 'text-emerald-400 font-mono'}`}>
              {isPortalExpired ? 'Portal Expired' : `Expires: ${expiryInfo.expiryDate}`}
            </div>
          </div>
        </div>

        {/* Action Controls Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight">My Users</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[#12131a] border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-500 w-48 select-text"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh Users List"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#161824] hover:bg-[#1e2030] border border-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-medium transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : 'text-neutral-400'}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowNewUserModal(true)}
              disabled={isPortalExpired || totalCreated >= currentReseller.userLimit}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New User</span>
            </button>
          </div>
        </div>

        {/* Users Table matching Screenshot */}
        <div className="bg-[#12131a] border border-neutral-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse select-text">
              <thead>
                <tr className="border-b border-neutral-800/80 bg-[#151620] text-neutral-400 uppercase text-[11px] font-semibold tracking-wider">
                  <th className="py-3.5 px-5">Member & Live Status</th>
                  <th className="py-3.5 px-4">Plan</th>
                  <th className="py-3.5 px-4">Validity</th>
                  <th className="py-3.5 px-4">Credits</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-neutral-500">
                      No members found under this reseller portal.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    const daysLeft = user.planDaysLeft ?? 30;
                    const isUserExpired = daysLeft <= 0;
                    const isSelected = selectedUserId === user.id;
                    const isOnlineLive = isUserLive(user, currentUser?.id, currentUser?.email);

                    return (
                      <tr 
                        key={user.id}
                        onClick={() => setSelectedUserId(user.id)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#1a1c2b] ring-1 ring-purple-500/40'
                            : 'hover:bg-[#161824]/60'
                        }`}
                      >
                        {/* Name, Email & Real-Time Online Status */}
                        <td className="py-3.5 px-5 select-text">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs bg-gradient-to-tr ${user.avatarColor || 'from-purple-600 to-indigo-600'}`}>
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              {/* Live indicator dot directly on avatar */}
                              {isOnlineLive && (
                                <span className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 border-2 border-[#12131a]"></span>
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 select-text">
                              <div className="font-semibold text-white text-xs tracking-tight flex items-center gap-1.5 flex-wrap select-text">
                                <span className="truncate select-text cursor-text">{user.name}</span>
                                {isOnlineLive ? (
                                  <span className="text-[10px] sm:text-[10.5px] px-2.5 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/70 font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-950/60 select-text cursor-text">
                                    <span className="relative flex h-2 w-2 shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3] shrink-0" />
                                    <span className="tracking-wide">LIVE</span>
                                  </span>
                                ) : (
                                  <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800 select-text cursor-text">
                                    {formatUserLastActive(user, currentUser?.id, currentUser?.email)}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-300 mt-0.5 truncate select-text cursor-text">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="py-3.5 px-4 select-text">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              user.plan === 'ultra'
                                ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                                : 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                            }`}
                          >
                            {user.plan === 'ultra' ? 'Ultra' : 'Basic'}
                          </span>
                        </td>

                        {/* Validity (e.g. 24D 5h or 30D 0h) */}
                        <td className="py-3.5 px-4 select-text">
                          {(() => {
                            const validity = getUserValidityTime(user);
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUserForCustomTime(user);
                                }}
                                title="Click to adjust custom validity (Max 30 days)"
                                className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                                  validity.isExpired 
                                    ? 'text-red-400 bg-red-950/40 border-red-800/40' 
                                    : 'text-emerald-400 font-semibold bg-emerald-950/40 border-emerald-800/40 hover:bg-emerald-950/70'
                                }`}
                              >
                                {validity.displayText} ⏱
                              </button>
                            );
                          })()}
                        </td>

                        {/* Credits (Used / Total Mila) */}
                        <td className="py-3.5 px-4 select-text">
                          {(() => {
                            const stats = getUserCreditStats(user);
                            return (
                              <div className="font-mono font-semibold text-xs sm:text-sm text-white select-text whitespace-nowrap">
                                <span className="text-rose-400">{stats.totalUsed.toLocaleString()}</span>
                                <span className="text-neutral-500 mx-1">/</span>
                                <span className="text-purple-300">{stats.totalAllocated.toLocaleString()}</span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Action Buttons Row */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* 1) Edit: name, credit used, plan change only */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUserForEdit(user);
                              }}
                              disabled={isPortalExpired}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1a1b26] hover:bg-[#232535] border border-neutral-700/60 rounded-lg text-[11px] text-neutral-300 hover:text-white transition-colors cursor-pointer"
                              title="Edit member name, plan, and credit used"
                            >
                              <Edit3 className="w-3 h-3 text-neutral-400" />
                              <span>Edit</span>
                            </button>

                            {/* 2) Custom Timing: decrease / increase up to 30 days */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUserForCustomTime(user);
                              }}
                              disabled={isPortalExpired}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1a1b26] hover:bg-[#232535] border border-amber-500/30 rounded-lg text-[11px] text-amber-300 hover:text-white transition-colors cursor-pointer"
                              title="Adjust member validity (Max 30 days)"
                            >
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Custom Time</span>
                            </button>

                            {/* 3) Password: create new password only */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUserForPassword(user);
                              }}
                              disabled={isPortalExpired}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1a1b26] hover:bg-[#232535] border border-neutral-700/60 rounded-lg text-[11px] text-neutral-300 hover:text-white transition-colors cursor-pointer"
                              title="Create new password for member"
                            >
                              <Key className="w-3 h-3 text-neutral-400" />
                              <span>Password</span>
                            </button>

                            {/* 4) Email: change member Gmail ID */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUserForEmail(user);
                              }}
                              disabled={isPortalExpired}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1a1b26] hover:bg-[#232535] border border-blue-500/40 rounded-lg text-[11px] text-blue-300 hover:text-white transition-colors cursor-pointer"
                              title="Change member Gmail ID"
                            >
                              <Mail className="w-3 h-3 text-blue-400" />
                              <span>Email</span>
                            </button>

                            {/* 5) Delete: permanently delete member access & data */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setUserToDelete(user);
                              }}
                              disabled={isPortalExpired}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-950/20 hover:bg-red-950/40 border border-red-500/30 rounded-lg text-[11px] text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                              title="Delete member access"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
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
      </main>

      {/* Modals */}
      <ResellerNewUserModal
        isOpen={showNewUserModal}
        onClose={() => setShowNewUserModal(false)}
        reseller={currentReseller}
        onAddUser={data => addUserByReseller(currentReseller.id, data)}
        currentCount={totalCreated}
      />

      <ResellerEditUserModal
        isOpen={!!selectedUserForEdit}
        onClose={() => setSelectedUserForEdit(null)}
        user={selectedUserForEdit}
        onSave={(userId, data) => {
          updateUserDetails(userId, data);
          showToast('Member details updated successfully.');
        }}
      />

      <ResellerPasswordModal
        isOpen={!!selectedUserForPassword}
        onClose={() => setSelectedUserForPassword(null)}
        user={selectedUserForPassword}
        onUpdatePassword={(userId, pass) => {
          updateUserDetails(userId, { password: pass });
          showToast('New password updated successfully.');
        }}
      />

      <ResellerEmailModal
        isOpen={!!selectedUserForEmail}
        onClose={() => setSelectedUserForEmail(null)}
        user={selectedUserForEmail}
        onUpdateEmail={async (userId, newEmail) => {
          const res = await updateUserEmail(userId, newEmail);
          if (res.success) {
            showToast('Gmail ID updated successfully.');
          }
          return res;
        }}
      />

      {/* Reseller Custom Time Modal */}
      <CustomTimeModal
        isOpen={!!selectedUserForCustomTime}
        onClose={() => setSelectedUserForCustomTime(null)}
        user={selectedUserForCustomTime}
        titlePrefix="Adjust Member Validity (Reseller)"
        onSave={(userId, newDaysLeft) => {
          const finalDays = Math.max(0, newDaysLeft);
          updateUserDetails(userId, { planDaysLeft: finalDays });
          showToast(`Member validity updated to ${finalDays} days.`);
        }}
      />

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-text">
          <div className="bg-[#12131a] border border-neutral-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Delete Member Access?</h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{userToDelete.name}</strong> ({userToDelete.email})? This member's access and data will be permanently removed.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Delete Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API & Webhooks Docs Modal */}
      {showApiDocs && currentReseller && (
        <ResellerApiDocsModal
          reseller={currentReseller}
          onClose={() => setShowApiDocs(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
};
