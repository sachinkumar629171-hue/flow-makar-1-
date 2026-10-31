import React, { useState } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Play, 
  Send, 
  Terminal, 
  Zap, 
  Cpu, 
  Layers, 
  Image as ImageIcon,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface MetaAISuiteProps {
  onOpenVideoStudioWithPrompt: (prompt: string) => void;
}

const META_PRESETS = [
  {
    title: 'Imagine Photorealistic Macro',
    model: 'Llama 3.3 70B',
    prompt: 'Macro cinematic shot of an iridescent crystal hummingbird sipping nectar from a glowing magenta orchid in a rainforest at dusk, high detail, 8K photorealistic.',
  },
  {
    title: 'Meta Cinematic Drone Reveal',
    model: 'Llama 3.3 70B',
    prompt: 'Wide-angle cinematic drone flyover of ancient futuristic ruins engulfed by bioluminescent vines and waterfalls, golden hour volumetric sunlight, 60fps.',
  },
  {
    title: 'Hyper-Realistic Cybernetic Portrait',
    model: 'Llama 3.1 405B',
    prompt: 'Hyper-detailed close-up portrait of a futuristic astronaut looking up at a spiraling neon supernova through their reflective gold helmet visor, cinematic lighting.',
  },
  {
    title: 'Surreal Liquid Nebula Motion',
    model: 'Llama 3.3 70B',
    prompt: 'Surreal flowing liquid clouds of purple and cyan nebula dust swirling in zero gravity, soft glow, high dynamic range, smooth motion, IMAX aesthetic.',
  },
];

export const MetaAISuite: React.FC<MetaAISuiteProps> = ({ onOpenVideoStudioWithPrompt }) => {
  const { currentUser } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<'llama-3.3' | 'llama-3.1-405b'>('llama-3.3');
  const [inputConcept, setInputConcept] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>(
    'Cinematic 8K masterpiece: Majestic snow leopard walking across an alpine ridge during a vibrant purple sunset, soft snow particles drifting in wind, Red V-Raptor lens, high dynamic range.'
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = (customTopic?: string) => {
    const topic = customTopic || inputConcept || 'Futuristic cybernetic city';
    setIsGenerating(true);
    setTimeout(() => {
      const result = `Imagine with Meta AI (Flow Optimized): ${topic}, shot on 70mm anamorphic lens, dramatic chiaroscuro illumination, hyper-realistic textures, seamless motion physics for Flow Nano Banana 2 diffusion, 60fps cinematic grade.`;
      setGeneratedPrompt(result);
      setIsGenerating(false);
    }, 700);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#12091e] via-[#0e0c1a] to-[#07050d] border border-fuchsia-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-950/80 border border-fuchsia-700/60 text-fuchsia-300 text-xs font-semibold">
              <img
                src="/assets/aistudio/image_0c8b35cc.png"
                alt="Meta AI"
                className="w-4 h-4 rounded-full object-contain"
              />
              <span>Meta AI · Llama 3.3 & Imagine Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
              Meta AI Prompt & Vision Studio
            </h1>
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              Powered by Meta's state-of-the-art Llama 3.3 neural architectures. Craft ultra-vivid scenes with high visual coherence engineered for Flow video synthesis.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://www.meta.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-fuchsia-500/60"
            >
              <span>Open Meta.ai Web</span>
              <ExternalLink className="w-3.5 h-3.5 text-fuchsia-400" />
            </a>
            <button
              onClick={() => handleCopy(currentUser?.sessionToken || 'FLOW-SESSION-ACTIVE', 'meta-token')}
              className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-fuchsia-600/30"
            >
              {copiedId === 'meta-token' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'meta-token' ? 'Token Copied!' : 'Copy Meta Bridge Token'}</span>
            </button>
          </div>
        </div>

        {/* Model Tabs */}
        <div className="mt-6 pt-5 border-t border-fuchsia-900/40 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-400 font-medium mr-2 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-fuchsia-400" />
            Llama Model:
          </span>
          {[
            { id: 'llama-3.3', label: 'Llama 3.3 70B', tag: 'Fast & Cinematic' },
            { id: 'llama-3.1-405b', label: 'Llama 3.1 405B Ultra', tag: 'Maximum Reasoning' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedModel === m.id
                  ? 'bg-fuchsia-500 text-neutral-950 shadow-md font-bold'
                  : 'bg-neutral-900/70 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              <span>{m.label}</span>
              <span className={`text-[10px] px-1 rounded ${selectedModel === m.id ? 'bg-black/20 text-neutral-950' : 'bg-neutral-800 text-neutral-400'}`}>
                {m.tag}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Presets & Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Meta AI Presets */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-2xl bg-[#0f0a17] border border-neutral-800/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Meta AI Video Presets
                </h3>
              </div>
              <span className="text-[11px] text-neutral-400">Tap to load</span>
            </div>

            <div className="space-y-2.5">
              {META_PRESETS.map((preset, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800/80 hover:border-fuchsia-500/50 transition-all group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-white group-hover:text-fuchsia-300 transition-colors">
                      {preset.title}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      {preset.model}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed mb-2.5">
                    "{preset.prompt}"
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800/50">
                    <button
                      onClick={() => handleGenerate(preset.title)}
                      className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Load in Studio</span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(preset.prompt, `meta-p-${idx}`)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                        title="Copy prompt"
                      >
                        {copiedId === `meta-p-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onOpenVideoStudioWithPrompt(preset.prompt)}
                        className="px-2.5 py-1 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                        title="Open in Flow Video Studio"
                      >
                        <Play className="w-2.5 h-2.5 fill-white" />
                        <span>Use in Flow</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Meta AI Imagine Output & Generator */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl bg-[#0f0a17] border border-neutral-800/80 overflow-hidden min-h-[460px]">
          <div className="p-4 bg-gradient-to-r from-neutral-900 to-[#170e22] border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/aistudio/image_0c8b35cc.png"
                alt="Meta AI"
                className="w-5 h-5 rounded-full object-contain"
              />
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Meta AI Imagine Studio
                </h2>
                <p className="text-[11px] text-neutral-400">Model: {selectedModel.toUpperCase()} · Meta AI Vision Engine</p>
              </div>
            </div>
          </div>

          {/* Output Display */}
          <div className="flex-1 p-5 space-y-4">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
                <div className="w-10 h-10 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
                <p className="text-sm font-bold text-white">Synthesizing with Meta AI...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-900 via-[#180f24] to-neutral-900 border border-fuchsia-500/40 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-fuchsia-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                      Compiled Meta AI Video Prompt
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(generatedPrompt, 'meta-gen-p')}
                        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedId === 'meta-gen-p' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedId === 'meta-gen-p' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-mono text-neutral-200 select-all leading-relaxed bg-black/60 p-3.5 rounded-xl border border-neutral-800/80">
                    {generatedPrompt}
                  </p>

                  <button
                    onClick={() => onOpenVideoStudioWithPrompt(generatedPrompt)}
                    className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-600/30 cursor-pointer transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Launch in Flow Video Studio (Nano Banana 2)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="p-3.5 bg-[#0a0710] border-t border-neutral-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerate();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputConcept}
                onChange={(e) => setInputConcept(e.target.value)}
                placeholder="Ask Meta AI to create any scene (e.g. Glowing bioluminescent waterfall at night)..."
                className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-fuchsia-500/80 focus:ring-1 focus:ring-fuchsia-500/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={isGenerating}
                className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md shadow-fuchsia-600/30"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Imagine</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
