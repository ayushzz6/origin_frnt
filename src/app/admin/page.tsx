'use client';

import React from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { 
    Users, 
    TrendingUp, 
    DollarSign, 
    Activity, 
    ArrowUpRight, 
    ArrowDownRight,
    Zap,
    Globe,
    Cpu,
    Database,
    AlertCircle,
    CheckCircle2,
    Search
} from 'lucide-react';
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { motion } from 'framer-motion';

const data = [
    { name: '00:00', value: 400 },
    { name: '04:00', value: 300 },
    { name: '08:00', value: 900 },
    { name: '12:00', value: 1200 },
    { name: '16:00', value: 1500 },
    { name: '20:00', value: 1800 },
    { name: '23:59', value: 2100 },
];

const StatCard = ({ title, value, change, isPositive, icon: Icon, color }: any) => (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/[0.07] transition-all group">
        <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-xl bg-${color}-500/10 border border-${color}-500/20 text-${color}-500`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className={`flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-emerald-500' : 'text-primary'}`}>
                {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {change}
            </div>
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-white">{value}</h3>
    </div>
);

const HealthMonitor = ({ label, status, value, icon: Icon, color }: any) => (
    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-500 border border-${color}-500/20`}>
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                <p className="text-xs font-bold text-slate-200">{status}</p>
            </div>
        </div>
        <div className="text-right">
            <p className="text-xs font-mono font-bold text-white">{value}</p>
            <div className="w-16 h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                <div className={`h-full bg-${color}-500 w-[85%]`} />
            </div>
        </div>
    </div>
);

export default function AdminDashboard() {
    return (
        <AdminLayout>
            <div className="space-y-8 pb-20">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                        title="Total Revenue" 
                        value="$124.5k" 
                        change="+12.5%" 
                        isPositive={true} 
                        icon={DollarSign} 
                        color="emerald" 
                    />
                    <StatCard 
                        title="Active Students" 
                        value="12,842" 
                        change="+8.2%" 
                        isPositive={true} 
                        icon={Users} 
                        color="blue" 
                    />
                    <StatCard 
                        title="OGCode Grinds" 
                        value="851.2k" 
                        change="-2.4%" 
                        isPositive={false} 
                        icon={TrendingUp} 
                        color="amber" 
                    />
                    <StatCard 
                        title="Retention" 
                        value="94.2%" 
                        change="+0.8%" 
                        isPositive={true} 
                        icon={Zap} 
                        color="purple" 
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Growth Chart */}
                    <div className="lg:col-span-2 bg-white/5 border border-white/5 rounded-3xl p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight text-white">Engagement Trends</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Real-time user traffic in current cycle</p>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live Feed
                            </div>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                                        dy={10}
                                    />
                                    <YAxis hide />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: '#09090b', 
                                            border: '1px solid #ffffff1a',
                                            borderRadius: '12px',
                                            fontSize: '12px'
                                        }}
                                        itemStyle={{ color: '#10b981' }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke="#10b981" 
                                        strokeWidth={3}
                                        fillOpacity={1} 
                                        fill="url(#colorValue)" 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* System Health Monitor */}
                    <div className="bg-white/5 border border-white/5 rounded-3xl p-8">
                        <h3 className="text-lg font-black uppercase tracking-tight text-white mb-6">Environment Health</h3>
                        <div className="space-y-4">
                            <HealthMonitor 
                                label="Grader Service" 
                                status="Operational" 
                                value="18ms" 
                                icon={Cpu} 
                                color="emerald" 
                            />
                            <HealthMonitor 
                                label="PostgreSQL Nodes" 
                                status="Healthy" 
                                value="8ms" 
                                icon={Database} 
                                color="blue" 
                            />
                            <HealthMonitor 
                                label="Edge Network" 
                                status="Latency Detected" 
                                value="142ms" 
                                icon={Globe} 
                                color="amber" 
                            />
                            <HealthMonitor 
                                label="Auth Micro-service" 
                                status="Active" 
                                value="24ms" 
                                icon={CheckCircle2} 
                                color="emerald" 
                            />
                            
                            <div className="mt-8 pt-6 border-t border-white/5">
                                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-start gap-4">
                                    <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">Incident Report</p>
                                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase">High latency observed in APAC-South regions. Investigative action required.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Recent Content Activity */}
                    <div className="bg-white/5 border border-white/5 rounded-3xl p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-black uppercase tracking-tight text-white">LMS Feed</h3>
                            <button className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors">Manage Full Library</button>
                        </div>
                        <div className="space-y-6">
                            {[
                                { user: 'Dr. Neeraj Chopra', action: 'Uploaded new mock test', target: 'JEE Advance 2026', time: '12m ago', color: 'blue' },
                                { user: 'Admin Console', action: 'Auto-curated DPP', target: 'Physics - Mechanics', time: '45m ago', color: 'emerald' },
                                { user: 'Subramanian B.', action: 'Flagged question #4812', target: 'Incorrect options', time: '1h ago', color: 'amber' },
                                { user: 'System Bot', action: 'Released premium video', target: 'Organic Chemistry L4', time: '2h ago', color: 'purple' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-4 group cursor-default">
                                    <div className={`w-10 h-10 rounded-xl bg-${item.color}-500/10 border border-${item.color}-500/20 flex items-center justify-center text-${item.color}-500`}>
                                        <Activity className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-white leading-tight">
                                            {item.user} <span className="text-slate-500 font-normal">{item.action}</span>
                                        </p>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">{item.target}</p>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-600 uppercase italic">{item.time}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Subscription Heatmap Placeholder */}
                    <div className="bg-white/5 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                            <TrendingUp className="w-8 h-8 text-slate-700" />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Churn Analysis Mode</h3>
                        <p className="text-xs text-slate-600 max-w-[240px] uppercase font-bold leading-relaxed">Advanced retention heatmaps are currently generating. Sync time: 14:00 UTC.</p>
                        <button className="mt-6 px-6 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Manual Sync</button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
