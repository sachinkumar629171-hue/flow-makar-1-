import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Play, 
  Send, 
  Wand2, 
  Terminal, 
  Zap, 
  RotateCcw,
  Film,
  Layers,
  Cpu,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';

interface ChatGPTSuiteProps {
  onOpenVideoStudioWithPrompt: (prompt: string) => void;
}

interface PromptPreset {
  title: string;
  category: string;
  prompt: string;
  description: string;
}

const PROMPT_PRESETS: PromptPreset[] = [
  {
    title: 'Cinematic Cyberpunk Rain Drive',
    category: 'Cinematic',
    prompt: 'Hyper-realistic 8K cinematic shot, glossy futuristic supercar drifting through neon-lit rainy Tokyo alleyway, glowing purple and teal reflections in asphalt puddles, anamorphic lens flare, motion blur, 60fps.',
    description: 'Perfect for Flow Nano Banana 2 high-contrast vehicle movement.',
  },
  {
    title: 'Iridescent Sapphire Phoenix',
    category: 'Fantasy & Animals',
    prompt: 'A majestic mythical phoenix with glowing sapphire and gold feathers perched upon an ancient obsidian spire, spreading wings with soft ember particles swirling in wind, slow motion 4K.',
    description: 'Detailed feathers with volumetric lighting and particle physics.',
  },
  {
    title: 'Viral TikTok 3D Claymation Chef',
    category: 'Animation',
    prompt: 'Charming stop-motion clay kitten wearing a tiny chef hat, rolling fresh pastry dough on a wooden kitchen table, miniature warm pastel dollhouse bakery, high detail, smooth 24fps claymation.',
    description: 'Cute, high retention animation format for TikTok and YouTube Shorts.',
  },
  {
    title: 'Underwater Bioluminescent Trench',
    category: 'Nature & Macro',
    prompt: 'Macro documentary shot of rare transparent jellyfish floating in deep dark ocean trench, pulsing with electric neon bioluminescence, tiny drifting plankton, national geographic style, ultra crisp focus.',
    description: 'High dynamic range dark-mode video with glowing neon tones.',
  },
  {
    title: 'Vintage 1970s Hollywood 35mm',
    category: 'Retro Film',
    prompt: 'Vintage 1970s Panavision 35mm film aesthetic, golden hour sunlight hitting the coastline highway, classic convertible cruising along Big Sur cliffs, authentic film grain, warm nostalgic tones.',
    description: 'Nostalgic color palette with natural depth of field.',
  },
];

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  suggestedPrompt?: string;
  timestamp: string;
}

