import { Star, Zap, Trophy, Crown } from 'lucide-react';

export const TIER_THRESHOLDS = [
  { tier: 'Novice', min: 0, next: 100, icon: Star, color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/30', glow: '' },
  { tier: 'Beginner', min: 100, next: 300, icon: Star, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30', glow: 'shadow-green-500/20' },
  { tier: 'Apprentice', min: 300, next: 600, icon: Star, color: 'text-teal-400', bg: 'bg-teal-400/10', border: 'border-teal-400/30', glow: 'shadow-teal-500/20' },
  { tier: 'Intermediate', min: 600, next: 1000, icon: Zap, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30', glow: 'shadow-blue-500/20' },
  { tier: 'Advanced', min: 1000, next: 1500, icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/30', glow: 'shadow-indigo-500/20' },
  { tier: 'Elite', min: 1500, next: 2200, icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30', glow: 'shadow-cyan-500/20' },
  { tier: 'Expert', min: 2200, next: 3200, icon: Zap, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30', glow: 'shadow-purple-500/20' },
  { tier: 'Veteran', min: 3200, next: 4500, icon: Trophy, color: 'text-pink-400', bg: 'bg-pink-400/10', border: 'border-pink-400/30', glow: 'shadow-pink-500/20' },
  { tier: 'Master', min: 4500, next: 6000, icon: Trophy, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', glow: 'shadow-orange-500/20' },
  { tier: 'Grandmaster', min: 6000, next: 8000, icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', glow: 'shadow-amber-500/20' },
  { tier: 'Legend', min: 8000, next: 12000, icon: Crown, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30', glow: 'shadow-rose-500/20' },
  { tier: 'Mythic', min: 12000, next: 18000, icon: Crown, color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', glow: 'shadow-fuchsia-500/20' },
  { tier: 'Immortal', min: 18000, next: 25000, icon: Crown, color: 'text-violet-600', bg: 'bg-violet-600/10', border: 'border-violet-600/30', glow: 'shadow-violet-600/20' },
  { tier: 'Eternal', min: 25000, next: 40000, icon: Crown, color: 'text-blue-600', bg: 'bg-blue-600/10', border: 'border-blue-600/30', glow: 'shadow-blue-600/20' },
  { tier: 'Prime', min: 40000, next: 60000, icon: Crown, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
  { tier: 'Celestial', min: 60000, next: 90000, icon: Crown, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30', glow: 'shadow-blue-400/40' },
  { tier: 'Ascendant', min: 90000, next: 130000, icon: Crown, color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/30', glow: 'shadow-violet-400/40' },
  { tier: 'Divine', min: 130000, next: 200000, icon: Crown, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', glow: 'shadow-amber-500/50' },
  { tier: 'Omniscient', min: 200000, next: 300000, icon: Crown, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30', glow: 'shadow-rose-500/60' },
  { tier: 'Origin', min: 300000, next: Infinity, icon: Crown, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30', glow: 'shadow-primary/70' },
];

export const getUserTitle = (user: { selectedCourse?: string }) => {
  const course = user.selectedCourse?.toUpperCase() || '';
  if (course.includes('NEET')) return 'Dr.';
  if (course.includes('JEE')) return 'Er.';
  return '';
};

export const getTier = (points: number) => {
  return [...TIER_THRESHOLDS].reverse().find(t => points >= t.min) || TIER_THRESHOLDS[0];
};
