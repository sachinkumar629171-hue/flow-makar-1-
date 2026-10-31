import React from 'react';
import { Lock } from 'lucide-react';
import { motion } from 'motion/react';

interface LockedFeatureViewProps {
  platformName: string;
  logo: React.ReactNode;
}

export const LockedFeatureView: React.FC<LockedFeatureViewProps> = ({
  platformName,
  logo,
}) => {
  return (
    <div className="flex-1 w-full min-h-[65vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-center justify-center text-center max-w-sm w-full p-8 rounded-3xl bg-gradient-to-b from-[#13151f] to-[#0c0d14] border border-neutral-800/80 shadow-[0_10px_40px_rgba(0,0,0,0.6)] space-y-6"
      >
        {/* Lock Icon + Logo Emblem */}
        <div className="relative">
          {/* Glowing background halo */}
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 rounded-full blur-xl pointer-events-none" />

          {/* Big Circular Lock Badge */}
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-b from-[#1c1f2e] to-[#12131c] border border-neutral-700/80 flex items-center justify-center shadow-xl">
            {/* Center Lock (Tala) */}
            <div className="w-12 h-12 rounded-2xl bg-neutral-900/90 border border-neutral-700/60 flex items-center justify-center shadow-inner">
              <Lock className="w-6 h-6 text-amber-400 stroke-[2.2]" />
            </div>

            {/* Corner Platform Logo Badge */}
            <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-[#0f1118] border border-neutral-700/80 flex items-center justify-center shadow-lg p-1.5">
              {logo}
            </div>
          </div>
        </div>

        {/* Platform Title & Lock Status */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide">
            <Lock className="w-3 h-3" />
            <span>Access Locked</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
            {platformName}
          </h2>
        </div>
      </motion.div>
    </div>
  );
};