export const ChatGPTSuite: React.FC<ChatGPTSuiteProps> = ({ onOpenVideoStudioWithPrompt }) => {
  const { currentUser } = useAuth();
  const [selectedModel, setSelectedModel] = useState<'gpt-4o' | 'o3-mini' | 'o1-preview' | 'gpt-4.5'>('gpt-4o');
  const [inputMessage, setInputMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Hello ${currentUser?.name || 'Creator'}! I am your OpenAI Video Prompt Assistant. I optimize high-converting, photorealistic video prompts specifically engineered for Flow's Nano Banana 2 model. Click any preset or ask me to craft a custom cinematic video scene.`,
      timestamp: 'Just now',
    },
  ]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputMessage('');
    setIsGenerating(true);

    // Simulate ChatGPT prompt engineering response
    setTimeout(() => {
      const generatedVideoPrompt = `Photorealistic 8K masterpiece: ${textToSend.replace(/^(create|generate|write|make)\s+/i, '')}, shot on RED V-Raptor 8K, 35mm anamorphic lens, volumetric rim lighting, cinematic color grading, smooth temporal consistency, high dynamic range.`;

      const botReply: ChatMessage = {
        id: `b-${Date.now()}`,
        sender: 'assistant',
        text: `Here is your optimized Flow Nano Banana 2 prompt based on "${textToSend}". It includes camera trajectory, atmospheric lighting, and lens specifications for maximum visual fidelity:`,
        suggestedPrompt: generatedVideoPrompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botReply]);
      setIsGenerating(false);
    }, 750);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c131a] via-[#0e1724] to-[#080d14] border border-teal-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/80 border border-teal-700/60 text-teal-300 text-xs font-semibold">
              <Bot className="w-3.5 h-3.5 text-teal-400" />
              <span>ChatGPT 4o & OpenAI Reasoning Integration</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
              OpenAI ChatGPT Prompt Studio
            </h1>
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              Generate elite video prompts, script storyboards, and camera instructions powered by OpenAI models. Send generated prompts directly to Flow Video Studio with one click.
            </p>
          </div>

          {/* Quick Actions & Official Link */}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://chatgpt.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-teal-500/60"
            >
              <span>Open ChatGPT Web</span>
              <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
            </a>
            <button
              onClick={() => handleCopy(currentUser?.sessionToken || 'FLOW-SESSION-ACTIVE', 'token-btn')}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-teal-600/30"
            >
              {copiedId === 'token-btn' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'token-btn' ? 'Token Copied!' : 'Copy Extension Token'}</span>
            </button>
          </div>
        </div>

        {/* Model Switcher Tabs */}
        <div className="mt-6 pt-5 border-t border-teal-900/40 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-400 font-medium mr-2 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-teal-400" />
            Model:
          </span>
          {[
            { id: 'gpt-4o', label: 'GPT-4o (Omni)', tag: 'Fast & Creative' },
            { id: 'o3-mini', label: 'o3-mini', tag: 'Deep Reasoning' },
            { id: 'o1-preview', label: 'o1-preview', tag: 'Complex Logic' },
            { id: 'gpt-4.5', label: 'GPT-4.5 Ultra', tag: 'Max Depth' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedModel === m.id
                  ? 'bg-teal-500 text-neutral-950 shadow-md font-bold'
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

      {/* Main Grid: Prompt Presets + Live Chat Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Flow Optimized Prompt Presets */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-2xl bg-[#0e1017] border border-neutral-800/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Flow-Optimized Presets
                </h3>
              </div>
              <span className="text-[11px] text-neutral-400">Click to test</span>
            </div>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              Curated prompt templates crafted to maximize cinematic camera angles and temporal fidelity in Flow Nano Banana 2.
            </p>

            <div className="space-y-2.5">
              {PROMPT_PRESETS.map((preset, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800/80 hover:border-teal-500/50 transition-all group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors">
                      {preset.title}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      {preset.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed mb-2.5">
                    "{preset.prompt}"
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800/50">
                    <button
                      onClick={() => handleSendMessage(`Enhance this video prompt for Flow Nano Banana 2: ${preset.prompt}`)}
                      className="text-[11px] text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Send to Chat</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(preset.prompt, `preset-${idx}`)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                        title="Copy prompt"
                      >
                        {copiedId === `preset-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onOpenVideoStudioWithPrompt(preset.prompt)}
                        className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
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

        {/* Right Column: Interactive ChatGPT Prompt Copilot */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl bg-[#0e1017] border border-neutral-800/80 overflow-hidden min-h-[520px]">
          {/* Chat Header */}
          <div className="p-4 bg-gradient-to-r from-neutral-900 to-[#12141c] border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-950 border border-teal-700/60 flex items-center justify-center text-teal-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  ChatGPT Prompt Engineer
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                </h2>
                <p className="text-[11px] text-neutral-400">Model: {selectedModel.toUpperCase()} · Latency ~120ms</p>
              </div>
            </div>

            <button
              onClick={() => {
                setMessages([
                  {
                    id: `reset-${Date.now()}`,
                    sender: 'assistant',
                    text: 'Chat cleared. Tell me your new video concept!',
                    timestamp: 'Now',
                  },
                ]);
              }}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[460px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-teal-600 text-white rounded-tr-none'
                      : 'bg-neutral-900/90 text-neutral-200 border border-neutral-800 rounded-tl-none'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* If assistant generated a video prompt block */}
                  {msg.suggestedPrompt && (
                    <div className="mt-3 p-3 rounded-xl bg-black/60 border border-teal-500/30 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-teal-300 font-semibold">
                        <span className="flex items-center gap-1">
                          <Film className="w-3.5 h-3.5 text-teal-400" />
                          Ready for Flow Video Studio
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopy(msg.suggestedPrompt!, msg.id)}
                            className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            onClick={() => onOpenVideoStudioWithPrompt(msg.suggestedPrompt!)}
                            className="px-2.5 py-0.5 rounded bg-teal-500 hover:bg-teal-400 text-neutral-950 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                          >
                            <Play className="w-3 h-3 fill-neutral-950" />
                            <span>Launch in Flow</span>
                          </button>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-neutral-300 select-all leading-normal bg-neutral-950/70 p-2 rounded-lg border border-neutral-800">
                        {msg.suggestedPrompt}
                      </p>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-neutral-400 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isGenerating && (
              <div className="flex items-center gap-2 text-xs text-teal-400 p-2">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                <span>ChatGPT is generating prompt tokens...</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 bg-[#0a0c10] border-t border-neutral-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Describe your scene concept (e.g. Neon sports car in desert at dusk)..."
                className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isGenerating}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-md shadow-teal-600/30"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Craft Prompt</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
