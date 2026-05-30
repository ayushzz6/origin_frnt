'use client';
import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import CrystalBackground from '@/components/ui/CrystalBackground';
import { Card } from '@/components/ui/CardSwap';
import EvilEye from '@/components/EvilEye';

// Heavy graphics libs (three, gsap) — split into their own chunks
const FloatingLines = dynamic(() => import('@/components/ui/FloatingLines'), { ssr: false });
const CardSwap = dynamic(() => import('@/components/ui/CardSwap'), { ssr: false });
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  BarChart3,
  Users,
  Clock,
  Trophy,
  Zap,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Sun,
  Moon,
  Crown
} from 'lucide-react';
import { getRegistrationStatusAction } from '@/server/actions/system-actions';

const PhaseStartIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="16" cy="7" r="2" />
    <path d="M14 9 L10 11 L7 16 L9 20" />
    <path d="M10 11 L14 15 L17 14" />
    <path d="M14 9 L17 12" />
    <path d="M4 20 L20 20" />
  </svg>
);

const PhaseRunIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13" cy="6" r="2" />
    <path d="M13 8 L12 13 L9 17L6 17" />
    <path d="M12 13 L15 16 L15 21" />
    <path d="M13 8 L10 11 L8 10" />
    <path d="M13 8 L16 9 L18 7" />
  </svg>
);

const PhaseSprintIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="15" cy="6" r="2" />
    <path d="M14 8 L11 13 L8 15 L5 14" />
    <path d="M11 13 L15 16 L13 21" />
    <path d="M14 8 L11 11 L8 10" />
    <path d="M14 8 L17 9 L20 7" />
    <path d="M2 10 L6 10" />
    <path d="M1 14 L4 14" />
    <path d="M3 18 L7 18" />
  </svg>
);

const PhaseAchieveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7 L12 14" />
    <path d="M12 7 L9 10" />
    <path d="M12 7 L15 10" />
    <path d="M12 14 L9 19 L7 21" />
    <path d="M12 14 L15 19 L17 21" />
    <path d="M4 14 L20 14" strokeDasharray="3 3" />
  </svg>
);

