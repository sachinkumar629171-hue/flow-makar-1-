import React from 'react';
import { X, Play, Clock, Sparkles, Download, Film } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo?: (url: string) => void;
}

export const HistoryModal: React.FC<ModalProps> = ({ isOpen, onClose, onSelectVideo }) => {
  const { generations } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="w-full max-w-2xl max-h-[85vh] bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold font-display text-white">Generation History</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="p-6 overflow-y-auto space-y-4">
          {generations.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
              <p className="text-sm">No video generations yet.</p>
              <p className="text-xs text-neutral-500 mt-1">Try generating a video using the prompt box!</p>
            </div>
          ) : (
            generations.map(gen => (
              <div
                key={gen.id}
                className="p-4 bg-neutral-900/80 border border-neutral-800/90 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-20 h-14 rounded-xl overflow-hidden bg-black shrink-0 relative group">
                    <img
                      src={gen.thumbnailUrl}
                      alt={gen.prompt}
                      className="w-full h-full object-cover"
                    />
                    {gen.videoUrl && (
                      <button
                        onClick={() => onSelectVideo && onSelectVideo(gen.videoUrl!)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Play className="w-4 h-4 text-white fill-white" />
                      </button>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white font-medium line-clamp-2 leading-relaxed">
                      {gen.prompt}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(gen.createdAt).toLocaleDateString()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-mono">
                        {gen.model}
                      </span>
                      <span>{gen.aspectRatio}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {gen.videoUrl && (
                    <a
                      href={gen.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-200 hover:text-white transition-colors cursor-pointer"
                      title="Download Video"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
