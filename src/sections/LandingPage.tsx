'use client';
import { useRef, useEffect, useState, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { motion, useSpring, useInView, AnimatePresence, useMotionValue } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/CardSwap';

// Heavy graphics libs (three, gsap) — split into their own chunks
const OriginLogoBackground = dynamic(() => import('@/components/ui/OriginLogoBackground'), { ssr: false });
const ParticleBackground = dynamic(() => import('@/components/ui/ParticleBackground'), { ssr: false });
const CardSwap = dynamic(() => import('@/components/ui/CardSwap'), { ssr: false });
const SplitText = dynamic(() => import('@/components/ui/SplitText'), { ssr: false });
const ScrollStack = dynamic(() => import('@/components/ui/ScrollStack'), { ssr: false });
const ScrollStackItem = dynamic(() => import('@/components/ui/ScrollStack').then(mod => mod.ScrollStackItem), { ssr: false });
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

function BookGallerySection({ ncertBooks }: { ncertBooks: { image: string; text: string }[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // All mutable scroll state lives in a ref — no React re-renders inside the RAF loop
  const stateRef = useRef({ x: 0, scrollBoost: 0, lastScroll: -1, singleWidth: 0 });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const state = stateRef.current;
    const BASE_SPEED = 0.55; // px per frame at ~60 fps
    const BOOST_GAIN = 0.35; // how much each scroll-delta px contributes to boost
    const BOOST_CAP = 9;     // max extra speed
    const DECAY = 0.94;      // boost decay per frame

    let raf: number;
    const tick = () => {
      state.scrollBoost = Math.max(0, state.scrollBoost * DECAY);
      state.x -= BASE_SPEED + state.scrollBoost;
      // Seamless loop: jump forward by one copy-width when we've scrolled past it
      if (state.singleWidth > 0 && state.x <= -state.singleWidth) {
        state.x += state.singleWidth;
      }
      track.style.transform = `translateX(${state.x}px)`;
      raf = requestAnimationFrame(tick);
    };

    // Measure after the first paint when layout is ready
    raf = requestAnimationFrame(() => {
      // Track holds 3 identical copies → divide by 3 for one copy's width
      state.singleWidth = track.scrollWidth / 3;
      tick();
    });

    const handleScroll = () => {
      const mainEl = document.querySelector('main');
      const scrollTop = mainEl ? mainEl.scrollTop : window.scrollY;
      if (state.lastScroll >= 0) {
        const delta = Math.abs(scrollTop - state.lastScroll);
        state.scrollBoost = Math.min(state.scrollBoost + delta * BOOST_GAIN, BOOST_CAP);
      }
      state.lastScroll = scrollTop;
    };

    const mainEl = document.querySelector('main');
    window.addEventListener('scroll', handleScroll, { passive: true });
    if (mainEl) mainEl.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', handleScroll);
      if (mainEl) mainEl.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Triple the array so the loop has plenty of runway before the reset jump
  const loopBooks = [...ncertBooks, ...ncertBooks, ...ncertBooks];

  return (
    <section id="how-it-works" ref={sectionRef} className="py-28 lg:py-40 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }} viewport={{ once: true }} className="text-center mb-16">
          <h2 className="text-[10px] font-black text-primary tracking-[0.5em] uppercase mb-6">Our Knowledge Base</h2>
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter">
            Trained on <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">Gold Standards.</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto font-medium leading-relaxed">
            We trained our AI on exact NCERT textbooks and reference gold standards like <strong className="text-primary">HC Verma, Irodov, NCERT Exemplar</strong>, and standard preparatory resources.
          </p>
        </motion.div>
      </div>

      {/* Full-bleed auto-scrolling marquee — always runs, faster when page scrolls */}
      <div className="overflow-hidden w-full py-4 select-none">
        <div
          ref={trackRef}
          className="flex gap-6 sm:gap-10 w-max"
          style={{ willChange: 'transform' }}
        >
          {loopBooks.map((book, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-40 sm:w-52 flex flex-col items-center gap-3 group"
            >
              <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden border border-border/40 dark:border-white/10 shadow-xl bg-card/50 backdrop-blur-sm group-hover:shadow-2xl group-hover:-translate-y-2 transition-all duration-500">
                <img
                  src={book.image}
                  alt={book.text}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  style={{ transform: 'translate3d(0,0,0)' }}
                />
              </div>
              <p className="text-center text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors leading-tight px-1">
                {book.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface FeatureItem {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  video: string;
}

// Defined outside LandingPage so React sees a stable component reference on every render.
// Defining it inside would create a new function on each parent state change, unmounting all cards.
function FeatureCard({ feature }: { feature: FeatureItem }) {
  return (
    <div className="group relative bg-card/80 dark:bg-card/85 backdrop-blur-xl rounded-3xl border border-border/50 dark:border-white/10 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden h-full flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
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
        <div className="w-full mt-auto rounded-xl overflow-hidden border border-border dark:border-white/10 bg-gray-100 dark:bg-white/[0.05] shadow-md group-hover:shadow-xl transition-all duration-500 relative h-32">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="none"
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
}

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const actualTheme = mounted ? resolvedTheme : (theme === 'system' ? 'dark' : theme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [regStatus, setRegStatus] = useState<{ count: number; limit: number; seatsLeft: number } | null>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const isCounterInView = useInView(counterRef, { once: true, amount: 0.5 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const showStickyCTARef = useRef(false);

  // Drives the video opacity on scroll — fades out over the first viewport height
  const videoOpacity = useMotionValue(1);
  const smoothVideoOpacity = useSpring(videoOpacity, { stiffness: 60, damping: 25 });

  const scrubVideoRef = useRef<HTMLVideoElement>(null);
  const prevXRef = useRef<number | null>(null);
  const targetTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!mounted || actualTheme !== 'light') return;

    const handleMouseMove = (e: MouseEvent) => {
      const video = scrubVideoRef.current;
      if (!video) return;
      
      const duration = video.duration;
      if (isNaN(duration) || duration === 0) return;

      if (prevXRef.current === null) {
        prevXRef.current = e.clientX;
        return;
      }

      const delta = e.clientX - prevXRef.current;
      prevXRef.current = e.clientX;

      const SENSITIVITY = 0.8;
      const timeOffset = (delta / window.innerWidth) * SENSITIVITY * duration;
      
      let nextTarget = targetTimeRef.current + timeOffset;
      if (nextTarget < 0) nextTarget = 0;
      if (nextTarget > duration) nextTarget = duration;
      
      targetTimeRef.current = nextTarget;

      if (!isSeekingRef.current) {
        isSeekingRef.current = true;
        const diff = nextTarget - video.currentTime;
        if (Math.abs(diff) > 0.05) {
          const step = diff * 0.15;
          video.currentTime = Math.max(0, Math.min(duration, video.currentTime + step));
        } else {
          video.currentTime = nextTarget;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      prevXRef.current = null;
    };
  }, [mounted, actualTheme]);

  const handleSeeked = () => {
    const video = scrubVideoRef.current;
    if (!video) return;
    
    const diff = targetTimeRef.current - video.currentTime;
    if (Math.abs(diff) > 0.05) {
      const step = diff * 0.15;
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + step));
    } else if (Math.abs(diff) > 0.001) {
      video.currentTime = targetTimeRef.current;
    } else {
      isSeekingRef.current = false;
    }
  };

  const handleBeginJourney = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (actualTheme === 'dark') {
      setIsTransitioning(true);
      if (videoRef.current) {
        videoRef.current.loop = false;
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch((err) => console.warn('Video play failed:', err));
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

  const ncertBooks = [
    { image: '/images/ncert/Physics-class-11-part-1.png', text: 'Physics Class 11 & HCV' },
    { image: '/images/ncert/Physics-class-12-part-1.png', text: 'Physics Class 12 & Irodov' },
    { image: '/images/ncert/Chemistry-class-11-part-1.png', text: 'Chemistry Class 11 Part 1' },
    { image: '/images/ncert/Chemistry-class-11-part-2.png', text: 'Chemistry Class 11 Part 2' },
    { image: '/images/ncert/Biology-class-11.png', text: 'NCERT Biology Class 11' },
    { image: '/images/ncert/Biology-class-12.png', text: 'NCERT Biology Class 12' },
    { image: '/images/ncert/Mathematics-class-11.png', text: 'Maths Class 11 & Cengage' },
    { image: '/images/ncert/Mathematics-class-12-part-1.png', text: 'Maths Class 12 & Exemplar' }
  ];

  const appFeatures = [
    {
      image: '/images/app-features/Origin-bot-emotional.png',
      category: 'AI Mentor',
      title: 'Origin AI Mentor & Support',
      description: 'Your 24/7 emotionally intelligent companion built to understand your mood, identify learning friction points, and explain micro-concepts adaptively. It keeps you inspired and clear-headed.',
      audience: 'Student Interface'
    },
    {
      image: '/images/app-features/Focus-timer.png',
      category: 'Productivity',
      title: 'Integrated Pomodoro Engine',
      description: 'Block out distractions and build perfect flow states. Track your direct study hours with scientifically-proven session intervals and rest blocks optimized for rigorous preps.',
      audience: 'Student Interface'
    },
    {
      image: '/images/app-features/Global-Ranking.png',
      category: 'Competition',
      title: 'Real-time Leaderboards & Stats',
      description: 'Gauge your performance against top national rankers daily. See precise global percentiles, accurate subject accuracy curves, and absolute velocity scores updated instantly.',
      audience: 'Student Interface'
    },
    {
      image: '/images/app-features/OG-code-to-Practice.png',
      category: 'Coding & Practice',
      title: 'OGCode Practice Environment',
      description: 'Convert conceptual physics or maths logic directly into interactive sandbox challenges. Solve code-driven logic boards that establish structural thinking.',
      audience: 'Student Interface'
    },
    {
      image: '/images/app-features/Origin-testing-Agency.png',
      category: 'Evaluation',
      title: 'Origin Testing Agency',
      description: 'Engage in full-length custom mock assessments built dynamically to mimic real NTA templates. Get immediate failure reviews, predictive AIR metrics, and concept gap diagnostics.',
      audience: 'Student Interface'
    },
    {
      image: '/images/app-features/Peronalized-dpp-generation.png',
      category: 'Practice Engine',
      title: 'Personalized DPP Generation',
      description: 'Never solve generic question sheets again. Our AI analyzes your mock mistakes and generates customized Daily Practice Problems matching your unique concept friction points.',
      audience: 'Student Interface'
    },
    {
      image: '/images/app-features/Room-feature.png',
      category: 'Collaboration',
      title: 'Interactive Study Rooms',
      description: 'Join real-time, interactive virtual study rooms. Solve challenges alongside classmates, exchange immediate chat notes, share code snippets, and sync up on collective mock sprints.',
      audience: 'Student Interface'
    },
    {
      image: '/images/app-features/books-study-notes.png',
      category: 'Resource Hub',
      title: 'Study Notes & Reference Vault',
      description: 'Access hyper-precise summary blueprints, structured micro-concepts, and formulas cross-referenced directly from gold standards like NCERT, HC Verma, and Irodov.',
      audience: 'Student Interface'
    },
    {
      image: '/images/app-features/teacher/Live-test.png',
      category: 'Teacher Operating System',
      title: 'Live Batch Mock Control',
      description: 'Deploy live custom tests to multiple student batches instantaneously. Monitor student solve speed, check ongoing accuracy spreads, and spot struggling students live.',
      audience: 'Teacher Interface'
    },
    {
      image: '/images/app-features/teacher/Syallabus-compliton-tracker.png',
      category: 'Teacher Operating System',
      title: 'Syllabus Mastery Map',
      description: 'Track overall batch coverage and subject syllabus percentiles dynamically. Pinpoint exactly which topics have low collective mastery and adjust future lecture blocks.',
      audience: 'Teacher Interface'
    },
    {
      image: '/images/app-features/teacher/Teacher-Batch.png',
      category: 'Teacher Operating System',
      title: 'Cohort Performance Analytics',
      description: 'Organize hundreds of students into performance cohorts. Dive deep into individual growth metrics, parent reports, and batch engagement distributions on one dashboard.',
      audience: 'Teacher Interface'
    },
    {
      image: '/images/app-features/teacher/Teacher-question.png',
      category: 'Teacher Operating System',
      title: 'Infinite Question Pool Builder',
      description: 'Construct proprietary class tests using the AI-assisted problem importer. Auto-parse hand-written sheets or PDFs and tag them with precise subjects, chapters, and difficulty levels in seconds.',
      audience: 'Teacher Interface'
    }
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

  const mainRef = useRef<HTMLElement | null>(null);
  const [mountedMain, setMountedMain] = useState(false);

  useEffect(() => {
    mainRef.current = document.querySelector('main');
    setMountedMain(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mainScroller = mainRef.current;
    const handleScroll = () => {
      const scrollTop = mainScroller ? mainScroller.scrollTop : window.scrollY;

      // Gate setState to only fire when the boolean actually changes — avoids re-render on every scroll frame
      const shouldShow = scrollTop > 400;
      if (shouldShow !== showStickyCTARef.current) {
        showStickyCTARef.current = shouldShow;
        setShowStickyCTA(shouldShow);
      }

      // Fade the video out as user scrolls — fully gone after 1 viewport height
      const fadeProgress = Math.min(scrollTop / window.innerHeight, 1);
      videoOpacity.set(1 - fadeProgress);
    };
    if (mainScroller) {
      mainScroller.addEventListener('scroll', handleScroll, { passive: true });
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
    return () => {
      if (mainScroller) {
        mainScroller.removeEventListener('scroll', handleScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, [mountedMain, videoOpacity]);

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

  return (
    <div className="min-h-dvh bg-background text-foreground selection:bg-primary/20 font-sans antialiased transition-colors duration-500 relative overflow-x-visible">
      {/* Background Layer: Light Theme – mouse-scrub controlled video */}
      {mounted && actualTheme === 'light' && (
        <div className="fixed inset-0 z-0 pointer-events-none w-full h-full">
          <video
            ref={scrubVideoRef}
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-cover"
            style={{ position: 'fixed', inset: 0, zIndex: 0, objectPosition: '70% center' }}
            onSeeked={handleSeeked}
          >
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260530_042513_df96a13b-6155-4f6e-8b93-c9dee66fba08.mp4" type="video/mp4" />
          </video>
        </div>
      )}
      {/* Dark mode video – fades out on scroll, revealing 3D logo below */}
      {mounted && actualTheme === 'dark' && (
        <motion.div
          style={{ opacity: smoothVideoOpacity, willChange: 'opacity' }}
          className="fixed inset-0 w-full h-full z-[2] pointer-events-none"
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

      {/* Ambient floating particles – z:0, behind everything */}
      {mounted && <ParticleBackground visible={mounted} />}

      {/* 3D logo background – dark mode only; additive blending glow */}
      {mounted && actualTheme === 'dark' && <OriginLogoBackground />}

      {/* Fixed Navbar – outside the hero motion.div so CSS fixed works across all sections */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <nav className="pointer-events-auto relative flex flex-row justify-between items-center px-4 py-2.5 sm:px-6 md:px-8 md:py-4 max-w-7xl mx-auto w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] mt-3 sm:mt-6 rounded-full border border-black/5 dark:border-white/5 bg-white/20 dark:bg-white/[0.02] backdrop-blur-md shadow-[0_8px_32px_0_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <img src="/origin-new.jpg" alt="ORIGIN" className="h-7 w-auto sm:h-9 rounded-lg object-contain" />
            <span 
              className="text-lg xs:text-xl sm:text-2xl md:text-3xl tracking-tight text-foreground font-normal whitespace-nowrap"
              style={{ fontFamily: 'var(--font-heading)' }}
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
      </div>

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

      {/* Hero Section Wrapper — filter only applied during the Begin Journey exit animation, never at rest */}
      <motion.div
        animate={isTransitioning ? { scale: 0.95, opacity: 0, filter: 'blur(10px)' } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative min-h-dvh flex flex-col justify-between z-10 overflow-hidden pt-[88px] sm:pt-[108px]"
      >

        {/* Hero Section – cinematic and vertically centered */}
        <section ref={heroRef} className="relative z-10 flex flex-col items-center justify-center text-center px-6 flex-grow max-w-7xl mx-auto w-full py-8 sm:py-12">
          <SplitText
            tag="h1"
            text="Where dreams rise through the silence."
            className="text-3xl xs:text-4xl sm:text-7xl md:text-8xl leading-[0.95] tracking-[-2.46px] max-w-7xl font-normal text-foreground"
            delay={80}
            duration={0.8}
            ease="power3.out"
            splitType="words"
            from={{ opacity: 0, y: 50, rotateX: 40 }}
            to={{ opacity: 1, y: 0, rotateX: 0 }}
            threshold={0.1}
            rootMargin="-50px"
            textAlign="center"
          />
          
          <p className="text-slate-200 dark:text-slate-200 text-base sm:text-lg max-w-2xl mt-6 sm:mt-8 leading-relaxed animate-fade-rise-delay drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
            We're designing tools for deep thinkers, bold creators, and quiet rebels. Amid the chaos, we build digital spaces for sharp focus and inspired work.
          </p>

          <motion.button
            onClick={handleBeginJourney}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease: 'easeOut' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="relative mt-8 sm:mt-12 cursor-pointer group"
          >
            {/* Pulsing ring */}
            <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping opacity-60 group-hover:opacity-0 transition-opacity" />
            <span className="relative flex items-center gap-3 px-10 py-4 sm:px-14 sm:py-5 rounded-full bg-primary text-primary-foreground text-sm sm:text-base font-black uppercase tracking-widest shadow-2xl shadow-primary/40 border border-primary/30">
              Begin Journey
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            </span>
          </motion.button>
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
                        <video autoPlay loop muted playsInline preload="none" className="w-full h-full object-cover" poster="/video-poster.jpg">
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

      {/* Immersive Book Gallery Section */}
      <BookGallerySection ncertBooks={ncertBooks} />

      {/* Immersive ScrollStack App Features Section */}
      <section id="app-features-stack" className="py-28 lg:py-40 relative z-10 overflow-visible bg-gradient-to-b from-transparent via-slate-50/50 to-transparent dark:via-slate-950/20">
        <div className="max-w-7xl mx-auto px-6 mb-16 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} viewport={{ once: true }} className="space-y-4">
            <h2 className="text-[10px] font-black text-primary tracking-[0.5em] uppercase">Ecosystem Walkthrough</h2>
            <h1 className="text-5xl sm:text-7xl font-black text-gray-900 dark:text-white tracking-tighter">
              Explore the <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">ORIGIN Stack.</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto font-medium">
              A comprehensive walkthrough of specialized tools built for extreme student performance and complete teacher batch control.
            </p>
          </motion.div>
        </div>

        <div className="w-full px-[5%] sm:px-[5%] lg:px-[5%]">
          <ScrollStack 
            useWindowScroll={true} 
            itemDistance={140} 
            itemScale={0.02}
            itemStackDistance={0} 
            stackPosition="10%"
            baseScale={0.92}
            blurAmount={1}
          >
            {appFeatures.map((feat, idx) => {
              const isBotEmotional = feat.image === '/images/app-features/Origin-bot-emotional.png';
              
              if (isBotEmotional) {
                return (
                  <ScrollStackItem 
                    key={idx} 
                    itemClassName="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-border/50 dark:border-white/5 shadow-2xl p-3 sm:p-5 flex flex-col items-center justify-center"
                  >
                    {/* Full card image to show text clearly */}
                    <div className="w-full h-full rounded-[30px] overflow-hidden bg-gray-50/30 dark:bg-white/[0.01] flex items-center justify-center relative p-1 shadow-inner group">
                      <img 
                        src={feat.image} 
                        alt={feat.title} 
                        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
                        className="w-full h-full object-contain rounded-2xl shadow-sm transition-transform duration-500 will-change-transform" 
                      />
                    </div>
                  </ScrollStackItem>
                );
              }

              return (
                <ScrollStackItem 
                  key={idx} 
                  itemClassName="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-border/50 dark:border-white/5 shadow-2xl flex flex-col gap-2.5 sm:gap-4 items-center p-3 sm:p-6"
                >
                  {/* Image Block (Top) */}
                  <div className="w-full h-[40vh] sm:h-auto sm:flex-[2] min-h-0 rounded-2xl overflow-hidden border border-border/40 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.01] flex items-center justify-center relative p-2 shadow-inner group">
                    <img 
                      src={feat.image} 
                      alt={feat.title} 
                      style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
                      className="max-w-full max-h-full object-contain rounded-xl shadow-md group-hover:scale-[1.01] transition-transform duration-500 will-change-transform" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/[0.02] via-transparent to-transparent pointer-events-none" />
                  </div>

                  {/* Text/Explanation Block (Below) */}
                  <div className="w-full flex-[0] shrink-0 space-y-2 text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-black uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      {feat.category}
                    </div>
                    
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
                      {feat.title}
                    </h3>
                    
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                      {feat.description}
                    </p>
                    
                    <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                      <span>Target:</span>
                      <span className="text-gray-800 dark:text-gray-200 border-b border-primary/30 pb-0.5">
                        {feat.audience}
                      </span>
                    </div>
                  </div>
                </ScrollStackItem>
              );
            })}
          </ScrollStack>
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
              className="relative flex items-center gap-4 px-10 py-4 bg-primary text-primary-foreground rounded-full font-black text-lg shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 group border border-primary/30"
            >
              <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-40 group-hover:opacity-0 transition-opacity" />
              <div className="relative w-8 h-8 flex items-center justify-center bg-white/20 rounded-full p-1.5 group-hover:rotate-12 transition-transform">
                <svg className="w-full h-full text-primary-foreground" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.938 3.659 1.434 5.628 1.435h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <span className="relative">Join O3 Origin Community</span>
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
                Try Origin Now
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
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">© 2026 SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</span>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
              <a href="/terms-and-conditions" className="hover:text-foreground hover:underline transition-colors">Terms & Conditions</a>
              <span>•</span>
              <a href="/privacy-policy" className="hover:text-foreground hover:underline transition-colors">Privacy Policy</a>
              <span>•</span>
              <a href="/childrens-policy" className="hover:text-foreground hover:underline transition-colors">Children's Safety Policy</a>
              <span>•</span>
              <a href="/faq" className="hover:text-foreground hover:underline transition-colors">FAQ</a>
            </div>
            <img src="/origin-new.jpg" alt="ORIGIN" className="h-12 w-auto dark:brightness-110 mt-3" />
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