'use client';
import { useState, useRef, useEffect } from 'react';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Crown,
    LogOut,
    Settings,
    Bell,
    Search,
    Sun,
    Moon,
    User as UserIcon,
    Timer,
    UserPlus,
    Code,
    LayoutGrid,
    ListTodo,
    BookOpen,
    Building2,
    FileText,
    Target,
    ChevronRight,
    Trophy,
    ArrowRight,
    Menu,
    X
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { motion, AnimatePresence } from 'framer-motion';
import type { User, ViewState } from '@/types';
import GlobalSearch from './GlobalSearch';

interface NavbarProps {
    user: User;
    currentView: ViewState;
    onNavigate: (view: ViewState) => void;
    onPrefetch?: (view: ViewState) => void;
    onLogout: () => void;
    theme: "dark" | "light" | "system";
    setTheme: (theme: "dark" | "light" | "system") => void;
    connectEnabled?: boolean;
    leftOffset?: number;
}

export default function Navbar({ user, currentView, onNavigate, onPrefetch, onLogout, theme, setTheme, connectEnabled, leftOffset = 0 }: NavbarProps) {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showExploreMenu, setShowExploreMenu] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const exploreMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const { availableWidth } = useLayout();
    const isConstrained = availableWidth < 1024;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setShowProfileMenu(false);
            }
            if (exploreMenuRef.current && !exploreMenuRef.current.contains(event.target as Node)) {
                setShowExploreMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isTeacher = user.role?.toLowerCase() === 'teacher';

    const navItems = isTeacher ? [] : [
        { label: 'OGCode', icon: Code, view: 'ogcode' as ViewState },
        { label: 'AI Explainer', icon: () => <img src="/ai-bot.png" className="w-5 h-5 object-cover rounded-sm" />, view: 'doubt-solver' as ViewState },
        { label: 'Tests', icon: FileText, view: 'test-list' as ViewState },
        { label: 'Rooms', icon: Crown, view: 'study-rooms' as ViewState },
        { label: 'DPP', icon: Target, view: 'dpp' as ViewState },
        { label: 'Goals', icon: ListTodo, view: 'tasks-goals' as ViewState },
        { label: 'Explore', icon: LayoutGrid, view: 'explore' as ViewState },
        ...(connectEnabled ? [{ label: 'Connect', icon: Building2, view: 'connect' as ViewState }] : []),
    ];

    const isActive = (item: { view: ViewState; label: string }) => {
        const currentViewValue = String(currentView);
        return currentViewValue === item.view ||
            (item.view === 'study-rooms' && currentViewValue.startsWith('study-rooms')) ||
            (item.view === 'ogcode' && currentView === 'ogcode-workspace');
    };

    const sidebarBg = 'bg-card/95 dark:bg-slate-950/90 backdrop-blur-xl border-r border-primary/20 dark:border-primary/20 shadow-[2px_0_24px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_24px_rgba(0,0,0,0.3)]';

    return (
        <>
            {/* ── DESKTOP SIDEBAR (md+) ────────────────────────────────────── */}
            <nav
                id="tutorial-nav"
                style={leftOffset > 0 ? { left: leftOffset } : undefined}
                className={cn(
                    'fixed left-0 top-0 h-dvh z-50 hidden md:flex flex-col w-[72px] transition-[left] duration-300',
                    sidebarBg
                )}
            >
                {/* Logo */}
                <div className="flex items-center justify-center h-[72px] flex-shrink-0">
                    <button
                        onClick={() => onNavigate('dashboard')}
                        onMouseEnter={() => onPrefetch?.('dashboard')}
                        className="p-1 rounded-xl hover:bg-primary/5 transition-colors"
                    >
                        <img
                            src={user.role?.toLowerCase() === 'student' ? '/origin-new.jpg' : '/O3-Origin-Logo.png'}
                            alt="ORIGIN"
                            className="h-9 w-9 object-cover rounded-lg"
                        />
                    </button>
                </div>

                {/* Divider */}
                <div className="w-10 mx-auto h-px bg-primary/10 flex-shrink-0" />

                {/* Search — pinned at top for quick access */}
                <div className="relative w-full px-1 pt-2 flex-shrink-0 group/search">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsSearchOpen(true)}
                        title="Search (⌘K)"
                        className="flex flex-col items-center gap-0.5 py-2.5 px-1 w-full rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                    >
                        <Search className="w-5 h-5" />
                        <span className="text-[9px] font-bold leading-none">Search</span>
                    </motion.button>
                    {/* Hover expand tooltip */}
                    <div className="absolute left-[72px] top-1/2 -translate-y-1/2 pointer-events-none z-[60] flex items-center">
                        <div className={cn(
                            'flex items-center h-9 rounded-r-xl bg-card/95 dark:bg-zinc-900/95 backdrop-blur-xl',
                            'border border-l-0 border-primary/20 shadow-lg overflow-hidden',
                            'w-0 group-hover/search:w-24 transition-all duration-200 ease-out'
                        )}>
                            <span className="whitespace-nowrap text-xs font-bold text-foreground px-3">Search</span>
                        </div>
                    </div>
                </div>

                <div className="w-10 mx-auto h-px bg-primary/10 flex-shrink-0 mt-2" />

                {/* Nav Items */}
                <div className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto no-scrollbar px-1">
                    {navItems.map((item) => {
                        const active = isActive(item);
                        const Icon = item.icon as React.ComponentType<{ className?: string }>;

                        return (
                            <div
                                key={item.label}
                                id={`tutorial-nav-${item.view}`}
                                className="relative w-full group/navitem"
                                onMouseEnter={() => {
                                    if (item.label === 'Explore') setShowExploreMenu(true);
                                }}
                                onMouseLeave={() => {
                                    if (item.label === 'Explore') setShowExploreMenu(false);
                                }}
                                ref={item.label === 'Explore' ? exploreMenuRef : undefined}
                            >
                                <button
                                    id={`tutorial-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                                    onClick={() => onNavigate(item.view)}
                                    onMouseEnter={() => onPrefetch?.(item.view)}
                                    onFocus={() => onPrefetch?.(item.view)}
                                    title={item.label}
                                    className={cn(
                                        'relative flex flex-col items-center gap-0.5 py-2.5 px-1 w-full rounded-xl transition-all duration-200 group',
                                        active
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-slate-400 dark:text-slate-500 hover:bg-primary/5 hover:text-primary'
                                    )}
                                >
                                    {/* Active pill */}
                                    {active && (
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                                    )}
                                    <div className="w-5 h-5 flex items-center justify-center">
                                        {typeof item.icon === 'function' && item.icon.toString().includes('img')
                                            ? <Icon />
                                            : <Icon className="w-5 h-5" />
                                        }
                                    </div>
                                    <span className="sr-only">{item.label}</span>
                                </button>

                                {/* Hover expand tooltip — hidden once sub-menu is open for Explore */}
                                {!(item.label === 'Explore' && showExploreMenu) && (
                                    <div className="absolute left-[72px] top-1/2 -translate-y-1/2 pointer-events-none z-[60] flex items-center">
                                        <div className={cn(
                                            'flex items-center h-9 rounded-r-xl bg-card/95 dark:bg-zinc-900/95 backdrop-blur-xl',
                                            'border border-l-0 border-primary/20 shadow-lg overflow-hidden',
                                            'w-0 group-hover/navitem:w-28 transition-all duration-200 ease-out'
                                        )}>
                                            <span className="whitespace-nowrap text-xs font-bold text-foreground px-3">{item.label}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Explore sub-menu */}
                                {item.label === 'Explore' && (
                                    <AnimatePresence>
                                        {showExploreMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, x: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                                exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                                className="absolute left-[76px] top-0 w-80 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-primary/20 dark:border-zinc-800 p-2 z-50 origin-left"
                                            >
                                                <div className="px-3 py-2 mb-2">
                                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Learning Hub</h3>
                                                </div>
                                                <motion.div
                                                    className="grid grid-cols-1 gap-1"
                                                    initial="hidden"
                                                    animate="show"
                                                    variants={{
                                                        hidden: { opacity: 0 },
                                                        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
                                                    }}
                                                >
                                                    {[
                                                        { label: 'Study Corner', icon: BookOpen, view: 'study-corner', desc: 'NCERT & Materials', color: 'text-primary' },
                                                        { label: 'Pomodoro', icon: Timer, view: 'pomodoro', desc: 'Focus timer', color: 'text-primary' },
                                                        { label: 'Leaderboard', icon: Trophy, view: 'leaderboard', desc: 'Global rankings', color: 'text-amber-500' }
                                                    ].map((subItem) => (
                                                        <motion.button
                                                            key={subItem.label}
                                                            variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                                                            onClick={() => {
                                                                onNavigate(subItem.view as ViewState);
                                                                setShowExploreMenu(false);
                                                            }}
                                                            onMouseEnter={() => onPrefetch?.(subItem.view as ViewState)}
                                                            onFocus={() => onPrefetch?.(subItem.view as ViewState)}
                                                            className="w-full flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all group"
                                                        >
                                                            <div className={`w-10 h-10 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center transition-transform group-hover:scale-110 ${subItem.color}`}>
                                                                <subItem.icon className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-left flex-1">
                                                                <p className="text-sm font-bold text-black dark:text-white leading-none mb-1">{subItem.label}</p>
                                                                <p className="text-[10px] text-slate-500 dark:text-zinc-500">{subItem.desc}</p>
                                                            </div>
                                                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-700 group-hover:translate-x-1 transition-transform" />
                                                        </motion.button>
                                                    ))}
                                                </motion.div>
                                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                                    <button
                                                        onClick={() => onNavigate('explore')}
                                                        onMouseEnter={() => onPrefetch?.('explore')}
                                                        onFocus={() => onPrefetch?.('explore')}
                                                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-colors group"
                                                    >
                                                        <span className="text-xs font-bold text-primary">View All Features</span>
                                                        <ArrowRight className="w-3.5 h-3.5 text-rose-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Divider */}
                <div className="w-10 mx-auto h-px bg-primary/10 flex-shrink-0" />

                {/* Bottom actions */}
                <div className="flex flex-col items-center gap-1 py-3 px-1 flex-shrink-0">
                    {/* Theme toggle */}
                    <div className="relative w-full group/theme">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                        className={cn(
                            'flex flex-col items-center gap-0.5 py-2.5 px-1 w-full rounded-xl transition-all',
                            theme === 'light'
                                ? 'text-primary bg-primary/10'
                                : 'text-slate-400 hover:text-amber-500 hover:bg-primary/5'
                        )}
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        <span className="text-[9px] font-bold leading-none">Theme</span>
                    </motion.button>
                    <div className="absolute left-[72px] top-1/2 -translate-y-1/2 pointer-events-none z-[60] flex items-center">
                        <div className={cn(
                            'flex items-center h-9 rounded-r-xl bg-card/95 dark:bg-zinc-900/95 backdrop-blur-xl',
                            'border border-l-0 border-primary/20 shadow-lg overflow-hidden',
                            'w-0 group-hover/theme:w-24 transition-all duration-200 ease-out'
                        )}>
                            <span className="whitespace-nowrap text-xs font-bold text-foreground px-3">
                                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                            </span>
                        </div>
                    </div>
                    </div>

                    {/* Notifications */}
                    <div className="relative w-full group/alerts">
                    <div className="flex flex-col items-center gap-0.5 py-2.5 px-1 w-full rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                        <NotificationBell />
                        <span className="text-[9px] font-bold leading-none">Alerts</span>
                    </div>
                    <div className="absolute left-[72px] top-1/2 -translate-y-1/2 pointer-events-none z-[60] flex items-center">
                        <div className={cn(
                            'flex items-center h-9 rounded-r-xl bg-card/95 dark:bg-zinc-900/95 backdrop-blur-xl',
                            'border border-l-0 border-primary/20 shadow-lg overflow-hidden',
                            'w-0 group-hover/alerts:w-24 transition-all duration-200 ease-out'
                        )}>
                            <span className="whitespace-nowrap text-xs font-bold text-foreground px-3">Alerts</span>
                        </div>
                    </div>
                    </div>

                    {/* Avatar / Profile */}
                    <div className="relative w-full group/profile" ref={profileMenuRef}>
                        <button
                            onMouseEnter={() => {
                                setShowProfileMenu(true);
                                onPrefetch?.('profile');
                            }}
                            onClick={() => onNavigate('profile')}
                            onFocus={() => onPrefetch?.('profile')}
                            title="Profile"
                            className="flex flex-col items-center gap-0.5 py-2.5 px-1 w-full rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                        >
                            <Avatar className="w-6 h-6 border border-primary/20 shadow-sm">
                                <AvatarFallback className="bg-primary text-white text-[10px] font-bold">
                                    {user.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-[9px] font-bold leading-none">Profile</span>
                        </button>
                        {/* Hover expand tooltip */}
                        <div className="absolute left-[72px] bottom-0 pointer-events-none z-[60] flex items-center">
                            <div className={cn(
                                'flex items-center h-9 rounded-r-xl bg-card/95 dark:bg-zinc-900/95 backdrop-blur-xl',
                                'border border-l-0 border-primary/20 shadow-lg overflow-hidden',
                                'w-0 group-hover/profile:w-28 transition-all duration-200 ease-out'
                            )}>
                                <span className="whitespace-nowrap text-xs font-bold text-foreground px-3">{user.name.split(' ')[0]}</span>
                            </div>
                        </div>

                        {showProfileMenu && (
                            <motion.div
                                initial={{ opacity: 0, x: 10, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                onMouseLeave={() => setShowProfileMenu(false)}
                                className="absolute left-[76px] bottom-0 w-64 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-primary/20 dark:border-zinc-800 py-2 z-50 origin-bottom-left"
                            >
                                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 mb-2">
                                    <p className="text-sm font-black text-black dark:text-white">{user.name}</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <p className="text-xs text-slate-500 dark:text-zinc-500 truncate max-w-[120px]">{user.email}</p>
                                        <Badge className="text-[10px] h-5 px-1.5 bg-rose-600 text-white dark:bg-rose-500/20 dark:text-rose-400 border-none font-bold">
                                            {user.isPremium ? 'PRO' : 'FREE'}
                                        </Badge>
                                    </div>
                                </div>

                                {!user.isPremium && (
                                    <div className="px-3 mb-2">
                                        <button
                                            onClick={() => {
                                                onNavigate('premium');
                                                setShowProfileMenu(false);
                                            }}
                                            onMouseEnter={() => onPrefetch?.('premium')}
                                            onFocus={() => onPrefetch?.('premium')}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:scale-[1.02] transition-all"
                                        >
                                            <Crown className="w-3.5 h-3.5" />
                                            Upgrade to Pro
                                        </button>
                                    </div>
                                )}

                                <motion.div
                                    className="px-2"
                                    initial="hidden"
                                    animate="show"
                                    variants={{
                                        hidden: { opacity: 0 },
                                        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
                                    }}
                                >
                                    {[
                                        { label: 'My Profile', icon: UserIcon, action: () => onNavigate('profile'), color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30' },
                                        { label: 'Settings', icon: Settings, action: () => onNavigate('profile'), color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-zinc-800/50' },
                                        { label: 'Logout', icon: LogOut, action: onLogout, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' }
                                    ].map((menuItem) => (
                                        <motion.button
                                            key={menuItem.label}
                                            variants={{ hidden: { opacity: 0, x: 10 }, show: { opacity: 1, x: 0 } }}
                                            onClick={() => {
                                                menuItem.action();
                                                setShowProfileMenu(false);
                                            }}
                                            onMouseEnter={() => {
                                                if (menuItem.label === 'My Profile' || menuItem.label === 'Settings') {
                                                    onPrefetch?.('profile');
                                                }
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-black dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors group"
                                        >
                                            <div className={`w-8 h-8 rounded-lg ${menuItem.bg} flex items-center justify-center ${menuItem.color} group-hover:scale-110 transition-transform`}>
                                                <menuItem.icon className="w-4 h-4" />
                                            </div>
                                            {menuItem.label}
                                        </motion.button>
                                    ))}
                                </motion.div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── MOBILE COMPACT TOP BAR ──────────────────────────────────── */}
            <div className={cn(
                'fixed top-0 left-0 right-0 h-14 z-50 md:hidden flex items-center justify-between px-3',
                'bg-card/95 dark:bg-slate-950/90 backdrop-blur-xl border-b border-primary/20 dark:border-primary/20',
                'shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.3)]'
            )}>
                {/* Hamburger */}
                <button
                    onClick={() => setShowMobileMenu(true)}
                    className="p-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors bg-primary/5 rounded-xl"
                >
                    <Menu className="w-5 h-5" />
                </button>

                {/* Logo */}
                <button
                    onClick={() => onNavigate('dashboard')}
                    onMouseEnter={() => onPrefetch?.('dashboard')}
                    className="absolute left-1/2 -translate-x-1/2"
                >
                    <img
                        src={user.role?.toLowerCase() === 'student' ? '/origin-new.jpg' : '/O3-Origin-Logo.png'}
                        alt="ORIGIN"
                        className="h-8 w-auto rounded-lg"
                    />
                </button>

                {/* Right actions */}
                <div className="flex items-center gap-1">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className={cn(
                            'p-2 rounded-full transition-colors',
                            theme === 'light' ? 'text-primary bg-primary/10' : 'text-slate-400 bg-white/5'
                        )}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsSearchOpen(true)}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary bg-primary/5 rounded-full transition-colors"
                    >
                        <Search className="w-4 h-4" />
                    </motion.button>

                    <NotificationBell />

                    <button
                        onMouseEnter={() => onPrefetch?.('profile')}
                        onClick={() => onNavigate('profile')}
                        className="ml-1 p-1"
                    >
                        <Avatar className="w-7 h-7 border border-primary/20">
                            <AvatarFallback className="bg-primary text-white text-[10px] font-bold">
                                {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </button>
                </div>
            </div>

            {/* ── MOBILE BOTTOM-SHEET DRAWER ──────────────────────────────── */}
            <AnimatePresence>
                {showMobileMenu && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowMobileMenu(false)}
                            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
                        />

                        {/* Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-[70] md:hidden bg-card/98 dark:bg-slate-950/98 backdrop-blur-2xl rounded-t-3xl border-t border-primary/20 shadow-2xl"
                        >
                            {/* Handle */}
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                            </div>

                            {/* Close button */}
                            <div className="flex items-center justify-between px-5 pb-3">
                                <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Navigation</p>
                                <button
                                    onClick={() => setShowMobileMenu(false)}
                                    className="p-1.5 rounded-xl bg-primary/5 text-slate-500 hover:text-primary transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Nav items — 2-column grid */}
                            <div className="grid grid-cols-2 gap-2 px-4 pb-8">
                                {navItems.map((item) => {
                                    const Icon = item.icon as React.ComponentType<{ className?: string }>;
                                    const active = isActive(item);
                                    return (
                                        <button
                                            key={item.label}
                                            id={`tutorial-nav-${item.view}`}
                                            onClick={() => {
                                                onNavigate(item.view);
                                                setShowMobileMenu(false);
                                            }}
                                            onTouchStart={() => onPrefetch?.(item.view)}
                                            className={cn(
                                                'flex items-center gap-3 p-4 rounded-2xl transition-all text-left',
                                                active
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                                            )}
                                        >
                                            <div className={cn('p-2 rounded-xl flex-shrink-0', active ? 'bg-primary/20' : 'bg-slate-100 dark:bg-slate-800')}>
                                                {typeof item.icon === 'function' && item.icon.toString().includes('img')
                                                    ? <Icon />
                                                    : <Icon className="w-5 h-5" />
                                                }
                                            </div>
                                            <span className="font-bold text-sm">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <GlobalSearch
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                currentView={currentView}
                onNavigate={onNavigate}
            />
        </>
    );
}
