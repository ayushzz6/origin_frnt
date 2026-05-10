'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { 
    Search, 
    Filter, 
    MoreVertical, 
    ShieldCheck, 
    UserX, 
    UserCheck, 
    Eye,
    Mail,
    Calendar,
    ChevronDown,
    ArrowUpRight,
    UserPlus,
    X,
    Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const mockUsers = [
    { id: '1', name: 'Naveen S.', email: 'naveen@origin.com', role: 'admin', joined: '2024-03-10', status: 'verified', class: 'N/A' },
    { id: '2', name: 'Dr. Neeraj Chopra', email: 'neeraj.c@origin.com', role: 'teacher', joined: '2024-03-12', status: 'verified', class: 'Physics' },
    { id: '3', name: 'Rahul Sharma', email: 'rahul.s@student.com', role: 'student', joined: '2024-03-15', status: 'pending', class: '12th' },
    { id: '4', name: 'Sneha Kapur', email: 'sneha.k@student.com', role: 'student', joined: '2024-03-20', status: 'verified', class: '11th' },
    { id: '5', name: 'Amit V.', email: 'amit.v@origin.com', role: 'teacher', joined: '2024-03-22', status: 'rejected', class: 'Maths' },
    { id: '6', name: 'Priya M.', email: 'priya.m@student.com', role: 'student', joined: '2024-03-25', status: 'verified', class: 'Dropper' },
];

const RoleBadge = ({ role }: { role: string }) => {
    const styles: any = {
        admin: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        teacher: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        student: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${styles[role.toLowerCase()] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
            {role}
        </span>
    );
};

const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
        verified: 'bg-emerald-500/10 text-emerald-500',
        pending: 'bg-amber-500/10 text-amber-500',
        rejected: 'bg-rose-500/10 text-rose-500',
    };
    return (
        <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${styles[status.toLowerCase()]}`}>
            <div className={`w-1 h-1 rounded-full ${status === 'verified' ? 'bg-emerald-500' : status === 'pending' ? 'bg-amber-500' : 'bg-rose-500'}`} />
            {status}
        </span>
    );
};

export default function UserManagement() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTab, setSelectedTab] = useState('all');

    return (
        <AdminLayout>
            <div className="space-y-8 pb-20">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
                        {['all', 'students', 'teachers', 'admins'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSelectedTab(tab)}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedTab === tab 
                                    ? 'bg-white text-zinc-950 shadow-lg' 
                                    : 'text-slate-500 hover:text-white'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-emerald-500 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Search by name, email or ID..."
                                className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all w-full md:w-[320px]"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="p-3 bg-emerald-500 text-zinc-950 rounded-2xl hover:bg-emerald-400 transition-all active:scale-95">
                            <UserPlus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Directory Table */}
                <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Identity</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Classification</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Verification</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Enrolled</th>
                                    <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Operations</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {mockUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center text-sm font-black text-emerald-500">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{user.name}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Mail className="w-3 h-3 text-slate-500" />
                                                        <span className="text-[10px] text-slate-500 font-medium">{user.email}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1.5">
                                                <RoleBadge role={user.role} />
                                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{user.class}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <StatusBadge status={user.status} />
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                                                {user.joined}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    title="Impersonate"
                                                    className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all active:scale-95"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    title="Approve / Manage"
                                                    className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-zinc-950 transition-all active:scale-95"
                                                >
                                                    <UserCheck className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    title="Suspend / Ban"
                                                    className="p-2 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                                                >
                                                    <UserX className="w-4 h-4" />
                                                </button>
                                                <div className="w-[1px] h-4 bg-white/5 mx-1" />
                                                <button className="p-2 text-slate-500 hover:text-white transition-colors">
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 italic">Showing 6 entries out of 1,204</p>
                    <div className="flex items-center gap-2">
                        <button className="px-4 py-2 bg-white/5 border border-white/5 rounded-lg text-slate-500 text-[10px] font-black uppercase transition-colors hover:bg-white/10 hover:text-white">Previous</button>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3].map((n) => (
                                <button key={n} className={`w-8 h-8 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${n === 1 ? 'bg-emerald-500 text-zinc-950' : 'text-slate-500 hover:bg-white/5'}`}>{n}</button>
                            ))}
                        </div>
                        <button className="px-4 py-2 bg-white/5 border border-white/5 rounded-lg text-white text-[10px] font-black uppercase transition-colors hover:bg-white/10">Next</button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
