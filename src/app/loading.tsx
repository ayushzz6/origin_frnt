"use client";

import { motion } from "framer-motion";
import { BookOpen, Sparkles, BrainCircuit } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
      {/* Glow effect in the background */}
      <div className="absolute w-72 h-72 rounded-full bg-primary/10 blur-[100px] animate-pulse" />

      <div className="relative flex items-center justify-center w-40 h-40">
        {/* Outer Orbiting Books/AI rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border border-primary/20 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute inset-4 border border-dashed border-primary/10 rounded-full"
        />

        {/* Orbiting Icons */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 flex justify-between items-center"
        >
          <BookOpen className="w-5 h-5 text-primary/80 -translate-y-4" />
          <BrainCircuit className="w-5 h-5 text-primary/80 translate-y-4" />
        </motion.div>

        {/* Center Logo Area */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <motion.img
            src="/O3-Origin-Logo.png"
            alt="ORIGIN Logo"
            className="w-16 h-16 rounded-xl border border-primary/30 shadow-lg object-contain bg-black"
            animate={{ 
              scale: [1, 1.05, 1],
              rotateY: [0, 180, 360]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
        </div>

        {/* Sparkling particles */}
        <Sparkles className="absolute top-2 right-2 w-4 h-4 text-primary animate-pulse" />
      </div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 text-sm font-semibold tracking-widest text-primary uppercase animate-pulse"
      >
        Initializing AI Workspace...
      </motion.p>
    </div>
  );
}
