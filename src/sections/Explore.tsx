import { motion } from 'framer-motion';
import {
    BookOpen,
    Trophy,
    FileText,
    Target,
    Timer,
    User,
    Settings,
    ArrowRight,
} from 'lucide-react';
import type { ViewState } from '@/types';

interface ExploreProps {
    onNavigate: (view: ViewState) => void;
}

const CARDS = [
    {
        title: 'Study Corner',
        description: 'NCERT books, curated notes, and interactive study material in one place.',
        icon: BookOpen,
        view: 'study-corner' as ViewState,
        accent: 'text-rose-500',
        accentBg: 'bg-rose-500/10 dark:bg-rose-500/15',
        stat: '150+ Resources',
    },
    {
        title: 'Tests & Assessments',
        description: 'JEE-level mock tests and subject-wise assessments with detailed analytics.',
        icon: FileText,
        view: 'test-list' as ViewState,
        accent: 'text-indigo-500',
        accentBg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
        stat: '500+ Questions',
    },
    {
        title: 'Arena Leaderboard',
        description: 'See where you stand globally and track your progress against the best.',
        icon: Trophy,
        view: 'leaderboard' as ViewState,
        accent: 'text-amber-500',
        accentBg: 'bg-amber-500/10 dark:bg-amber-500/15',
        stat: 'Top 1%',
    },
    {
        title: 'Daily Practice (DPP)',
        description: 'Personalised problem sets generated daily based on your performance.',
        icon: Target,
        view: 'dpp' as ViewState,
        accent: 'text-emerald-500',
        accentBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
        stat: 'Updated Daily',
    },
    {
        title: 'My Profile',
        description: 'Manage your personal details, plan, and academic preferences.',
        icon: User,
        view: 'profile' as ViewState,
        accent: 'text-sky-500',
        accentBg: 'bg-sky-500/10 dark:bg-sky-500/15',
        stat: 'Active',
    },
    {
        title: 'Focus Timer',
        description: 'Master your time with Pomodoro sessions and track deep work hours.',
        icon: Timer,
        view: 'pomodoro' as ViewState,
        accent: 'text-orange-500',
        accentBg: 'bg-orange-500/10 dark:bg-orange-500/15',
        stat: 'Productivity',
    },
    {
        title: 'Settings',
        description: 'Configure your experience, theme, and notification preferences.',
        icon: Settings,
        view: 'profile' as ViewState,
        accent: 'text-slate-500',
        accentBg: 'bg-slate-500/10 dark:bg-slate-500/15',
        stat: 'Configured',
    },
] as const;

export default function Explore({ onNavigate }: ExploreProps) {
    return (
        <div className="min-h-screen neu-surface font-sans">
            <main className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">

                {/* Page header */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-1 pt-2"
                >
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
                        Explore <span className="text-primary">Origin</span>
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                        Your central command for mastery — practice modules, assessments, and growth tools.
                    </p>
                </motion.div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {CARDS.map((card, i) => (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.32, delay: 0.05 * i }}
                            onClick={() => onNavigate(card.view)}
                            className="neu-raised neu-pressable cursor-pointer group flex flex-col gap-4 p-5 min-h-[200px]"
                        >
                            {/* Icon */}
                            <div className={`w-11 h-11 rounded-2xl ${card.accentBg} flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                                <card.icon className={`w-5 h-5 ${card.accent}`} />
                            </div>

                            {/* Text */}
                            <div className="flex-1 space-y-1.5">
                                <h3 className="font-black text-base text-foreground leading-tight group-hover:text-primary transition-colors duration-200">
                                    {card.title}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {card.description}
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/20">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${card.accent}`}>
                                    {card.stat}
                                </span>
                                <ArrowRight className={`w-4 h-4 ${card.accent} opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300`} />
                            </div>
                        </motion.div>
                    ))}
                </div>

            </main>
        </div>
    );
}
