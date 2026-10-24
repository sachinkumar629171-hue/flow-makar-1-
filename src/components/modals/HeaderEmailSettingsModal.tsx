import React, { useState, useEffect } from 'react';
import { X, Save, Mail, Eye, EyeOff, Sparkles, Check, Copy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderEmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavedToast?: (msg: string) => void;
}

export const HeaderEmailSettingsModal: React.FC<HeaderEmailSettingsModalProps> = ({
  isOpen,
  onClose,
  onSavedToast,
}) => {
  const { promptConfig, updatePromptConfig, currentUser } = useAuth();
  
  // Default to promptConfig.headerEmailOpacity or 0 (stealth/hidden by default)
  const [opacity, setOpacity] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (promptConfig) {
      setOpacity(promptConfig.headerEmailOpacityCustom ? (promptConfig.headerEmailOpacity ?? 0) : 0);
    }
  }, [promptConfig]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePromptConfig({
      headerEmailOpacity: Number(opacity),
      headerEmailOpacityCustom: true,
    });
    if (onSavedToast) {
      onSavedToast(`Header Email Opacity set to ${opacity}%`);
    }
    onClose();
  };

  const sampleEmail = currentUser?.email || 'user@gmail.com';

  const extensionCodeSnippet = `// Extension Content Script se Header Gmail ID lene ke tarike:
// 1. Direct Text from ID:
const userEmail = document.getElementById('user-header-email')?.textContent?.trim();

// 2. Data Attribute:
const emailFromAttr = document.getElementById('header-user-email-container')?.getAttribute('data-user-email');

// 3. LocalStorage:
const storedData = JSON.parse(localStorage.getItem('google_flow_user_data') || '{}');
console.log('User Email:', userEmail || storedData.email);`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(extensionCodeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#111217] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 bg-[#15161d]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-white">Header Gmail ID & Opacity Settings</h2>
              <p className="text-[11px] text-neutral-400">Header me user ki email visibility aur transparency control karein</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          
          {/* Explanation Box */}
          <div className="p-4 bg-cyan-950/20 border border-cyan-800/40 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Extension Stealth Mode (0% Opacity)</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Jab aap Opacity ko <strong>0%</strong> karenge, toh email human visitor ko bilkul nahi dikhegi (hidden/invisible rahegi), lekin element usi jagah <strong>DOM</strong> me maujood rahega taaki aapka <strong>Extension</strong> user ki Gmail ID ko silently read kar sake.
            </p>
          </div>

          {/* Opacity Slider Control */}
          <div className="space-y-4 p-4 bg-neutral-900/50 border border-neutral-800 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                {opacity === 0 ? (
                  <EyeOff className="w-4 h-4 text-rose-400" />
                ) : (
                  <Eye className="w-4 h-4 text-emerald-400" />
                )}
                <span>Email Opacity:</span>
              </label>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-mono font-black px-2.5 py-0.5 rounded-md ${
                  opacity === 0 
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60' 
                    : opacity === 100 
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                    : 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
                }`}>
                  {opacity}% {opacity === 0 ? '(Fully Hidden)' : opacity === 100 ? '(Visible)' : '(Transparent)'}
                </span>
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
            />

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[
                { label: '0% Hidden', val: 0, desc: 'Stealth' },
                { label: '25% Ghost', val: 25, desc: 'Faint' },
                { label: '50% Half', val: 50, desc: 'Subtle' },
                { label: '100% Solid', val: 100, desc: 'Full' },
              ].map((preset) => (
                <button
                  type="button"
                  key={preset.val}
                  onClick={() => setOpacity(preset.val)}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer border ${
                    opacity === preset.val
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-900/30'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                  }`}
                >
                  <div>{preset.label}</div>
                  <div className="text-[10px] text-neutral-400 font-normal">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Live Header Preview (Header Background: Black #08090b):
            </div>
            <div className="p-4 bg-[#08090b] border border-neutral-900 rounded-2xl flex items-center justify-between relative overflow-hidden">
              <span className="text-sm font-black font-display text-white tracking-tight">Flow</span>

              <div className="flex items-center gap-3">
                {/* Simulated Header Email with Opacity */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-800/40 bg-black/40 transition-opacity duration-150"
                  style={{ opacity: opacity / 100 }}
                >
                  <span className="text-xs font-mono text-neutral-300 font-medium tracking-tight">
                    {sampleEmail}
                  </span>
                </div>

                {/* Simulated other icons */}
                <div className="flex items-center gap-2 opacity-50 text-neutral-400 text-xs">
                  <div className="w-6 h-6 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">?</div>
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[10px]">S</div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 italic">
              {opacity === 0
                ? 'Dekhein: 0% par header par kuch nahi dikhega, sab normal black dikhega.'
                : `Abhi screen par email ${opacity}% opacity ke saath dikhegi.`}
            </p>
          </div>

          {/* Developer / Extension Instructions */}
          <div className="p-3.5 bg-neutral-950 border border-neutral-800/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold">
              <span>Extension Developer Code</span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-[10.5px] font-mono text-neutral-400 bg-[#090a0d] p-2.5 rounded-xl overflow-x-auto leading-relaxed border border-neutral-900">
              {`const email = document.getElementById('user-header-email')?.textContent?.trim();`}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/30 transition-all cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Opacity Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
