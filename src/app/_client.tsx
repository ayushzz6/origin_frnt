'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import LandingPage from '@/sections/LandingPage';
import { AnimatePresence, motion } from 'framer-motion';

export default function HomeClient() {
  const { user } = useAuth();
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem('origin-intro-seen');
    if (!hasSeenIntro) {
      setShowIntro(true);
    }
  }, []);

  const finishIntro = () => {
    sessionStorage.setItem('origin-intro-seen', 'true');
    setShowIntro(false);
  };

  const handleGetStarted = () => {
    if (!user) {
      router.push('/role-selection');
      return;
    }
    // Route by role first; /dashboard is the student-only home.
    if (user.role === 'teacher') {
      router.push('/teacher');
      return;
    }
    if (user.role === 'admin') {
      router.push('/admin');
      return;
    }
    router.push(user.isOnboarded ? '/dashboard' : '/onboarding');
  };

  return (
    <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
      <AnimatePresence mode="wait">
        {showIntro ? (
          <motion.div
            key="intro"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black"
          >
            <video
              autoPlay
              muted
              playsInline
              onEnded={finishIntro}
              className="w-full h-full object-cover"
            >
              <source src="/videos/Intro%20Video.mp4" type="video/mp4" />
            </video>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="flex flex-col items-center gap-2 sm:gap-3 text-center px-6">
                <p className="text-pop-up-top text-[11px] sm:text-sm font-semibold tracking-[0.65em] uppercase text-white/40">
                  Welcome to
                </p>
                <h1 className="text-pop-up-top-delay text-5xl sm:text-7xl md:text-9xl font-black text-white tracking-tighter uppercase leading-none">
                  <span className="text-gradient brightness-125">O3 Origin</span>
                </h1>
              </div>
            </div>
            
            <button 
              onClick={finishIntro}
              className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/5 hover:bg-white/10 backdrop-blur-3xl border-t border-l border-white/10 rounded-full flex items-center justify-center transition-all duration-700 hover:scale-105 group z-[110]"
            >
              <div className="relative -top-4 -left-4 flex flex-col items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 group-hover:text-white transition-all duration-500">
                  Skip Intro
                </span>
                <div className="w-6 h-[1px] bg-white/10 group-hover:w-12 group-hover:bg-white/40 transition-all duration-500" />
              </div>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          >
            <LandingPage onGetStarted={handleGetStarted} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
