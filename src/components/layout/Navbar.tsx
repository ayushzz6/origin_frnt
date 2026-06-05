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
}

export default function Navbar({ user, currentView, onNavigate, onPrefetch, onLogout, theme, setTheme, connectEnabled }: NavbarProps) {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showExploreMenu, setShowExploreMenu] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);
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
    const isConstrained = availableWidth < 1024; // Force mobile menu if space is less than 1024px
    const effectiveShowMobileMenu = showMobileMenu || (isConstrained && showMobileMenu);

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
        { label: 'AI Explainer', icon: () => <img src="/ai-bot.png" className="w-4 h-4 object-cover rounded-sm" />, view: 'doubt-solver' as ViewState },
        { label: 'Tests', icon: FileText, view: 'test-list' as ViewState },
        { label: 'Rooms', icon: Crown, view: 'study-rooms' as ViewState },
        { label: 'DPP', icon: Target, view: 'dpp' as ViewState },
        { label: 'Goals', icon: ListTodo, view: 'tasks-goals' as ViewState },
        { label: 'Explore', icon: LayoutGrid, view: 'explore' as ViewState },
        // Phase 2F — student entry to the teacher/institute connection hub.
        // Shown only when teacherConnect is enabled (mirrors the server gate).
        ...(connectEnabled ? [{ label: 'Connect', icon: Building2, view: 'connect' as ViewState }] : []),
    ];

    return (
        <div
            className="absolute top-2 sm:top-6 left-0 right-0 mx-auto z-50 bg-card/70 dark:bg-slate-950/70 backdrop-blur-[16px] border border-primary/20 dark:border-white/10 text-slate-700 dark:text-slate-300 shadow-xl shadow-primary/10 dark:shadow-2xl rounded-2xl sm:rounded-[2rem] pointer-events-auto w-full sm:w-[95%] max-w-7xl transition-all duration-300"
        >

            <div className="w-full h-full flex items-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <div className="flex items-center justify-between h-16 w-full">

                        {/* Logo */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                                onClick={() => setShowMobileMenu(!showMobileMenu)}
                                className={cn(
                                    "p-2 text-slate-700 dark:text-slate-400 hover:text-primary transition-all bg-primary/5 dark:bg-white/5 rounded-xl",
                                    isConstrained ? "flex" : "md:hidden"
                                )}
                            >
                                {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                            <img
                                src={user.role?.toLowerCase() === 'student' ? '/origin-new.jpg' : '/O3-Origin-Logo.png'}
                                alt="ORIGIN"
                                className="h-9 w-auto cursor-pointer rounded-lg"
                                onClick={() => onNavigate('dashboard')}
                            />
                            <div className={cn(
                                "h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2 flex-shrink-0",
                                isConstrained ? "hidden" : "hidden md:block"
                            )} />
                            {navItems.length > 0 && (
                                <nav id="tutorial-nav" className={cn(
                                    "items-center gap-1 relative px-1 py-1 bg-primary/5 dark:bg-white/5 rounded-xl border border-primary/10 dark:border-white/5 overflow-hidden min-w-0",
                                    isConstrained ? "hidden" : "hidden md:flex"
                                )}>
                                    {navItems.map((item) => {
                                        const currentViewValue = String(currentView);
                                        const isActive = currentViewValue === item.view ||
                                            (item.view === 'study-rooms' && currentViewValue.startsWith('study-rooms')) ||
                                            (item.view === 'ogcode' && currentView === 'ogcode-workspace');
                                        const Icon = item.icon as any;

                                        return (
                                            <div
                                                key={item.label}
                                                id={`tutorial-nav-${item.view}`}
                                                className="relative"
                                                onMouseEnter={() => {
                                                    setHoveredTab(item.label);
                                                    if (item.label === 'Explore') setShowExploreMenu(true);
                                                }}
                                                onMouseLeave={() => {
                                                    setHoveredTab(null);
                                                    if (item.label === 'Explore') setShowExploreMenu(false);
                                                }}
                                            >
                                                <button
                                                    id={`tutorial-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                                                    onClick={() => onNavigate(item.view)}
                                                    onMouseEnter={() => onPrefetch?.(item.view)}
                                                    onFocus={() => onPrefetch?.(item.view)}
                                                    className={`relative px-2 lg:px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 group z-10 ${isActive
                                                        ? 'text-[#334155] dark:text-white'
                                                        : 'text-slate-500 dark:text-slate-400 hover:text-[#334155] dark:hover:text-white'
                                                        }`}
                                                >
                                                    <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                                        {typeof Icon === 'function' ? <Icon /> : <Icon className="w-4 h-4" />}
                                                    </div>
                                                    {item.label}
                                                </button>

                                                {isActive && (
                                                    <motion.div
                                                        layoutId="nav-pill"
                                                        className="absolute inset-0 bg-primary/5 dark:bg-primary/20 shadow-sm rounded-lg z-0"
                                                        initial={false}
                                                        transition={{
                                                            type: "spring",
                                                            stiffness: 500,
                                                            damping: 35
                                                        }}
                                                    />
                                                )}

                                                {(hoveredTab === item.label && !isActive) && (
                                                    <motion.div
                                                        layoutId="nav-pill-hover"
                                                        className="absolute inset-0 bg-slate-50 dark:bg-zinc-800 shadow-sm rounded-lg z-0"
                                                        initial={false}
                                                        transition={{
                                                            type: "spring",
                                                            stiffness: 500,
                                                            damping: 35
                                                        }}
                                                    />
                                                )}

                                                {item.label === 'Explore' && (
                                                    <AnimatePresence>
                                                        {showExploreMenu && (
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                                transition={{ duration: 0.2, ease: "easeOut" }}
                                                                className="absolute left-0 mt-3 w-80 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-primary/20 dark:border-zinc-800 p-2 z-50 origin-top-left"
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
                                                                        show: {
                                                                            opacity: 1,
                                                                            transition: { staggerChildren: 0.05 }
                                                                        }
                                                                    }}
                                                                >
                                                                    {[
                                                                        { label: 'Study Corner', icon: BookOpen, view: 'study-corner', desc: 'NCERT & Materials', color: 'text-primary' },
                                                                        { label: 'Pomodoro', icon: Timer, view: 'pomodoro', desc: 'Focus timer', color: 'text-primary' },
                                                                        { label: 'Leaderboard', icon: Trophy, view: 'leaderboard', desc: 'Global rankings', color: 'text-amber-500' }
                                                                    ].map((subItem) => (
                                                                        <motion.button
                                                                            key={subItem.label}
                                                                            variants={{
                                                                                hidden: { opacity: 0, x: -10 },
                                                                                show: { opacity: 1, x: 0 }
                                                                            }}
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
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs font-bold text-primary">View All Features</span>
                                                                        </div>
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
                                </nav>
                            )}
                        </div>

                        {/* Center Welcome Message (Desktop) - REMOVED from main row */}

                        {/* Right Actions */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <motion.button
                                whileHover={{ scale: 1.1, rotate: 15 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className={`p-2 transition-colors rounded-full ${theme === 'light' ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-amber-500 bg-white/5'}`}
                            >
                                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </motion.button>

                            <motion.button 
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setIsSearchOpen(true)}
                                className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary transition-colors bg-primary/5 dark:bg-white/5 rounded-full"
                            >
                                <Search className="w-4 h-4" />
                            </motion.button>

                            <NotificationBell />

                            <div className={cn(
                                "h-6 w-px bg-slate-200 dark:bg-zinc-800 mx-1",
                                isConstrained ? "hidden" : "block"
                            )} />

                            <button className={cn(
                                "items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-white rounded-full transition-all active:scale-95 group",
                                isConstrained ? "hidden" : "hidden sm:flex"
                            )}>
                                <UserPlus className="w-4 h-4 transition-transform group-hover:scale-110" />
                                <span className="text-xs font-black uppercase tracking-widest">Invite</span>
                            </button>

                            {/* Profile Dropdown */}
                            <div className="relative ml-1" ref={profileMenuRef}>
                                <button
                                    onMouseEnter={() => {
                                        setShowProfileMenu(true);
                                        onPrefetch?.('profile');
                                    }}
                                    onClick={() => onNavigate('profile')}
                                    onFocus={() => onPrefetch?.('profile')}
                                    className="flex items-center gap-2 pl-1 pr-1 py-1 rounded-full hover:bg-primary/5 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-primary/20 dark:hover:border-slate-700"
                                >
                                    <Avatar className="w-8 h-8 border-2 border-white dark:border-slate-800 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
                                        <AvatarFallback className="bg-primary text-white text-xs font-bold">
                                            {user.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>

                                {showProfileMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        onMouseLeave={() => setShowProfileMenu(false)}
                                        className="absolute right-0 mt-3 w-64 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-primary/20 dark:border-zinc-800 py-2 z-50 origin-top-right"
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
                                                show: {
                                                    opacity: 1,
                                                    transition: { staggerChildren: 0.05 }
                                                }
                                            }}
                                        >
                                            {[
                                                { label: 'My Profile', icon: UserIcon, action: () => onNavigate('profile'), color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30' },
                                                { label: 'Settings', icon: Settings, action: () => onNavigate('profile'), color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-zinc-800/50' },
                                                { label: 'Logout', icon: LogOut, action: onLogout, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' }
                                            ].map((item) => (
                                                <motion.button
                                                    key={item.label}
                                                    variants={{
                                                        hidden: { opacity: 0, x: 10 },
                                                        show: { opacity: 1, x: 0 }
                                                    }}
                                                    onClick={() => {
                                                        item.action();
                                                        setShowProfileMenu(false);
                                                    }}
                                                    onMouseEnter={() => {
                                                        if (item.label === 'My Profile' || item.label === 'Settings') {
                                                            onPrefetch?.('profile');
                                                        }
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-black dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors group"
                                                >
                                                    <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                                                        <item.icon className="w-4 h-4" />
                                                    </div>
                                                    {item.label}
                                                </motion.button>
                                            ))}
                                        </motion.div>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {showMobileMenu && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -20, height: 0 }}
                        className={cn(
                            "border-t border-rose-100 dark:border-zinc-800 bg-card/95 dark:bg-zinc-950/95 backdrop-blur-2xl rounded-b-2xl overflow-hidden shadow-2xl",
                            isConstrained ? "block" : "md:hidden"
                        )}
                    >
                        <div className="p-4 space-y-2">
                            {navItems.map((item) => {
                                const Icon = item.icon as any;
                                const currentViewValue = String(currentView);
                                const isActive = currentViewValue === item.view ||
                                    (item.view === 'study-rooms' && currentViewValue.startsWith('study-rooms')) ||
                                    (item.view === 'ogcode' && currentView === 'ogcode-workspace');
                                return (
                                    <button
                                        key={item.label}
                                        onClick={() => {
                                            onNavigate(item.view);
                                            setShowMobileMenu(false);
                                        }}
                                        onTouchStart={() => onPrefetch?.(item.view)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 dark:hover:bg-zinc-900 text-black dark:text-slate-400'}`}
                                    >
                                        <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/20' : 'bg-slate-100 dark:bg-zinc-800'}`}>
                                            {typeof Icon === 'function' ? <Icon /> : <Icon className="w-5 h-5" />}
                                        </div>
                                        <span className="font-bold text-sm tracking-wide">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <GlobalSearch 
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                currentView={currentView}
                onNavigate={onNavigate}
            />
        </div>
    );
}
