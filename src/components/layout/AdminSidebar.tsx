'use client';

import React from 'react';
import {
    Users,
    BookOpen,
    CreditCard,
    Activity,
    BarChart3,
    MessageSquare,
    Settings,
    ChevronLeft,
    LogOut,
    LayoutDashboard,
    Zap,
    ShieldCheck,
    Siren,
    FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';

interface AdminSidebarProps {
    isCollapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    onLogout: () => void;
}

const navItems = [
    { id: 'dashboard', label: 'Mission Control', icon: LayoutDashboard, path: '/admin' },
    { id: 'users', label: 'User Management', icon: Users, path: '/admin/users' },
    { id: 'content', label: 'Content & LMS', icon: BookOpen, path: '/admin/content' },
    { id: 'financials', label: 'Financials', icon: CreditCard, path: '/admin/financials' },
    { id: 'monitoring', label: 'Classroom Audit', icon: Activity, path: '/admin/monitoring' },
    { id: 'analytics', label: 'Global Analytics', icon: BarChart3, path: '/admin/analytics' },
    { id: 'marketing', label: 'Broadcast Center', icon: Zap, path: '/admin/marketing' },
    // Audit fix R-5 (A-15): /admin/incidents and /admin/audit-events
    // shipped in Phase 13 but had no sidebar entry. Operators were
    // typing the URL.
    { id: 'incidents', label: 'Incidents', icon: Siren, path: '/admin/incidents' },
    { id: 'audit-events', label: 'Audit Log', icon: FileText, path: '/admin/audit-events' },
    { id: 'settings', label: 'System Config', icon: Settings, path: '/admin/settings' },
];

export default function AdminSidebar({ isCollapsed, setCollapsed, onLogout }: AdminSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <motion.div
            initial={false}
            animate={{ width: isCollapsed ? 80 : 280 }}
            className="fixed left-0 top-0 h-full bg-card border-r border-border flex flex-col z-[60] shadow-2xl overflow-hidden transition-all duration-300"
        >
            {/* Header / Logo */}
            <div className="p-6 flex items-center justify-between min-h-[80px]">
                {!isCollapsed && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                    >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-zinc-950 dark:text-zinc-950 font-black" />
                        </div>
                        <span className="text-sm font-black tracking-widest text-foreground uppercase italic">Origin<span className="text-emerald-500">Admin</span></span>
                    </motion.div>
                )}
                <button
                    onClick={() => setCollapsed(!isCollapsed)}
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                >
                    <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                <div className="mb-4 px-2">
                    {!isCollapsed && <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">Operations</p>}
                    <div className="space-y-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.path;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => router.push(item.path)}
                                    className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all group relative ${isActive 
                                        ? 'bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20' 
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                                    }`}
                                >
                                    <item.icon className={`w-5 h-5 min-w-[20px] transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                    {!isCollapsed && (
                                        <motion.span 
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="text-sm whitespace-nowrap"
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                    {isActive && (
                                        <motion.div 
                                            layoutId="admin-nav-indicator"
                                            className="absolute left-0 w-1 h-1/2 bg-emerald-500 rounded-r-full"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Footer / Logout */}
            <div className="p-4 border-t border-border space-y-2">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-4 px-3 py-3 rounded-xl text-primary hover:bg-primary/10 transition-all group"
                >
                    <LogOut className="w-5 h-5 min-w-[20px] group-hover:-translate-x-1 transition-transform" />
                    {!isCollapsed && (
                        <motion.span 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-sm font-bold"
                        >
                            Exit Console
                        </motion.span>
                    )}
                </button>
            </div>
        </motion.div>
    );
}
