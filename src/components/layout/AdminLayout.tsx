'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { 
    Bell, 
    Search, 
    ShieldCheck, 
    Activity, 
    Globe,
    ExternalLink
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, logout, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isCollapsed, setCollapsed] = useState(false);
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    // Protection logic
    React.useEffect(() => {
        if (!isLoading && (!user || user.role !== 'admin')) {
            router.push('/auth?role=admin');
        }
    }, [user, isLoading, router]);

    if (isLoading || !user || user.role !== 'admin') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }


    const pageTitle = pathname.split('/').pop()?.replace(/-/g, ' ') || 'Mission Control';

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-emerald-500/30 selection:text-emerald-200 antialiased overflow-x-hidden scroll-smooth transition-colors duration-300">
            {/* Sidebar */}
            <AdminSidebar 
                isCollapsed={isCollapsed} 
                setCollapsed={setCollapsed} 
                onLogout={logout} 
            />

            {/* Main Content Area */}
            <motion.main
                animate={{ 
                    paddingLeft: isCollapsed ? 80 : 280,
                    opacity: 1
                }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col min-h-screen"
            >
                {/* Top Navigation Bar */}
                <header className="sticky top-0 z-50 h-[80px] bg-background/80 backdrop-blur-xl border-b border-border px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">Sector 01</h2>
                            <h1 className="text-xl font-black uppercase tracking-tight text-foreground group cursor-default flex items-center gap-2">
                                {pageTitle}
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink className="w-4 h-4 text-muted-foreground" /></span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* System Health / Real-time stats marquee placeholder */}
                        <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-accent/50 rounded-full border border-border text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                API: 42ms
                            </div>
                            <div className="w-1 h-1 rounded-full bg-border" />
                            <div className="flex items-center gap-2">
                                <Activity className="w-3 h-3 text-cyan-400" />
                                LOAD: 14%
                            </div>
                            <div className="w-1 h-1 rounded-full bg-border" />
                            <div className="flex items-center gap-2">
                                <Globe className="w-3 h-3 text-amber-500" />
                                ACTIVE: 1,402
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {mounted && (
                                <button
                                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                                    className="p-2.5 rounded-xl bg-accent hover:bg-accent-foreground/10 text-muted-foreground hover:text-foreground transition-all border border-border"
                                >
                                    {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                </button>
                            )}
                            <button className="p-2.5 rounded-xl bg-accent text-muted-foreground hover:text-foreground transition-all border border-border">
                                <Search className="w-5 h-5" />
                            </button>
                            <button className="p-2.5 rounded-xl bg-accent text-muted-foreground hover:text-foreground transition-all border border-border relative">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full ring-4 ring-background animate-pulse" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-8 lg:p-12 relative overflow-visible">
                    {/* Background Gradients - Hardware Accelerated */}
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 blur-[140px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none transform-gpu will-change-transform" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full translate-y-1/4 -translate-x-1/4 pointer-events-none transform-gpu will-change-transform opacity-60" />
                    
                    <div className="relative z-10">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={pathname}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                            >
                                {children}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.main>
        </div>
    );
}
