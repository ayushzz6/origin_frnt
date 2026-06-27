'use client';
import { GraduationCap, BookOpen, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface RoleSelectionProps {
    onSelectRole: (role: 'student' | 'teacher') => void;
    onBack: () => void;
}

const NEU_BG   = '#e0e0e0';
const NEU_DARK = '#bebebe';
const NEU_LITE = '#ffffff';

const raised  = `15px 15px 30px ${NEU_DARK}, -15px -15px 30px ${NEU_LITE}`;
const inset   = `inset 8px 8px 18px ${NEU_DARK}, inset -8px -8px 18px ${NEU_LITE}`;
const iconBox = `5px 5px 12px ${NEU_DARK}, -5px -5px 12px ${NEU_LITE}`;
const pressed = `inset 4px 4px 10px ${NEU_DARK}, inset -4px -4px 10px ${NEU_LITE}`;

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
    const [hoveredCta, setHoveredCta] = useState<'student' | 'teacher' | null>(null);

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-6"
            style={{ background: NEU_BG }}
        >
            {/* Back */}
            <div className="w-full max-w-2xl mb-8">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm font-semibold transition-all duration-200"
                    style={{ color: '#888' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#888')}
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
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3" style={{ color: '#333' }}>
                    How will you use <span style={{ color: 'hsl(var(--primary))' }}>ORIGIN</span>?
                </h1>
                <p className="text-base" style={{ color: '#777' }}>
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
                            className="flex-1 flex flex-col gap-5 p-7 cursor-pointer select-none"
                            style={{
                                background: NEU_BG,
                                borderRadius: '30px',
                                boxShadow: isActive ? inset : raised,
                                transition: 'box-shadow 0.25s ease, transform 0.2s ease',
                                transform: isActive ? 'scale(0.98)' : 'scale(1)',
                                minWidth: 260,
                            }}
                            onMouseEnter={e => {
                                if (!isActive) {
                                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isActive) {
                                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                                }
                            }}
                        >
                            {/* Icon */}
                            <div
                                className="w-14 h-14 flex items-center justify-center rounded-2xl"
                                style={{ background: NEU_BG, boxShadow: isActive ? pressed : iconBox }}
                            >
                                <role.Icon
                                    className="w-7 h-7 transition-colors duration-300"
                                    style={{ color: isActive ? 'hsl(var(--primary))' : '#999' }}
                                />
                            </div>

                            {/* Text */}
                            <div>
                                <h3 className="text-xl font-black mb-1.5" style={{ color: '#333' }}>{role.title}</h3>
                                <p className="text-sm leading-relaxed" style={{ color: '#777' }}>{role.subtitle}</p>
                            </div>

                            {/* Features */}
                            <ul className="space-y-2.5">
                                {role.features.map((f) => (
                                    <li key={f} className="flex items-center gap-3 text-sm" style={{ color: '#666' }}>
                                        <div
                                            className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300"
                                            style={{ background: isActive ? 'hsl(var(--primary))' : '#bbb' }}
                                        />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <button
                                type="button"
                                className="mt-2 w-full py-3 rounded-[16px] text-sm font-black uppercase tracking-widest transition-all duration-300"
                                onMouseEnter={() => !isActive && setHoveredCta(role.id)}
                                onMouseLeave={() => setHoveredCta(null)}
                                style={{
                                    background: (isActive || hoveredCta === role.id) ? 'hsl(var(--primary))' : NEU_BG,
                                    color: (isActive || hoveredCta === role.id) ? '#fff' : '#999',
                                    boxShadow: (isActive || hoveredCta === role.id)
                                        ? `0 8px 24px hsl(var(--primary)/0.35)`
                                        : `6px 6px 14px ${NEU_DARK}, -6px -6px 14px ${NEU_LITE}`,
                                    border: 'none',
                                    outline: 'none',
                                    transform: hoveredCta === role.id && !isActive ? 'translateY(-1px)' : undefined,
                                }}
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
