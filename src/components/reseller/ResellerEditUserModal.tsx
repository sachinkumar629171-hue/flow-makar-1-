import React, { useState, useEffect } from 'react';
import { X, User, Sparkles, Shield, Coins, Check } from 'lucide-react';
import { User as UserType, PlanType } from '../../types';

interface ResellerEditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onSave: (userId: string, data: { name?: string; plan?: PlanType; credits?: number; maxCredits?: number }) => void;
}

export const ResellerEditUserModal: React.FC<ResellerEditUserModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
}) => {
  if (!isOpen || !user) return null;

  const [name, setName] = useState(user.name);
  const [plan, setPlan] = useState<PlanType>(user.plan);
  const [maxCredits, setMaxCredits] = useState(user.maxCredits || (user.plan === 'ultra' ? 45000 : 100));
  const initialUsed = Math.max(0, (user.maxCredits || (user.plan === 'ultra' ? 45000 : 100)) - user.credits);
  const [creditsUsed, setCreditsUsed] = useState(initialUsed);

  useEffect(() => {
    setName(user.name);
    setPlan(user.plan);
    const max = user.maxCredits || (user.plan === 'ultra' ? 45000 : 100);
    setMaxCredits(max);
    setCreditsUsed(Math.max(0, max - user.credits));
  }, [user]);

  const handlePlanChange = (newPlan: PlanType) => {
    setPlan(newPlan);
    const newMax = newPlan === 'ultra' ? 45000 : 100;
    setMaxCredits(newMax);
    if (creditsUsed > newMax) {
      setCreditsUsed(0);
    }
  };

  const handleUsedChange = (val: number) => {
    const clamped = Math.max(0, Math.min(maxCredits, val));
    setCreditsUsed(clamped);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const remainingCredits = Math.max(0, maxCredits - creditsUsed);
    onSave(user.id, {
      name: name.trim(),
      plan,
      credits: remainingCredits,
      maxCredits,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12131a] border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-[#161722]">
          <div>
            <h2 className="text-base font-semibold text-white">Edit Member Details</h2>
            <p className="text-xs text-neutral-400">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                placeholder="Enter member full name..."
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Plan Change */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Membership Plan</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handlePlanChange('ultra')}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  plan === 'ultra'
                    ? 'bg-purple-600/15 border-purple-500 text-purple-300 shadow-sm'
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
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300 shadow-sm'
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

          {/* Credits Used & Total Credits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-neutral-300">Credits Used</label>
                <span className="text-[10px] text-neutral-500 font-mono">Used</span>
              </div>
              <div className="relative">
                <Coins className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  max={maxCredits}
                  value={creditsUsed}
                  onChange={e => handleUsedChange(Number(e.target.value))}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-neutral-300">Remaining Credits</label>
                <span className="text-[10px] text-emerald-400 font-mono">Available</span>
              </div>
              <div className="px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800/80 rounded-xl text-emerald-400 font-mono text-sm">
                {Math.max(0, maxCredits - creditsUsed).toLocaleString()} / {maxCredits.toLocaleString()}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-neutral-500">
            Reseller can update the member's full name, membership plan, and credits used.
          </p>

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
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
