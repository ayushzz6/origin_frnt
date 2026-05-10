'use client';

import React from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { 
    Users, 
    MessageSquare, 
    Trophy, 
    Activity, 
    Calendar,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    CheckCircle2,
    Clock,
    AlertCircle,
    UserCheck,
    Lock
} from 'lucide-react';
import { motion } from 'framer-motion';

const MonitoringCard = ({ title, value, label, icon: Icon, color, trend }: any) => (
    <div className="bg-white/5 border border-white/5 rounded-3xl p-8 hover:bg-white/[0.07] transition-all group">
        <div className="flex items-start justify-between mb-6">
            <div className={`p-4 rounded-2xl bg-${color}-500/10 text-${color}-500 border border-${color}-500/20`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${trend > 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
                {trend > 0 ? '+' : ''}{trend}%
            </div>
        </div>
        <div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
            <h3 className="text-3xl font-black text-white mb-2">{value}</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{label}</p>
        </div>
    </div>
);

export default function Monitoring() {
    return (
        <AdminLayout>
            <div className="space-y-12 pb-24">
                {/* Real-time Participation Header */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <MonitoringCard 
                        title="Active Classrooms" 
                        value="842" 
                        label="Live Interactions" 
                        icon={Users} 
                        color="blue" 
                        trend={12.5}
                    />
                    <MonitoringCard 
                        title="Unresolved Doubts" 
                        value="142" 
                        label="Wait Time: 12m" 
                        icon={MessageSquare} 
                        color="amber" 
                        trend={-4.2}
                    />
                    <MonitoringCard 
                        title="Avg Attendance" 
                        value="92.1%" 
                        label="Weekly Aggregate" 
                        icon={Activity} 
                        color="emerald" 
                        trend={0.8}
                    />
                    <MonitoringCard 
                        title="Strike Streak" 
                        value="14.8k" 
                        label="Consistency Index" 
                        icon={Trophy} 
                        color="purple" 
                        trend={22.1}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Classroom Audit Table */}
                    <div className="lg:col-span-2 bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-10 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Classroom <span className="text-slate-700 italic font-normal">Audit</span></h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">Monitoring live sessions and teacher engagement levels.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
                                    <input 
                                        type="text" 
                                        placeholder="Search class..."
                                        className="bg-zinc-950 border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-[10px] uppercase font-black tracking-widest text-white focus:outline-none focus:border-emerald-500/50 transition-all w-full md:w-[240px]"
                                    />
                                </div>
                                <button className="p-3 bg-white/5 border border-white/5 rounded-2xl text-slate-500 hover:text-white transition-all"><Filter className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-white/5">
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Mentor</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Session Type</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Load</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Quality Index</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 text-right">Ops</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {[
                                        { teacher: 'Dr. Neeraj Chopra', subject: 'Advanced Physics', load: '402 Students', rank: '9.8 / 10', status: 'live', color: 'emerald' },
                                        { teacher: 'Amit Varma', subject: 'Pure Mathematics', load: '182 Students', rank: '8.4 / 10', status: 'idle', color: 'slate' },
                                        { teacher: 'S. Subramanian', subject: 'Organic Chemistry', load: '942 Students', rank: '9.2 / 10', status: 'live', color: 'emerald' },
                                        { teacher: 'Priya Mehta', subject: 'Genetic Biology', load: '210 Students', rank: '7.9 / 10', status: 'flagged', color: 'rose' },
                                    ].map((row, i) => (
                                        <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div>
                                                        <p className="text-sm font-bold text-white mb-0.5">{row.teacher}</p>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{row.subject}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <Activity className={`w-3.5 h-3.5 text-${row.color}-500`} />
                                                    <span className="text-[10px] font-bold text-slate-400 capitalize">{row.status} session</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-[10px] font-black text-slate-300 uppercase italic">{row.load}</td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <div className={`h-full bg-${row.color}-500 w-[80%]`} />
                                                    </div>
                                                    <span className="text-[10px] font-black text-white">{row.rank}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button className="p-2.5 rounded-xl bg-white/5 text-slate-500 hover:text-white transition-all"><ArrowUpRight className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Engagement Insights Sidebar */}
                    <div className="space-y-8">
                        {/* Doubt Solver Analytics */}
                        <div className="bg-zinc-950 border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-5">
                                <MessageSquare className="w-16 h-16" />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-600 mb-8">Doubt Moderation</h3>
                            <div className="space-y-6">
                                <div className="p-5 bg-white/5 rounded-2xl border border-white/5 border-l-4 border-l-rose-500">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Critical Delay</span>
                                        <span className="text-[9px] font-bold text-slate-600 uppercase">24m ago</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-300 leading-relaxed mb-4 uppercase">"Integrated Calculus proof not resolving correctly in Batch B4."</p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex -space-x-2">
                                            {[1, 2].map((i) => <div key={i} className="w-6 h-6 rounded-full border-2 border-zinc-950 bg-slate-800" />)}
                                        </div>
                                        <button className="px-4 py-1.5 bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all">Assign Admin</button>
                                    </div>
                                </div>

                                <div className="p-5 bg-white/5 rounded-2xl border border-white/5 border-l-4 border-l-emerald-500">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Resolving</span>
                                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase italic">82Doubts cleared this hour</p>
                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-[92%] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Leaderboard Oversight */}
                        <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-10 flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-600">Integrity Check</h3>
                                <button className="p-2 rounded-xl hover:bg-white/5 transition-all text-slate-600"><AlertCircle className="w-4 h-4" /></button>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-16 h-16 rounded-2xl bg-zinc-950 flex items-center justify-center border border-white/5 shadow-2xl relative">
                                    <Lock className="w-8 h-8 text-slate-800" />
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-950 flex items-center justify-center">
                                        <UserCheck className="w-2 h-2 text-zinc-950" />
                                    </div>
                                </div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Streak Reset Gateway</h4>
                                <p className="text-[9px] text-slate-500 uppercase font-black leading-relaxed max-w-[180px]">Manual override for global leaderboards and bot-detection audits.</p>
                                <button className="mt-4 w-full py-3 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-all">Launch Oversight Console</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Batch Attendance / Heatmap Placeholder */}
                <div className="bg-gradient-to-r from-emerald-600/10 to-blue-600/10 border border-white/5 rounded-[3rem] p-12 lg:p-16 relative group">
                    <div className="flex flex-col lg:flex-row items-center gap-12">
                        <div className="lg:w-1/2 space-y-6">
                            <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Cohort <span className="text-slate-600 font-normal italic">Saturation</span></h2>
                            <p className="text-sm text-slate-400 font-bold uppercase leading-relaxed">Cross-batch participation analysis. identifying engagement deserts and peak focus cycles across Class 9-12 and Droppers.</p>
                            <div className="flex flex-wrap gap-4 pt-4">
                                {['Attendance', 'Drop-offs', 'Peak Time', 'Subject Load'].map((tag) => (
                                    <span key={tag} className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">{tag}</span>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 w-full bg-zinc-950/80 border border-white/5 rounded-[2rem] p-12 flex items-center justify-center text-center">
                            <div>
                                <Activity className="w-12 h-12 text-slate-800 mb-6 mx-auto animate-pulse" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-loose">Analytical Saturation Models are <br/> <span className="text-slate-300 italic">Computing Engagement Curves...</span></p>
                                <button className="mt-8 px-8 py-3 bg-white text-zinc-950 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Generate Full Report</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
