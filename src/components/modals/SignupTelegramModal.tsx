import React, { useState, useEffect } from 'react';
import { X, Save, ExternalLink, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SignupTelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

export const SignupTelegramModal: React.FC<SignupTelegramModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { promptConfig, updatePromptConfig } = useAuth();
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (promptConfig) {
      setUrl(promptConfig.signupTelegramUrl || '');
      setEnabled(promptConfig.signupTelegramEnabled !== false);
    }
  }, [promptConfig, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePromptConfig({
      signupTelegramUrl: url.trim(),
      signupTelegramEnabled: enabled,
    });
    setSaveSuccess(true);
    if (onSaved) {
      onSaved(`Sign Up Telegram settings updated! Status: ${enabled ? 'ON' : 'OFF'}`);
    }
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 400);
  };

  const handleTestLink = () => {
    const targetUrl = url.trim();
    if (!targetUrl) return;
    const finalUrl = targetUrl.startsWith('http://') || targetUrl.startsWith('https://') 
      ? targetUrl 
      : targetUrl.startsWith('@')
        ? `https://t.me/${targetUrl.replace(/^@/, '')}`
        : targetUrl.startsWith('t.me/')
          ? `https://${targetUrl}`
          : `https://t.me/${targetUrl}`;
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 bg-[#16171d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-white">Sign Up Telegram Icon Settings</h2>
              <p className="text-[11px] text-neutral-400">Floating icon visible exclusively on Sign Up page</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Info Banner */}
          <div className="p-3.5 bg-sky-950/30 border border-sky-800/40 rounded-2xl space-y-1">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Sign Up Page Floating Support</span>
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Jab users sirf <strong>Sign Up</strong> screen par rahenge, tab unke samne bottom-right corner me Telegram ka icon show hoga. Login page par ye hide rahega.
            </p>
          </div>

          {/* Toggle Switch */}
          <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Telegram Icon Status</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  enabled 
                    ? 'bg-sky-950 text-sky-300 border border-sky-800/60' 
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700/60'
                }`}>
                  {enabled ? 'ON (Visible)' : 'OFF (Hidden)'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {enabled 
                  ? 'Icon Sign Up page par bottom-right me show hoga.' 
                  : 'Icon Sign Up page par puri tarah se OFF rahega.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                enabled ? 'bg-sky-500' : 'bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Telegram URL Input */}
          <div className="space-y-2 p-4 bg-neutral-900/40 border border-neutral-800 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Telegram Link URL</span>
              </label>
              {url.trim() && (
                <button
                  type="button"
                  onClick={handleTestLink}
                  className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer transition-colors"
                  title="Test link in new tab"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Test Link</span>
                </button>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-400">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://t.me/your_telegram_channel ya @your_username"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
            <p className="text-[10.5px] text-neutral-400 leading-normal">
              Users jab Sign Up page par Telegram icon par click karenge toh ye link nayi window me open hoga (e.g. Channel, Support, ya Group).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-900/30 transition-all active:scale-95 cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
