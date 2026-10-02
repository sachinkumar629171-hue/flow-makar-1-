import React, { useState } from 'react';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Send, 
  Lock, 
  Save, 
  Check, 
  Pencil, 
  Copy,
  Sparkles,
  Shield,
  Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SupabaseSettingsModal } from './modals/SupabaseSettingsModal';
import { getSupabaseConfig } from '../lib/supabase';
import { getUserCreditStats, getUserValidityTime } from '../lib/userStats';

interface SettingsPageProps {
  onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const { currentUser, updateProfile, isAdmin } = useAuth();
  const [whatsapp, setWhatsapp] = useState(currentUser?.whatsapp || '');
  const [telegram, setTelegram] = useState(currentUser?.telegram || '');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(() => getSupabaseConfig().isConnected);

  if (!currentUser) return null;

  const handleCopyEmail = () => {
    if (currentUser.email) {
      navigator.clipboard.writeText(currentUser.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updateData: any = { whatsapp, telegram };
    if (password) {
      updateData.password = password;
    }
    updateProfile(updateData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="min-h-screen w-full bg-[#08090b] text-neutral-200 flex flex-col font-sans select-none">
      {/* Top Bar with Back Button */}
      <header className="w-full border-b border-neutral-900/80 bg-[#08090b]/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer group py-1"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
          <span>flowcreatorai.site/settings</span>
        </div>
      </header>

      {/* Main Settings Container */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-[#0e0f14] border border-neutral-800/80 rounded-2xl shadow-2xl overflow-hidden">
          {/* Card Header matching Screenshot 2 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-[#121319]/40">
            <h2 className="text-xs font-bold tracking-wider text-neutral-400 uppercase font-mono">
              Account Info
            </h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-neutral-800/60 cursor-pointer"
              title="Edit Profile"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            {/* Full Name */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1.5">
                <User className="w-3.5 h-3.5 text-neutral-400" />
                <span>Name</span>
              </div>
              <input
                type="text"
                readOnly
                value={currentUser.name}
                className="w-full px-4 py-2.5 bg-[#08090b] border border-neutral-800 rounded-xl text-white text-sm font-medium focus:outline-none focus:border-neutral-700 cursor-default select-text"
              />
            </div>

            {/* Email Address with LOCKED badge */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
                  <Mail className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Email</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono">
                  LOCKED
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  readOnly
                  value={currentUser.email}
                  className="w-full pl-4 pr-20 py-2.5 bg-[#08090b] border border-neutral-800 rounded-xl text-neutral-300 text-sm font-mono focus:outline-none cursor-default select-text"
                />
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="absolute right-2 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedEmail ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-neutral-400" />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* WhatsApp Number */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1.5">
                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                <span>WhatsApp Number</span>
              </div>
              <input
                type="text"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full px-4 py-2.5 bg-[#08090b] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/80 focus:ring-1 focus:ring-purple-500/80 transition-colors"
              />
            </div>

            {/* Telegram Username */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1.5">
                <Send className="w-3.5 h-3.5 text-neutral-400" />
                <span>Telegram Username</span>
              </div>
              <input
                type="text"
                value={telegram}
                onChange={e => setTelegram(e.target.value)}
                placeholder="@username"
                className="w-full px-4 py-2.5 bg-[#08090b] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/80 focus:ring-1 focus:ring-purple-500/80 transition-colors"
              />
            </div>

            {/* Password Update */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-neutral-400" />
                <span>Change Password (leave blank to keep current)</span>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 bg-[#08090b] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/80 focus:ring-1 focus:ring-purple-500/80 transition-colors"
              />
            </div>

            {/* Account Tier & Credit Info Breakdown (Mila • Used • Bacha) */}
            {(() => {
              const stats = getUserCreditStats(currentUser);
              return (
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/90 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <div>
                        <span className="text-neutral-400">Current Tier: </span>
                        <span className="font-bold text-white uppercase tracking-wider">{currentUser.plan || 'basic'} Plan</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {(() => {
                        const validity = getUserValidityTime(currentUser);
                        return (
                          <>
                            <span className="text-neutral-400 text-[11px]">Validity: </span>
                            <span className="font-mono font-bold text-emerald-400">
                              {validity.displayText === 'Lifetime' ? 'Lifetime' : `${validity.profileDays} ${validity.profileDays === 1 ? 'Day' : 'Days'} Left`}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Credit Stats Grid: Total Mila, Kitna Use Hua, Bacha Hua */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-neutral-800/60">
                    <div className="bg-[#12131a] border border-purple-900/40 rounded-lg p-2 flex flex-col">
                      <span className="text-[10px] text-purple-300">Total Mila</span>
                      <span className="font-bold text-purple-300 font-mono text-xs">{stats.totalAllocated.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#12131a] border border-rose-900/40 rounded-lg p-2 flex flex-col">
                      <span className="text-[10px] text-rose-300">Kitna Use Hua</span>
                      <span className="font-bold text-rose-400 font-mono text-xs">{stats.totalUsed.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#12131a] border border-emerald-900/40 rounded-lg p-2 flex flex-col">
                      <span className="text-[10px] text-emerald-300">Bacha Balance</span>
                      <span className="font-bold text-emerald-400 font-mono text-xs">{stats.remaining.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Dual tone progress bar */}
                  <div className="h-1.5 w-full bg-neutral-950 rounded-full overflow-hidden flex border border-neutral-800">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-amber-500"
                      style={{ width: `${stats.percentageUsed}%` }}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${stats.percentageRemaining}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Supabase Cloud Database Integration Section (For Admin & Power Users) */}
            {isAdmin && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#10131a] to-[#0d1017] border border-emerald-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Supabase Live Database</span>
                        {supabaseConnected ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/60 text-emerald-300 font-mono">
                            CONNECTED
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
                            NOT CONFIGURED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        {supabaseConnected 
                          ? 'Syncing all user registrations, logins & reseller data directly to Supabase cloud.'
                          : 'Connect your Supabase Project URL & Anon Key for external hosting database persistence.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSupabaseModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                  >
                    {supabaseConnected ? 'Configure' : 'Connect Supabase'}
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Supabase Settings Modal */}
      <SupabaseSettingsModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
        onConfigSaved={() => {
          setSupabaseConnected(getSupabaseConfig().isConnected);
        }}
      />
    </div>
  );
};
