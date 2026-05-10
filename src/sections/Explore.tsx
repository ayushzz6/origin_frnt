import { motion } from 'framer-motion';
import {
    BookOpen,
    Trophy,
    FileText,
    Target,
    TrendingUp,
    Settings,
    User,
    ArrowRight,
    Timer
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ViewState } from '@/types';

interface ExploreProps {
    onNavigate: (view: ViewState) => void;
}

export default function Explore({ onNavigate }: ExploreProps) {
    const exploreCards = [
        {
            title: 'Study Corner',
            description: 'Access NCERT books, curated notes, and interactive study material.',
            icon: BookOpen,
            view: 'study-corner' as ViewState,
            color: 'from-rose-500 to-pink-500',
            stats: '150+ Resources'
        },
        {
            title: 'Tests & Assessments',
            description: 'Practice JEE-level mock tests and detailed subject-wise assessments.',
            icon: FileText,
            view: 'test-list' as ViewState,
            color: 'from-rose-600 to-pink-600',
            stats: '500+ Questions'
        },
        {
            title: 'Arena Leaderboard',
            description: 'See where you stand globally. Track your progress against the best.',
            icon: Trophy,
            view: 'leaderboard' as ViewState,
            color: 'from-amber-500 to-orange-500',
            stats: 'Top 1%'
        },
        {
            title: 'Daily Practice (DPP)',
            description: 'Personalized problem sets generated daily based on your performance.',
            icon: Target,
            view: 'dpp' as ViewState,
            color: 'from-emerald-500 to-teal-500',
            stats: 'Updated Daily'
        },
        {
            title: 'My Profile',
            description: 'Manage your personal details, plan, and academic preferences.',
            icon: User,
            view: 'profile' as ViewState,
            color: 'from-rose-700 to-pink-800',
            stats: 'Active'
        },
        {
            title: 'Settings',
            description: 'Configure your experience, theme, and notification preferences.',
            icon: Settings,
            view: 'profile' as ViewState, // Reuse profile for now or add settings
            color: 'from-gray-400 to-gray-600',
            stats: 'Configured'
        },
        {
            title: 'Focus Timer',
            description: 'Master your time with Pomodoro sessions and track your deep work hours.',
            icon: Timer,
            view: 'pomodoro' as ViewState,
            color: 'from-rose-500 to-red-600',
            stats: 'Productivity'
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: 'spring' as const,
                stiffness: 100
            }
        }
    };

    return (
        <div className="min-h-screen pt-12 pb-24 px-4 sm:px-6 lg:px-8 bg-background text-foreground transition-colors duration-500">
            {/* Ambient Background Elements */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[20%] right-[-5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[10%] left-[-5%] w-[30%] h-[30%] bg-rose-500/5 rounded-full blur-[80px]" />
            </div>

            {/* Header Section */}
            <div className="max-w-7xl mx-auto mb-12 sm:mb-20 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="text-center lg:text-left pt-10"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6 mx-auto lg:mx-0">
                        <TrendingUp className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Academic Ecosystem</span>
                    </div>
                    <h1 className="text-5xl lg:text-7xl font-black tracking-tight mb-6">
                        Explore <span className="text-gradient">Origin</span>
                    </h1>
                    <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl lg:ml-0 mx-auto leading-relaxed font-medium">
                        Your central command for mastery. Access practice modules, performance assessments, and professional growth tools.
                    </p>
                </motion.div>
            </div>

            {/* Grid Section */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 relative z-10"
            >
                {exploreCards.map((card, index) => (
                    <motion.div
                        key={index}
                        variants={itemVariants}
                        whileHover={{ scale: 1.02, y: -8 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onNavigate(card.view)}
                        className="group relative cursor-pointer"
                    >
                        {/* Interactive Background Glow */}
                        <div className={`absolute -inset-0.5 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-20 rounded-[2.6rem] blur-xl transition-all duration-500`} />
                        
                        <div className="relative glass premium-shadow rounded-[2.5rem] p-8 sm:p-10 flex flex-col h-full min-h-[340px] transition-all duration-300 group-hover:border-primary/50">
                            {/* Icon Box */}
                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${card.color} p-4 text-white shadow-xl group-hover:shadow-[0_0_30px_rgba(0,0,0,0.2)] mb-8 transition-all group-hover:scale-110 group-hover:rotate-6 duration-500`}>
                                <card.icon className="w-full h-full stroke-[2.5px]" />
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors">{card.title}</h3>
                                    <ArrowRight className="w-6 h-6 text-primary opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300" />
                                </div>
                                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-medium">
                                    {card.description}
                                </p>
                            </div>

                            <div className="mt-8 pt-6 border-t border-border/10 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Module Status</span>
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 font-bold px-3 py-1">
                                    {card.stats}
                                </Badge>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
