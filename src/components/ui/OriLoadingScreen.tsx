'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const FRAMES = [
  { src: '/ori2d/ori-thinking.png',   msg: 'Thinking…'        },
  { src: '/ori2d/ori-reading.png',    msg: 'Loading…'          },
  { src: '/ori2d/ori-curious.png',    msg: 'Fetching data…'    },
  { src: '/ori2d/ori-cheerful.png',   msg: 'Almost there!'     },
  { src: '/ori2d/ori-determined.png', msg: 'Getting ready…'    },
  { src: '/ori2d/ori-exited.png',     msg: 'One moment!'       },
  { src: '/ori2d/ori-happy.png',      msg: 'Here we go!'       },
];

interface Props { fullscreen?: boolean }

export default function OriLoadingScreen({ fullscreen = false }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % FRAMES.length), 1400);
    return () => clearInterval(t);
  }, []);

  const frame = FRAMES[idx];

  return (
    <div className={cn(
      'flex flex-col items-center justify-center neu-surface',
      fullscreen ? 'fixed inset-0 z-50' : 'min-h-[70vh] w-full',
    )}>
      {/* ambient glow */}
      <div className="absolute w-56 h-56 rounded-full bg-primary/8 blur-[70px] pointer-events-none" />

      {/* floating neumorphic avatar shell */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="relative neu-raised rounded-[28px] w-40 h-40 flex items-center justify-center overflow-hidden"
      >
        {/* pulsing ring */}
        <motion.div
          className="absolute inset-0 rounded-[28px] border-2 border-primary/25"
          animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.04, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* cycling Ori expression */}
        <AnimatePresence mode="wait">
          <motion.img
            key={frame.src}
            src={frame.src}
            alt="Ori"
            draggable={false}
            className="w-28 h-28 object-contain select-none"
            initial={{ opacity: 0, scale: 0.76 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.76 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          />
        </AnimatePresence>
      </motion.div>

      {/* loading message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={frame.msg}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.18 }}
          className="mt-6 text-[11px] font-black tracking-[0.2em] text-primary uppercase"
        >
          {frame.msg}
        </motion.p>
      </AnimatePresence>

      {/* step pill dots */}
      <div className="flex gap-1.5 mt-3">
        {FRAMES.map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              'h-[6px] rounded-full transition-colors duration-300',
              i === idx ? 'bg-primary' : 'bg-muted-foreground/25',
            )}
            animate={{ width: i === idx ? 18 : 6 }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}
