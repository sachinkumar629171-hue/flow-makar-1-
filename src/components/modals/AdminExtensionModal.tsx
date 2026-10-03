import React, { useState } from 'react';
import { X, Chrome, Upload, Link, Check, FileArchive, Download, Sparkles, AlertCircle, Zap, HardDrive, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PlanType, ExtensionConfig } from '../../types';
import { triggerExtensionDownload, formatDownloadUrl } from '../../utils/download';
import { apiUrl } from '../../config/api';

interface AdminExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminExtensionModal: React.FC<AdminExtensionModalProps> = ({ isOpen, onClose }) => {
  const { planExtensions, updatePlanExtensionConfig, updatePromptConfig } = useAuth();

  const [activeTab, setActiveTab] = useState<PlanType>('basic');

  // Basic Form State
  const [basicState, setBasicState] = useState<ExtensionConfig>({ ...planExtensions.basic });
  // Ultra Form State
  const [ultraState, setUltraState] = useState<ExtensionConfig>({ ...planExtensions.ultra });

  const [isUploading, setIsUploading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentForm = activeTab === 'basic' ? basicState : ultraState;

  const updateCurrentField = (field: keyof ExtensionConfig, value: any) => {
    if (activeTab === 'basic') {
      setBasicState(prev => ({ ...prev, [field]: value }));
    } else {
      setUltraState(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File size exceeds 50MB. Please use Google Drive/Cloud Link or a compressed package.');
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const base64Data = reader.result;
        updateCurrentField('fileName', file.name);
        updateCurrentField('fileData', base64Data);
        updateCurrentField('downloadType', 'file');

        // Automatically upload to central server storage
        try {
          const res = await fetch(apiUrl('/api/extensions/upload'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: activeTab,
              fileName: file.name,
              fileData: base64Data,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.downloadUrl) {
              updateCurrentField('downloadUrl', data.downloadUrl);
            }
          }
        } catch (err) {
          console.warn('Server upload background error:', err);
        } finally {
          setIsUploading(false);
        }
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file from disk.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto format Google Drive or Dropbox links if present (only if it's not meant to be a direct URL open)
    const cleanBasic = {
      ...basicState,
      downloadUrl: basicState.downloadUrl ? (basicState.downloadType === 'url' ? basicState.downloadUrl : formatDownloadUrl(basicState.downloadUrl)) : basicState.downloadUrl
    };
    const cleanUltra = {
      ...ultraState,
      downloadUrl: ultraState.downloadUrl ? (ultraState.downloadType === 'url' ? ultraState.downloadUrl : formatDownloadUrl(ultraState.downloadUrl)) : ultraState.downloadUrl
    };

    updatePlanExtensionConfig('basic', cleanBasic);
    updatePlanExtensionConfig('ultra', cleanUltra);

    if (cleanUltra.version?.trim()) {
      updatePromptConfig({ extensionVersion: cleanUltra.version.trim() });
    }

    // Sync to backend config
    try {
      await fetch(apiUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planExtensions: {
            basic: cleanBasic,
            ultra: cleanUltra,
          },
          promptConfig: {
            extensionVersion: cleanUltra.version?.trim(),
          }
        })
      });
    } catch {
      // offline fallback
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleTestDownload = (targetPlan: PlanType) => {
    const config = targetPlan === 'basic' ? basicState : ultraState;
    triggerExtensionDownload(config, targetPlan);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="w-full max-w-xl bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 bg-[#161820]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-inner">
              <Chrome className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-white">Manage Plan Extensions</h2>
              <p className="text-[11px] text-neutral-400">
                Host separate extensions for Basic members and Ultra members (Google Drive link or Direct Upload)
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

        {/* Plan Switcher Tabs */}
        <div className="px-6 pt-4 border-b border-neutral-800 bg-[#0f1015]">
          <div className="grid grid-cols-2 gap-2 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'basic'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-blue-300" />
              <span>Basic Plan Extension</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ultra')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'ultra'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span>Ultra Plan Extension (VIP)</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
          {savedSuccess && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Extensions updated & synced! Basic & Ultra members will now receive their online files.</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Delivery Method for Current Selected Plan */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-neutral-300">
                Delivery Mode ({activeTab === 'basic' ? 'Basic Users' : 'Ultra Users'})
              </label>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                activeTab === 'basic' ? 'bg-blue-950 text-blue-400 border border-blue-800/60' : 'bg-purple-950 text-purple-400 border border-purple-800/60'
              }`}>
                {activeTab.toUpperCase()} TIER
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => updateCurrentField('downloadType', 'url')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  currentForm.downloadType === 'url'
                    ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                <span>Google Drive / Online Link</span>
              </button>
              <button
                type="button"
                onClick={() => updateCurrentField('downloadType', 'file')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  currentForm.downloadType === 'file'
                    ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-purple-400" />
                <span>Upload File to Server (.zip/.crx)</span>
              </button>
            </div>
          </div>

          {/* If Link Mode */}
          {currentForm.downloadType === 'url' ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-300">
                Google Drive / Direct Download URL ({activeTab === 'basic' ? 'Basic' : 'Ultra'})
              </label>
              <input
                type="url"
                required
                value={currentForm.downloadUrl}
                onChange={e => updateCurrentField('downloadUrl', e.target.value)}
                placeholder="https://drive.google.com/file/d/... or direct .zip link"
                className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 font-mono text-xs"
              />
              <div className="p-2.5 bg-blue-950/30 border border-blue-900/40 rounded-xl text-[11px] text-blue-300 flex items-start gap-2">
                <HardDrive className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Tip:</strong> Google Drive links (e.g. <code>drive.google.com/file/d/.../view</code>) are automatically converted to direct one-click download URLs for your users!
                </span>
              </div>
            </div>
          ) : (
            /* If File Upload Mode */
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-300">
                Upload {activeTab === 'basic' ? 'Basic' : 'Ultra'} Package to Server (.zip / .crx)
              </label>
              <label className="border-2 border-dashed border-neutral-700 hover:border-purple-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-neutral-900/60 transition-colors">
                <input
                  type="file"
                  accept=".zip,.crx,.tar.gz"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {isUploading ? (
                  <RefreshCw className="w-8 h-8 text-purple-400 mb-2 animate-spin" />
                ) : (
                  <FileArchive className="w-8 h-8 text-purple-400 mb-2" />
                )}
                <span className="text-xs font-semibold text-white">
                  {isUploading ? 'Uploading file to server storage...' : `Click or drag ${activeTab} package file`}
                </span>
                <span className="text-[11px] text-neutral-400 mt-0.5">
                  Saved directly to server so all users can download online (up to 50MB)
                </span>
                {currentForm.fileName && (
                  <div className="mt-2 px-3 py-1 bg-purple-950/80 border border-purple-800 rounded-lg text-purple-300 text-xs font-mono flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Loaded: {currentForm.fileName}</span>
                  </div>
                )}
              </label>
            </div>
          )}

          {/* Extension Name & Version */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Extension Name</label>
              <input
                type="text"
                required
                value={currentForm.name}
                onChange={e => updateCurrentField('name', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Version</label>
              <input
                type="text"
                required
                value={currentForm.version}
                onChange={e => updateCurrentField('version', e.target.value)}
                placeholder="2.5.0"
                className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Save File Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Download File Name</label>
            <input
              type="text"
              required
              value={currentForm.fileName || ''}
              onChange={e => updateCurrentField('fileName', e.target.value)}
              placeholder={`flow-${activeTab}-extension.zip`}
              className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 font-mono text-xs"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={currentForm.description}
              onChange={e => updateCurrentField('description', e.target.value)}
              className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleTestDownload(activeTab)}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Test Download ({activeTab})</span>
            </button>

            <button
              type="submit"
              disabled={isUploading}
              className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Save Both Extensions</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

