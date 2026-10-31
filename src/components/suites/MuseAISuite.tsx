import React, { useState } from 'react';
import { 
  Clapperboard, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Play, 
  Video, 
  Sliders, 
  Volume2, 
  Camera, 
  Palette, 
  Gauge, 
  Zap,
  Layers,
  Wand2,
  Film
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';

interface MuseAISuiteProps {
  onOpenVideoStudioWithPrompt: (prompt: string) => void;
}

interface CameraMotion {
  id: string;
  label: string;
  description: string;
  token: string;
}

const CAMERA_MOTIONS: CameraMotion[] = [
  { id: 'orbital', label: '360° Orbital Arc', description: 'Smooth cinematic camera circling around subject', token: 'continuous 360-degree orbital camera rotation around subject, maintaining sharp focal center' },
  { id: 'fpv-drone', label: 'FPV Drone Dive', description: 'High-speed dynamic dive through scenery', token: 'fast-paced FPV drone dive angling downward with kinetic motion blur and wide-angle perspective' },
  { id: 'dolly-zoom', label: 'Dolly Zoom (Vertigo)', description: 'Simultaneous zoom-in with camera pullback', token: 'vertigo dolly zoom effect, background compressing while subject remains locked in perspective' },
  { id: 'pan-track', label: 'Lateral Tracking Pan', description: 'Smooth sideways tracking shot keeping pace', token: 'smooth mechanical lateral tracking shot moving parallel to the motion trajectory at steady velocity' },
  { id: 'push-in', label: 'Slow Push-In Focus', description: 'Dramatic slow advance toward key detail', token: 'slow deliberate camera push-in establishing intimate emotional focus with shallow depth of field' },
  { id: 'handheld', label: 'Organic Handheld', description: 'Subtle realistic human camera micro-shake', token: 'natural handheld camera movement with subtle organic micro-jitter for documentary realism' },
];

const STYLES = [
  { id: 'cinema-8k', label: 'Photorealistic 8K', token: 'hyper-realistic 8K photorealism, Panavision 70mm lens, natural volumetric lighting' },
  { id: 'unreal-5', label: 'Unreal Engine 5.4', token: 'Unreal Engine 5.4 lumen global illumination, nanite ray-traced reflections, clean render' },
  { id: 'anime-ghibli', label: 'Anime & Ghibli', token: 'Studio Ghibli aesthetic, hand-painted watercolor backgrounds, vibrant pastel hues, lush animation' },
  { id: 'cyber-noir', label: 'Cyberpunk Neon Noir', token: 'cyberpunk neon noir, wet reflective streets, cyan and magenta rim light, heavy atmosphere' },
  { id: 'imax-film', label: '70mm IMAX Kodak', token: 'shot on 70mm IMAX Kodak Vision3 film stock, authentic cinematic grain, rich analog dynamic range' },
];

const AUDIO_TRACKS = [
  { id: 'ambient-drone', label: 'Atmospheric Sub-Bass & Drone', mood: 'Deep & Immersive' },
  { id: 'action-whoosh', label: 'Kinetic Whooshes & Impacts', mood: 'High Energy' },
  { id: 'nature-wind', label: 'Binaural Wind & Environment', mood: 'Peaceful Nature' },
  { id: 'cyber-synth', label: 'Analog Synthesizer Arpeggio', mood: 'Futuristic Sci-Fi' },
];

export const MuseAISuite: React.FC<MuseAISuiteProps> = ({ onOpenVideoStudioWithPrompt }) => {
  const { currentUser } = useAuth();
  const [userSubject, setUserSubject] = useState('Ancient stone temple discovered deep inside a bioluminescent cavern');
  const [selectedMotion, setSelectedMotion] = useState<string>('orbital');
  const [selectedStyle, setSelectedStyle] = useState<string>('cinema-8k');
  const [selectedAudio, setSelectedAudio] = useState<string>('ambient-drone');
  const [motionSpeed, setMotionSpeed] = useState<number>(7);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeMotionObj = CAMERA_MOTIONS.find((m) => m.id === selectedMotion) || CAMERA_MOTIONS[0];
  const activeStyleObj = STYLES.find((s) => s.id === selectedStyle) || STYLES[0];
  const activeAudioObj = AUDIO_TRACKS.find((a) => a.id === selectedAudio) || AUDIO_TRACKS[0];

  // Synthesize full Muse AI prompt
  const synthesizedPrompt = `${userSubject.trim() || 'Cinematic sequence'}, ${activeMotionObj.token}, ${activeStyleObj.token}, camera velocity index ${motionSpeed}/10, sound design: ${activeAudioObj.label}, master grade temporal stability 60fps.`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#120a1f] via-[#10081d] to-[#07050d] border border-purple-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-700/60 text-purple-300 text-xs font-semibold">
              <Clapperboard className="w-3.5 h-3.5 text-purple-400" />
              <span>Muse AI Video Motion & Sound FX Engine</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
              Muse AI Next-Gen Studio
            </h1>
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              Design complex multi-axis camera choreography, curated cinematic shaders, and synced sound layers. Directly feed compiled motion prompts into Flow Nano Banana 2.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://muse.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-purple-500/60"
            >
              <span>Open Muse.ai Official</span>
              <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
            </a>
            <button
              onClick={() => handleCopy(currentUser?.sessionToken || 'FLOW-SESSION-ACTIVE', 'muse-token')}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/30"
            >
              {copiedId === 'muse-token' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'muse-token' ? 'Token Copied!' : 'Copy Muse Bridge Token'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Motion & Style Directors */}
        <div className="lg:col-span-6 space-y-6">
          {/* Scene Subject Input */}
          <div className="p-5 rounded-2xl bg-[#0f0b18] border border-neutral-800/80 space-y-3">
            <label className="text-xs font-bold text-white flex items-center gap-2">
              <Film className="w-3.5 h-3.5 text-purple-400" />
              <span>Scene Concept / Subject</span>
            </label>
            <textarea
              rows={3}
              value={userSubject}
              onChange={(e) => setUserSubject(e.target.value)}
              placeholder="Describe what is happening in the scene..."
              className="w-full bg-neutral-900/80 border border-neutral-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none resize-none transition-all"
            />
          </div>

          {/* Camera Motion Selector */}
          <div className="p-5 rounded-2xl bg-[#0f0b18] border border-neutral-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-purple-400" />
                <span>3D Camera Trajectory</span>
              </label>
              <span className="text-[10px] text-purple-400 font-mono">
                {activeMotionObj.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CAMERA_MOTIONS.map((motion) => {
                const isSelected = selectedMotion === motion.id;
                return (
                  <button
                    key={motion.id}
                    onClick={() => setSelectedMotion(motion.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-purple-950/80 border-purple-500/80 text-white shadow-md shadow-purple-950/50'
                        : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-900'
                    }`}
                  >
                    <span className="text-xs font-bold truncate block">
                      {motion.label}
                    </span>
                    <span className="text-[10px] text-neutral-400 truncate mt-1">
                      {motion.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Velocity Slider */}
            <div className="pt-2 space-y-1.5">
              <div className="flex justify-between text-[11px] text-neutral-400 font-medium">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-purple-400" />
                  Motion Velocity
                </span>
                <span className="text-purple-300 font-bold">{motionSpeed}/10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={motionSpeed}
                onChange={(e) => setMotionSpeed(Number(e.target.value))}
                className="w-full accent-purple-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Aesthetic Style */}
          <div className="p-5 rounded-2xl bg-[#0f0b18] border border-neutral-800/80 space-y-3">
            <label className="text-xs font-bold text-white flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-purple-400" />
              <span>Aesthetic Grading & Shader</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    selectedStyle === style.id
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                      : 'bg-neutral-900/70 border-neutral-800 text-neutral-300 hover:text-white'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Audio Layer & Compiled Muse Flow Prompt */}
        <div className="lg:col-span-6 space-y-6">
          {/* Audio Layer Generator */}
          <div className="p-5 rounded-2xl bg-[#0f0b18] border border-neutral-800/80 space-y-3">
            <label className="text-xs font-bold text-white flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Spatial Audio Soundscape</span>
            </label>
            <div className="space-y-2">
              {AUDIO_TRACKS.map((track) => (
                <div
                  key={track.id}
                  onClick={() => setSelectedAudio(track.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    selectedAudio === track.id
                      ? 'bg-purple-950/70 border-purple-500/70 text-white shadow-sm'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        selectedAudio === track.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{track.label}</p>
                      <p className="text-[10px] text-neutral-400">{track.mood}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      selectedAudio === track.id
                        ? 'bg-purple-900 text-purple-200'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {selectedAudio === track.id ? 'Selected' : 'Use'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Compiled Output Preview & Direct Flow Launcher */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#170e28] via-[#120b20] to-[#0c0816] border border-purple-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Compiled Muse Prompt for Flow
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(synthesizedPrompt, 'muse-compiled')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedId === 'muse-compiled' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedId === 'muse-compiled' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs sm:text-sm font-mono text-neutral-200 select-all leading-relaxed bg-black/60 p-3.5 rounded-xl border border-neutral-800/80">
              {synthesizedPrompt}
            </p>

            {/* Big Launch in Flow Button */}
            <motion.button
              onClick={() => onOpenVideoStudioWithPrompt(synthesizedPrompt)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30 cursor-pointer transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Launch in Flow Video Studio (Nano Banana 2)</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};
