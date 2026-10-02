import React, { useState, useEffect } from 'react';
import { X, Mail, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { User } from '../../types';

interface ResellerEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUpdateEmail: (userId: string, newEmail: string) => Promise<{ success: boolean; error?: string }>;
}

export const ResellerEmailModal: React.FC<ResellerEmailModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateEmail,
}) => {
  if (!isOpen || !user) return null;

  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNewEmail('');
    setError(null);
    setSuccess(null);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const clean = newEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setError('Please enter a valid Gmail address.');
      return;
    }

    if (clean === user.email.toLowerCase()) {
      setError('New Gmail is the same as the current Gmail.');
      return;
    }

    setLoading(true);
    try {
      const res = await onUpdateEmail(user.id, clean);
      if (!res.success) {
        setError(res.error || 'Failed to update Gmail ID.');
      } else {
        setSuccess('Gmail ID updated successfully!');
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch {
      setError('An error occurred while updating Gmail ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12131a] border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-[#161722]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Change Member Gmail ID</h2>
              <p className="text-xs text-neutral-400">Member: {user.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Current Old Gmail */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Current / Old Gmail ID
            </label>
            <div className="px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800/80 rounded-xl text-neutral-300 font-mono text-sm select-all">
              {user.email}
            </div>
          </div>

          <div className="flex justify-center text-neutral-500">
            <ArrowRight className="w-4 h-4 rotate-90 sm:rotate-0" />
          </div>

          {/* New Gmail */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              New Gmail ID
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="Enter new Gmail address..."
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              The member will use this new Gmail address to log in to Flow Studio.
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
              disabled={loading || !newEmail.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Updating...' : 'Update Gmail ID'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
