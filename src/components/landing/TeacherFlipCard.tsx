'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BookOpen, BarChart2, Users, Zap } from 'lucide-react';

const STUDENT_POINTS = [
  { icon: Zap, text: '24/7 AI mentor that remembers your history' },
  { icon: BookOpen, text: '12,620+ curated JEE / NEET questions' },
  { icon: BarChart2, text: 'Real-time percentile + velocity tracking' },
  { icon: Users, text: 'Live study rooms with peer presence' },
];

const TEACHER_POINTS = [
  { icon: Users, text: 'Assign DPPs to your entire batch in 30 seconds' },
  { icon: BarChart2, text: 'Per-student analytics — see every weak topic' },
  { icon: BookOpen, text: 'Custom test creation with AI grading' },
  { icon: Zap, text: 'Connect billing + enrollment, automated' },
];

type Audience = 'student' | 'teacher';

export default function TeacherFlipCard() {
  const [active, setActive] = useState<Audience>('student');

  const isStudent = active === 'student';

  return (
    <section className="py-24 lg:py-32 relative z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_60%,rgba(0,102,255,0.05),transparent)] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-12"
        >
          <span className="text-[10px] font-black text-primary tracking-[0.4em] uppercase block mb-4">Two Audiences, One Platform</span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter mb-6">
            <span className="text-outline">Built for</span>{' '}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">both sides</span>{' '}
            <span className="text-outline">of the classroom.</span>
          </h2>

          {/* Toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-black/10 dark:border-white/10 bg-gray-100 dark:bg-white/5 backdrop-blur-sm">
            {(['student', 'teacher'] as Audience[]).map((a) => (
              <button
                key={a}
                onClick={() => setActive(a)}
                className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                  active === a
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'text-gray-600 dark:text-white/50 hover:text-white'
                }`}
              >
                {a === 'student' ? 'For Students' : 'For Teachers'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Flip card content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, rotateY: -12, scale: 0.97 }}
            animate={{ opacity: 1, rotateY: 0, scale: 1 }}
            exit={{ opacity: 0, rotateY: 12, scale: 0.97 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="grid md:grid-cols-2 gap-8 items-stretch"
          >
            {/* Content panel */}
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-gray-100 dark:bg-white/[0.03] backdrop-blur-xl p-8 space-y-5">
              <div>
                <p className="text-[10px] font-black text-primary tracking-[0.35em] uppercase mb-2">
                  {isStudent ? 'Student experience' : 'Teacher dashboard'}
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                  {isStudent
                    ? 'Everything you need to crack JEE / NEET.'
                    : 'Run your batch like a top coaching centre.'}
                </h3>
              </div>

              <div className="space-y-4">
                {(isStudent ? STUDENT_POINTS : TEACHER_POINTS).map(({ icon: Icon, text }, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.35 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-none mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-white/70 font-medium leading-relaxed">{text}</p>
                  </motion.div>
                ))}
              </div>

              <motion.a
                href={isStudent ? '/auth/register' : '/auth/register?role=teacher'}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/30 mt-2"
              >
                {isStudent ? 'Start for free' : 'Set up your batch'}
                <ArrowRight className="w-3.5 h-3.5" />
              </motion.a>
            </div>

            {/* Visual placeholder */}
            <div className="rounded-2xl border border-dashed border-black/20 dark:border-white/20 bg-gray-100 dark:bg-white/[0.02] flex flex-col items-center justify-center gap-4 p-8 min-h-[340px]">
              <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-black/20 dark:border-white/20 flex items-center justify-center">
                {isStudent
                  ? <BarChart2 className="w-6 h-6 text-gray-400 dark:text-white/20" />
                  : <Users className="w-6 h-6 text-gray-400 dark:text-white/20" />}
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-black text-gray-500 dark:text-white/30 uppercase tracking-widest">
                  {isStudent ? 'IMAGE' : 'IMAGE'}
                </p>
                <p className="text-xs text-gray-400 dark:text-white/25 font-medium max-w-[220px] leading-relaxed">
                  {isStudent
                    ? 'Dashboard screenshot — analytics view, 1600×1000 PNG · place at /images/screenshots/student-dashboard.png'
                    : 'Teacher batch view screenshot — student list, DPP assignment panel, 1600×1000 PNG · place at /images/screenshots/teacher-dashboard.png'}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
