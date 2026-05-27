"use client";

import { motion } from "framer-motion";
import { BookOpen, Sparkles, BrainCircuit } from "lucide-react";

export default function TeacherLoading() {
  return (
    <div className="relative min-h-screen w-full bg-background overflow-hidden">
      {/* 1. SKELETON BACKGROUND SYSTEM */}
      <div className="flex flex-col min-h-screen w-full select-none pointer-events-none opacity-40 dark:opacity-20 animate-pulse">
        {/* Header Skeleton */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3 bg-card">
          <div className="flex items-center gap-6">
            {/* Workspace Switcher Skeleton */}
            <div className="h-10 w-48 rounded-md bg-muted" />
            {/* Nav items skeletons */}
            <div className="hidden md:flex items-center gap-2">
              <div className="h-8 w-20 rounded-md bg-muted" />
              <div className="h-8 w-24 rounded-md bg-muted" />
              <div className="h-8 w-20 rounded-md bg-muted" />
              <div className="h-8 w-28 rounded-md bg-muted" />
              <div className="h-8 w-16 rounded-md bg-muted" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="h-10 w-24 rounded-full bg-muted" />
          </div>
        </header>

        {/* Main Content Skeleton */}
        <main className="flex-1 px-6 py-8 space-y-8 max-w-6xl mx-auto w-full">
          {/* WelcomeHeroPanel Skeleton */}
          <div className="h-32 rounded-3xl border bg-card p-6 flex justify-between items-center" />

          {/* Cards Grid Skeleton */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div className="h-32 rounded-2xl border bg-card p-6" />
            <div className="h-32 rounded-2xl border bg-card p-6" />
            <div className="h-32 rounded-2xl border bg-card p-6" />
          </div>

          {/* Bottom Grid Skeleton */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-2 h-64 rounded-2xl border bg-card p-6" />
            <div className="h-64 rounded-2xl border bg-card p-6" />
          </div>
        </main>
      </div>

      {/* 2. CENTERED PREMIUM PRELOADER */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[3px]">
        {/* Glow effect in the background */}
        <div className="absolute w-72 h-72 rounded-full bg-primary/10 blur-[100px] animate-pulse" />

        <div className="relative flex items-center justify-center w-40 h-40">
          {/* Outer Orbiting Rings */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border border-primary/30 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 border border-dashed border-primary/20 rounded-full"
          />

          {/* Orbiting Icons */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 flex justify-between items-center"
          >
            <BookOpen className="w-5 h-5 text-primary -translate-y-4" />
            <BrainCircuit className="w-5 h-5 text-primary translate-y-4" />
          </motion.div>

          {/* Center Logo Area */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <motion.img
              src="/origin-new.jpg"
              alt="ORIGIN Logo"
              className="w-16 h-16 rounded-xl border border-primary/30 shadow-lg object-cover bg-black"
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
          className="mt-6 text-sm font-bold tracking-widest text-primary uppercase animate-pulse"
        >
          Loading Teacher Workspace...
        </motion.p>
      </div>
    </div>
  );
}
