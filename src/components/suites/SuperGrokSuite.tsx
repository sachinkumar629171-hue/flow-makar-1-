import React, { useState } from 'react';
import { 
  Flame, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Play, 
  Terminal, 
  Zap, 
  Brain, 
  TrendingUp, 
  Radio, 
  Compass,
  Smile,
  Shield,
  Layers,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';

interface SuperGrokSuiteProps {
  onOpenVideoStudioWithPrompt: (prompt: string) => void;
}

interface TrendHook {
  topic: string;
  tag: string;
  engagement: string;
  prompt: string;
}

const X_TRENDS: TrendHook[] = [
  {
    topic: 'Liquid Chrome Zero Gravity',
    tag: '#VFXSimulation',
    engagement: '142k views',
    prompt: 'Zero-gravity macro sequence of liquid molten chrome coalescing into a floating reflective sphere, reflecting galaxies and neon nebula stars, extreme slow motion 120fps, cinematic 8K.',
  },
  {
    topic: 'Tokyo Rain FPV Drone Race',
    tag: '#CinematicDrone',
    engagement: '280k views',
    prompt: 'High-speed FPV drone dive through high-rise Shibuya skyscrapers at night during heavy neon rain, weaving between billboards and aerial trains, motion blur, dynamic camera shake, cinematic.',
  },
  {
    topic: 'Bioluminescent Amazonian Jaguar',
    tag: '#DarkFantasy',
    engagement: '95k views',
    prompt: 'Mystical black panther stalked through an ethereal bioluminescent jungle, turquoise glowing rosettes along its coat, mist clinging to lush ferns, volumetric moonbeams slicing through canopy.',
  },
  {
    topic: 'Cybernetic Samurai Duel at Sunset',
    tag: '#SciFiAction',
    engagement: '310k views',
    prompt: 'Two cybernetic samurai clashing radiant energy katanas upon a skyscraper rooftop against a crimson sunset, sparks showering in slow motion, holographic kanji advertisements flickering behind.',
  },
];

export const SuperGrokSuite: React.FC<SuperGrokSuiteProps> = ({ onOpenVideoStudioWithPrompt }) => {
  const { currentUser } = useAuth();
  const [selectedModel, setSelectedModel] = useState<'grok-3-think' | 'grok-2-vision' | 'super-grok-search'>('grok-3-think');
  const [personalityMode, setPersonalityMode] = useState<'fun' | 'normal'>('fun');
  const [conceptInput, setConceptInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [grokOutput, setGrokOutput] = useState<{
    reasoningSteps: string[];
    finalPrompt: string;
    humorNote?: string;
  } | null>({
    reasoningSteps: [
      'Grok 3 Think Mode active: Analyzing high-impact viral retention vectors.',
      'Calibrating camera focal length to 28mm for wide dramatic perspective.',
      'Balancing particle illumination against Flow Nano Banana 2 diffusion limits.',
    ],
    finalPrompt: 'Ultra-cinematic 8K drone shot, futuristic supersonic aircraft skimming over a turquoise glacier canyon, twin vapor trails glowing in sunset amber, photorealistic water mist, IMAX 70mm.',
    humorNote: 'Normal video prompts are boring. Grok crafted this with 10x more kinetic energy.',
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = (customTopic?: string) => {
    const topic = customTopic || conceptInput || 'Neon futuristic cityscape';
    setIsThinking(true);
    setGrokOutput(null);

    setTimeout(() => {
      const isFun = personalityMode === 'fun';
      const steps = [
        `Grok Reasoning: Ingesting topic "${topic}" with ${selectedModel.toUpperCase()}.`,
        `Synthesizing cinematic composition: Dynamic 3D lighting, physics-accurate motion, and temporal coherence.`,
        `Optimizing parameters for Flow Nano Banana 2 rendering pipeline: High contrast ratio & anamorphic bokeh.`,
      ];

      const prompt = `${isFun ? 'Electrifying & audacious 8K cinematic shot' : 'Ultra-high-definition 8K documentary footage'}: ${topic}, captured on Arri Alexa 65, intense atmospheric fog, rim lighting from glowing cyan and magenta sources, seamless motion continuity, hyper-detailed textures.`;

      const humor = isFun
        ? `Grok Insight: If this doesn't stop thumbs from scrolling, nothing will. Render it in Flow immediately.`
        : `Grok Analysis: Prompt balanced for photorealism and spatial fidelity without temporal artifacting.`;

      setGrokOutput({
        reasoningSteps: steps,
        finalPrompt: prompt,
        humorNote: humor,
      });
      setIsThinking(false);
    }, 850);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#180a0f] via-[#140b15] to-[#09070c] border border-rose-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-700/60 text-rose-300 text-xs font-semibold">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Super Grok 3 · xAI DeepSearch & Think Engine</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
              Super Grok Intelligence Hub
            </h1>
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              Harness xAI's raw computational reasoning, DeepSearch real-time trends, and bold visual prompts tailored directly for Flow Video creation.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://grok.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-rose-500/60"
            >
              <span>Open Grok Official</span>
              <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
            </a>
            <button
              onClick={() => handleCopy(currentUser?.sessionToken || 'FLOW-SESSION-ACTIVE', 'grok-token')}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-600/30"
            >
              {copiedId === 'grok-token' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'grok-token' ? 'Token Copied!' : 'Copy Grok Bridge Token'}</span>
            </button>
          </div>
        </div>

        {/* Engine Modes & Personality Toggle */}
        <div className="mt-6 pt-5 border-t border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium mr-1 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-rose-400" />
              Engine:
            </span>
            {[
              { id: 'grok-3-think', label: 'Grok 3 (Think Mode)', badge: 'Reasoning' },
              { id: 'grok-2-vision', label: 'Grok 2 (Vision)', badge: 'Visuals' },
              { id: 'super-grok-search', label: 'Super Grok DeepSearch', badge: 'Live Trends' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedModel === m.id
                    ? 'bg-rose-500 text-neutral-950 shadow-md font-bold'
                    : 'bg-neutral-900/70 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                <span>{m.label}</span>
                <span className={`text-[10px] px-1 rounded ${selectedModel === m.id ? 'bg-black/20 text-neutral-950' : 'bg-neutral-800 text-neutral-400'}`}>
                  {m.badge}
                </span>
              </button>
            ))}
          </div>

          {/* Personality Mode: Fun vs Normal */}
          <div className="flex items-center gap-1.5 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800 self-start sm:self-auto">
            <button
              onClick={() => setPersonalityMode('fun')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                personalityMode === 'fun'
                  ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Fun Mode</span>
            </button>
            <button
              onClick={() => setPersonalityMode('normal')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                personalityMode === 'normal'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Normal Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Trend Radar + Grok Think Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Real-Time Viral Trend Radar */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-2xl bg-[#120e15] border border-neutral-800/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  xAI Live Trend Radar
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                Live Feed
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              Viral cinematic aesthetics trending right now across social video platforms. Tap any trend to feed it into Grok Think mode.
            </p>

            <div className="space-y-2.5">
              {X_TRENDS.map((trend, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800/80 hover:border-rose-500/50 transition-all group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors">
                      {trend.topic}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {trend.engagement}
                    </span>
                  </div>
                  <span className="text-[10px] text-rose-400 font-mono block mb-2">
                    {trend.tag}
                  </span>
                  <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed mb-2.5">
                    "{trend.prompt}"
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800/50">
                    <button
                      onClick={() => handleGenerate(trend.topic)}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Analyze with Grok</span>
                      <Brain className="w-3 h-3" />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(trend.prompt, `trend-${idx}`)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                        title="Copy prompt"
                      >
                        {copiedId === `trend-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onOpenVideoStudioWithPrompt(trend.prompt)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                        title="Use in Flow Video Studio"
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

        {/* Right Column: Grok Think Engine & Prompt Generator */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl bg-[#120e15] border border-neutral-800/80 overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-neutral-900 to-[#181119] border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-700/60 flex items-center justify-center text-rose-400">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Grok 3 Thinking Console
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                </h2>
                <p className="text-[11px] text-neutral-400">
                  Mode: {personalityMode.toUpperCase()} · Reasoner: DeepSearch Neural V3
                </p>
              </div>
            </div>

            <div className="text-[11px] text-neutral-400 font-mono">
              Tokens: Real-Time
            </div>
          </div>

          {/* Thinking Output Area */}
          <div className="flex-1 p-5 space-y-4 min-h-[380px]">
            {isThinking ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
                <div className="w-12 h-12 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                <p className="text-sm font-bold text-white">Grok 3 Think Mode Executing...</p>
                <p className="text-xs text-neutral-400 max-w-sm">
                  Calculating kinetic camera arcs, cinematic illumination vectors, and Flow diffusion weight balance.
                </p>
              </div>
            ) : grokOutput ? (
              <div className="space-y-4">
                {/* Reasoning Steps Accordion/Box */}
                <div className="p-3.5 rounded-xl bg-black/60 border border-rose-900/30 font-mono text-[11px] text-neutral-300 space-y-1.5">
                  <div className="text-rose-400 font-bold flex items-center gap-1.5 mb-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Thought Process:</span>
                  </div>
                  {grokOutput.reasoningSteps.map((step, sIdx) => (
                    <div key={sIdx} className="flex items-start gap-2 text-neutral-400">
                      <span className="text-rose-500">›</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                {/* Final Flow-Ready Prompt Card */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-900 via-[#161219] to-neutral-900 border border-rose-500/40 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                      Optimized Flow Nano Banana 2 Prompt
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(grokOutput.finalPrompt, 'final-grok-p')}
                        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedId === 'final-grok-p' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedId === 'final-grok-p' ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        onClick={() => onOpenVideoStudioWithPrompt(grokOutput.finalPrompt)}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-rose-600/30"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Launch in Flow</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-mono text-neutral-200 select-all leading-relaxed bg-black/50 p-3 rounded-lg border border-neutral-800/80">
                    {grokOutput.finalPrompt}
                  </p>

                  {grokOutput.humorNote && (
                    <p className="text-[11px] text-amber-300/80 italic font-medium flex items-center gap-1">
                      <span>⚡</span>
                      <span>{grokOutput.humorNote}</span>
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Interactive Input Form */}
          <div className="p-3.5 bg-[#0b080e] border-t border-neutral-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerate();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={conceptInput}
                onChange={(e) => setConceptInput(e.target.value)}
                placeholder="Give Grok any idea or scene concept (e.g. Cyber dragon over Manhattan)..."
                className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={isThinking}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md shadow-rose-600/30"
              >
                <Flame className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grok Think</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
