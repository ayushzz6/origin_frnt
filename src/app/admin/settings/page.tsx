'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { 
    Settings, 
    ShieldAlert, 
    ToggleLeft, 
    ToggleRight, 
    Database, 
    Cpu, 
    Activity, 
    Lock, 
    History,
    RefreshCw,
    AlertTriangle,
    Zap,
    Globe,
    Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FeatureToggle = ({ title, desc, active, onToggle }: any) => (
    <div className="flex items-start justify-between p-6 bg-white/5 border border-white/5 rounded-2xl group hover:bg-white/[0.07] transition-all">
        <div className="space-y-1">
            <h4 className="text-sm font-black text-white uppercase tracking-tight">{title}</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed max-w-[240px] italic">{desc}</p>
        </div>
        <button 
            onClick={onToggle}
            className={`p-1 w-12 h-6 rounded-full transition-all duration-300 relative ${active ? 'bg-emerald-500' : 'bg-slate-800'}`}
        >
            <motion.div 
                animate={{ x: active ? 24 : 0 }}
                className="w-4 h-4 bg-white rounded-full shadow-lg"
            />
        </button>
    </div>
);

export default function SystemSettings() {
    const [features, setFeatures] = useState({
        aiAvatar: true,
        betaGrader: false,
        pomodoroGroups: true,
        globalChat: false,
    });

    const [isMaintenance, setIsMaintenance] = useState(false);

    return (
        <AdminLayout>
            <div className="space-y-12 pb-24">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Feature Management */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Zap className="w-24 h-24" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-8">Feature <span className="text-slate-700 font-normal italic">Gating</span></h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FeatureToggle 
                                    title="AI Avatar Studio" 
                                    desc="Generative pfps for student profiles. Cohort A only." 
                                    active={features.aiAvatar}
                                    onToggle={() => setFeatures({...features, aiAvatar: !features.aiAvatar})}
                                />
                                <FeatureToggle 
                                    title="Experimental Grader" 
                                    desc="Low-latency C++ execution using WebAssembly." 
                                    active={features.betaGrader}
                                    onToggle={() => setFeatures({...features, betaGrader: !features.betaGrader})}
                                />
                                <FeatureToggle 
                                    title="Group Pomodoro" 
                                    desc="Shared focus timers with community leaderboards." 
                                    active={features.pomodoroGroups}
                                    onToggle={() => setFeatures({...features, pomodoroGroups: !features.pomodoroGroups})}
                                />
                                <FeatureToggle 
                                    title="Real-time Doubt Hub" 
                                    desc="WebSocket-accelerated peer-to-peer resolution." 
                                    active={features.globalChat}
                                    onToggle={() => setFeatures({...features, globalChat: !features.globalChat})}
                                />
                            </div>
                        </div>

                        {/* Audit Log */}
                        <div className="bg-zinc-950 border border-white/5 rounded-[2.5rem] p-10 flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight text-white mb-1">Audit <span className="text-slate-700 italic font-normal">Vault</span></h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Immutable record of high-privilege operations.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input 
                                            type="text" 
                                            placeholder="Search logs..."
                                            className="bg-white/5 border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-[10px] uppercase font-black text-white focus:outline-none w-48"
                                        />
                                    </div>
                                    <button className="p-3 bg-white/5 border border-white/5 rounded-2xl text-slate-500 hover:text-white transition-all"><RefreshCw className="w-5 h-5" /></button>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { admin: 'Naveen S.', action: 'MOD_USER_ROLE', target: 'ID:4812 -> ADMIN', time: '08:42:15 UTC', ip: '192.168.1.1' },
                                    { admin: 'System Script', action: 'CLEAN_TEMP_CACHE', target: 'Sector 01', time: '07:22:01 UTC', ip: 'internal' },
                                    { admin: 'Deepika K.', action: 'FLUSH_FAILED_TX', target: 'Ledger Store', time: '04:12:55 UTC', ip: '102.14.88.2' },
                                    { admin: 'Naveen S.', action: 'TOGGLE_FEAT', target: 'aiAvatar: ENABLED', time: '02:00:12 UTC', ip: '192.168.1.1' },
                                ].map((log, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5 group hover:bg-white/[0.05] transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:animate-pulse" />
                                            <div>
                                                <p className="text-xs font-bold text-white uppercase">{log.action}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-black text-slate-500 truncate max-w-[120px]">{log.target}</span>
                                                    <span className="text-[8px] text-slate-700 italic">BY {log.admin}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-mono text-slate-500">{log.time}</p>
                                            <p className="text-[8px] font-mono text-slate-800">{log.ip}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone Side-Panel */}
                    <div className="space-y-8">
                        <div className="bg-rose-500/5 border border-rose-500/20 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 pointer-events-none" />
                            <div className="w-16 h-16 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 relative z-10 group-hover:rotate-12 transition-transform duration-500">
                                <AlertTriangle className="w-8 h-8 text-rose-500" />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-[0.22em] text-rose-500 mb-4 relative z-10">Danger Zone</h3>
                            
                            <div className="space-y-4 w-full relative z-10">
                                <button 
                                    onClick={() => setIsMaintenance(!isMaintenance)}
                                    className={`w-full py-4 rounded-2xl flex items-center justify-between px-6 transition-all border ${isMaintenance ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-500/20' : 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500/20'}`}
                                >
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Maintenance Mode</p>
                                        <p className={`text-[8px] uppercase font-bold ${isMaintenance ? 'text-rose-100' : 'text-rose-700'}`}>{isMaintenance ? 'Active - Site Restricted' : 'Inactive - Site Online'}</p>
                                    </div>
                                    <Lock className={`w-4 h-4 transition-transform ${isMaintenance ? 'rotate-0' : 'rotate-180 opacity-50'}`} />
                                </button>

                                <button className="w-full py-4 bg-zinc-950 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-white hover:bg-white/5 hover:border-white/10 transition-all flex items-center justify-center gap-3">
                                    <Database className="w-4 h-4" />
                                    Purge Transient Cache
                                </button>
                                
                                <button className="w-full py-4 bg-zinc-950 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-white hover:bg-white/5 hover:border-white/10 transition-all flex items-center justify-center gap-3">
                                    <History className="w-4 h-4" />
                                    Flush Session Vault
                                </button>
                            </div>
                        </div>

                        {/* System Health / API Stats Sidebar */}
                        <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-10 space-y-8">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Runtime Health</h3>
                            <div className="space-y-6">
                                {[
                                    { label: 'DB Connection Pool', value: '42 / 100', color: 'emerald' },
                                    { label: 'Edge Latency', value: '18ms', color: 'blue' },
                                    { label: 'WASM Runtime', value: 'STABLE', color: 'emerald' },
                                ].map((stat, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                                            <p className="text-sm font-black text-white">{stat.value}</p>
                                        </div>
                                        <div className={`w-12 h-1 bg-${stat.color}-500/20 rounded-full overflow-hidden`}>
                                            <div className={`h-full bg-${stat.color}-500 w-[60%]`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
