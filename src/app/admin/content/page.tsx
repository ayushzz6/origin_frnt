'use client';

import React from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { 
    BookOpen, 
    Code, 
    Calendar, 
    Video, 
    Zap, 
    ArrowRight,
    FileText,
    Database,
    Plus,
    Clock,
    Tag,
    Layers,
    Binary
} from 'lucide-react';
import { motion } from 'framer-motion';

const ToolCard = ({ title, desc, icon: Icon, stats, color, labels }: any) => (
    <div className="bg-white/5 border border-white/5 rounded-3xl p-8 hover:bg-white/[0.07] transition-all group relative overflow-hidden">
        <div className={`absolute -right-4 -top-4 w-32 h-32 bg-${color}-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity`} />
        <div className="flex items-start justify-between mb-6">
            <div className={`p-4 rounded-2xl bg-${color}-500/10 text-${color}-500 border border-${color}-500/20 group-hover:scale-110 transition-transform`}>
                <Icon className="w-8 h-8" />
            </div>
            <button className="p-3 bg-white/5 text-slate-500 rounded-xl hover:text-white transition-colors">
                <Plus className="w-5 h-5" />
            </button>
        </div>
        <div>
            <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-black uppercase tracking-tight text-white">{title}</h3>
                <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500`} />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-8 leading-relaxed max-w-[280px] line-clamp-2">
                {desc}
            </p>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-8">
            {stats.map((stat: any, i: number) => (
                <div key={i} className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">{stat.label}</span>
                    <span className="text-lg font-black text-white">{stat.value}</span>
                </div>
            ))}
        </div>
        <button className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-${color}-500 text-zinc-950 font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all`}>
            Launch Engine <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </button>
    </div>
);

export default function ContentHub() {
    return (
        <AdminLayout>
            <div className="space-y-12 pb-20">
                {/* Hero Section */}
                <div className="max-w-3xl">
                    <p className="text-xs font-black uppercase tracking-[0.4em] text-emerald-500 mb-3 italic">Learning Management System</p>
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-white mb-6">Academic Content <span className="text-slate-700">Infrastructure</span></h1>
                    <p className="text-slate-400 font-medium leading-relaxed uppercase text-sm">Centralized control for high-fidelity mock tests, coding arenas, and premium video assets. Automated deployment and trend-based DPP generation.</p>
                </div>

                {/* Main LMS Tools Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <ToolCard 
                        title="Question Bank" 
                        desc="Physics, Chemistry, Maths & Biology repository with full LaTeX support." 
                        icon={Database} 
                        color="blue"
                        stats={[
                            { label: 'Q-COUNT', value: '48,201' },
                            { label: 'LAST UPLOAD', value: '08:42 AM' }
                        ]}
                    />
                    <ToolCard 
                        title="OGCode Editor" 
                        desc="Custom IDE for coding tests. Manage boilerplate and grader test-cases." 
                        icon={Binary} 
                        color="emerald"
                        stats={[
                            { label: 'CHALLENGES', value: '1,402' },
                            { label: 'DEPLOYED', value: '98%' }
                        ]}
                    />
                    <ToolCard 
                        title="Batch Scheduler" 
                        desc="Timed mock tests and DPP releases for multiple class cohorts." 
                        icon={Clock} 
                        color="amber"
                        stats={[
                            { label: 'SCHEDULED', value: '12' },
                            { label: 'REACH', value: '85k+' }
                        ]}
                    />
                    <ToolCard 
                        title="Study Corner" 
                        desc="Premium lecture hub for video assets, PDFs, and notes management." 
                        icon={Video} 
                        color="rose"
                        stats={[
                            { label: 'LECTURES', value: '2,840' },
                            { label: 'SPACE USED', value: '1.2 TB' }
                        ]}
                    />
                    <ToolCard 
                        title="DPP Engine" 
                        desc="Trend-aware curation tool to auto-generate practice sheets." 
                        icon={Zap} 
                        color="purple"
                        stats={[
                            { label: 'CURATED', value: '12.4k' },
                            { label: 'ALGO-HEALTH', value: 'Optimal' }
                        ]}
                    />
                    <ToolCard 
                        title="Tags & Taxonomy" 
                        desc="Global curricula management for chapters and concepts." 
                        icon={Tag} 
                        color="cyan"
                        stats={[
                            { label: 'TOPICS', value: '840' },
                            { label: 'HIERARCHY', value: 'Active' }
                        ]}
                    />
                </div>

                {/* Batch Deployment Preview */}
                <div className="bg-white/5 border border-white/5 rounded-[2rem] p-8 lg:p-12">
                    <div className="flex flex-col lg:flex-row gap-12">
                        <div className="lg:w-1/3 space-y-6">
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white">Release <span className="text-slate-600 font-normal italic">Monitor</span></h2>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed uppercase">Real-time status of scheduled batches across different regions and student tiers.</p>
                            
                            <div className="space-y-3">
                                {[
                                    { label: 'NEET 2026 MOCK #14', status: 'In 2h 40m', color: 'bg-emerald-500' },
                                    { label: 'JEE MAINS REVISION #02', status: 'Active Now', color: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse' },
                                    { label: 'CLASS 11 DPP - KINEMATICS', status: 'Tomorrow 08:00', color: 'bg-slate-700' }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${item.color}`} />
                                            <span className="text-[10px] font-black tracking-widest text-white uppercase">{item.label}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{item.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 bg-zinc-950/50 border border-white/5 rounded-3xl p-8 flex items-center justify-center text-center">
                            <div>
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 mx-auto border border-white/5">
                                    <Layers className="w-8 h-8 text-slate-700" />
                                </div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Cohort Visualization Mode</h3>
                                <p className="text-xs text-slate-600 max-w-[320px] uppercase font-bold leading-relaxed">Map views showing real-time test participation and score clusters are loading.</p>
                                <button className="mt-8 px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Enable Mission Radar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
