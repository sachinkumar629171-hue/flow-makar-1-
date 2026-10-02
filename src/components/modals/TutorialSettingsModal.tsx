import React, { useState } from 'react';
import { X, Youtube, Save, Check, Play, Smartphone, Monitor } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getYouTubeEmbedUrl } from '../../utils/youtube';

interface TutorialSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialSettingsModal: React.FC<TutorialSettingsModalProps> = ({ isOpen, onClose }) => {
  const { tutorialConfig, updateTutorialConfig } = useAuth();

  const [desktopVideoUrl, setDesktopVideoUrl] = useState(tutorialConfig.desktopVideoUrl);
  const [desktopTitle, setDesktopTitle] = useState(tutorialConfig.desktopTitle);
  const [desktopSubtitle, setDesktopSubtitle] = useState(tutorialConfig.desktopSubtitle || '');

  const [mobileVideoUrl, setMobileVideoUrl] = useState(tutorialConfig.mobileVideoUrl);
  const [mobileTitle, setMobileTitle] = useState(tutorialConfig.mobileTitle);
  const [mobileSubtitle, setMobileSubtitle] = useState(tutorialConfig.mobileSubtitle || '');

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTutorialConfig({
      desktopVideoUrl,
      desktopTitle,
      desktopSubtitle,
      mobileVideoUrl,
      mobileTitle,
      mobileSubtitle,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="w-full max-w-xl bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 bg-[#161820]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-white">Tutorial Video Settings</h2>
              <p className="text-[11px] text-neutral-400">
                Update YouTube tutorial links for Desktop and Mobile guides
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {savedSuccess && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Tutorial video links updated successfully!</span>
            </div>
          )}

          {/* Section 1: Desktop / PC Video */}
          <div className="p-4 bg-[#0e1017] rounded-2xl border border-neutral-800/80 space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
              <Monitor className="w-4 h-4" />
              <span>1. Desktop / PC Tutorial Video</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                YouTube Video URL or ID
              </label>
              <input
                type="text"
                required
                value={desktopVideoUrl}
                onChange={e => setDesktopVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                className="w-full px-3.5 py-2.5 bg-[#08090d] border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Embed Preview: {getYouTubeEmbedUrl(desktopVideoUrl) || 'None'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={desktopTitle}
                  onChange={e => setDesktopTitle(e.target.value)}
                  placeholder="How to Use Flow on Desktop"
                  className="w-full px-3.5 py-2 bg-[#08090d] border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Description / Subtitle</label>
                <input
                  type="text"
                  value={desktopSubtitle}
                  onChange={e => setDesktopSubtitle(e.target.value)}
                  placeholder="Chrome extension setup & Studio guide"
                  className="w-full px-3.5 py-2 bg-[#08090d] border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Mobile Video */}
          <div className="p-4 bg-[#0e1017] rounded-2xl border border-neutral-800/80 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Smartphone className="w-4 h-4" />
              <span>2. Mobile (Android & iOS) Tutorial Video</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                YouTube Video URL or ID
              </label>
              <input
                type="text"
                required
                value={mobileVideoUrl}
                onChange={e => setMobileVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                className="w-full px-3.5 py-2.5 bg-[#08090d] border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Embed Preview: {getYouTubeEmbedUrl(mobileVideoUrl) || 'None'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={mobileTitle}
                  onChange={e => setMobileTitle(e.target.value)}
                  placeholder="How to Use Flow on Mobile"
                  className="w-full px-3.5 py-2 bg-[#08090d] border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Description / Subtitle</label>
                <input
                  type="text"
                  value={mobileSubtitle}
                  onChange={e => setMobileSubtitle(e.target.value)}
                  placeholder="Step-by-step phone & tablet guide"
                  className="w-full px-3.5 py-2 bg-[#08090d] border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-red-900/30 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Tutorial Links</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
