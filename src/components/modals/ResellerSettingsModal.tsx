import React, { useState, useEffect } from 'react';
import { X, Save, Link as LinkIcon, MessageSquare, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ResellerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResellerSettingsModal: React.FC<ResellerSettingsModalProps> = ({ isOpen, onClose }) => {
  const { promptConfig, updatePromptConfig } = useAuth();
  const [url, setUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (promptConfig) {
      setUrl(promptConfig.resellerContactUrl || '');
      setCustomUrl(promptConfig.customPlanContactUrl || '');
      setEnabled(promptConfig.resellerContactUrlEnabled !== false);
    }
  }, [promptConfig]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePromptConfig({ 
      resellerContactUrl: url,
      customPlanContactUrl: customUrl,
      resellerContactUrlEnabled: enabled
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white">
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 bg-[#16171d]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold font-display text-white">Reseller Contact Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="p-3.5 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Configurable Support Links</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Define the URLs that users will be redirected to when they click <strong>"Contact Your Reseller"</strong>.
            </p>
          </div>

          <div className="space-y-4">
            {/* Top Plans Setting */}
            <div className="space-y-3 p-4 bg-neutral-900/40 border border-neutral-800 rounded-2xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider">Top 3 Plans Link</label>
                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                    enabled ? 'bg-blue-600' : 'bg-neutral-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <LinkIcon className="w-4 h-4 text-neutral-500" />
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Plan Link (Requires 3 clicks if enabled)"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 italic ml-1">
                  Requires <strong>3 quick clicks</strong> to open if toggle is ON.
                </p>
              </div>
            </div>

            {/* Custom Plan Setting */}
            <div className="space-y-3 p-4 bg-neutral-900/40 border border-neutral-800 rounded-2xl">
              <label className="block text-xs font-bold text-white uppercase tracking-wider">Bottom "Custom Plan" Link</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <LinkIcon className="w-4 h-4 text-neutral-500" />
                </div>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Custom Plan Link (Single click)"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <p className="text-[10px] text-neutral-500 italic ml-1">
                Opens instantly on <strong>single click</strong>.
              </p>
            </div>
          </div>

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
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/30 transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Contact URL</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
