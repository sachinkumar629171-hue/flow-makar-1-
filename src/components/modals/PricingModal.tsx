import React, { useState } from 'react';
import { X, Check, Zap, Sparkles, Infinity as InfinityIcon, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminPanel?: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onOpenAdminPanel }) => {
  const { currentUser, isAdmin, requestUpgrade, promptConfig } = useAuth();
  const [showResellerToast, setShowResellerToast] = useState(false);
  const [clickCount, setClickCount] = useState<{ [key: string]: { count: number, lastTime: number } }>({});

  if (!isOpen) return null;

  const handleContactReseller = (type: 'plan' | 'custom' = 'plan') => {
    const now = Date.now();
    
    // Bottom Custom Plan Section logic
    if (type === 'custom') {
      if (promptConfig?.customPlanContactUrl) {
        window.open(promptConfig.customPlanContactUrl, '_blank');
        return;
      }
      if (currentUser) requestUpgrade();
      setShowResellerToast(true);
      setTimeout(() => setShowResellerToast(false), 3000);
      return;
    }

    // Top Plans Section logic
    const contactUrl = promptConfig?.resellerContactUrl?.trim() || 'https://t.me/google_ultra_veo3_bot';

    // If 3-click feature is OFF, open link instantly
    if (promptConfig?.resellerContactUrlEnabled === false) {
      window.open(contactUrl, '_blank');
      return;
    }

    // 3-click feature: check for 3 clicks within 3 seconds (3000 ms)
    const current = clickCount['plan'] || { count: 0, lastTime: 0 };
    const isQuick = now - current.lastTime < 3000;
    const newCount = isQuick ? current.count + 1 : 1;

    if (newCount >= 3) {
      window.open(contactUrl, '_blank');
      setClickCount({ ...clickCount, ['plan']: { count: 0, lastTime: 0 } });
      return;
    }

    setClickCount({ ...clickCount, ['plan']: { count: newCount, lastTime: now } });

    // Default message / toast behavior
    if (currentUser) requestUpgrade();
    setShowResellerToast(true);
    setTimeout(() => setShowResellerToast(false), 3000);
  };

  const getIcon = (color: string) => {
    switch (color) {
      case 'blue': return <Zap className="w-4 h-4" />;
      case 'purple': return <Sparkles className="w-4 h-4" />;
      case 'amber': return <InfinityIcon className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getCardStyle = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-[#0e1017] border-neutral-800 hover:border-neutral-700';
      case 'purple': return 'bg-[#100f1c] border-purple-500/80 shadow-[0_0_35px_rgba(168,85,247,0.18)]';
      case 'amber': return 'bg-[#120f09] border-amber-500/70 shadow-[0_0_35px_rgba(245,158,11,0.15)]';
      default: return 'bg-[#0e1017] border-neutral-800 hover:border-neutral-700';
    }
  };

  const getMetricStyle = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-[#08090d] border-neutral-800/80 text-blue-400';
      case 'purple': return 'bg-[#090812] border-purple-900/40 text-purple-400';
      case 'amber': return 'bg-[#0a0804] border-amber-900/40 text-amber-400';
      default: return 'bg-[#08090d] border-neutral-800/80 text-blue-400';
    }
  };

  const getButtonStyle = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30';
      case 'purple': return 'bg-[#a824f9] hover:bg-[#971ce0] text-white shadow-purple-900/50';
      case 'amber': return 'bg-[#f59e0b] hover:bg-[#d97706] text-black shadow-amber-900/40';
      default: return 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30';
    }
  };

  const getBadgeStyle = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-950 border-blue-500 text-blue-300';
      case 'purple': return 'bg-purple-950 border-purple-500 text-purple-300';
      case 'amber': return 'bg-amber-950 border-amber-500 text-amber-300';
      default: return 'bg-neutral-900 border-neutral-700 text-neutral-300';
    }
  };

  const pricingPlans = promptConfig.pricing?.plans || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-lg overflow-y-auto select-text">
      <div className="relative w-full max-w-5xl bg-[#090a0f] border border-neutral-800/80 rounded-3xl shadow-2xl overflow-hidden text-white my-6 sm:my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 z-20 text-neutral-400 hover:text-white p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-10 md:p-12 space-y-10 text-center">
          {/* Top Pill & Main Titles */}
          <div className="flex flex-col items-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-950/60 border border-blue-500/40 text-sky-400 text-xs font-semibold mb-3.5">
              <Zap className="w-3.5 h-3.5 fill-sky-400 text-sky-400" />
              <span>Powered by Google Flow AI</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight font-display">
              Simple, transparent plans
            </h1>

            <p className="mt-3 text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-xl">
              Get managed access to Google Flow's AI video generation. Contact your reseller to get started.
            </p>

            {isAdmin && onOpenAdminPanel && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdminPanel();
                }}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-purple-900/50 hover:bg-purple-900/80 text-purple-300 text-xs font-semibold rounded-full border border-purple-500/40 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                <span>Open Admin Management Dashboard</span>
              </button>
            )}
          </div>

          {/* Dynamic Pricing Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left items-stretch">
            {pricingPlans.map((plan) => (
              <div key={plan.id} className={`relative rounded-2xl p-6 sm:p-7 border flex flex-col justify-between transition-all ${getCardStyle(plan.color)}`}>
                {/* Badge if exists */}
                {plan.badge && (
                  <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider shadow-md ${getBadgeStyle(plan.color)}`}>
                    {plan.badge}
                  </div>
                )}

                <div>
                  {/* Header with Icon */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${plan.color === 'blue' ? 'bg-blue-950/70 border-blue-500/30 text-blue-400' : plan.color === 'purple' ? 'bg-purple-950/80 border-purple-500/40 text-purple-300' : 'bg-amber-950/80 border-amber-500/40 text-amber-300'}`}>
                      {getIcon(plan.color)}
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">{plan.label}</div>
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleContactReseller('plan')}
                    className="text-xs text-neutral-400 font-medium mb-5 cursor-pointer hover:text-neutral-300 transition-colors"
                    title="Click 3 times in 3s to contact reseller"
                  >
                    {plan.subtitle}
                  </div>

                  {/* Metric Dual Box */}
                  <div className={`grid grid-cols-2 gap-2 p-3 border rounded-xl mb-6 text-center ${getMetricStyle(plan.color)}`}>
                    <div className={`border-r pr-2 ${plan.color === 'blue' ? 'border-neutral-800/80' : plan.color === 'purple' ? 'border-purple-900/40' : 'border-amber-900/40'}`}>
                      <div className={`text-lg font-bold ${plan.color === 'amber' ? 'text-2xl leading-none py-0.5' : ''}`}>{plan.credits}</div>
                      <div className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">CREDITS</div>
                    </div>
                    <div className="pl-2">
                      <div className={`text-lg font-bold ${plan.color === 'amber' ? 'text-2xl leading-none py-0.5' : ''}`}>{plan.videos}</div>
                      <div className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">AI VIDEOS</div>
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-3 text-xs text-neutral-300">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2.5">
                        <Check className={`w-4 h-4 shrink-0 ${plan.color === 'blue' ? 'text-neutral-400' : plan.color === 'purple' ? 'text-purple-400' : 'text-amber-400'}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <div className="mt-8 pt-4">
                  <button
                    type="button"
                    onClick={() => handleContactReseller('plan')}
                    className={`w-full py-3 px-4 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer text-center shadow-lg ${getButtonStyle(plan.color)}`}
                  >
                    {currentUser?.plan === plan.id.toLowerCase() ? 'Current Plan' : plan.buttonText}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Frequently Asked Questions Section */}
          <div className="rounded-2xl p-6 sm:p-8 bg-[#0d0f14] border border-neutral-800/80 text-left space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Frequently Asked Questions
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div>
                <h4 className="text-sm font-semibold text-white mb-1.5">What are credits?</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Each video generation on Google Flow uses a certain number of credits depending on length and quality settings.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-1.5">Do credits roll over?</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Credits reset at the start of each billing cycle and do not carry over to the next month.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-1.5">How does Google Flow access work?</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Our extension injects your assigned session into the Flow website, giving you instant access without any extra setup.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-1.5">Can I upgrade mid-cycle?</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Yes! Contact your reseller and they'll upgrade your plan immediately with prorated credits.
                </p>
              </div>
            </div>
          </div>

          {/* Need a Custom Plan Bar */}
          <div className="rounded-2xl p-5 sm:p-6 bg-[#0d0f14] border border-neutral-800/80 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-bold text-white">Need a custom plan?</h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                Contact your reseller for team or agency pricing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleContactReseller('custom')}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
            >
              Contact Your Reseller
            </button>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification for "Contact Your Reseller" (Matches Screenshot bottom right) */}
      {showResellerToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#14151b] border border-blue-600/50 rounded-2xl p-4 shadow-2xl text-left max-w-sm animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Contact Your Reseller</span>
          </div>
          <div className="text-[11px] text-neutral-300 leading-relaxed">
            {currentUser?.resellerName ? (
              <span>Your authorized reseller is <strong className="text-white font-semibold">{currentUser.resellerName}</strong>. Your upgrade request has been sent!</span>
            ) : (
              <span>Upgrade request submitted to Admin and authorized resellers. Please reach out for instant plan activation.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

