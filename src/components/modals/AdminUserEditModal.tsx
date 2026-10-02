import React, { useState } from 'react';
import { X, User, Zap, Save, Check, Calendar, Clock, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { User as UserType, PlanType } from '../../types';

interface EditModalProps {
  user: UserType | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    userId: string,
    plan: PlanType,
    credits: number,
    maxCredits: number,
    planDaysLeft: number,
    status?: 'active' | 'suspended',
    canEditPrompts?: boolean
  ) => void;
  onResetSession?: (userId: string) => void;
}

export const AdminUserEditModal: React.FC<EditModalProps> = ({ user, isOpen, onClose, onSave, onResetSession }) => {
  if (!isOpen || !user) return null;

  const [plan, setPlan] = useState<PlanType>(user.plan);
  const [credits, setCredits] = useState<number>(user.credits);
  const [maxCredits, setMaxCredits] = useState<number>(user.maxCredits);
  const [planDaysLeft, setPlanDaysLeft] = useState<number>(user.planDaysLeft ?? 30);
  const [status, setStatus] = useState<'active' | 'suspended'>(user.status || 'active');
  const [canEditPrompts, setCanEditPrompts] = useState<boolean>(Boolean(user.canEditPrompts));
  const [saved, setSaved] = useState(false);
  const [sessionResetDone, setSessionResetDone] = useState(false);

  const handlePlanChange = (newPlan: PlanType) => {
    setPlan(newPlan);
    if (newPlan === 'unlimited') {
      setCredits(99999);
      setMaxCredits(99999);
    } else if (newPlan === 'ultra') {
      setCredits(45000);
      setMaxCredits(45000);
    } else {
      setCredits(100);
      setMaxCredits(100);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
      user.id,
      plan,
      Number(credits),
      Number(maxCredits),
      Number(planDaysLeft),
      status,
      canEditPrompts
    );
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white">
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold font-display text-white">Edit User: {user.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">User Email</label>
            <div className="px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-neutral-200 text-sm select-text cursor-text">
              {user.email}
            </div>
          </div>

          {/* Account Plan Tier Conversion */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Convert Plan Tier</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handlePlanChange('basic')}
                className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer text-center ${
                  plan === 'basic'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                    : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Basic (100)
              </button>
              <button
                type="button"
                onClick={() => handlePlanChange('ultra')}
                className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer text-center ${
                  plan === 'ultra'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300 ring-1 ring-purple-500/50'
                    : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Ultra (45k)
              </button>
              <button
                type="button"
                onClick={() => handlePlanChange('unlimited')}
                className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer text-center ${
                  plan === 'unlimited'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/50'
                    : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Unlimited (99k)
              </button>
            </div>
          </div>

          {/* Plan Validity Days (Allow decreasing below 30 days) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Plan Validity (Days Left)</span>
              </label>
              <span className="text-xs font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/60">
                {planDaysLeft} {planDaysLeft === 1 ? 'day' : 'days'}
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {[30, 15, 7, 3, 1].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPlanDaysLeft(d)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer ${
                    planDaysLeft === d
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                      : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="365"
                value={planDaysLeft}
                onChange={e => setPlanDaysLeft(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 font-mono"
                placeholder="Custom days (e.g. 7, 15, 30)"
              />
              <span className="text-xs text-neutral-400 whitespace-nowrap">Days remaining</span>
            </div>
          </div>

          {/* Credits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Available Credits</label>
              <input
                type="number"
                min="0"
                value={credits}
                onChange={e => setCredits(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Max Credit Limit</label>
              <input
                type="number"
                min="0"
                value={maxCredits}
                onChange={e => setMaxCredits(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          {/* Status Switch */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Account Status</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  status === 'active'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatus('suspended')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  status === 'suspended'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                    : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Suspended
              </button>
            </div>
          </div>

          {/* Prompt Server Editor Access Switch */}
          <div className="pt-1">
            <label className="block text-xs font-medium text-neutral-300 mb-1">Prompt Server Editor Access</label>
            <button
              type="button"
              onClick={() => setCanEditPrompts(!canEditPrompts)}
              className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                canEditPrompts
                  ? 'bg-purple-600/20 border-purple-500 text-purple-200 ring-1 ring-purple-500/50'
                  : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${canEditPrompts ? 'bg-purple-400 animate-pulse' : 'bg-neutral-600'}`} />
                <span>Allow user to fill & edit prompts in Prompt Server</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                canEditPrompts ? 'bg-purple-900 text-purple-200' : 'bg-neutral-800 text-neutral-400'
              }`}>
                {canEditPrompts ? 'ALLOWED' : 'DISABLED'}
              </span>
            </button>
          </div>

          {/* Single-Device Reset Button */}
          {onResetSession && (
            <div className="pt-1">
              <label className="block text-xs font-medium text-neutral-300 mb-1">Single-Device Session</label>
              <button
                type="button"
                onClick={() => {
                  onResetSession(user.id);
                  setSessionResetDone(true);
                  setTimeout(() => setSessionResetDone(false), 2000);
                }}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                  sessionResetDone
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                    : 'bg-[#0b0c0f] hover:bg-amber-950/40 border-neutral-800 hover:border-amber-600/60 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-3.5 h-3.5 ${sessionResetDone ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span>{sessionResetDone ? 'Session Cleared & Device Unlocked!' : 'Reset Device Login (Force Logout Previous Device)'}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  sessionResetDone ? 'bg-emerald-900 text-emerald-200' : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                }`}>
                  {sessionResetDone ? 'DONE' : 'RESET NOW'}
                </span>
              </button>
            </div>
          )}

          <div className="p-3 bg-neutral-900/80 rounded-xl border border-neutral-800 text-xs text-neutral-400">
            <p>
              💡 Switching plan instantly adjusts default credits and notifies the user. You can customize the validity days to any custom duration (e.g. 7 or 15 days).
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  Updated
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

