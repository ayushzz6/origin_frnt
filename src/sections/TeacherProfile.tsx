'use client';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ChevronLeft,
    User,
    GraduationCap,
    Crown,
    Edit3,
    BookOpen,
    Trophy,
    TrendingUp,
    Calendar,
    MapPin,
    Camera,
    Settings,
    Bell,
    Shield,
    Sun,
    Moon,
    MessageSquare,
    Users,
    Briefcase,
    LogOut
} from 'lucide-react';
import type { User as UserType } from '@/types';

interface TeacherProfileProps {
    user: UserType;
    onBack: () => void;
    onLogout: () => void;
}

export default function TeacherProfile({ user, onBack, onLogout }: TeacherProfileProps) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const toggleDarkMode = () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    };

    const teachingStats = [
        { label: 'Active Classes', value: '12', icon: Users, color: 'text-blue-500 shadow-blue-500/10' },
        { label: 'Total Students', value: '450+', icon: GraduationCap, color: 'text-emerald-500 shadow-emerald-500/10' },
        { label: 'Doubt Solved', value: '1.2k', icon: MessageSquare, color: 'text-orange-500 shadow-orange-500/10' },
        { label: 'Rating', value: '4.9', icon: Trophy, color: 'text-indigo-500 shadow-indigo-500/10' },
    ];

    const syllabusProgress = [
        { course: 'Class 12 - Physics A', progress: 85, color: 'bg-blue-500 dark:bg-blue-600' },
        { course: 'Class 11 - JEE Advanced', progress: 65, color: 'bg-orange-500 dark:bg-orange-600' },
        { course: 'Class 10 - Foundation', progress: 92, color: 'bg-emerald-500 dark:bg-emerald-600' },
    ];

    const teachingMilestones = [
        { name: 'Expert Educator', description: 'Taught over 1000 students', icon: GraduationCap, unlocked: true },
        { name: 'Fastest Responser', description: 'Average doubt resolution < 5 mins', icon: TrendingUp, unlocked: true },
        { name: 'Subject Matter Expert', description: 'Authored 3 study guides', icon: BookOpen, unlocked: true },
        { name: 'Student Favorite', description: 'Highest rating for 3 months', icon: Trophy, unlocked: true },
        { name: 'Content Creator', description: 'Uploaded 50+ lecture videos', icon: Camera, unlocked: false },
        { name: 'Mentor Master', description: 'Mentored 10+ junior teachers', icon: Users, unlocked: false },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary transition-colors duration-300 relative overflow-x-hidden">
            {/* Premium Background Decoration */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-40 dark:opacity-20 transition-opacity"
                style={{
                    backgroundImage: `radial-gradient(circle at 80% 30%, hsl(var(--primary) / 0.15) 0%, transparent 40%),
                               radial-gradient(circle at 20% 70%, hsl(var(--secondary) / 0.1) 0%, transparent 40%)`
                }}>
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
            </div>

            <div className="relative z-10 flex flex-col min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border transition-all">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-20">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={onBack}
                                    className="p-2.5 rounded-xl bg-card text-muted-foreground hover:text-primary transition-all border border-border shadow-sm"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="h-8 w-[1px] bg-border mx-1" />
                                <h1 className="text-xl font-black tracking-tight text-foreground uppercase">Teacher Profile</h1>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={toggleDarkMode}
                                    className="p-2.5 rounded-full bg-card text-muted-foreground hover:text-foreground transition-all border border-border"
                                >
                                    {mounted ? (resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />) : <Moon className="w-5 h-5" />}
                                </button>
                                <button className="p-2.5 rounded-full bg-card text-muted-foreground hover:text-foreground transition-all border border-border">
                                    <Settings className="w-5 h-5" />
                                </button>
                                <div className="h-8 w-[1px] bg-border mx-1" />
                                <button
                                    onClick={onLogout}
                                    className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all border border-rose-100 dark:border-rose-900/30 shadow-sm group"
                                    title="Logout"
                                >
                                    <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full mb-20">
                    {/* Profile Header */}
                    <Card className="border border-border shadow-2xl shadow-primary/5 bg-card/60 backdrop-blur-xl mb-10 relative overflow-hidden ring-1 ring-border">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 pointer-events-none" />
                        <CardContent className="relative z-10 p-8 sm:p-10">
                            <div className="flex flex-col sm:flex-row items-center gap-8">
                                {/* Avatar */}
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-blue-500 rounded-full opacity-30 blur group-hover:opacity-50 transition duration-500" />
                                    <Avatar className="w-28 h-28 border-4 border-background relative z-10">
                                        <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-4xl font-black uppercase">
                                            {user.name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <button className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-background hover:scale-110 transition-transform z-20">
                                        <Camera className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Info */}
                                <div className="flex-1 text-center sm:text-left">
                                    <div className="flex items-center justify-center sm:justify-start gap-4 mb-3">
                                        <h2 className="text-3xl font-black text-foreground tracking-tight">{user.name}</h2>
                                        <Badge className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 border-0 h-6">
                                            <Crown className="w-3 h-3 mr-1 text-yellow-300" />
                                            VERIFIED EDUCATOR
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground font-medium mb-5">{user.email}</p>

                                    <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                                        <Badge variant="secondary" className="px-3.5 py-1.5 bg-secondary text-secondary-foreground border border-border shadow-sm font-bold text-[10px] uppercase tracking-wider">
                                            <Briefcase className="w-3.5 h-3.5 mr-1.5" />
                                            Senior Faculty
                                        </Badge>
                                        <Badge variant="secondary" className="px-3.5 py-1.5 bg-secondary text-secondary-foreground border border-border shadow-sm font-bold text-[10px] uppercase tracking-wider">
                                            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                                            {user.fieldOfInterest || 'Physics'}
                                        </Badge>
                                        <Badge variant="secondary" className="px-3.5 py-1.5 bg-secondary text-secondary-foreground border border-border shadow-sm font-bold text-[10px] uppercase tracking-wider">
                                            <MapPin className="w-3.5 h-3.5 mr-1.5" />
                                            Mumbai, India
                                        </Badge>
                                    </div>
                                </div>

                                {/* Edit Button */}
                                <Button
                                    variant="outline"
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="rounded-xl px-6 h-11 border-border bg-card text-foreground hover:bg-secondary font-bold transition-all shadow-sm"
                                >
                                    <Edit3 className="w-4 h-4 mr-2" />
                                    Edit Profile
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                        {teachingStats.map((stat, index) => (
                            <Card key={index} className="border border-border shadow-lg bg-card/60 backdrop-blur-xl ring-1 ring-border hover:scale-[1.02] transition-all group cursor-default">
                                <CardContent className="p-6 text-center">
                                    <div className={`w-12 h-12 mx-auto rounded-2xl bg-secondary flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform ${stat.color}`}>
                                        <stat.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <p className="text-2xl font-black text-foreground tracking-tight">{stat.value}</p>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{stat.label}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Tabs */}
                    <Tabs defaultValue="overview" className="mb-10">
                        <TabsList className="bg-muted p-1.5 w-full h-14 rounded-2xl backdrop-blur-md">
                            {[
                                { value: 'overview', icon: TrendingUp, label: 'Performance' },
                                { value: 'achievements', icon: Trophy, label: 'Milestones' },
                                { value: 'settings', icon: Settings, label: 'Office Settings' }
                            ].map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="flex-1 h-full rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg text-muted-foreground font-bold text-sm tracking-tight transition-all"
                                >
                                    <tab.icon className="w-4 h-4 mr-2" />
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        <TabsContent value="overview" className="mt-8">
                            <Card className="border border-border shadow-xl bg-card/60 backdrop-blur-xl ring-1 ring-border overflow-hidden">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg font-black flex items-center gap-3 text-foreground uppercase tracking-tight">
                                        <div className="w-1.5 h-6 bg-primary rounded-full" />
                                        Syllabus Completion
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-8">
                                    <div className="space-y-6">
                                        {syllabusProgress.map((course) => (
                                            <div key={course.course}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-bold text-foreground text-sm">{course.course}</span>
                                                    <span className="text-xs font-black text-primary">{course.progress}%</span>
                                                </div>
                                                <div className="h-3 bg-secondary rounded-full overflow-hidden border border-border">
                                                    <div
                                                        className={`h-full ${course.color} rounded-full transition-all duration-500`}
                                                        style={{ width: `${course.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-8 p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 dark:to-secondary/20 ring-1 ring-primary/20">
                                        <h4 className="font-bold mb-2">Teacher Credibility Score</h4>
                                        <div className="flex items-center gap-6">
                                            <div className="w-24 h-24 relative flex-shrink-0">
                                                <svg className="w-full h-full transform -rotate-90">
                                                    <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary" />
                                                    <circle
                                                        cx="48"
                                                        cy="48"
                                                        r="42"
                                                        fill="none"
                                                        stroke="url(#teal-grad)"
                                                        strokeWidth="8"
                                                        strokeLinecap="round"
                                                        strokeDasharray={`${0.94 * 264} 264`}
                                                    />
                                                    <defs>
                                                        <linearGradient id="teal-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                            <stop offset="0%" stopColor="hsl(var(--primary))" />
                                                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                                                        </linearGradient>
                                                    </defs>
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className="text-2xl font-black text-primary">94</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground leading-relaxed font-medium">Your teaching impact is at an all-time high! Your student engagement is <span className="text-emerald-500 font-bold">↑ 12%</span> this week. Excellent work, Professor!</p>
                                                <Button
                                                    variant="ghost"
                                                    className="text-primary p-0 h-auto mt-2 font-black hover:bg-transparent"
                                                    onClick={onBack}
                                                >
                                                    View Class Feedback →
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="achievements" className="mt-8">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                {teachingMilestones.map((milestone, index) => (
                                    <Card
                                        key={index}
                                        className={`border border-border shadow-lg ${milestone.unlocked ? 'bg-card/60' : 'bg-muted/10 opacity-60'} backdrop-blur-xl ring-1 ring-border group transition-all hover:scale-[1.02]`}
                                    >
                                        <CardContent className="p-8 text-center">
                                            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${milestone.unlocked
                                                ? 'bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20'
                                                : 'bg-secondary'
                                                }`}>
                                                <milestone.icon className={`w-8 h-8 ${milestone.unlocked ? 'text-white' : 'text-muted-foreground'}`} />
                                            </div>
                                            <h4 className="font-black text-foreground tracking-tight leading-tight mb-1 uppercase text-xs">{milestone.name}</h4>
                                            <p className="text-[10px] text-muted-foreground font-medium">{milestone.description}</p>
                                            {milestone.unlocked && (
                                                <Badge className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-0 font-bold text-[9px]">EARNED</Badge>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="settings" className="mt-8">
                            <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl ring-1 ring-slate-200 dark:ring-white/5">
                                <CardContent className="p-6">
                                    <div className="space-y-3">
                                        {[
                                            { icon: User, label: 'Profile Information', desc: 'Update your professional bio and designation', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' },
                                            { icon: Calendar, label: 'Office Hours', desc: 'Manage your availability for doubt sessions', color: 'bg-primary/5 text-primary' },
                                            { icon: Bell, label: 'Class Alerts', desc: 'Set notifications for student submissions', color: 'bg-secondary text-secondary-foreground' },
                                            { icon: Shield, label: 'Privacy & Security', desc: 'Access control and professional credentials', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' }
                                        ].map((item, idx) => (
                                            <button key={idx} className="w-full flex items-center gap-5 p-4 rounded-2xl hover:bg-secondary transition-all border border-transparent hover:border-border group text-left">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${item.color}`}>
                                                    <item.icon className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-black text-foreground leading-tight text-sm uppercase">{item.label}</h4>
                                                    <p className="text-[11px] text-muted-foreground mt-1 font-medium">{item.desc}</p>
                                                </div>
                                                <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 rotate-180 transition-all" />
                                            </button>
                                        ))}

                                        <div className="pt-4 border-t border-border mt-2">
                                            <button
                                                onClick={onLogout}
                                                className="w-full flex items-center gap-5 p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/10 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all border border-rose-100/50 dark:border-rose-900/20 hover:border-rose-200 dark:hover:border-rose-800 group"
                                            >
                                                <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
                                                    <LogOut className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <h4 className="font-black text-rose-600 dark:text-rose-400 leading-tight text-sm uppercase">Logout Session</h4>
                                                    <p className="text-[11px] text-rose-500/70 dark:text-rose-400/50 mt-1 font-medium">Safely sign out from your professional account</p>
                                                </div>
                                                <ChevronLeft className="w-5 h-5 text-rose-300 group-hover:translate-x-1 rotate-180 transition-all" />
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </main>
            </div>
        </div>
    );
}
