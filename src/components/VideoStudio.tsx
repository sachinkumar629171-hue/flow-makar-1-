import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Play, 
  Sliders, 
  Layers, 
  Video, 
  Maximize2, 
  Clock, 
  Zap, 
  Download, 
  Share2, 
  Compass, 
  Check,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface VideoStudioProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

const SAMPLE_PROMPTS = [
  'A cinematic shot of a majestic royal bird with iridescent sapphire feathers turning head in slow motion',
  'Futuristic neon city highway with hovering sports vehicles racing at sunset in Tokyo',
  'Stop-motion clay kitten wearing a chef hat rolling dough in a warm pastel dollhouse bakery',
  'Hyper-realistic macro shot of glowing jellyfish floating in deep bioluminescent oceanic trench'
];

export const VideoStudio: React.FC<VideoStudioProps> = ({ isOpen, onClose, initialPrompt = '' }) => {
  const { currentUser, addGeneration } = useAuth();

  const [prompt, setPrompt] = useState(initialPrompt || SAMPLE_PROMPTS[0]);
  const [model, setModel] = useState('Nano Banana 2');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [duration, setDuration] = useState<number>(5);
  const [motionSpeed, setMotionSpeed] = useState<'gentle' | 'dynamic' | 'cinematic'>('cinematic');
  const [style, setStyle] = useState('Photorealistic 8K');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [generatedResult, setGeneratedResult] = useState<{
    videoUrl: string;
    thumbnailUrl: string;
    prompt: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const creditCost = duration === 5 ? 10 : 20;
  const hasEnoughCredits = currentUser.credits >= creditCost;

  const handleStartGeneration = async () => {
    if (!prompt.trim()) {
      setErrorMessage('Please enter a video prompt description.');
      return;
    }
    if (!hasEnoughCredits) {
      setErrorMessage(`Insufficient credits! You need ${creditCost} credits for this generation.`);
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);
    setProgress(0);
    setGeneratedResult(null);

    // Simulate multi-stage Nano Banana 2 rendering
    const stages = [
      { p: 15, msg: 'Initializing Nano Banana 2 neural diffusion weights...' },
      { p: 35, msg: 'Synthesizing keyframes & 3D camera trajectory...' },
      { p: 65, msg: 'Applying temporal motion consistency and 60fps interpolation...' },
      { p: 85, msg: 'Upscaling textures and color grading in HDR...' },
      { p: 100, msg: 'Finalizing MP4 video rendering...' }
    ];

    for (const stage of stages) {
      await new Promise(r => setTimeout(r, 600));
      setProgress(stage.p);
      setStatusText(stage.msg);
    }

    // Video sample results pool
    const sampleVideos = [
      {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumb: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1000&auto=format&fit=crop&q=80'
      },
      {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumb: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1000&auto=format&fit=crop&q=80'
      },
      {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
        thumb: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1000&auto=format&fit=crop&q=80'
      }
    ];

    const pick = sampleVideos[Math.floor(Math.random() * sampleVideos.length)];

    const result = {
      videoUrl: pick.url,
      thumbnailUrl: pick.thumb,
      prompt: prompt.trim()
    };

    setGeneratedResult(result);
    setIsGenerating(false);

    // Add to generation history
    await addGeneration({
      userId: currentUser.id,
      prompt: prompt.trim(),
      model,
      aspectRatio,
      duration,
      thumbnailUrl: pick.thumb,
      videoUrl: pick.url,
      creditsCost: creditCost,
      status: 'completed',
      style
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-lg select-none overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white my-auto flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-white">
                Flow Video Creation Studio
              </h2>
              <p className="text-[11px] text-neutral-400">Powered by Nano Banana 2 &amp; Flow Ultra Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-full text-xs font-mono">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>{currentUser.credits.toLocaleString()} Credits available</span>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Body Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-4">
            {/* Prompt input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-purple-400" />
                  <span>Prompt Description</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPrompt(SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)])}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
                >
                  Inspire Me
                </button>
              </div>
              <textarea
                rows={3}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe your scene in detail (e.g., lighting, action, mood, camera movement)..."
                className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-2xl text-white text-xs sm:text-sm placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors leading-relaxed"
              />
            </div>

            {/* AI Model selection */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                AI Generation Model
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Nano Banana 2', label: 'Nano Banana 2', tag: 'New' },
                  { id: 'Flow Ultra HD', label: 'Flow Ultra HD', tag: 'Pro' },
                  { id: 'Sora Motion v2', label: 'Sora-Flow v2', tag: 'Fast' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setModel(item.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      model === item.id
                        ? 'bg-purple-950/60 border-purple-500 text-white font-semibold'
                        : 'bg-[#0b0c0f] border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{item.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                        {item.tag}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio and Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-[#0b0c0f] p-1 rounded-xl border border-neutral-800">
                  {(['16:9', '9:16', '1:1'] as const).map(ratio => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                        aspectRatio === ratio
                          ? 'bg-neutral-800 text-white font-semibold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Duration &amp; FPS
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-[#0b0c0f] p-1 rounded-xl border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setDuration(5)}
                    className={`py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                      duration === 5
                        ? 'bg-neutral-800 text-white font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    5s (10 cr)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration(10)}
                    className={`py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                      duration === 10
                        ? 'bg-neutral-800 text-white font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    10s (20 cr)
                  </button>
                </div>
              </div>
            </div>

            {/* Style Preset */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Visual Art Style
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['Photorealistic 8K', 'Cinematic Anamorphic', 'Claymation Stop-Motion', 'Anime Cyberpunk', 'Vintage 35mm Film'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      style === s
                        ? 'bg-purple-600 text-white font-medium shadow-sm'
                        : 'bg-[#0b0c0f] border border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 bg-red-950/70 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Generate Action Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleStartGeneration}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-sm font-semibold rounded-2xl shadow-xl shadow-purple-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Synthesizing Video ({progress}%)...</span>
                  </div>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Video with {model} ({creditCost} Credits)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview / Output Column */}
          <div className="lg:col-span-5 flex flex-col">
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Live Render Preview
            </label>

            <div className="w-full flex-1 min-h-[260px] bg-[#0b0c0f] border border-neutral-800 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center p-4">
              {isGenerating ? (
                <div className="text-center p-6 space-y-4 max-w-xs">
                  <div className="w-14 h-14 mx-auto rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 animate-pulse">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white font-display">Rendering Scene</h4>
                    <p className="text-[11px] text-neutral-400 mt-1 min-h-[30px]">{statusText}</p>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : generatedResult ? (
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="relative rounded-xl overflow-hidden bg-black flex-1 max-h-[260px]">
                    <video
                      src={generatedResult.videoUrl}
                      controls
                      autoPlay
                      loop
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Generation Complete!
                    </span>
                    <a
                      href={generatedResult.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Video</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 text-neutral-500 space-y-2">
                  <Video className="w-10 h-10 mx-auto text-neutral-700" />
                  <p className="text-xs font-medium">Ready to create</p>
                  <p className="text-[11px] text-neutral-600 max-w-xs">
                    Configure your prompt &amp; settings on the left, then click Generate Video.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
