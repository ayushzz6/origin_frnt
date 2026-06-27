'use client';
import { useRef, useEffect, useState, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { motion, useInView, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useMainScrollContainer } from '@/hooks/useMainScrollContainer';
import { Button } from '@/components/ui/button';
import SmoothScroll from '@/components/providers/SmoothScroll';
import LiveCounter from '@/components/landing/LiveCounter';
import ActivityTicker from '@/components/landing/ActivityTicker';
import NoiseOverlay from '@/components/landing/NoiseOverlay';
import { useTypewriter } from '@/hooks/useTypewriter';

// Heavy/below-fold — all split into their own chunks
const OriginLogoBackground = dynamic(() => import('@/components/ui/OriginLogoBackground'), { ssr: false });
const OriMascot = dynamic(() => import('@/features/mascot/OriMascot'), { ssr: false });
import type { MascotState } from '@/features/mascot/mascot-state';
const TryOriginAI = dynamic(() => import('@/components/landing/TryOriginAI'), { ssr: false });
const RankPredictor = dynamic(() => import('@/components/landing/RankPredictor'), { ssr: false });
const NumbersWall = dynamic(() => import('@/components/landing/NumbersWall'), { ssr: false });
const StreakPreview = dynamic(() => import('@/components/landing/StreakPreview'), { ssr: false });
const TopperWall = dynamic(() => import('@/components/landing/TopperWall'), { ssr: false });
const TeacherFlipCard = dynamic(() => import('@/components/landing/TeacherFlipCard'), { ssr: false });
const ManifestoReveal = dynamic(() => import('@/components/landing/ManifestoReveal'), { ssr: false });
const CustomCursor = dynamic(() => import('@/components/landing/CustomCursor'), { ssr: false });
const SplitText = dynamic(() => import('@/components/ui/SplitText'), { ssr: false });
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Menu,
  X,
  ChevronRight,
  CheckCircle2,
  Sun,
  Moon,
  Crown,
  Gamepad2,
} from 'lucide-react';
import LandingCTABtn from '@/components/landing/LandingCTABtn';
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
    <section id="how-it-works" ref={sectionRef} className="py-14 sm:py-28 lg:py-40 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }} viewport={{ once: true }} className="text-center mb-10 sm:mb-16">
          <h2 className="text-[10px] font-heading font-black text-primary tracking-[0.5em] uppercase mb-4 sm:mb-6">Our Knowledge Base</h2>
          <h1 className="text-3xl xs:text-4xl sm:text-7xl lg:text-8xl font-heading font-black mb-4 sm:mb-6 tracking-tighter">
            <span className="text-outline">Trained on</span>{' '}<span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">Gold Standards.</span>
          </h1>
          <p className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto font-display italic leading-relaxed">
            We trained our AI on exact NCERT textbooks and reference gold standards like <strong className="text-primary font-sans not-italic font-bold">HC Verma, Irodov, NCERT Exemplar</strong>, and standard preparatory resources.
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
              className="flex-shrink-0 w-40 sm:w-52 flex flex-col items-center gap-4 group"
            >
              <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden neu-raised transition-all duration-500 hover:scale-105">
                <img
                  src={book.image}
                  alt={book.text}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  style={{ transform: 'translate3d(0,0,0)' }}
                />
              </div>
              <p className="text-center text-[11px] font-heading font-bold text-muted-foreground group-hover:text-primary transition-colors leading-tight px-1">
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

const FEATURE_ACCENTS = [
  { stripe: 'from-amber-400 to-orange-400', text: 'text-amber-500', dim: 'text-amber-400/[0.12]' },
  { stripe: 'from-indigo-500 to-violet-500', text: 'text-indigo-500', dim: 'text-indigo-400/[0.12]' },
  { stripe: 'from-emerald-500 to-teal-400', text: 'text-emerald-500', dim: 'text-emerald-400/[0.12]' },
  { stripe: 'from-rose-500 to-pink-400',    text: 'text-rose-500',    dim: 'text-rose-400/[0.12]' },
  { stripe: 'from-violet-500 to-purple-400', text: 'text-violet-500', dim: 'text-violet-400/[0.12]' },
  { stripe: 'from-sky-500 to-blue-400',     text: 'text-sky-500',    dim: 'text-sky-400/[0.12]' },
] as const;

