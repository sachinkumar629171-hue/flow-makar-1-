import React, { useState } from 'react';
import { X, Copy, Check, Users, Gift, Share2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferralModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !currentUser) return null;

  const referralCode = currentUser.referralCode || 'FLOWPRO99';
  const referralLink = `${window.location.origin}/?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="w-full max-w-md bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold font-display text-white">Refer &amp; Earn</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Share2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white font-display">Invite Friends, Get Extra Credits</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Share your personal invite code. When someone signs up, both of you unlock priority AI video render perks!
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Your Referral Code</label>
            <div className="flex items-center justify-between px-4 py-3 bg-[#0b0c0f] border border-neutral-800 rounded-xl">
              <span className="font-mono text-base font-bold text-purple-300 tracking-wider">
                {referralCode}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-neutral-400 mb-1">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Referred Users</span>
              </div>
              <div className="text-xl font-bold text-white">0</div>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-neutral-400 mb-1">
                <Gift className="w-3.5 h-3.5 text-purple-400" />
                <span>Bonus Earned</span>
              </div>
              <div className="text-xl font-bold text-purple-400">0 Credits</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
