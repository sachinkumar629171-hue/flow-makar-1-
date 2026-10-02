import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Zap, Sparkles, Infinity as InfinityIcon, Check, RotateCcw } from 'lucide-react';
import { useAuth, DEFAULT_PROMPT_CONFIG } from '../../context/AuthContext';
import { PricingPlan } from '../../types';

interface PricingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PricingSettingsModal: React.FC<PricingSettingsModalProps> = ({ isOpen, onClose }) => {
  const { promptConfig, updatePromptConfig } = useAuth();
  const [plans, setPlans] = useState<PricingPlan[]>(() => {
    // Fallback to empty array only if both are missing
    return promptConfig.pricing?.plans || [];
  });
  const [isSaving, setIsSaving] = useState(false);

  // Update local state if promptConfig changes (e.g. initial load)
  React.useEffect(() => {
    if (isOpen && promptConfig.pricing?.plans) {
      setPlans(promptConfig.pricing.plans);
    }
  }, [isOpen, promptConfig.pricing?.plans]);

  if (!isOpen) return null;

  const handleReset = () => {
    if (confirm('Are you sure you want to reset pricing to default values? This will overwrite your current settings.')) {
      setPlans(DEFAULT_PROMPT_CONFIG.pricing?.plans || []);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePromptConfig({
        pricing: {
          ...promptConfig.pricing,
          plans: plans
        }
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const addPlan = () => {
    const newId = `plan-${Date.now()}`;
    const newPlan: PricingPlan = {
      id: newId,
      name: 'New Plan',
      label: 'NEW',
      subtitle: 'Contact Your Reseller',
      credits: '10,000',
      videos: '100',
      features: ['Feature 1', 'Feature 2'],
      buttonText: 'Contact Your Reseller',
      color: 'blue'
    };
    setPlans(prev => [...prev, newPlan]);
  };

  const deletePlan = (id: string) => {
    if (confirm('Are you sure you want to delete this pricing plan?')) {
      setPlans(prev => prev.filter(p => p.id !== id));
    }
  };

  const updatePlan = (id: string, data: Partial<PricingPlan>) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const addFeature = (planId: string) => {
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        return { ...p, features: [...p.features, 'New Feature'] };
      }
      return p;
    }));
  };

  const removeFeature = (planId: string, index: number) => {
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        const newFeatures = [...p.features];
        newFeatures.splice(index, 1);
        return { ...p, features: newFeatures };
      }
      return p;
    }));
  };

  const updateFeature = (planId: string, index: number, value: string) => {
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        const newFeatures = [...p.features];
        newFeatures[index] = value;
        return { ...p, features: newFeatures };
      }
      return p;
    }));
  };

  const getIcon = (color: string) => {
    switch (color) {
      case 'blue': return <Zap className="w-4 h-4 text-blue-400" />;
      case 'purple': return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'amber': return <InfinityIcon className="w-4 h-4 text-amber-400" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#0d0f14] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-[#08090d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900/30 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Pricing Plan Settings</h2>
              <p className="text-xs text-neutral-400">Configure what users see in the pricing modal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold transition-colors border border-neutral-700"
              title="Reset to Default Plans"
            >
              <RotateCcw className="w-3 h-3" />
              RESET
            </button>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#0d0f14]">
          <div className="flex items-center justify-between mb-2">
             <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Active Plans</h3>
             <button
               onClick={addPlan}
               className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-[10px] font-bold transition-all border border-blue-500/30"
             >
               <Plus className="w-3 h-3" />
               ADD NEW PLAN
             </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className={`relative group rounded-xl border ${plan.color === 'purple' ? 'border-purple-500/50 bg-purple-950/5' : plan.color === 'amber' ? 'border-amber-500/40 bg-amber-950/5' : 'border-neutral-800 bg-neutral-900/30'} p-5 space-y-4 transition-all hover:border-neutral-700`}>
                {/* Delete Plan Button */}
                <button
                  onClick={() => deletePlan(plan.id)}
                  className="absolute top-2 right-2 p-1.5 bg-red-950/50 border border-red-500/30 rounded-lg text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900 hover:text-white"
                  title="Delete Plan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getIcon(plan.color)}
                    <input
                      type="text"
                      value={plan.name}
                      onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                      className="bg-transparent border-none text-white font-bold focus:ring-0 p-0 w-32"
                    />
                  </div>
                  <select
                    value={plan.color}
                    onChange={(e) => updatePlan(plan.id, { color: e.target.value as any })}
                    className="bg-neutral-800/50 border border-neutral-700 text-[10px] text-neutral-400 font-bold px-1 py-0.5 rounded outline-none"
                  >
                    <option value="blue">Blue</option>
                    <option value="purple">Purple</option>
                    <option value="amber">Amber</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Label</label>
                      <input
                        type="text"
                        value={plan.label}
                        onChange={(e) => updatePlan(plan.id, { label: e.target.value.toUpperCase() })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none transition-all uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Badge</label>
                      <input
                        type="text"
                        value={plan.badge || ''}
                        onChange={(e) => updatePlan(plan.id, { badge: e.target.value })}
                        placeholder="e.g. HOT"
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase">Subtitle / Price</label>
                    <input
                      type="text"
                      value={plan.subtitle || ''}
                      onChange={(e) => updatePlan(plan.id, { subtitle: e.target.value })}
                      placeholder="e.g. Contact Your Reseller or $19/mo"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Credits</label>
                      <input
                        type="text"
                        value={plan.credits}
                        onChange={(e) => updatePlan(plan.id, { credits: e.target.value })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Videos</label>
                      <input
                        type="text"
                        value={plan.videos}
                        onChange={(e) => updatePlan(plan.id, { videos: e.target.value })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase">Button Text</label>
                    <input
                      type="text"
                      value={plan.buttonText}
                      onChange={(e) => updatePlan(plan.id, { buttonText: e.target.value })}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Features</label>
                    <button
                      onClick={() => addFeature(plan.id)}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      ADD FEATURE
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="shrink-0">
                          <Check className="w-3.5 h-3.5 text-neutral-500" />
                        </div>
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => updateFeature(plan.id, idx, e.target.value)}
                          className="flex-1 bg-neutral-800/30 border border-neutral-700/50 rounded-md px-2 py-1 text-[11px] text-neutral-300 focus:border-blue-500 outline-none"
                        />
                        <button
                          onClick={() => removeFeature(plan.id, idx)}
                          className="p-1 text-neutral-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-[#08090d] flex items-center justify-between">
          <p className="text-xs text-neutral-500 italic">
            Note: These changes only affect the visual display in the pricing modal.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Pricing Config'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
