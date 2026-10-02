import React, { useState } from 'react';
import { X, User, Mail, Lock, Shield, Sparkles, Clock, Check, AlertCircle } from 'lucide-react';
import { PlanType, Reseller } from '../../types';

interface ResellerNewUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  reseller: Reseller;
  onAddUser: (data: {
    name: string;
    email: string;
    password?: string;
    plan: PlanType;
    credits: number;
    daysLeft: number;
  }) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  currentCount: number;
}

export const ResellerNewUserModal: React.FC<ResellerNewUserModalProps> = ({
  isOpen,
  onClose,
  reseller,
  onAddUser,
  currentCount,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(`flow${Math.floor(100000 + Math.random() * 900000)}`);
  const [plan, setPlan] = useState<PlanType>('ultra');
  const [credits, setCredits] = useState(45000);
  const [daysLeft, setDaysLeft] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isLimitReached = currentCount >= reseller.userLimit;

  const handlePlanChange = (newPlan: PlanType) => {
    setPlan(newPlan);
    setCredits(newPlan === 'ultra' ? 45000 : 100);
  };

  const handleGeneratePassword = () => {
    setPassword(`flow${Math.floor(100000 + Math.random() * 900000)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const targetDays = Math.min(30, Math.max(1, daysLeft || 30));
    try {
      const res = await onAddUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        plan,
        credits,
        daysLeft: targetDays,
      });

      if (!res.success) {
        setError(res.error || 'Failed to create user');
      } else {
        onClose();
      }
    } catch {
      setError('Failed to create user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12131a] border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-[#161722]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Add New Member</h2>
              <p className="text-xs text-neutral-400">
                Reseller Slot: <span className="text-purple-400 font-medium">{currentCount} / {reseller.userLimit}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLimitReached && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>You have reached your allocated maximum limit ({reseller.userLimit} users).</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Gaurav Kataria BY"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Customer Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="customer@gmail.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-neutral-300">Login Password</label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] text-purple-400 hover:text-purple-300 cursor-pointer"
              >
                Generate Random
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Plan Choice */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Membership Plan</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handlePlanChange('ultra')}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  plan === 'ultra'
                    ? 'bg-purple-600/15 border-purple-500 text-white'
                    : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold">Ultra VIP (45,000)</span>
                </div>
                {plan === 'ultra' && <Check className="w-3.5 h-3.5 text-purple-400" />}
              </button>

              <button
                type="button"
                onClick={() => handlePlanChange('basic')}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  plan === 'basic'
                    ? 'bg-blue-600/15 border-blue-500 text-white'
                    : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold">Basic Plan (100)</span>
                </div>
                {plan === 'basic' && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </button>
            </div>
          </div>

          {/* Credits & Validity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">Credits Allocated</label>
              <input
                type="number"
                min="1"
                value={credits}
                onChange={e => setCredits(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-neutral-300">Validity (Days)</label>
                <span className="text-[10px] text-purple-400 font-mono">Max 30 Days</span>
              </div>
              <div className="relative">
                <Clock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={daysLeft}
                  onChange={e => setDaysLeft(Math.min(30, Math.max(1, Number(e.target.value))))}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLimitReached}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
            >
              Create Member Access
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
