import React, { useState } from 'react';
import { X, User, Phone, Send, Lock, Save, Check, Copy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateProfile } = useAuth();
  const [whatsapp, setWhatsapp] = useState(currentUser?.whatsapp || '');
  const [telegram, setTelegram] = useState(currentUser?.telegram || '');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  if (!isOpen || !currentUser) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-text">
      <div className="w-full max-w-lg bg-[#121318] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold font-display text-white">Account Settings</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Email Address</label>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={currentUser.email}
                className="w-full pl-3.5 pr-24 py-2.5 bg-[#0b0c0f] border border-neutral-800/80 rounded-xl text-neutral-200 text-sm font-mono select-text cursor-text"
              />
              <button
                type="button"
                onClick={handleCopyEmail}
                className="absolute right-2 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-neutral-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-400">Full Name</label>
              <span className="text-[10px] text-neutral-500 font-mono">Read Only</span>
            </div>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                readOnly
                disabled
                value={currentUser.name}
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0b0c0f]/80 border border-neutral-800/80 rounded-xl text-neutral-300 text-sm cursor-not-allowed select-text opacity-85"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">WhatsApp</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="+1234..."
                  className="w-full pl-10 pr-3 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Telegram</label>
              <div className="relative">
                <Send className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={telegram}
                  onChange={e => setTelegram(e.target.value)}
                  placeholder="@user"
                  className="w-full pl-10 pr-3 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">New Password (leave empty to keep current)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800 text-xs text-neutral-400 space-y-1">
            <div className="flex justify-between">
              <span>Account ID:</span>
              <span className="font-mono text-neutral-300">{currentUser.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Plan Tier:</span>
              <span className={`font-semibold capitalize ${currentUser.plan === 'ultra' ? 'text-purple-400' : 'text-blue-400'}`}>
                {currentUser.plan} Plan ({currentUser.credits.toLocaleString()} credits)
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-green-300" />
                  Saved!
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
