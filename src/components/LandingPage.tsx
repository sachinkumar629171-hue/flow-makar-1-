import React from 'react';
import { Twitter, Instagram, MessageSquare, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onOpenPricing?: () => void;
  onOpenResellerLogin?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth, onOpenPricing }) => {
  return (
    <div className="relative min-h-screen w-full bg-[#08090b] text-white overflow-hidden select-none flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="relative z-30 flex items-center justify-between px-6 sm:px-10 py-6">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onOpenAuth('login')}>
          <span className="text-xl sm:text-2xl font-black tracking-tight font-display text-white">
            Flow
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Twitter"
            className="text-neutral-400 hover:text-white transition-colors duration-200"
          >
            <Twitter className="w-4 h-4 sm:w-5 sm:h-5" />
          </a>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="text-neutral-400 hover:text-white transition-colors duration-200"
          >
            <Instagram className="w-4 h-4 sm:w-5 sm:h-5" />
          </a>
          <button
            onClick={() => onOpenPricing ? onOpenPricing() : onOpenAuth('login')}
            aria-label="View Pricing"
            className="text-neutral-400 hover:text-white transition-colors duration-200 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            id="landing-signin-btn"
            onClick={() => onOpenAuth('login')}
            className="text-sm font-semibold text-neutral-200 hover:text-white transition-colors px-3.5 py-1.5 rounded-full hover:bg-white/10 cursor-pointer border border-neutral-700/50"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* Dynamic Floating Media Grid Background (Visual Match to Screenshot 1) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center">
        {/* Dark Vignette Overlay */}
        <div className="absolute inset-0 bg-radial from-transparent via-[#08090b]/60 to-[#08090b] z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090b] via-transparent to-[#08090b]/80 z-10" />

        {/* Tilted cards grid */}
        <div className="w-[140%] max-w-[1900px] grid grid-cols-4 md:grid-cols-5 gap-4 sm:gap-6 transform -rotate-6 scale-105 opacity-85">
          {/* Column 1 */}
          <div className="flex flex-col gap-4 sm:gap-6 -translate-y-12">
            <div className="h-44 sm:h-64 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop&q=80"
                alt="Orchestra concert"
                className="w-full h-full object-cover brightness-75 hover:scale-105 transition-transform duration-700"
              />
            </div>
            <div className="h-60 sm:h-80 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80"
                alt="White Horse Sprinting"
                className="w-full h-full object-cover brightness-85"
              />
            </div>
            <div className="h-48 sm:h-64 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=600&auto=format&fit=crop&q=80"
                alt="Otter"
                className="w-full h-full object-cover brightness-75"
              />
            </div>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-4 sm:gap-6 translate-y-6">
            <div className="h-52 sm:h-72 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80"
                alt="Golden abstract glowing texture"
                className="w-full h-full object-cover brightness-75"
              />
            </div>
            <div className="h-64 sm:h-96 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/10 ring-1 ring-white/10">
              <img
                src="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80"
                alt="Skeleton with sunglasses"
                className="w-full h-full object-cover brightness-95"
              />
            </div>
            <div className="h-48 sm:h-64 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80"
                alt="Rock concert fisheye crowd"
                className="w-full h-full object-cover brightness-75"
              />
            </div>
          </div>

          {/* Column 3 - Center */}
          <div className="flex flex-col gap-4 sm:gap-6 -translate-y-6">
            <div className="h-64 sm:h-96 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/10">
              <img
                src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80"
                alt="Chef cat baker"
                className="w-full h-full object-cover brightness-90"
              />
            </div>
            <div className="h-52 sm:h-72 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&auto=format&fit=crop&q=80"
                alt="Surgeons in theater"
                className="w-full h-full object-cover brightness-80"
              />
            </div>
          </div>

          {/* Column 4 */}
          <div className="flex flex-col gap-4 sm:gap-6 translate-y-10">
            <div className="h-60 sm:h-80 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=600&auto=format&fit=crop&q=80"
                alt="Otter waving hand"
                className="w-full h-full object-cover brightness-90"
              />
            </div>
            <div className="h-48 sm:h-64 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80"
                alt="Sandcastle Builder"
                className="w-full h-full object-cover brightness-75"
              />
            </div>
            <div className="h-52 sm:h-72 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&auto=format&fit=crop&q=80"
                alt="Clay monster toy"
                className="w-full h-full object-cover brightness-85"
              />
            </div>
          </div>

          {/* Column 5 */}
          <div className="hidden md:flex flex-col gap-4 sm:gap-6 -translate-y-8">
            <div className="h-56 sm:h-72 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80"
                alt="Arabian horse mane"
                className="w-full h-full object-cover brightness-75"
              />
            </div>
            <div className="h-64 sm:h-96 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80"
                alt="Artistic kitchen portrait"
                className="w-full h-full object-cover brightness-75"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Center Hero Section */}
      <main className="relative z-20 flex flex-col items-center justify-center text-center px-4 py-20 sm:py-28 my-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex flex-col items-center max-w-4xl mx-auto"
        >
          {/* Big Bold "Flow" Text */}
          <h1 className="text-7xl sm:text-9xl md:text-[130px] font-extrabold tracking-tight text-white font-display leading-none mb-4 drop-shadow-2xl">
            Flow
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-neutral-300 font-normal tracking-wide max-w-xl mx-auto mb-8 drop-shadow-md">
            Where the next wave of storytelling happens
          </p>

          {/* "Create with Flow" Pill CTA Button */}
          <motion.button
            id="create-with-flow-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onOpenAuth('login')}
            className="px-8 py-3.5 sm:px-9 sm:py-4 bg-white text-black text-sm sm:text-base font-semibold rounded-full shadow-[0_0_35px_rgba(255,255,255,0.3)] hover:shadow-[0_0_45px_rgba(255,255,255,0.5)] hover:bg-neutral-100 transition-all duration-200 cursor-pointer"
          >
            Create with Flow
          </motion.button>
        </motion.div>
      </main>

      {/* Subtle Bottom Scroll / Down Indicator */}
      <footer className="relative z-20 pb-8 flex flex-col items-center justify-center">
        <button
          onClick={() => onOpenAuth('login')}
          className="text-neutral-400 hover:text-white transition-colors flex flex-col items-center gap-1 cursor-pointer animate-bounce"
          aria-label="Scroll down or explore"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
};