// Defined outside LandingPage so React sees a stable component reference on every render.
function FeatureCard({ feature, index }: { feature: FeatureItem; index: number }) {
  const ac = FEATURE_ACCENTS[index % FEATURE_ACCENTS.length];
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.07 * index, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, margin: '-40px' }}
      className="shine-card group relative neu-raised transition-all duration-500 hover:scale-[1.015] overflow-hidden h-full flex flex-col rounded-3xl"
    >
      {/* Accent stripe */}
      <div className={`h-[3px] w-full bg-gradient-to-r ${ac.stripe} flex-shrink-0`} />

      {/* Ghost number — blinks brightly on card hover */}
      <span className={`ghost-num absolute top-3 right-4 text-[88px] font-black leading-none select-none pointer-events-none ${ac.dim} transition-transform duration-500 group-hover:scale-110`}>
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="p-6 sm:p-8 flex flex-col h-full gap-5 relative">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl neu-inset flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105">
          <feature.icon className="w-7 h-7" />
        </div>

        {/* Text */}
        <div className="flex-1 flex flex-col gap-2.5">
          <h3 className="text-xl sm:text-2xl font-heading font-bold text-foreground tracking-tight leading-snug">
            {feature.title}
          </h3>
          <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed">
            {feature.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border/25">
          <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${ac.text} opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-1 group-hover:translate-x-0`}>
            Explore feature
          </span>
          <ChevronRight className={`w-4 h-4 ${ac.text} opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 flex-shrink-0`} />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Dark hero: floating 2D ori images ──────────────────────────────────── */
const ORI_FLOATS = [
  { src: '/ori2d/ori-thinking.png',   pos: 'top-[5%]  left-[3%]',        size: 155, rotate: -8,  delay: '0s',    opacity: 0.52 },
  { src: '/ori2d/ori-happy.png',      pos: 'top-[6%]  right-[4%]',       size: 140, rotate: 11,  delay: '1.4s',  opacity: 0.48 },
  { src: '/ori2d/ori-reading.png',    pos: 'top-[37%] left-[1%]',        size: 118, rotate: -13, delay: '0.7s',  opacity: 0.42 },
  { src: '/ori2d/ori-proud.png',      pos: 'top-[40%] right-[2%]',       size: 132, rotate: 8,   delay: '2.0s',  opacity: 0.46 },
  { src: '/ori2d/ori-winking.png',    pos: 'bottom-[22%] left-[4%]',     size: 108, rotate: 5,   delay: '1.7s',  opacity: 0.42 },
  { src: '/ori2d/ori-curious.png',    pos: 'bottom-[16%] right-[3%]',    size: 122, rotate: -10, delay: '0.3s',  opacity: 0.46 },
  { src: '/ori2d/ori-cheerful.png',   pos: 'top-[19%]  left-[19%]',      size: 78,  rotate: 4,   delay: '2.6s',  opacity: 0.24 },
  { src: '/ori2d/ori-determined.png', pos: 'top-[21%]  right-[17%]',     size: 82,  rotate: -6,  delay: '1.9s',  opacity: 0.24 },
  { src: '/ori2d/ori-laptop.png',     pos: 'bottom-[38%] left-[13%]',    size: 72,  rotate: 10,  delay: '3.0s',  opacity: 0.20 },
  { src: '/ori2d/ori-surprise.png',   pos: 'bottom-[36%] right-[12%]',   size: 68,  rotate: -5,  delay: '2.3s',  opacity: 0.20 },
];

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { text: typewriterText, isTyping } = useTypewriter();
  const actualTheme = mounted ? resolvedTheme : (theme === 'system' ? 'dark' : theme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [regStatus, setRegStatus] = useState<{ count: number; limit: number; seatsLeft: number } | null>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const isCounterInView = useInView(counterRef, { once: true, amount: 0.5 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const showStickyCTARef = useRef(false);

  // Mouse-driven Y parallax for the traversing mascot
  const mascotMouseYRaw = useMotionValue(0);
  const mascotMouseY = useSpring(mascotMouseYRaw, { stiffness: 28, damping: 22 });

  // Section-driven horizontal side: the mascot sits at the LEFT/RIGHT edge that
  // each section declares (via data-mascot-side), gliding between them as you
  // scroll. Keeps it clear of the centred content cards and lets each screen
  // place Ori deliberately (e.g. Manifesto → left). Container tied to <main>.
  const scrollContainer = useMainScrollContainer();
  const mascotSideVw = useMotionValue(44); // start at right edge (hero)
  const mascotXNum = useSpring(mascotSideVw, { stiffness: 38, damping: 22, mass: 0.7 });
  const mascotX = useTransform(mascotXNum, (v) => `${v}vw`);

  // Responsive mascot footprint — smaller on phones/tablets so it never dominates.
  const [mascotSize, setMascotSize] = useState(580);
  // Live WebGL mascot only on tablet/desktop. Phones get the lighter 2D Ori
  // floats instead — avoids streaming multi-MB GLBs + a render loop on budget
  // devices / metered data. Starts false so SSR + first paint never mount WebGL.
  const [show3DMascot, setShow3DMascot] = useState(false);
  // "Play with Ori" direct-interaction mode (dark theme only).
  const [playMode, setPlayMode] = useState(false);
  const [playMood, setPlayMood] = useState<MascotState>('idle');
  const [orbitCoords, setOrbitCoords] = useState<{ azimuthDeg: number; polarDeg: number }>({ azimuthDeg: 0, polarDeg: 0 });


  const handleBeginJourney = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsTransitioning(true);
    setTimeout(() => {
      onGetStarted();
    }, 800);
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

      const shouldShow = scrollTop > 400;
      if (shouldShow !== showStickyCTARef.current) {
        showStickyCTARef.current = shouldShow;
        setShowStickyCTA(shouldShow);
      }
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
  }, [mountedMain]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const offsetY = (e.clientY - window.innerHeight / 2) * 0.1;
      mascotMouseYRaw.set(offsetY);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [mascotMouseYRaw]);

  // Responsive mascot size (re-evaluated on resize)
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setMascotSize(w < 640 ? 300 : w < 1024 ? 440 : 580);
      setShow3DMascot(w >= 640);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // Swap the mascot's emotion model by whichever section is most in view.
  // Replaces the old hover-driven swap (which couldn't fire — the mascot sits
  // behind pointer-events-none content). Skipped on phones (no live mascot).
  useEffect(() => {
    if (!show3DMascot) return;
    const root = scrollContainer.current;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-mascot-state]'));
    if (!sections.length) return;
    const ratios = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) ratios.set(e.target, e.intersectionRatio);
          else ratios.delete(e.target);
        }
        let best: Element | null = null;
        let max = 0;
        for (const [el, r] of ratios) {
          if (r > max) { max = r; best = el; }
        }
        const next = best?.getAttribute('data-mascot-state') as MascotState | null;
        if (next) setMascotState(next);
        const side = best?.getAttribute('data-mascot-side');
        if (side) mascotSideVw.set(side === 'left' ? -44 : side === 'center' ? 0 : 44);
      },
      { root, threshold: [0.2, 0.4, 0.6, 0.8] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [actualTheme, scrollContainer, mountedMain, show3DMascot]);

  // Esc closes Play-with-Ori mode
  useEffect(() => {
    if (!playMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPlayMode(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playMode]);

  const features = [
    {
      icon: (_: { className?: string }) => <img src="/iconsax/Ai-Icon.png" alt="AI" className="w-8 h-8 object-contain" />,
      title: 'Instant Doubt Resolution',
      description: 'Stuck at 2 AM? Get detailed, step-by-step solutions instantly. No waiting, just learning.',
      video: '/videos/Instant-Doubt-Resolution.mp4'
    },
    {
      icon: (_: { className?: string }) => <img src="/iconsax/Mathematics-Icon.png" alt="Mathematics" className="w-8 h-8 object-contain" />,
      title: 'Predictive Analytics',
      description: 'Know where you stand before the exam. Track mastery and predict your AIR with 95% accuracy.',
      video: '/videos/Predictive-Analytics.mp4'
    },
    {
      icon: (_: { className?: string }) => <img src="/iconsax/Physics-Icon.png" alt="Physics" className="w-8 h-8 object-contain" />,
      title: 'IITian Mentorship',
      description: 'Direct guidance from those who have cracked it. Strategies, tips, and motivation from top rankers.',
      video: '/videos/IITian-Mentorship-2.mp4'
    },
    {
      icon: (_: { className?: string }) => <img src="/iconsax/Chemistry-Icon.png" alt="Chemistry" className="w-8 h-8 object-contain" />,
      title: 'Pomodoro Focus',
      description: 'Built-in productivity tools. Study smarter with scientifically proven focus timers and break intervals.',
      video: '/videos/Pomodoro-Focus.mp4'
    },
    {
      icon: (_: { className?: string }) => <img src="/iconsax/Biology-Icon.png" alt="Biology" className="w-8 h-8 object-contain" />,
      title: 'Gamified Growth',
      description: 'Make preparation addictive. Earn streaks, unlock badges, and climb the leaderboard daily.',
      video: '/videos/Gamified-Growth.mp4'
    },
    {
      icon: (_: { className?: string }) => <img src="/ai-bot.png" alt="AI" className="w-8 h-8 object-cover rounded-lg" />,
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
    <SmoothScroll>
      <NoiseOverlay />
      <CustomCursor />
      <div className="min-h-dvh bg-background text-foreground selection:bg-primary/20 font-sans antialiased transition-colors duration-500 relative overflow-x-visible">
        {/* Ori theme: floating 2D ori images + traversing 3D mascot — both themes */}
        {mounted && (
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            {/* Dark-mode only: neumorphic dark base with subtle blue radial glows */}
            {actualTheme === 'dark' && (
              <div
                className="absolute inset-0"
                style={{
                  background: [
                    'radial-gradient(ellipse at 15% 50%, rgba(37,99,235,0.09) 0%, transparent 55%)',
                    'radial-gradient(ellipse at 85% 20%, rgba(99,102,241,0.06) 0%, transparent 45%)',
                    'radial-gradient(ellipse at 50% 90%, rgba(0,102,255,0.05) 0%, transparent 40%)',
                    '#0e0e0e',
                  ].join(', '),
                }}
              />
            )}

            {/* Floating 2D ori images scattered around the screen */}
            {ORI_FLOATS.map(({ src, pos, size, rotate, delay, opacity: op }) => (
              <div
                key={src}
                className={`absolute ${pos}`}
                style={{ width: size, height: size, transform: `rotate(${rotate}deg)` }}
              >
                <div className="mascot-float-anim w-full h-full" style={{ animationDelay: delay }}>
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="w-full h-full object-contain select-none"
                    style={{
                      opacity: actualTheme === 'dark' ? op : Math.min(1, op * 1.7),
                      filter: actualTheme === 'dark'
                        ? 'drop-shadow(0 4px 20px rgba(0,102,255,0.22)) drop-shadow(0 2px 10px rgba(0,0,0,0.75))'
                        : 'drop-shadow(0 4px 16px rgba(0,102,255,0.18)) drop-shadow(0 2px 6px rgba(0,0,0,0.12))',
                    }}
                  />
                </div>
              </div>
            ))}

            {/* 3D OriMascot — scroll-driven zig-zag (centre→right→left→right→centre)
                + mouse Y parallax. Margin-centred so Framer owns the transform.
                Tablet/desktop only; phones rely on the 2D floats above.
                preload=false → only the current section's model streams in
                (~3 MB on demand) instead of all six (~16 MB) upfront. */}
            {show3DMascot && (
              <motion.div
                className="absolute pointer-events-none"
                style={{
                  top: '50%',
                  left: '50%',
                  marginTop: -mascotSize / 2,
                  marginLeft: -mascotSize / 2,
                  width: mascotSize,
                  height: mascotSize,
                  x: mascotX,
                  y: mascotMouseY,
                }}
              >
                {/* Light theme: Ori's body is white, the canvas is transparent and the page
                    background is white — so without a backdrop the model is invisible. This
                    soft blue halo (travels with the mascot) gives the white model contrast. */}
                {actualTheme === 'light' && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 46%, rgba(37,99,235,0.20) 0%, rgba(37,99,235,0.10) 34%, rgba(37,99,235,0.04) 52%, transparent 66%)',
                    }}
                  />
                )}
                <OriMascot state={mascotState} className="relative w-full h-full" preload={false} />
              </motion.div>
            )}
          </div>
        )}

        {/* Fixed Navbar – outside the hero motion.div so CSS fixed works across all sections */}
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
          <nav className="pointer-events-auto relative flex flex-row justify-between items-center px-4 py-2.5 sm:px-6 md:px-8 md:py-4 max-w-7xl mx-auto w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] mt-3 sm:mt-6 rounded-full border border-white/5 dark:border-black/10 glass">
            <div className="flex items-center gap-1.5 sm:gap-3">
              <img src="/origin-new.jpg" alt="ORIGIN" className="h-7 w-auto sm:h-9 rounded-lg object-contain" />
              <span
                className="text-lg xs:text-xl sm:text-2xl md:text-3xl tracking-tight text-foreground font-heading font-black whitespace-nowrap"
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
                  className={`text-sm font-semibold transition-colors hover:text-foreground flex items-center gap-1.5 ${link.path === '/dashboard' ? 'text-primary font-bold' : 'text-muted-foreground'}`}
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
                className="neu-btn rounded-full w-9 h-9 flex items-center justify-center border-0 text-foreground transition-all duration-300 hover:scale-105 active:scale-95"
              >
                {mounted && (actualTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-primary" />)}
              </button>

              <LandingCTABtn
                label="Originate"
                onClick={handleBeginJourney}
                variant="xs"
              />

              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-foreground">
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </nav>
        </div>

        {/* Mobile Menu – slides in from right */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 md:hidden"
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                onClick={() => setMobileMenuOpen(false)}
              />
              {/* Drawer */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="absolute right-0 top-0 bottom-0 w-[min(80vw,300px)] bg-[hsl(var(--neu-bg))] shadow-2xl flex flex-col pt-20 pb-10 px-8 gap-2"
                style={{ boxShadow: '-8px 0 40px rgba(0,0,0,0.12)' }}
              >
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="absolute top-6 right-6 w-9 h-9 neu-raised rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>

                <div className="flex flex-col gap-1 mb-6">
                  {navLinks.map((link) => (
                    <a
                      key={link.name}
                      href={link.path}
                      onClick={(e) => { setMobileMenuOpen(false); handleNavLinkClick(e, link.path, link.isPremium); }}
                      className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl text-base font-heading font-black uppercase tracking-[0.12em] transition-all active:scale-95 ${link.path === '/dashboard' ? 'text-primary neu-inset' : 'text-muted-foreground hover:text-foreground hover:neu-raised'}`}
                    >
                      {link.name}
                      {link.isPremium && <Crown className="w-4 h-4 text-amber-500 fill-amber-500/20" />}
                    </a>
                  ))}
                </div>

                <div className="h-px bg-border/40 mb-6" />

                <div className="flex flex-col gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-4">Appearance</span>
                  <button
                    onClick={() => setTheme(actualTheme === 'dark' ? 'light' : 'dark')}
                    className="neu-btn flex items-center gap-3 px-5 py-3.5 rounded-2xl border-0 text-foreground font-heading font-black text-sm"
                  >
                    {mounted
                      ? (actualTheme === 'dark'
                          ? <><Sun className="w-4 h-4 text-amber-400" /> Light Mode</>
                          : <><Moon className="w-4 h-4 text-primary" /> Dark Mode</>)
                      : <><Moon className="w-4 h-4 text-primary" /> Dark Mode</>}
                  </button>
                  <LandingCTABtn
                    label="Originate"
                    onClick={() => { setMobileMenuOpen(false); handleBeginJourney(); }}
                    variant="sm"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section Wrapper — filter only applied during the Begin Journey exit animation, never at rest */}
        <motion.div
          animate={isTransitioning ? { scale: 0.95, opacity: 0, filter: 'blur(10px)' } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative min-h-dvh flex flex-col justify-between z-10 overflow-hidden pt-[72px] sm:pt-[88px] md:pt-[108px]"
        >

          {/* Hero Section – cinematic and vertically centered */}
          <section ref={heroRef} data-mascot-state="idle" data-mascot-side="right" className="relative z-10 flex flex-col items-center justify-center text-center px-5 sm:px-6 flex-grow max-w-7xl mx-auto w-full py-4 sm:py-8 md:py-12">

            {/* Logo image + tagline block */}
            <div className="w-full max-w-[1076px] flex flex-col">
              <motion.img
                src="/Origin-Name.png"
                alt="Origin"
                initial={{ opacity: 0, y: 40, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-20 xs:h-32 sm:h-44 md:h-56 object-contain drop-shadow-[0_8px_40px_rgba(0,102,255,0.35)]"
              />
            </div>

            {/* Live student counter */}
            <div
              onMouseEnter={() => setMascotState('answering')}
              onMouseLeave={() => setMascotState('idle')}
              className="w-full flex justify-center"
            >
              <LiveCounter />
            </div>

            {/* CTA Button — wave letters + spinning outline + takeoff on click */}
            <LandingCTABtn
              label="ORIGINATE"
              onClick={handleBeginJourney}
              onMouseEnter={() => setMascotState('success')}
              onMouseLeave={() => setMascotState('idle')}
              className="mt-6 sm:mt-12"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6, ease: 'easeOut' }}
            />

          </section>

          {/* Stats row with neumorphic raised cards */}
          <div
            className="relative z-10 w-full pb-4 sm:pb-8 md:pb-16"
            onMouseEnter={() => setMascotState('curious')}
            onMouseLeave={() => setMascotState('idle')}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex flex-row items-center justify-center gap-2 sm:gap-6 md:gap-8 max-w-5xl mx-auto px-2 xs:px-4"
            >
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + 0.1 * i, duration: 0.5 }}
                  className="flex-1 min-w-0 neu-raised px-3 py-4 sm:px-8 sm:py-6 rounded-2xl text-center transition-all duration-300 hover:scale-[1.03] cursor-default"
                >
                  <div className="text-xs sm:text-xl md:text-2xl font-heading font-black text-foreground mb-1 sm:mb-1.5 tracking-tight leading-tight">
                    {stat.value}
                  </div>
                  <div className="text-[9px] sm:text-[11px] font-heading font-bold text-muted-foreground uppercase tracking-[0.1em] sm:tracking-[0.2em] leading-tight">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Live activity ticker — Act 2: FOMO + social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.8 }}
              className="mt-8 border-t border-black/[0.06] dark:border-white/[0.06] w-full"
            >
              <ActivityTicker />
            </motion.div>
          </div>
        </motion.div>

        {/* Manifesto Reveal — second screen, right after hero */}
        <div data-mascot-state="thinking" data-mascot-side="left">
          <ManifestoReveal onBeginJourney={handleBeginJourney} />
        </div>

        {/* Rank Predictor — immediately after manifesto */}
        <div className="relative z-10" data-mascot-state="curious" data-mascot-side="right">
          <RankPredictor />
        </div>

        {/* Features Section - Responsive: Rotating cards on desktop, grid on mobile */}
        <section id="features" data-mascot-state="curious" data-mascot-side="left" className="py-14 sm:py-28 lg:py-36 relative z-10 overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-6">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-16">
              <div className="inline-flex items-center gap-2 neu-inset px-4 py-2 rounded-full mb-5 sm:mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <h2 className="text-[10px] font-heading font-black text-primary tracking-[0.4em] uppercase">Core Capabilities</h2>
              </div>
              <h1 className="text-3xl xs:text-4xl sm:text-6xl lg:text-7xl font-heading font-black text-foreground mb-4 sm:mb-6 tracking-tighter leading-[0.95]">
                Engineered for<br />
                <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">Rankers.</span>
              </h1>
              <p className="text-sm sm:text-lg text-muted-foreground max-w-xl mx-auto">Six tools. One mission — your name on the merit list.</p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {features.map((feature, idx) => <FeatureCard key={idx} feature={feature} index={idx} />)}
            </div>
          </div>
        </section>

        {/* Act 5 — Numbers Wall */}
        <div className="relative z-10" data-mascot-state="success" data-mascot-side="right">
          <NumbersWall />
        </div>

        {/* Act 3 — Interactive AI Demo */}
        <div className="relative z-10" data-mascot-state="thinking" data-mascot-side="left">
          <TryOriginAI />
        </div>

        {/* Immersive Book Gallery Section */}
        <div className="relative z-10" data-mascot-state="answering" data-mascot-side="right">
          <BookGallerySection ncertBooks={ncertBooks} />
        </div>


        {/* Act 8 — Streak Preview (gamification hook) */}
        <div className="relative z-10" data-mascot-state="success" data-mascot-side="left">
          <StreakPreview />
        </div>

        {/* Act 7 — Topper Wall */}
        <div className="relative z-10" data-mascot-state="success" data-mascot-side="right">
          <TopperWall />
        </div>

        {/* Act 6.5 — Teacher Flip Card */}
        <div className="relative z-10" data-mascot-state="curious" data-mascot-side="left">
          <TeacherFlipCard />
        </div>

        {/* Testimonials – nicer counter and CTA */}
        <section data-mascot-state="success" data-mascot-side="right" className="py-14 sm:py-28 lg:py-40 relative z-10 overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 text-center">
            <motion.div ref={counterRef} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="flex flex-col items-center space-y-6 sm:space-y-10">
              <h2 className="text-3xl xs:text-4xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-none">
                <span className="text-outline">Trusted by the</span> <br />
                <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">Top 1%.</span>
              </h2>
              <LandingCTABtn
                label="Join O3 Origin Community"
                href="https://chat.whatsapp.com/BBwpKNeiCypGzeVMwsw9ns?mode=gi_t"
                target="_blank"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              />
            </motion.div>
          </div>
        </section>

        {/* Pricing – refined cards */}
        <section id="pricing" data-mascot-state="thinking" data-mascot-side="left" className="py-14 sm:py-28 lg:py-36 relative z-10">
          <div className="max-w-7xl mx-auto px-5 sm:px-6">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-20">
              <div className="inline-flex items-center gap-2 neu-inset px-4 py-2 rounded-full mb-5 sm:mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <h2 className="text-[10px] font-heading font-black text-primary tracking-[0.4em] uppercase">Pricing Plans</h2>
              </div>
              <h2 className="text-3xl xs:text-4xl sm:text-6xl lg:text-7xl font-heading font-black mb-4 sm:mb-6 tracking-tighter leading-[0.95]">
                <span className="text-outline">Invest in</span><br />
                <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">Your Future.</span>
              </h2>
              <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto">Elite training shouldn&apos;t be a luxury. Choose the track that fits your ambition.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-5 max-w-6xl mx-auto items-end">
              {[
                { name: 'Starter', price: 'Free', desc: 'Atomic building blocks for serious aspirants.', features: ['5 AI Research Cycles / Day', 'Core Subject Benchmarks', 'Fundamental Gap Analysis', 'Curated Resource Hub', 'Community Access'], cta: 'Start Now', popular: false },
                { name: 'Pro', price: 'Waitlist', desc: 'The complete performance architecture.', features: ['Unlimited AI Research', 'Cognitive Failure Analysis', 'Dynamic Personalized Paths', 'Adaptive Arena Access', 'Rank Improvement Metrics', 'Focus & Velocity Tracking', 'Elite Community Access', 'Priority Support'], cta: 'Join Waitlist', popular: true, comingSoon: true },
                { name: 'Elite', price: 'Waitlist', desc: '1-on-1 performance engineering.', features: ['Everything in Pro', 'Personal AI Tutor Agent', 'Mastery-Based Explanations', 'End-to-End Milestone Maps', 'Rapid Revision Protocols', 'Mental Performance Gear', 'Advanced Predictive Ops'], cta: 'Join Waitlist', popular: false, comingSoon: true },
              ].map((plan, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * index, ease: [0.22, 1, 0.36, 1] }}
                  viewport={{ once: true }}
                  className={`shine-card relative flex flex-col rounded-3xl transition-all duration-500 hover:scale-[1.015] neu-raised
                    ${plan.popular
                      ? 'p-7 sm:p-10 ring-2 ring-primary/40 md:scale-[1.05] md:-translate-y-4 z-10 shadow-2xl shadow-primary/10'
                      : 'p-6 sm:p-8 opacity-90 hover:opacity-100'
                    }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-px left-0 right-0 h-[3px] rounded-t-3xl bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
                  )}
                  {plan.popular && (
                    <div className="mb-3 inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full neu-inset">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-[9px] font-heading font-black text-primary uppercase tracking-[0.2em]">Most Strategic</span>
                    </div>
                  )}
                  <div className="mb-6 sm:mb-8">
                    <h3 className="text-2xl font-heading font-black mb-2 tracking-tight text-foreground">{plan.name}</h3>
                    <div className={`text-4xl font-heading font-black mb-3 ${plan.popular ? 'text-primary' : 'text-foreground'}`}>{plan.price}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{plan.desc}</p>
                  </div>
                  <div className="flex-grow space-y-3.5 mb-8">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm font-bold text-foreground/80">
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto">
                    <LandingCTABtn
                      label={plan.cta}
                      onClick={handleBeginJourney}
                      className="w-full"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 relative z-10 border-t border-white/10 dark:border-black/20 bg-[hsl(var(--neu-bg))]">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center md:items-end justify-between gap-8">
            <div className="flex flex-col items-center md:items-start gap-2">
              <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.4em]">© 2026 SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</span>
              <div className="flex flex-wrap gap-2 sm:gap-4 text-xs text-muted-foreground mt-2">
                <a href="/terms-and-conditions" className="hover:text-foreground hover:underline transition-colors">Terms & Conditions</a>
                <span className="hidden sm:inline">•</span>
                <a href="/privacy-policy" className="hover:text-foreground hover:underline transition-colors">Privacy Policy</a>
                <span className="hidden sm:inline">•</span>
                <a href="/childrens-policy" className="hover:text-foreground hover:underline transition-colors">Children's Safety Policy</a>
                <span className="hidden sm:inline">•</span>
                <a href="/faq" className="hover:text-foreground hover:underline transition-colors">FAQ</a>
              </div>
              <img src="/origin-new.jpg" alt="ORIGIN" className="h-12 w-auto dark:brightness-110 mt-3" />
            </div>
            <div className="flex flex-col items-center md:items-end gap-4">
              <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.4em]">Connect With Us</span>
              <div className="flex gap-4 sm:gap-5 items-center">
                <a href="https://chat.whatsapp.com/BBwpKNeiCypGzeVMwsw9ns?mode=gi_t" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/Whatsapp-Logo.png" alt="WhatsApp" className="h-8 sm:h-10 w-auto" /></a>
                <a href="https://www.linkedin.com/in/o3-origin-ba73233a8/" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/LinkedIn.png" alt="LinkedIn" className="h-8 sm:h-10 w-auto" /></a>
                <a href="https://x.com/O3_origin" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/X.jpg" alt="X" className="h-8 sm:h-10 w-auto rounded-md" /></a>
                <a href="https://www.instagram.com/o3.origin/?hl=en" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform"><img src="/images/SocialMedia/Instagram.png" alt="Instagram" className="h-8 sm:h-10 w-auto" /></a>
              </div>
            </div>
          </div>
        </footer>

        {/* Mobile & Tablet Sticky bottom CTA */}
        <AnimatePresence>
          {showStickyCTA && (
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 left-0 right-0 z-40 lg:hidden px-4 pb-5 pt-3"
              style={{ background: 'linear-gradient(to top, hsl(var(--neu-bg)) 60%, transparent)' }}
            >
              <LandingCTABtn
                label="Begin Your Journey"
                onClick={handleBeginJourney}
                className="w-full"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Play with Ori — direct 3D interaction (tablet/desktop only) ────── */}
        {mounted && show3DMascot && (
          <>
            {/* Floating launcher */}
            <AnimatePresence>
              {!playMode && (
                <motion.button
                  type="button"
                  onClick={() => setPlayMode(true)}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 20 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className="fixed z-40 bottom-28 right-4 lg:bottom-6 lg:right-6 group flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full text-sm font-black tracking-tight text-white"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                    boxShadow: '0 8px 30px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}
                  aria-label="Play with Ori"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15">
                    <img
                      src="/ori2d/ori-happy.png"
                      alt=""
                      draggable={false}
                      className="w-6 h-6 object-contain select-none mascot-float-anim"
                    />
                  </span>
                  Play with Ori
                </motion.button>
              )}
            </AnimatePresence>

            {/* Foreground interaction overlay */}
            <AnimatePresence>
              {playMode && (
                <motion.div
                  className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Dim + blur backdrop — click to exit */}
                  <div
                    className="absolute inset-0 bg-black/75 backdrop-blur-md"
                    onClick={() => setPlayMode(false)}
                  />

                  {/* Interactive stage */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 24 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 24 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                    className="relative z-10 w-full max-w-[640px] rounded-3xl overflow-hidden border border-white/10"
                    style={{
                      background: 'linear-gradient(160deg, #141414, #0b0b0b)',
                      boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-4 pb-2">
                      <div className="flex items-center gap-2 text-white">
                        <Gamepad2 className="w-4 h-4 text-primary" />
                        <span className="text-sm font-black tracking-tight">Play with Ori</span>
                        <span className="text-[10px] font-semibold text-white/40 hidden sm:inline">drag to rotate · scroll to zoom</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPlayMode(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Exit
                      </button>
                    </div>

                    {/* Live 3D Ori — fully drag-rotatable; mood buttons let you play with it */}
                    <div className="relative w-full h-[52vh] max-h-[500px] min-h-[300px] pointer-events-auto">
                      <OriMascot
                        state={playMood}
                        className="w-full h-full"
                        preload={true}
                        interactive={true}
                        onOrbitChange={setOrbitCoords}
                      />
                      {/* Live rotation coordinates */}
                      <div className="pointer-events-none absolute top-3 left-3 flex gap-1.5 font-mono">
                        <span className="px-2 py-1 rounded-md text-[11px] font-bold text-primary bg-black/55 border border-white/10 backdrop-blur-sm">
                          yaw {orbitCoords.azimuthDeg}°
                        </span>
                        <span className="px-2 py-1 rounded-md text-[11px] font-bold text-primary bg-black/55 border border-white/10 backdrop-blur-sm">
                          pitch {orbitCoords.polarDeg}°
                        </span>
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>

                    {/* Mood controls */}
                    <div className="flex flex-wrap items-center justify-center gap-2 px-5 pb-5 pt-1">
                      {([
                        { mood: 'idle' as MascotState, img: 'ori-happy', label: 'Hi' },
                        { mood: 'curious' as MascotState, img: 'ori-curious', label: 'Curious' },
                        { mood: 'thinking' as MascotState, img: 'ori-thinking', label: 'Thinking' },
                        { mood: 'answering' as MascotState, img: 'ori-cheerful', label: 'Cheerful' },
                        { mood: 'success' as MascotState, img: 'ori-thubmsup', label: 'Yay' },
                      ]).map(({ mood, img, label }) => (
                        <button
                          key={mood}
                          type="button"
                          onClick={() => setPlayMood(mood)}
                          className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full text-xs font-black border transition-all ${
                            playMood === mood
                              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                              : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <img src={`/ori2d/${img}.png`} alt="" draggable={false} className="w-5 h-5 object-contain select-none" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </SmoothScroll>
  );
}