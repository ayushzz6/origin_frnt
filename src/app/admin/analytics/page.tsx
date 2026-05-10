'use client';

import React from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { 
    BarChart3, 
    TrendingUp, 
    Users, 
    Target,
    Zap,
    ArrowUpRight
} from 'lucide-react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Cell
} from 'recharts';

const data = [
    { name: 'Physics', users: 4200, growth: 12 },
    { name: 'Chemistry', users: 3800, growth: 8 },
    { name: 'Maths', users: 4842, growth: 15 },
    { name: 'Biology', users: 1200, growth: -2 },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

export default function AnalyticsPage() {
    return (
        <AdminLayout>
            <div className="space-y-8 pb-20">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Global Analytics</h2>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Cross-platform performance & engagement metrics</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white/5 border border-white/5 rounded-3xl p-8">
                        <h3 className="text-lg font-black uppercase tracking-tight text-white mb-8">Subject Distribution</h3>
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                                    />
                                    <YAxis hide />
                                    <Tooltip 
                                        cursor={{ fill: '#ffffff05' }}
                                        contentStyle={{ 
                                            backgroundColor: '#09090b', 
                                            border: '1px solid #ffffff1a',
                                            borderRadius: '12px',
                                        }}
                                    />
                                    <Bar dataKey="users" radius={[8, 8, 0, 0]}>
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">DAU / MAU Ratio</p>
                                    <h4 className="text-xl font-black text-white">42.8%</h4>
                                </div>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[42.8%]" />
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avg. Session Time</p>
                                    <h4 className="text-xl font-black text-white">48m 12s</h4>
                                </div>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[65%]" />
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                                    <Target className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Conversion Rate</p>
                                    <h4 className="text-xl font-black text-white">12.4%</h4>
                                </div>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 w-[12.4%]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
