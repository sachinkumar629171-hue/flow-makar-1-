import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, Plus, Minus, Check, Sparkles, PlusCircle, MinusCircle, Sliders, ArrowRight } from 'lucide-react';
import { User } from '../../types';

interface CustomTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (userId: string, newDaysLeft: number) => void;
  titlePrefix?: string;
  maxDays?: number;
}

type ValidityMode = 'add' | 'decrease' | 'set';

export const CustomTimeModal: React.FC<CustomTimeModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  titlePrefix = 'Adjust User Validity / Time',
  maxDays,
}) => {
  if (!isOpen || !user) return null;

  const maxLimit = maxDays ?? 3650;
  const currentDays = Math.max(0, user.planDaysLeft ?? 30);

  const [mode, setMode] = useState<ValidityMode>('add');
  const [addAmount, setAddAmount] = useState<number>(7);
  const [decreaseAmount, setDecreaseAmount] = useState<number>(1);
  const [directDays, setDirectDays] = useState<number>(currentDays);

  // Re-sync when modal opens or user changes
  useEffect(() => {
    if (user) {
      setDirectDays(Math.min(maxLimit, Math.max(0, user.planDaysLeft ?? 30)));
    }
  }, [user, maxLimit]);

  // Calculate dynamic target days based on active mode
  let targetTotalDays = currentDays;
  if (mode === 'add') {
    targetTotalDays = Math.min(maxLimit, currentDays + Math.max(0, addAmount));
  } else if (mode === 'decrease') {
    targetTotalDays = Math.max(0, currentDays - Math.max(0, decreaseAmount));
  } else {
    targetTotalDays = Math.min(maxLimit, Math.max(0, directDays));
  }

  const handleApplyAddPreset = (val: number) => {
    const safeVal = Math.max(1, val);
    setAddAmount(safeVal);
  };

  const handleApplyDecreasePreset = (val: number) => {
    const safeVal = Math.max(1, val);
    setDecreaseAmount(safeVal);
  };

  const handleApplyDirectPreset = (val: number) => {
    const safeVal = Math.min(maxLimit, Math.max(0, val));
    setDirectDays(safeVal);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalDays = Math.min(maxLimit, Math.max(0, targetTotalDays));
    onSave(user.id, finalDays);
    onClose();
  };

  const directPresets = maxDays && maxDays <= 30
    ? [
        { label: '1 Day', val: 1 },
        { label: '3 Days', val: 3 },
        { label: '7 Days', val: 7 },
        { label: '15 Days', val: 15 },
        { label: '20 Days', val: 20 },
        { label: '30 Days (Max)', val: 30 },
      ]
    : [
        { label: '1 Day', val: 1 },
        { label: '7 Days', val: 7 },
        { label: '15 Days', val: 15 },
        { label: '30 Days', val: 30 },
        { label: '60 Days', val: 60 },
        { label: '90 Days', val: 90 },
      ];

  const quickAddPresets = maxDays && maxDays <= 30
    ? [
        { label: '+1 Day', val: 1 },
        { label: '+3 Days', val: 3 },
        { label: '+5 Days', val: 5 },
        { label: '+7 Days', val: 7 },
        { label: '+15 Days', val: 15 },
        { label: '+30 Days', val: 30 },
      ]
    : [
        { label: '+1 Day', val: 1 },
        { label: '+3 Days', val: 3 },
        { label: '+7 Days', val: 7 },
        { label: '+15 Days', val: 15 },
        { label: '+30 Days', val: 30 },
        { label: '+60 Days', val: 60 },
      ];

  const quickDecreasePresets = [
    { label: '-1 Day', val: 1 },
    { label: '-3 Days', val: 3 },
    { label: '-5 Days', val: 5 },
    { label: '-7 Days', val: 7 },
    { label: '-15 Days', val: 15 },
    { label: '-30 Days', val: 30 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#12131a] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-[#161722]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">{titlePrefix}</h2>
              <p className="text-[11px] text-neutral-400 truncate max-w-[240px]">
                {user.name} ({user.email})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current Status banner */}
          <div className="p-3 bg-[#0a0b0e] border border-neutral-800/80 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-neutral-300 font-medium">Current Plan Time:</span>
            </div>
            <div className="flex items-center gap-2">
              {maxDays && (
                <span className="text-[10px] text-amber-400 font-mono">Max {maxDays}d</span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border ${
                currentDays <= 3
                  ? 'bg-red-950/80 text-red-300 border-red-800'
                  : currentDays <= 10
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              }`}>
                {currentDays} Days Left
              </span>
            </div>
          </div>

          {/* Mode Tabs: Add / Decrease / Set Direct */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Select Action Mode:
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0a0b0e] rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => setMode('add')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'add'
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/60 shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Add Days</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('decrease')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'decrease'
                    ? 'bg-rose-600/30 text-rose-300 border border-rose-500/60 shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
                }`}
              >
                <MinusCircle className="w-3.5 h-3.5" />
                <span>- Decrease</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('set')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'set'
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/60 shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Direct Set</span>
              </button>
            </div>
          </div>

          {/* Mode 1: ADD DAYS */}
          {mode === 'add' && (
            <div className="space-y-3 p-3.5 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-300">Days to Add:</span>
                <span className="text-[11px] text-emerald-400/80 font-mono">Will add to current {currentDays}d</span>
              </div>

              {/* Stepper + Input */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddAmount(prev => Math.max(1, prev - 5))}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  -5d
                </button>
                <button
                  type="button"
                  onClick={() => setAddAmount(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  -1d
                </button>

                <div className="relative flex-1">
                  <input
                    type="number"
                    min="1"
                    max={maxLimit}
                    value={addAmount}
                    onChange={e => setAddAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-center py-2 px-3 bg-[#0a0b0e] border border-emerald-700/60 focus:border-emerald-500 rounded-xl text-lg font-mono font-bold text-emerald-300 focus:outline-none"
                    placeholder="7"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-mono pointer-events-none">
                    Days
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setAddAmount(prev => prev + 1)}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  +1d
                </button>
                <button
                  type="button"
                  onClick={() => setAddAmount(prev => prev + 5)}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  +5d
                </button>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-6 gap-1 pt-1">
                {quickAddPresets.map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => handleApplyAddPreset(p.val)}
                    className={`py-1 px-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      addAmount === p.val
                        ? 'bg-emerald-600/40 border-emerald-500 text-emerald-200'
                        : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode 2: DECREASE DAYS */}
          {mode === 'decrease' && (
            <div className="space-y-3 p-3.5 bg-rose-950/20 border border-rose-800/40 rounded-2xl animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-300">Days to Subtract:</span>
                <span className="text-[11px] text-rose-400/80 font-mono">Will deduct from current {currentDays}d</span>
              </div>

              {/* Stepper + Input */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDecreaseAmount(prev => Math.max(1, prev - 5))}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  -5d
                </button>
                <button
                  type="button"
                  onClick={() => setDecreaseAmount(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  -1d
                </button>

                <div className="relative flex-1">
                  <input
                    type="number"
                    min="1"
                    max={currentDays}
                    value={decreaseAmount}
                    onChange={e => setDecreaseAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-center py-2 px-3 bg-[#0a0b0e] border border-rose-700/60 focus:border-rose-500 rounded-xl text-lg font-mono font-bold text-rose-300 focus:outline-none"
                    placeholder="1"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-mono pointer-events-none">
                    Days
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDecreaseAmount(prev => prev + 1)}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  +1d
                </button>
                <button
                  type="button"
                  onClick={() => setDecreaseAmount(prev => prev + 5)}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  +5d
                </button>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-6 gap-1 pt-1">
                {quickDecreasePresets.map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => handleApplyDecreasePreset(p.val)}
                    className={`py-1 px-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      decreaseAmount === p.val
                        ? 'bg-rose-600/40 border-rose-500 text-rose-200'
                        : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode 3: DIRECT SET */}
          {mode === 'set' && (
            <div className="space-y-3 p-3.5 bg-purple-950/20 border border-purple-800/40 rounded-2xl animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-300">Set Exact Total Days:</span>
                <span className="text-[11px] text-purple-400/80 font-mono">0 to {maxLimit} Days</span>
              </div>

              {/* Stepper + Input */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDirectDays(prev => Math.max(0, prev - 5))}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  -5d
                </button>
                <button
                  type="button"
                  onClick={() => setDirectDays(prev => Math.max(0, prev - 1))}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  -1d
                </button>

                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    max={maxLimit}
                    value={directDays}
                    onChange={e => setDirectDays(Math.min(maxLimit, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full text-center py-2 px-3 bg-[#0a0b0e] border border-purple-700/60 focus:border-purple-500 rounded-xl text-lg font-mono font-bold text-purple-300 focus:outline-none"
                    placeholder="30"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-mono pointer-events-none">
                    Days
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDirectDays(prev => Math.min(maxLimit, prev + 1))}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  +1d
                </button>
                <button
                  type="button"
                  onClick={() => setDirectDays(prev => Math.min(maxLimit, prev + 5))}
                  className="px-2.5 py-2 rounded-xl bg-[#181926] hover:bg-[#222436] border border-neutral-700/60 text-xs font-bold text-neutral-200 hover:text-white cursor-pointer"
                >
                  +5d
                </button>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-6 gap-1 pt-1">
                {directPresets.map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => handleApplyDirectPreset(p.val)}
                    className={`py-1 px-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      directDays === p.val
                        ? 'bg-purple-600/40 border-purple-500 text-purple-200'
                        : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Result Banner */}
          <div className="p-3.5 bg-[#0f1118] rounded-2xl border border-neutral-700/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10.5px] text-neutral-400 font-medium">Calculation Preview:</div>
              <div className="text-xs text-neutral-200 flex items-center gap-1.5 font-mono">
                <span>Current: <strong className="text-white">{currentDays}d</strong></span>
                {mode === 'add' && (
                  <span className="text-emerald-400">➕ {addAmount}d</span>
                )}
                {mode === 'decrease' && (
                  <span className="text-rose-400">➖ {decreaseAmount}d</span>
                )}
                <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10.5px] text-neutral-400 font-medium">New Total:</div>
              <div className="text-sm font-bold font-mono text-purple-300">
                {targetTotalDays} Days Left
              </div>
            </div>
          </div>

          {/* Real-Time Sync footer info */}
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 px-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Updates instantly in Supabase database & Chrome Extension.</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Apply & Set to {targetTotalDays} Days</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
