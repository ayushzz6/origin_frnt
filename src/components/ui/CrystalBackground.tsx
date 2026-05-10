'use client';
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export const CrystalBackground: React.FC = () => {
  const shards = useMemo(() => [
    {
      points: "0 0, 100 0, 100 100, 0 80",
      top: "-10%",
      left: "-5%",
      width: "60%",
      height: "70%",
      rotate: -15,
      blur: 20,
      opacity: 0.15,
      delay: 0,
    },
    {
      points: "0 20, 100 0, 80 100, 0 100",
      top: "10%",
      right: "-10%",
      width: "50%",
      height: "80%",
      rotate: 10,
      blur: 30,
      opacity: 0.2,
      delay: 0.2,
    },
    {
      points: "20 0, 100 30, 80 100, 0 70",
      bottom: "-15%",
      left: "15%",
      width: "70%",
      height: "60%",
      rotate: 5,
      blur: 25,
      opacity: 0.1,
      delay: 0.4,
    },
    {
      points: "0 0, 100 10, 90 90, 10 100",
      top: "20%",
      left: "20%",
      width: "40%",
      height: "40%",
      rotate: 45,
      blur: 40,
      opacity: 0.05,
      delay: 0.1,
    }
  ], []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-colors duration-1000">
      {/* Prism Diffraction Filter */}
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="prism-refraction">
            <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="60" xChannelSelector="R" yChannelSelector="G" />
            <feColorMatrix type="matrix" values="1.2 0 0 0 0 0 1 0 0 0 0 0 1.2 0 0 0 0 0 1 0" />
          </filter>
        </defs>
      </svg>

      {/* Crystalline Shards - Enhanced Visibility */}
      <div className="absolute inset-0 saturate-[1.5] brightness-[1.05]">
        {shards.map((shard, i) => (
          <motion.div
            key={i}
            className="absolute bg-white/50 dark:bg-white/10 border border-white/70 dark:border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.03)]"
            animate={{ 
              opacity: shard.opacity * 1.5, 
              scale: 1,
              x: [0, 15, 0],
              y: [0, -15, 0],
            }}
            transition={{ 
              duration: 10 + i * 2, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: shard.delay 
            }}
            style={{
              top: shard.top,
              left: shard.left,
              right: shard.right,
              bottom: shard.bottom,
              width: shard.width,
              height: shard.height,
              clipPath: `polygon(${shard.points})`,
              backdropFilter: `blur(${shard.blur}px) saturate(2.5)`,
              WebkitBackdropFilter: `blur(${shard.blur}px) saturate(2.5)`,
              transform: `rotate(${shard.rotate}deg)`,
            }}
          />
        ))}

        {/* Prism/Spectra Corner Decorations - Increased Intensity */}
        <div className="absolute top-[-5%] left-[-10%] w-[60%] h-[60%] opacity-30 dark:opacity-20 mix-blend-overlay rotate-[105deg] pointer-events-none">
          <div className="w-full h-full bg-gradient-to-tr from-rose-400 via-emerald-300 to-sky-400 blur-[130px]" />
        </div>
        <div className="absolute bottom-[0%] right-[-10%] w-[70%] h-[70%] opacity-40 dark:opacity-20 mix-blend-screen rotate-[-15deg] pointer-events-none">
          <div className="w-full h-full bg-gradient-to-tr from-amber-200 via-fuchsia-400 to-blue-500 blur-[160px]" />
        </div>
      </div>


      {/* Subtle Grain Overlay */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none mix-blend-overlay bg-[url('/noise.svg')]" />
    </div>
  );
};

export default CrystalBackground;
