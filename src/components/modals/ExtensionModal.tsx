import React, { useState } from 'react';
import { X, Download, Chrome, Check, ExternalLink, Sparkles, ShieldCheck, FileArchive } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { triggerExtensionDownload } from '../../utils/download';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, planExtensions } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const userPlan = currentUser?.plan || 'basic';
  const extensionConfig = userPlan === 'ultra' ? planExtensions.ultra : planExtensions.basic;

  const handleDownload = () => {
    setDownloading(true);

    try {
      triggerExtensionDownload(extensionConfig, userPlan);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3500);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="w-full max-w-lg bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Chrome className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold font-display text-white">Flow Browser Extension</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-purple-950/50">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold font-display text-white">
              {extensionConfig.name || 'Flow AI Studio Companion'}
            </h3>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[11px] font-mono">
              <span>Version {extensionConfig.version || '2.5.0'}</span>
              {extensionConfig.downloadType === 'file' && (
                <span className="text-emerald-400">• Direct File (.zip/.crx)</span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-2 max-w-sm mx-auto leading-relaxed">
              {extensionConfig.description ||
                'Generate and remix AI video prompts from any website or video directly into your Flow dashboard with one click.'}
            </p>
          </div>

          <div className="space-y-2.5 text-xs text-neutral-300">
            <div className="p-3 bg-neutral-900/80 rounded-xl border border-neutral-800 flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Instant Right-click prompt enhancer for Chrome, Edge, and Brave</span>
            </div>
            <div className="p-3 bg-neutral-900/80 rounded-xl border border-neutral-800 flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Real-time credit counter &amp; generation status notifications</span>
            </div>
            <div className="p-3 bg-neutral-900/80 rounded-xl border border-neutral-800 flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Direct access to Nano Banana 2 &amp; Flow Ultra workflows</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {downloading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : downloaded ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Download Started Successfully!</span>
                </>
              ) : (
                <>
                  {extensionConfig.downloadType === 'file' ? (
                    <FileArchive className="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>
                    Download {extensionConfig.fileName || 'Flow Extension'}
                  </span>
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-neutral-500 mt-2">
              Compatible with Chrome, Microsoft Edge, Brave, and all Chromium browsers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
