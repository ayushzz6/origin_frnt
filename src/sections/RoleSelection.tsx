'use client';
import { Button } from '@/components/ui/button';
import { GraduationCap, BookOpen, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

interface RoleSelectionProps {
    onSelectRole: (role: 'student' | 'teacher') => void;
    onBack: () => void;
}

export default function RoleSelection({ onSelectRole, onBack }: RoleSelectionProps) {
    const [hoveredRole, setHoveredRole] = useState<'student' | 'teacher' | null>(null);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground transition-colors duration-500 overflow-hidden relative">
            {/* Background Decoration */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply dark:mix-blend-screen"
                style={{
                    backgroundImage: `radial-gradient(circle at 80% 30%, var(--primary) 0%, transparent 40%),
                                     radial-gradient(circle at 20% 70%, var(--primary) 0%, transparent 40%)`
                }}>
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
            </div>

            <div className="w-full max-w-3xl relative z-10">
                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back to home</span>
                </button>

                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                        How will you use ORIGIN?
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Select your role to get a personalized experience
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Student Card */}
                    <div
                        className={`group relative p-8 rounded-3xl border transition-all duration-500 cursor-pointer overflow-hidden ${hoveredRole === 'student'
                            ? 'bg-card border-primary/50 shadow-[0_0_40px_rgba(var(--primary-rgb),0.1)] dark:shadow-[0_0_40px_rgba(var(--primary-rgb),0.2)] scale-[1.02]'
                            : 'bg-card/40 backdrop-blur-xl border-border/40 hover:border-black/5 dark:hover:border-white/10 hover:bg-card/80 shadow-xl'
                            }`}
                        onMouseEnter={() => setHoveredRole('student')}
                        onMouseLeave={() => setHoveredRole(null)}
                        onClick={() => onSelectRole('student')}
                    >
                        <div className={`absolute top-6 right-6 transition-opacity duration-300 ${hoveredRole === 'student' ? 'opacity-100' : 'opacity-0'
                            }`}>
                            <CheckCircle2 className="w-6 h-6 text-primary" />
                        </div>

                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 ${hoveredRole === 'student' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                            <GraduationCap className="w-8 h-8" />
                        </div>

                        <h3 className="text-2xl font-bold text-foreground mb-3">Student</h3>
                        <p className="text-muted-foreground mb-6 leading-relaxed">
                            I want to prepare for JEE exams, take AI-powered tests, and track my progress.
                        </p>

                        <ul className="space-y-3 mb-8">
                            {[
                                'Personalized Study Plan',
                                'AI-Driven Mock Tests',
                                'Concept Mastery Tracking',
                                '24/7 Doubt Solving'
                            ].map((feature, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <div className={`w-1.5 h-1.5 rounded-full ${hoveredRole === 'student' ? 'bg-primary' : 'bg-muted-foreground/30'
                                        }`} />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Button
                            className={`w-full py-6 text-base font-semibold transition-all duration-300 ${hoveredRole === 'student'
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                        >
                            Continue as Student
                        </Button>
                    </div>

                    {/* Teacher Card */}
                    <div
                        className={`group relative p-8 rounded-3xl border transition-all duration-500 cursor-pointer overflow-hidden ${hoveredRole === 'teacher'
                            ? 'bg-card border-primary/50 shadow-[0_0_40px_rgba(var(--primary-rgb),0.1)] dark:shadow-[0_0_40px_rgba(var(--primary-rgb),0.2)] scale-[1.02]'
                            : 'bg-card/40 backdrop-blur-xl border-border/40 hover:border-black/5 dark:hover:border-white/10 hover:bg-card/80 shadow-xl'
                            }`}
                        onMouseEnter={() => setHoveredRole('teacher')}
                        onMouseLeave={() => setHoveredRole(null)}
                        onClick={() => onSelectRole('teacher')}
                    >
                        <div className={`absolute top-6 right-6 transition-opacity duration-300 ${hoveredRole === 'teacher' ? 'opacity-100' : 'opacity-0'
                            }`}>
                            <CheckCircle2 className="w-6 h-6 text-primary" />
                        </div>

                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 ${hoveredRole === 'teacher' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                            <BookOpen className="w-8 h-8" />
                        </div>

                        <h3 className="text-2xl font-bold text-foreground mb-3">Teacher / Institution</h3>
                        <p className="text-muted-foreground mb-6 leading-relaxed">
                            I want to create tests, manage students, and analyze class performance.
                        </p>

                        <ul className="space-y-3 mb-8">
                            {[
                                'Create Custom Tests',
                                'Monitor Student Progress',
                                'Detailed Class Analytics',
                                'Assignment Management'
                            ].map((feature, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <div className={`w-1.5 h-1.5 rounded-full ${hoveredRole === 'teacher' ? 'bg-primary' : 'bg-muted-foreground/30'
                                        }`} />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Button
                            className={`w-full py-6 text-base font-semibold transition-all duration-300 ${hoveredRole === 'teacher'
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                        >
                            Continue as Teacher
                        </Button>
                    </div>

                </div>
            </div>
        </div>
    );
}
