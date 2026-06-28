'use client';
import { GraduationCap, BookOpen, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RoleSelectionProps {
    onSelectRole: (role: 'student' | 'teacher') => void;
    onBack: () => void;
}

const ROLES = [
    {
        id: 'student' as const,
        Icon: GraduationCap,
        title: 'Student',
        subtitle: 'Prepare for JEE with AI-powered tools and adaptive practice.',
        features: ['Personalised Study Plan', 'AI Mock Tests', 'Concept Mastery Tracking', '24/7 Doubt Solving'],
        cta: 'Continue as Student',
    },
    {
        id: 'teacher' as const,
        Icon: BookOpen,
        title: 'Teacher / Institution',
        subtitle: 'Create tests, manage students, and analyse class performance.',
        features: ['Create Custom Tests', 'Monitor Student Progress', 'Detailed Class Analytics', 'Assignment Management'],
        cta: 'Continue as Teacher',
    },
];

export default function RoleSelection({ onSelectRole, onBack }: RoleSelectionProps) {
    const [selected, setSelected] = useState<'student' | 'teacher' | null>(null);

    return (
        <div className="min-h-screen neu-surface flex flex-col items-center justify-center p-6 text-foreground">
            {/* Back */}
            <div className="w-full max-w-2xl mb-8">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to home
                </button>
            </div>

            {/* Heading */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-center mb-12"
            >
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3 text-foreground">
                    How will you use <span className="text-primary">ORIGIN</span>?
                </h1>
                <p className="text-base text-muted-foreground">
                    Select your role to get a personalised experience
                </p>
            </motion.div>

            {/* Cards */}
            <div className="flex flex-col sm:flex-row gap-8 w-full max-w-2xl justify-center">
                {ROLES.map((role, i) => {
                    const isActive = selected === role.id;
                    return (
                        <motion.div
                            key={role.id}
                            initial={{ opacity: 0, y: 28 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 + 0.12 * i, ease: [0.22, 1, 0.36, 1] }}
                            onClick={() => { setSelected(role.id); onSelectRole(role.id); }}
                            className={cn(
                                'flex-1 flex flex-col gap-5 p-7 cursor-pointer select-none rounded-[30px] transition-all duration-200',
                                isActive
                                    ? 'neu-inset ring-2 ring-primary scale-[0.98]'
                                    : 'neu-raised hover:scale-[1.02]'
                            )}
                            style={{ minWidth: 260 }}
                        >
                            {/* Icon */}
                            <div className={cn(
                                'w-14 h-14 flex items-center justify-center rounded-2xl transition-all',
                                isActive ? 'neu-inset' : 'neu-raised'
                            )}>
                                <role.Icon
                                    className={cn(
                                        'w-7 h-7 transition-colors duration-300',
                                        isActive ? 'text-primary' : 'text-muted-foreground'
                                    )}
                                />
                            </div>

                            {/* Text */}
                            <div>
                                <h3 className="text-xl font-black mb-1.5 text-foreground">{role.title}</h3>
                                <p className="text-sm leading-relaxed text-muted-foreground">{role.subtitle}</p>
                            </div>

                            {/* Features */}
                            <ul className="space-y-2.5">
                                {role.features.map((f) => (
                                    <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <div className={cn(
                                            'w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300',
                                            isActive ? 'bg-primary' : 'bg-muted-foreground/40'
                                        )} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <button
                                type="button"
                                className={cn(
                                    'mt-2 w-full py-3 rounded-[16px] text-sm font-black uppercase tracking-widest transition-all duration-300',
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/0.35)]'
                                        : 'neu-raised text-muted-foreground hover:text-primary hover:-translate-y-0.5'
                                )}
                            >
                                {isActive ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> Selected
                                    </span>
                                ) : role.cta}
                            </button>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
