import React, { useState, useEffect } from 'react';
import { X, Bell, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface DashboardAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardAnnouncementModal: React.FC<DashboardAnnouncementModalProps> = ({ isOpen, onClose }) => {
  const { promptConfig, updatePromptConfig } = useAuth();
  const currentAnnouncement = promptConfig?.dashboardAnnouncement || { enabled: false, text: '', type: 'info' };

  const [enabled, setEnabled] = useState(Boolean(currentAnnouncement.enabled));
  const [text, setText] = useState(currentAnnouncement.text || '');
  const [type, setType] = useState<'info' | 'warning' | 'success'>(currentAnnouncement.type || 'info');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const ann = promptConfig?.dashboardAnnouncement || { enabled: false, text: '', type: 'info' };
      setEnabled(Boolean(ann.enabled));
      setText(ann.text || '');
      setType(ann.type || 'info');
    }
  }, [isOpen, promptConfig?.dashboardAnnouncement?.enabled, promptConfig?.dashboardAnnouncement?.text, promptConfig?.dashboardAnnouncement?.type]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePromptConfig({
      ...promptConfig,
      dashboardAnnouncement: {
        enabled,
        text,
        type,
      }
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121318] border border-neutral-800 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Dashboard Notification Banner</h3>
            <p className="text-xs text-neutral-400">Show a custom announcement banner to all users on their dashboard.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
            <div>
              <span className="text-sm font-medium block">Enable Banner on Dashboard</span>
              <span className="text-[11px] font-mono text-neutral-400">
                showNotification:{' '}
                <strong className={enabled ? 'text-emerald-400' : 'text-rose-400'}>
                  {enabled ? 'true (ON)' : 'false (OFF)'}
                </strong>
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Notification Message Text</label>
            <textarea
              rows={3}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="e.g. New Nano Banana 2 update is now live! Enjoy 4K video generation."
              className="w-full bg-black/50 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Banner Style Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['info', 'success', 'warning'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all ${
                    type === t
                      ? 'bg-purple-600/30 border-purple-500 text-purple-300 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-2 shadow-lg shadow-purple-600/30"
            >
              {saved ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              <span>{saved ? 'Saved!' : 'Save & Publish'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
