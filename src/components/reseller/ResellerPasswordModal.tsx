import React, { useState, useEffect } from 'react';
import { X, Lock, Check, RefreshCw } from 'lucide-react';
import { User } from '../../types';

interface ResellerPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUpdatePassword: (userId: string, newPass: string) => void;
}

export const ResellerPasswordModal: React.FC<ResellerPasswordModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdatePassword,
}) => {
  if (!isOpen || !user) return null;

  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setNewPassword('');
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [user]);

  const handleGenerate = () => {
    const generated = `flow${Math.floor(100000 + Math.random() * 900000)}`;
    setNewPassword(generated);
    setErrorMsg(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPass = newPassword.trim();
    if (!cleanPass) {
      setErrorMsg('Please enter or generate a new password.');
      return;
    }
    if (cleanPass.length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      return;
    }

    onUpdatePassword(user.id, cleanPass);
    setSuccessMsg('New password created and updated successfully!');
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12131a] border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-[#161722]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Create New Password</h2>
              <p className="text-xs text-neutral-400">{user.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Customer Email</label>
            <div className="px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800/80 rounded-xl text-neutral-300 font-mono text-sm select-all">
              {user.email}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-neutral-300">New Password</label>
              <button
                type="button"
                onClick={handleGenerate}
                className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Generate Random</span>
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={newPassword}
                onChange={e => {
                  setNewPassword(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Type new password for member..."
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Enter or generate a new password to grant new login access.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800/80">
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
              <span>Update New Password</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
