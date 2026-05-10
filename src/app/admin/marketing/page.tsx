'use client';

import React from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { 
    Zap, 
    MessageSquare, 
    Layout, 
    Send, 
    Image, 
    Bell, 
    ChevronRight,
    Search,
    Plus,
    UserCircle,
    Flag,
    CheckCircle2,
    Calendar,
    ArrowUpRight,
    Target
} from 'lucide-react';
import { motion } from 'framer-motion';

const CampaignCard = ({ title, status, date, color, type }: any) => (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between group cursor-default">
        <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 text-${color}-500 border border-${color}-500/20 flex items-center justify-center`}>
                {type === 'push' ? <Zap className="w-5 h-5" /> : <Layout className="w-5 h-5" />}
            </div>
            <div>
                <p className="text-xs font-black text-white group-hover:text-emerald-400 transition-colors">{title}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{date} • {status}</p>
            </div>
        </div>
        <button className="p-2 text-slate-600 hover:text-white transition-colors"><ChevronRight className="w-4 h-4" /></button>
    </div>
);

export default function Marketing() {
    return (
        <AdminLayout>
            <div className="space-y-12 pb-24">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Broadcast Center */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Send className="w-24 h-24" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-8">Broadcast <span className="text-slate-700 italic font-normal">Command</span></h2>
                            
                            <div className="space-y-6 max-w-2xl">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Target Audience Segment</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['All Users', 'NEET 2026', 'JEE 2025', 'Class 12', 'Premium Only', 'Inactive (7d+)'].map((chip) => (
                                            <button key={chip} className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/10 hover:text-white transition-all">
                                                {chip}
                                            </button>
                                        ))}
                                        <button className="p-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full hover:bg-emerald-500 hover:text-zinc-950 transition-all"><Plus className="w-3 h-3" /></button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <input 
                                        type="text" 
                                        placeholder="Notification Title (e.g. Major Mock Test Release)"
                                        className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                                    />
                                    <textarea 
                                        placeholder="Broadcast message content... (HTML/Markdown supported)"
                                        rows={4}
                                        className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-4">
                                    <div className="flex items-center gap-4">
                                        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
                                            <Calendar className="w-4 h-4 text-slate-600" />
                                            Schedule
                                        </button>
                                        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
                                            <Target className="w-4 h-4 text-slate-600" />
                                            A/B Test
                                        </button>
                                    </div>
                                    <button className="px-10 py-4 bg-emerald-500 text-zinc-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-3">
                                        Initiate Blast
                                        <Zap className="w-4 h-4 fill-zinc-950" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Banner Management */}
                        <div className="bg-zinc-950 border border-white/5 rounded-[2.5rem] p-10 flex flex-col shadow-2xl relative">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight text-white mb-1">Banner <span className="text-slate-700 italic font-normal">Real Estate</span></h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Live assets on Landing Page and User Dashboard.</p>
                                </div>
                                <button className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white transition-all"><Plus className="w-5 h-5" /></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { title: 'ORIGIN PRO REVEAL', loc: 'Dashboard Carousel', color: 'blue' },
                                    { title: 'JEE ADMIT CARDS', loc: 'Global Top Bar', color: 'rose' },
                                    { title: 'MENTORSHIP BLAST', loc: 'Sidebar Modal', color: 'purple' },
                                    { title: 'UPCOMING NEET MOCK', loc: 'Landing Hero', color: 'emerald' },
                                ].map((item, i) => (
                                    <div key={i} className="group cursor-default">
                                        <div className={`h-32 w-full rounded-2xl bg-gradient-to-br from-zinc-900 to-black border border-white/5 mb-3 flex items-center justify-center relative overflow-hidden group-hover:border-white/20 transition-all`}>
                                            <div className={`absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                                <div className="p-1.5 bg-white text-zinc-950 rounded-lg"><ArrowUpRight className="w-3 h-3" /></div>
                                            </div>
                                            <Image className="w-8 h-8 text-slate-800 group-hover:scale-110 transition-transform duration-500" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white mb-1">{item.title}</p>
                                        <p className="text-[9px] font-bold text-slate-600 uppercase italic">{item.loc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Marketing Feed & Feedback */}
                    <div className="space-y-8">
                        {/* Feed Loop */}
                        <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8 lg:p-10 flex flex-col shadow-2xl relative">
                            <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500 mb-8 flex items-center gap-2">
                                <Flag className="w-4 h-4" />
                                Feedback Loop
                            </h3>
                            <div className="space-y-6">
                                {[
                                    { user: 'Rahul S.', type: 'Hint Request', text: 'LaTeX rendering issue in Periodic Table Q4.', time: '12m ago', color: 'rose' },
                                    { user: 'S. Amrit', type: 'Support Ticket', text: 'Payment confirmation for Pro upgrade delayed.', time: '45m ago', color: 'amber' },
                                    { user: 'Priya Mehta', type: 'Feature Idea', text: 'Would love dark-mode variants for mock tests.', time: '2h ago', color: 'blue' },
                                ].map((row, i) => (
                                    <div key={i} className="space-y-3 p-4 bg-zinc-950 rounded-2xl border border-white/5 border-l-4 border-l-blue-500/50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <UserCircle className="w-4 h-4 text-slate-700" />
                                                <span className="text-[10px] font-black uppercase text-white">{row.user}</span>
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-600 uppercase italic">{row.time}</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed line-clamp-2">"{row.text}"</p>
                                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                            <span className={`text-[9px] font-black uppercase tracking-widest text-${row.color}-500/50`}>{row.type}</span>
                                            <button className="text-[9px] font-black uppercase text-blue-500 flex items-center gap-1 hover:text-blue-400">Handle <ChevronRight className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button className="mt-10 w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 hover:text-white transition-all shadow-xl">Full Audit Portal</button>
                        </div>

                        {/* Quick Stats */}
                        <div className="bg-emerald-500 text-zinc-950 rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(16,185,129,0.2)] flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            </div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-zinc-950/70">Blast Capacity</h4>
                            <h3 className="text-4xl font-black tracking-tighter mb-4 italic">Unlimited</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-950/50 leading-relaxed">System healthy. <br/> All edge nodes synchronized.</p>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
