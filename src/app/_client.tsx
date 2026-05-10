'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import LandingPage from '@/sections/LandingPage';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap } from 'lucide-react';

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
    if (user) {
      router.push(user.isOnboarded ? '/dashboard' : '/onboarding');
    } else {
      router.push('/role-selection');
    }
  };

  return (
    <main className="relative min-h-screen bg-black">
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

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1.2, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            >
              <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-white tracking-tighter text-center uppercase drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                Welcome to <span className="text-gradient brightness-125">O3 Origin</span>
              </h1>
            </motion.div>
            
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