const AnimatedCounter = ({ from, to, duration, inView }: { from: number; to: number; duration: number; inView: boolean }) => {
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!inView) return;
    let startTime: number | null = null;
    let animationFrame: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * (to - from) + from));
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [from, to, duration, inView]);
  return <>{count}</>;
};

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [regStatus, setRegStatus] = useState<{ count: number; limit: number; seatsLeft: number } | null>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const isCounterInView = useInView(counterRef, { once: true, amount: 0.5 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showStickyCTA, setShowStickyCTA] = useState(false);

  const handleBeginJourney = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (actualTheme === 'dark') {
      setIsTransitioning(true);
      if (videoRef.current) {
        videoRef.current.loop = false;
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch((err) => console.log('Video play failed:', err));
      }
      setTimeout(() => {
        onGetStarted();
      }, 800);
    } else {
      onGetStarted();
    }
  };


  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', isPremium: false },
    { name: 'OGCode', path: '/ogcode', isPremium: false },
    { name: 'AI Explainer', path: '/doubt-solver', isPremium: false },
    { name: 'Study Rooms', path: '/study-rooms', isPremium: false },
    { name: 'Tests', path: '/tests', isPremium: false },
  ];

  const handleNavLinkClick = (e: React.MouseEvent, path: string, isPremiumLink: boolean) => {
    e.preventDefault();
    if (!user) {
      router.push('/role-selection');
      return;
    }
    if (user.role === 'teacher') {
      router.push('/teacher');
      return;
    }
    if (user.role === 'admin') {
      router.push('/admin');
      return;
    }
    router.push(path);
  };

  useEffect(() => {
    const fetchRegStatus = async () => {
      const status = await getRegistrationStatusAction();
      setRegStatus(status);
    };
    fetchRegStatus();
  }, []);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => {
      // Show sticky CTA once scrolled past hero section (~400px)
      setShowStickyCTA(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const actualTheme = mounted ? resolvedTheme : (theme === 'system' ? 'dark' : theme);

  const { scrollYProgress } = useScroll({
    target: howItWorksRef,
    offset: ["start center", "end center"]
  });
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // Transform for each step (unchanged logic, just nicer visual)
  const step1Scale = useTransform(scrollYProgress, [0, 0.25], [1, 1.2]);
  const step1Opacity = useTransform(scrollYProgress, [0, 0.25], [0.5, 1]);
  const step1Border = useTransform(scrollYProgress, [0, 0.25], ["rgba(226, 232, 240, 0.5)", "rgba(244, 63, 94, 1)"]);
  const step1Glow = useTransform(scrollYProgress, [0, 0.25], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(244, 63, 94, 0.3)"]);
  const step2Scale = useTransform(scrollYProgress, [0.25, 0.5], [1, 1.2]);
  const step2Opacity = useTransform(scrollYProgress, [0.25, 0.5], [0.5, 1]);
  const step2Border = useTransform(scrollYProgress, [0.25, 0.5], ["rgba(226, 232, 240, 0.5)", "rgba(225, 29, 72, 1)"]);
  const step2Glow = useTransform(scrollYProgress, [0.25, 0.5], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(225, 29, 72, 0.3)"]);
  const step3Scale = useTransform(scrollYProgress, [0.5, 0.75], [1, 1.2]);
  const step3Opacity = useTransform(scrollYProgress, [0.5, 0.75], [0.5, 1]);
  const step3Border = useTransform(scrollYProgress, [0.5, 0.75], ["rgba(226, 232, 240, 0.5)", "rgba(190, 18, 60, 1)"]);
  const step3Glow = useTransform(scrollYProgress, [0.5, 0.75], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(190, 18, 60, 0.3)"]);
  const step4Scale = useTransform(scrollYProgress, [0.75, 1], [1, 1.2]);
  const step4Opacity = useTransform(scrollYProgress, [0.75, 1], [0.5, 1]);
  const step4Border = useTransform(scrollYProgress, [0.75, 1], ["rgba(203, 213, 225, 0.5)", "rgba(159, 18, 57, 1)"]);
  const step4Glow = useTransform(scrollYProgress, [0.75, 1], ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 30px rgba(159, 18, 57, 0.3)"]);

  const features = [
    {
      icon: MessageCircle,
      title: 'Instant Doubt Resolution',
      description: 'Stuck at 2 AM? Get detailed, step-by-step solutions instantly. No waiting, just learning.',
      video: '/videos/Instant-Doubt-Resolution.mp4'
    },
    {
      icon: BarChart3,
      title: 'Predictive Analytics',
      description: 'Know where you stand before the exam. Track mastery and predict your AIR with 95% accuracy.',
      video: '/videos/Predictive-Analytics.mp4'
    },
    {
      icon: Users,
      title: 'IITian Mentorship',
      description: 'Direct guidance from those who have cracked it. Strategies, tips, and motivation from top rankers.',
      video: '/videos/IITian-Mentorship-2.mp4'
    },
    {
      icon: Clock,
      title: 'Pomodoro Focus',
      description: 'Built-in productivity tools. Study smarter with scientifically proven focus timers and break intervals.',
      video: '/videos/Pomodoro-Focus.mp4'
    },
    {
      icon: Trophy,
      title: 'Gamified Growth',
      description: 'Make preparation addictive. Earn streaks, unlock badges, and climb the leaderboard daily.',
      video: '/videos/Gamified-Growth.mp4'
    },
    {
      icon: () => <img src="/ai-bot.png" alt="AI" className="w-8 h-8 object-cover rounded-lg" />,
      title: 'Adaptive Intelligence',
      description: 'Tests that evolve with you. Our AI identifies your weak spots and adapts the difficulty in real-time.',
      video: '/videos/Adaptive-Intelligence.mp4'
    },
  ];

  const stats = [
    { value: 'No Guesswork', label: 'Data-Driven Learning' },
    { value: 'Only Precision', label: 'Targeted Practice' },
    { value: 'Built for Results', label: 'Proven Framework' },
  ];

  // Enhanced FeatureCard with nicer styling, borders, hover effects
  const FeatureCard = ({ feature }: { feature: typeof features[0] }) => (
    <div className="group relative bg-card/80 dark:bg-card/85 backdrop-blur-xl rounded-3xl border border-border/50 dark:border-white/10 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden h-full flex flex-col">
      {/* Gradient top line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Tab Header */}
      <div className="h-14 bg-gray-50/50 dark:bg-white/[0.01] border-b border-border/30 dark:border-white/10 flex items-center px-4 sm:px-6 gap-3 shrink-0">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400/60" />
          <div className="w-3 h-3 rounded-full bg-amber-400/60" />
          <div className="w-3 h-3 rounded-full bg-rose-400/60" />
        </div>
        <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 ml-4 uppercase tracking-[0.2em] truncate">
          {feature.title}
        </span>
      </div>

      {/* Card Content */}
      <div className="p-6 sm:p-8 flex flex-col justify-center items-start text-left h-full">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br bg-primary/10 flex items-center justify-center mb-6 text-primary dark:text-primary/70 shadow-inner ring-1 ring-primary/20">
          <feature.icon className="w-7 h-7" />
        </div>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">
          {feature.title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed font-medium mb-6">
          {feature.description}
        </p>

        {/* Video Preview */}
        <div className="w-full mt-auto rounded-xl overflow-hidden border border-border dark:border-white/10 bg-gray-100 dark:bg-white/[0.05] shadow-md group-hover:shadow-xl transition-all duration-500 relative h-32">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
            poster="/video-poster.jpg"
          >
            <source src={feature.video} type="video/mp4" />
          </video>
          <div className="absolute bottom-2 right-2 bg-white/80 dark:bg-black/60 backdrop-blur p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <Zap className="w-3 h-3 text-rose-500 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground selection:bg-primary/20 font-sans antialiased transition-colors duration-500 relative overflow-x-hidden">
      {/* Background Layer: Light Theme – softer wave lines */}
      {mounted && actualTheme === 'light' && (
        <div className="fixed inset-0 z-0 pointer-events-none opacity-70">
          <FloatingLines
            enabledWaves={['top', 'middle', 'bottom']}
            linesGradient={['#fda4af', '#fb7185', '#f43f5e']}
            lineCount={[8, 12, 16]}
            lineDistance={[8, 6, 4]}
            bendRadius={5.0}
            bendStrength={-0.5}
            interactive={true}
            parallax={true}
          />
        </div>
      )}
      {/* Fixed video background for dark mode - placed globally */}
      {mounted && actualTheme === 'dark' && (
        <motion.div
          animate={isTransitioning ? { scale: 0.1, opacity: 0, filter: 'blur(10px)' } : { scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: '52% 75%' }}
          className="fixed inset-0 w-full h-full z-0 pointer-events-none"
        >
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4" type="video/mp4" />
          </video>
        </motion.div>
      )}

      {/* Hero Section Wrapper */}
      <motion.div
        animate={isTransitioning ? { scale: 0.95, opacity: 0, filter: 'blur(10px)' } : { scale: 1, opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative min-h-dvh flex flex-col justify-between z-10 overflow-hidden"
      >

        {/* Navigation – glassmorphic floating navbar */}
        <nav className="relative z-50 flex flex-row justify-between items-center px-4 py-2.5 sm:px-6 md:px-8 md:py-4 max-w-7xl mx-auto w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] mt-3 sm:mt-6 rounded-full border border-black/5 dark:border-white/5 bg-white/20 dark:bg-white/[0.02] backdrop-blur-md shadow-[0_8px_32px_0_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <img src="/origin-new.jpg" alt="ORIGIN" className="h-7 w-auto sm:h-9 rounded-lg object-contain" />
            <span 
              className="text-lg xs:text-xl sm:text-2xl md:text-3xl tracking-tight text-foreground font-normal whitespace-nowrap"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              O3 Origin<sup className="text-[10px]">®</sup>
            </span>
          </div>

          {/* Desktop Links (hidden on mobile, md:flex) */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.path}
                onClick={(e) => handleNavLinkClick(e, link.path, link.isPremium)}
                className={`text-sm font-medium transition-colors hover:text-foreground flex items-center gap-1.5 ${link.path === '/dashboard' ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
              >
                {link.name}
                {link.isPremium && (
                  <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                )}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setTheme(actualTheme === 'dark' ? 'light' : 'dark')}
              className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 border border-white/10 transition-all duration-300"
            >
              {mounted && (actualTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-primary" />)}
            </button>
            
            <button
              onClick={handleBeginJourney}
              className="liquid-glass rounded-full px-3.5 py-2 text-xs sm:px-6 sm:py-2.5 sm:text-sm text-foreground hover:scale-[1.03] transition-transform cursor-pointer"
            >
              Begin Journey
            </button>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-foreground">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Overlay – smooth */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 md:hidden"
          >
            <div className="flex flex-col items-center gap-12 w-full max-w-sm">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.path}
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleNavLinkClick(e, link.path, link.isPremium);
                  }}
                  className={`text-3xl font-black uppercase tracking-[0.2em] hover:text-primary transition-all active:scale-95 flex items-center gap-2 ${link.path === '/dashboard' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {link.name}
                  {link.isPremium && (
                    <Crown className="w-6 h-6 text-amber-500 fill-amber-500/20" />
                  )}
                </a>
              ))}
              <div className="h-px w-full bg-border" />
              <div className="flex items-center justify-between w-full px-8">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Theme</span>
                <button
                  onClick={() => setTheme(actualTheme === 'dark' ? 'light' : 'dark')}
                  className="flex items-center gap-3 px-6 py-3 rounded-full border border-border text-foreground font-black text-xs uppercase tracking-widest bg-muted"
                >
                  {mounted ? (actualTheme === 'dark' ? <><Sun className="w-4 h-4" /> Light</> : <><Moon className="w-4 h-4" /> Dark</>) : <><Moon className="w-4 h-4" /> Dark</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Hero Section – cinematic and vertically centered */}
        <section ref={heroRef} className="relative z-10 flex flex-col items-center justify-center text-center px-6 flex-grow max-w-7xl mx-auto w-full py-8 sm:py-12">
          <h1 
            className="text-3xl xs:text-4xl sm:text-7xl md:text-8xl leading-[0.95] tracking-[-2.46px] max-w-7xl font-normal text-foreground animate-fade-rise"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Where <em className="not-italic text-muted-foreground">dreams</em> rise <em className="not-italic text-muted-foreground">through the silence.</em>
          </h1>
          
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mt-6 sm:mt-8 leading-relaxed animate-fade-rise-delay">
            We're designing tools for deep thinkers, bold creators, and quiet rebels. Amid the chaos, we build digital spaces for sharp focus and inspired work.
          </p>

          <button
            onClick={handleBeginJourney}
            className="liquid-glass rounded-full px-8 py-4 text-sm sm:px-14 sm:py-5 sm:text-base text-foreground mt-8 sm:mt-12 hover:scale-[1.03] transition-transform cursor-pointer animate-fade-rise-delay-2"
          >
            Begin Journey
          </button>
        </section>

        {/* Stats row with subtle hover at the bottom of the first page viewport */}
        <div className="relative z-10 w-full pb-8 sm:pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }} className="flex flex-wrap items-center justify-center gap-6 sm:gap-12 md:gap-20">
            {stats.map((stat, i) => (
              <div key={i} className="text-center group">
                <div className="text-3xl font-black text-foreground mb-2 group-hover:scale-110 transition-transform tracking-tight">
                  {stat.value}
                </div>
                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Features Section - Responsive: Rotating cards on desktop, grid on mobile */}
      <section id="features" className="py-28 lg:py-36 relative z-10 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-[10px] font-black text-primary tracking-[0.4em] uppercase mb-4">Core Capabilities</h2>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter">
              Engineered for <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">Rankers.</span>
            </h1>
          </motion.div>

          {isMobile ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {features.map((feature, idx) => <FeatureCard key={idx} feature={feature} />)}
            </div>
          ) : (
            <div className="flex justify-center items-center min-h-[520px] w-full relative">
              <CardSwap className="relative !transform-none !bottom-auto !right-auto mx-auto" width="520px" height="520px" verticalDistance={40} pauseOnHover={true}>
                {features.map((feature, index) => (
                  <Card key={index} className="bg-white/90 dark:bg-card/95 backdrop-blur-xl rounded-3xl border border-border/70 dark:border-white/10 shadow-2xl overflow-hidden">
                    <div className="h-14 bg-gray-50/80 dark:bg-white/[0.02] border-b border-border/50 dark:border-white/10 flex items-center px-6 gap-3">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400/60" />
                        <div className="w-3 h-3 rounded-full bg-amber-400/60" />
                        <div className="w-3 h-3 rounded-full bg-rose-400/60" />
                      </div>
                      <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 ml-4 uppercase tracking-[0.2em] truncate">{feature.title}</span>
                    </div>
                    <div className="p-8 flex flex-col justify-center items-start h-full">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br bg-primary/10 flex items-center justify-center mb-6 text-primary dark:text-primary/70">
                        <feature.icon className="w-7 h-7" />
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">{feature.title}</h3>
                      <p className="text-gray-600 dark:text-gray-300 leading-relaxed font-medium mb-6">{feature.description}</p>
                      <div className="w-full rounded-xl overflow-hidden border border-border dark:border-white/10 bg-gray-100 dark:bg-white/[0.05] relative h-32">
                        <video autoPlay loop muted playsInline className="w-full h-full object-cover" poster="/video-poster.jpg">
                          <source src={feature.video} type="video/mp4" />
                        </video>
                      </div>
                    </div>
                  </Card>
                ))}
              </CardSwap>
            </div>
          )}
        </div>
      </section>

      {/* The Protocol Section – improved spacing, images still work */}
      <section id="how-it-works" ref={howItWorksRef} className="py-28 lg:py-40 relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} viewport={{ once: true }} className="text-center mb-24">
            <h2 className="text-[10px] font-black text-primary tracking-[0.5em] uppercase mb-6">Mastery Framework</h2>
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter">
              The <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">Protocol.</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto font-medium leading-relaxed">
              A systematic, AI-driven approach to mastering the syllabus and securing your top rank.
            </p>
          </motion.div>

          <div className="space-y-40 lg:space-y-64 relative">
            {/* Step 1 */}
            <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
              <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} viewport={{ once: true, margin: "-100px" }} className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-emerald-300 border border-emerald-200 dark:border-rose-800">
                  <span className="text-xs font-black uppercase tracking-widest">Step 01</span>
                </div>
                <h2 className="text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tighter">Diagnose.</h2>
                <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed font-medium">Identify critical knowledge gaps with hyper-precise AI diagnostic tests. Our AI maps your cognitive profile in real-time.</p>
                <ul className="space-y-4 pt-4">
                  {["Real-time gap detection", "Cognitive strength mapping", "Syllabus coverage audit"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/80" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="flex-1 relative group">
                <div className="absolute inset-0 bg-primary/80/20 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative rounded-3xl overflow-hidden border border-border dark:border-white/10 shadow-2xl">
                  <img src="/images/protocol/diagnose.png" alt="Diagnose" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-1000" />
                </div>
              </motion.div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-16 lg:gap-32">
              <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} viewport={{ once: true, margin: "-100px" }} className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-primary/20 dark:border-rose-800">
                  <span className="text-xs font-black uppercase tracking-widest">Step 02</span>
                </div>
                <h2 className="text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tighter">Plan.</h2>
                <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed font-medium">Get a custom roadmap generated by our AIR prediction engine. Every hour of study is optimized for maximum mark gains.</p>
                <ul className="space-y-4 pt-4">
                  {["Personalized path to AIR < 100", "Dynamic subject re-prioritization", "Time-blocked efficiency maps"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/80" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="flex-1 relative group">
                <div className="absolute inset-0 bg-primary/80/20 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative rounded-3xl overflow-hidden border border-border dark:border-white/10 shadow-2xl">
                  <img src="/images/protocol/plan.png" alt="Plan" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-1000" />
                </div>
              </motion.div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
              <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} viewport={{ once: true, margin: "-100px" }} className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  <span className="text-xs font-black uppercase tracking-widest">Step 03</span>
                </div>
                <h2 className="text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tighter">Execute.</h2>
                <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed font-medium">Practice with adaptive DPPs that evolve as you solve. No two students ever solve the same question set.</p>
                <ul className="space-y-4 pt-4">
                  {["Infinite adaptive problem sets", "Hyper-focused doubt resolution", "Scientifically designed focus blocks"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="flex-1 relative group">
                <div className="absolute inset-0 bg-teal-500/20 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative rounded-3xl overflow-hidden border border-border dark:border-white/10 shadow-2xl">
                  <img src="/images/protocol/execute.png" alt="Execute" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-1000" />
                </div>
              </motion.div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-16 lg:gap-32">
              <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} viewport={{ once: true, margin: "-100px" }} className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <span className="text-xs font-black uppercase tracking-widest">Step 04</span>
                </div>
                <h2 className="text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tighter">Achieve.</h2>
                <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed font-medium">Track your rank improvements daily. See your predicted AIR rise as you master more concepts.</p>
                <ul className="space-y-4 pt-4">
                  {["Daily AIR prediction updates", "Milestone celebration engine", "Final sprint optimization"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="flex-1 relative group">
                <div className="absolute inset-0 bg-amber-500/20 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative rounded-3xl overflow-hidden border border-border dark:border-white/10 shadow-2xl">
                  <img src="/images/protocol/achieve.png" alt="Achieve" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-1000" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials – nicer counter and CTA */}
      <section className="py-28 lg:py-40 relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div ref={counterRef} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="flex flex-col items-center space-y-10">
            <h2 className="text-5xl sm:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">
              Trusted by the <br />
              <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">Top 1%.</span>
            </h2>
            <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto font-black leading-relaxed tracking-tight uppercase">
              <span className="text-primary text-5xl sm:text-7xl md:text-8xl block mb-5 font-black tabular-nums">
                <AnimatedCounter from={1} to={12620} duration={10} inView={isCounterInView} />+
              </span>
              QUESTIONS To Practice FROM NCERT, PYQS, AND Famous Books for JEE and NEET Preparation
            </p>

            <motion.a
              href="https://chat.whatsapp.com/BBwpKNeiCypGzeVMwsw9ns?mode=gi_t"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-4 px-8 py-4 bg-[#25D366] text-white rounded-full font-black text-lg shadow-2xl shadow-green-500/30 hover:shadow-green-500/50 transition-all duration-300 group"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-white rounded-full p-1.5 group-hover:rotate-12 transition-transform">
                <svg className="w-full h-full text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.938 3.659 1.434 5.628 1.435h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              Join O3 Origin Community
            </motion.a>
          </motion.div>
        </div>
      </section>

      {/* Pricing – refined cards */}
      <section id="pricing" className="py-28 lg:py-36 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-[10px] font-black text-primary tracking-[0.4em] uppercase mb-4">Pricing Plans</h2>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter">
              Invest in <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">Your Future.</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto font-medium">Elite training shouldn't be a luxury. Choose the track that fits your ambition.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { name: 'Starter', price: 'Free', desc: 'Atomic building blocks for serious aspirants.', features: ['5 AI Research Cycles / Day', 'Core Subject Benchmarks', 'Fundamental Gap Analysis', 'Curated Resource Hub', 'Community Access'], cta: 'Start Now', popular: false },
              { name: 'Pro', price: 'Waitlist', desc: 'The complete performance architecture.', features: ['Unlimited AI Research', 'Cognitive Failure Analysis', 'Dynamic Personalized Paths', 'Adaptive Arena Access', 'Rank Improvement Metrics', 'Focus & Velocity Tracking', 'Elite Community Access', 'Priority Support'], cta: 'Join Waitlist', popular: true, comingSoon: true },
              { name: 'Elite', price: 'Waitlist', desc: '1-on-1 performance engineering.', features: ['Everything in Pro', 'Personal AI Tutor Agent', 'Mastery-Based Explanations', 'End-to-End Milestone Maps', 'Rapid Revision Protocols', 'Mental Performance Gear', 'Advanced Predictive Ops'], cta: 'Join Waitlist', popular: false, comingSoon: true },
            ].map((plan, index) => (
              <div key={index} className={`relative p-6 sm:p-10 flex flex-col rounded-3xl transition-all duration-500 hover:scale-[1.02] ${plan.popular ? 'bg-card dark:bg-card border-2 border-rose-500 shadow-2xl shadow-rose-500/10' : 'bg-card/80 dark:bg-white/[0.01] backdrop-blur-sm border border-border dark:border-white/10 shadow-xl'}`}>
                {plan.popular && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-2 rounded-full bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">Most Strategic</div>}
                <div className="mb-8">
                  <h3 className="text-2xl font-black mb-2 tracking-tight text-gray-900 dark:text-white">{plan.name}</h3>
                  <div className="text-4xl font-black mb-4 text-gray-900 dark:text-white">{plan.price}</div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{plan.desc}</p>
                </div>
                <div className="flex-grow space-y-4 mb-10">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-rose-500" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                  <div className="mt-auto">
                    <Button onClick={handleBeginJourney} className={`w-full py-6 rounded-xl text-[11px] uppercase tracking-[0.2em] font-black transition-all duration-300 ${plan.popular ? 'bg-primary hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/20' : 'bg-secondary dark:bg-white/[0.05] text-foreground hover:bg-secondary/80 dark:hover:bg-white/[0.1]'}`}>
                      {plan.cta}
                    </Button>
                  </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA – elegant */}
      <section className="py-28 lg:py-36 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-100 via-indigo-50 to-rose-100 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-blue-950/20 -z-10 blur-3xl" />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }} className="space-y-10">
            <h2 className="text-6xl sm:text-8xl lg:text-9xl font-black text-gray-900 dark:text-white tracking-tighter leading-[0.9] mb-8">
              REWRITE YOUR <br />
              <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">STORY.</span>
              </h2>
            <div className="flex flex-col items-center gap-6">
              <div className="bg-primary/10 dark:bg-primary/5 border border-primary/20 dark:border-primary/30 px-6 py-2 rounded-full">
                <p className="text-sm font-black tracking-[0.2em] text-primary uppercase animate-pulse">
                  {regStatus ? `⚠️ ${regStatus.seatsLeft > 0 ? `Only ${regStatus.seatsLeft} Seats Left` : 'Capacity Reached'}` : '⚠️ Limited Seats Remaining'}
                </p>
              </div>
              <Button onClick={handleBeginJourney} className="bg-primary hover:opacity-90 text-primary-foreground rounded-full px-14 py-8 text-2xl font-black shadow-2xl shadow-primary/30 transition-all duration-300 hover:scale-105 group">
                START YOUR JOURNEY
                <Zap className="w-7 h-7 ml-3 group-hover:rotate-12 transition-transform" />
              </Button>
              <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 font-black tracking-tight uppercase">
                Join Success journey with <span className="text-gray-900 dark:text-white border-b-4 border-primary/50">O3 Origin</span>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 relative z-10 border-t border-border/50 dark:border-white/10 bg-background/50 dark:bg-card/30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center md:items-end justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">© O3 Origin</span>
            <img src="/origin-new.jpg" alt="ORIGIN" className="h-12 w-auto dark:brightness-110" />
          </div>
          <div className="flex flex-col items-center md:items-end gap-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Connect With Us</span>
            <div className="flex gap-5 items-center">
              <a href="https://chat.whatsapp.com/BBwpKNeiCypGzeVMwsw9ns?mode=gi_t" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/Whatsapp-Logo.png" alt="WhatsApp" className="h-10 w-auto" /></a>
              <a href="https://www.linkedin.com/in/o3-origin-ba73233a8/" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/LinkedIn.png" alt="LinkedIn" className="h-10 w-auto" /></a>
              <a href="https://x.com/O3_origin" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/X.jpg" alt="X" className="h-10 w-auto rounded-md" /></a>
              <a href="https://www.instagram.com/o3.origin/?hl=en" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/Instagram.png" alt="Instagram" className="h-10 w-auto" /></a>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile & Tablet Sticky bottom CTA */}
      <AnimatePresence>
        {showStickyCTA && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-4 left-4 right-4 z-40 lg:hidden"
          >
            <button
              onClick={() => handleBeginJourney()}
              className="w-full bg-primary text-black font-semibold rounded-full py-4 text-base hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-2 border border-primary/25 backdrop-blur-md"
            >
              <span>Begin Journey</span>
              <ChevronRight className="w-5 h-5 text-black" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}