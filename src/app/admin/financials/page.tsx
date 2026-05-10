'use client';

import React from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { 
    DollarSign, 
    TrendingUp, 
    Users, 
    CreditCard, 
    ArrowUpRight, 
    ArrowDownRight,
    Search,
    Filter,
    Plus,
    Download,
    Terminal,
    Zap,
    Ticket,
    Receipt
} from 'lucide-react';
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    BarChart,
    Bar
} from 'recharts';
import { motion } from 'framer-motion';

const data = [
    { name: 'JAN', rev: 45000 },
    { name: 'FEB', rev: 52000 },
    { name: 'MAR', rev: 48000 },
    { name: 'APR', rev: 61000 },
    { name: 'MAY', rev: 55000 },
    { name: 'JUN', rev: 67000 },
    { name: 'JUL', rev: 72000 },
];

const StatCard = ({ title, value, change, isPositive, icon: Icon, color }: any) => (
    <div className="bg-white/5 border border-white/5 rounded-3xl p-8 hover:bg-white/[0.07] transition-all group relative overflow-hidden">
        <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${color}-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity`} />
        <div className="flex items-start justify-between mb-6">
            <div className={`p-4 rounded-2xl bg-${color}-500/10 text-${color}-500 border border-${color}-500/20 shadow-lg shadow-${color}-500/5`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isPositive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {change}
            </div>
        </div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
        <h3 className="text-3xl font-black text-white">{value}</h3>
        <div className="mt-4 flex items-center gap-2">
            <div className={`w-1 h-1 rounded-full bg-${color}-500`} />
            <span className="text-[10px] font-bold text-slate-600 uppercase">Live Metrics</span>
        </div>
    </div>
);

export default function Financials() {
    return (
        <AdminLayout>
            <div className="space-y-12 pb-24">
                {/* Header Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <StatCard 
                        title="Monthly Recurring Revenue" 
                        value="$72,402" 
                        change="14.2%" 
                        isPositive={true} 
                        icon={TrendingUp} 
                        color="blue" 
                    />
                    <StatCard 
                        title="Annual Contract Value" 
                        value="$841.5k" 
                        change="8.1%" 
                        isPositive={true} 
                        icon={DollarSign} 
                        color="emerald" 
                    />
                    <StatCard 
                        title="Churn Rate Index" 
                        value="2.41%" 
                        change="1.2%" 
                        isPositive={false} 
                        icon={Zap} 
                        color="rose" 
                    />
                    <StatCard 
                        title="Active Pro Subs" 
                        value="8,401" 
                        change="22.5%" 
                        isPositive={true} 
                        icon={Users} 
                        color="purple" 
                    />
                </div>

                {/* Main Graph & Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Revenue Visualization */}
                    <div className="lg:col-span-2 bg-white/5 border border-white/5 rounded-[2.5rem] p-10 flex flex-col">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Revenue <span className="text-slate-700 font-normal italic">Dynamics</span></h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Year-to-date subscription growth and retention volatility.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="p-3 bg-white/5 border border-white/5 rounded-2xl text-slate-400 hover:text-white transition-all"><Download className="w-5 h-5" /></button>
                                <button className="px-6 py-3 bg-emerald-500 text-zinc-950 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/10">Full Ledger</button>
                            </div>
                        </div>
                        <div className="flex-1 min-h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#475569', fontSize: 10, fontWeight: 900 }} 
                                        dy={15}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#475569', fontSize: 10, fontWeight: 900 }}
                                        tickFormatter={(val) => `$${val/1000}k`}
                                    />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: '#09090b', 
                                            border: '1px solid #ffffff1a',
                                            borderRadius: '20px',
                                            padding: '16px'
                                        }}
                                        itemStyle={{ color: '#3b82f6', fontWeight: 900 }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="rev" 
                                        stroke="#3b82f6" 
                                        strokeWidth={4}
                                        fillOpacity={1} 
                                        fill="url(#colorRev)" 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Quick Access Sidebar */}
                    <div className="space-y-8">
                        {/* Coupon Engine */}
                        <div className="bg-white/5 border border-white/5 rounded-[2rem] p-8">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">Coupon Engine</h3>
                                <button className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-zinc-950 transition-all"><Plus className="w-4 h-4" /></button>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { code: 'ORIGIN2024', discount: '40%', status: 'Active', color: 'emerald' },
                                    { code: 'BETA_TESTER', discount: 'Free', status: 'Paused', color: 'amber' },
                                    { code: 'EXAM_PREP', discount: '15%', status: 'Expired', color: 'rose' },
                                ].map((promo, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                                <Ticket className="w-5 h-5 text-slate-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-white">{promo.code}</p>
                                                <p className="text-[10px] font-bold text-slate-600 uppercase">{promo.discount} OFF</p>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest text-${promo.color}-500`}>{promo.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Terminal Logs */}
                        <div className="bg-zinc-950 border border-white/5 rounded-[2rem] p-8 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Terminal className="w-12 h-12" />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-600 mb-6">Recent Ledger</h3>
                            <div className="space-y-4 font-mono">
                                {[
                                    { msg: 'INV_4812 Paid - $49.00', time: '12:04' },
                                    { msg: 'REF_9021 Processed', time: '11:42' },
                                    { msg: 'SUB_MOD_77 Tier Changed', time: '11:15' },
                                    { msg: 'TX_PENDING Origin Pro', time: '10:58' },
                                ].map((log, i) => (
                                    <div key={i} className="flex items-start justify-between gap-4">
                                        <span className="text-[10px] text-slate-500 break-all leading-relaxed lowercase">{log.msg}</span>
                                        <span className="text-[10px] text-slate-700 italic shrink-0">{log.time}</span>
                                    </div>
                                ))}
                            </div>
                            <button className="mt-8 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-2">
                                <Receipt className="w-4 h-4" />
                                View Full Transaction Audit
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tier Management Banner */}
                <div className="bg-gradient-to-br from-blue-600/20 via-transparent to-purple-600/20 border border-white/5 rounded-[3rem] p-10 lg:p-16 flex flex-col lg:flex-row items-center gap-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 pointer-events-none" />
                    <div className="lg:w-2/3 space-y-6 relative z-10">
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 self-start rounded-full border border-white/10 w-fit">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Security Check Passed</span>
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter text-white">Tier Management <span className="text-slate-600">Gatekeeper</span></h2>
                        <p className="text-sm text-slate-400 font-bold uppercase leading-relaxed max-w-xl">Adjust features included in ORIGIN Free vs. Premium tiers dynamically. Changes propagate instantly to all active clusters without requiring a system reboot.</p>
                        <div className="flex items-center gap-6 pt-4">
                            <button className="px-10 py-4 bg-white text-zinc-950 rounded-2xl font-black text-[12px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Configure Entities</button>
                            <button className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors">Safety Audit Log</button>
                        </div>
                    </div>
                    <div className="hidden lg:flex flex-1 items-center justify-center relative">
                        <div className="w-48 h-48 rounded-[3rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center rotate-12 relative z-10 transition-transform hover:rotate-0 duration-700">
                            <CreditCard className="w-16 h-16 text-indigo-400" />
                        </div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/20 blur-[100px] rounded-full" />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

// Support Icons
const ShieldCheck = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
);
