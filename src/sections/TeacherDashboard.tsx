'use client';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    Calendar,
    Plus,
    MoreVertical,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Copy,
    Mail,
    UserCircle,
    Camera
} from 'lucide-react';
import type { User, Classroom } from '@/types';
import { toast } from 'sonner';

interface TeacherDashboardProps {
    user: User;
}

// Mock Data for Teacher Dashboard
const mockClassrooms: Classroom[] = [
    {
        id: 'c1',
        name: 'Class 12 - Physics A',
        subject: 'Physics',
        schedule: 'Mon, Wed, Fri - 10:00 AM',
        studentCount: 42,
        avgAttendance: 94,
        students: []
    },
    {
        id: 'c2',
        name: 'Class 11 - JEE Advanced',
        subject: 'Physics',
        schedule: 'Tue, Thu - 2:00 PM',
        studentCount: 35,
        avgAttendance: 88,
        students: []
    },
    {
        id: 'c3',
        name: 'Class 12 - Doubt Session',
        subject: 'Physics',
        schedule: 'Sat - 11:00 AM',
        studentCount: 15,
        avgAttendance: 98,
        students: []
    }
];

export default function TeacherDashboard({ user }: { user: User }) {
    const [classrooms, setClassrooms] = useState<Classroom[]>(mockClassrooms);
    const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);

    // Create Class Form State
    const [newClassName, setNewClassName] = useState('');
    const [newClassSubject, setNewClassSubject] = useState('');
    const [newClassSchedule, setNewClassSchedule] = useState('');
    const [iscreateClassOpen, setIsCreateClassOpen] = useState(false);

    // Add Student Form State
    const [inviteEmail, setInviteEmail] = useState('');
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);

    // Removal of profileMenuRef logic as TopBar is now global

    const handleCreateClass = (e: React.FormEvent) => {
        e.preventDefault();
        const newClass: Classroom = {
            id: `c${Date.now()}`,
            name: newClassName,
            subject: newClassSubject,
            schedule: newClassSchedule,
            studentCount: 0,
            avgAttendance: 0,
            students: []
        };
        setClassrooms([...classrooms, newClass]);
        setIsCreateClassOpen(false);
        toast.success('Classroom created successfully!');
        setNewClassName('');
        setNewClassSubject('');
        setNewClassSchedule('');
    };

    const handleAddStudent = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app, this would send an invite
        toast.success(`Invite sent to ${inviteEmail}`);
        setIsAddStudentOpen(false);
        setInviteEmail('');
    };

    const copyInviteLink = () => {
        navigator.clipboard.writeText(`https://origin.app/join/${selectedClassroom?.id}`);
        toast.success('Invite link copied to clipboard');
    };

    return (
        <div className="min-h-screen neu-surface text-foreground transition-colors duration-300 selection:bg-primary/20 selection:text-primary font-sans">

            {/* Decorative Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px] animate-pulse" />
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight">
                            Hello, <span className="text-primary">{user.name.split(' ')[0]}</span> 👋
                        </h1>
                        <p className="text-muted-foreground mt-2 font-medium">
                            Manage your classrooms and student performance with precision.
                        </p>
                    </div>

                    <Dialog open={iscreateClassOpen} onOpenChange={setIsCreateClassOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary text-primary-foreground hover:scale-105 transition-all shadow-lg shadow-primary/20 rounded-xl px-8 h-12 font-black uppercase text-xs tracking-widest">
                                <Plus className="w-4 h-4 mr-2 stroke-[3px]" />
                                Create Classroom
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-card backdrop-blur-xl border-border ring-1 ring-border shadow-2xl">
                            <DialogHeader>
                                <DialogTitle>Create New Classroom</DialogTitle>
                                <DialogDescription>Add a new class to organize your students.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateClass} className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="className">Class Name</Label>
                                    <Input
                                        id="className"
                                        placeholder="e.g. Class 12 - Physics Batch A"
                                        value={newClassName}
                                        onChange={(e) => setNewClassName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input
                                        id="subject"
                                        placeholder="e.g. Physics"
                                        value={newClassSubject}
                                        onChange={(e) => setNewClassSubject(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="schedule">Schedule</Label>
                                    <Input
                                        id="schedule"
                                        placeholder="e.g. Mon, Wed, Fri - 10:00 AM"
                                        value={newClassSchedule}
                                        onChange={(e) => setNewClassSchedule(e.target.value)}
                                        required
                                    />
                                </div>
                                <DialogFooter className="mt-8">
                                    <Button type="submit" className="w-full bg-primary text-primary-foreground font-black h-12 rounded-xl">Create Class</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Tabs defaultValue="classrooms" className="w-full relative z-10">
                    <TabsList className="bg-card/40 border border-border/50 backdrop-blur-xl p-1.5 mb-10 rounded-2xl w-full flex justify-start h-14">
                        <TabsTrigger value="classrooms" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl px-8 h-full font-black text-sm transition-all">
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            Classrooms
                        </TabsTrigger>
                        <TabsTrigger value="avatar" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl px-8 h-full font-black text-sm transition-all">
                            <UserCircle className="w-4 h-4 mr-2" />
                            AI Avatar Creator
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="classrooms" className="space-y-8 mt-0 border-0 p-0">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Students', value: '92', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                                { label: 'Active Classes', value: classrooms.length.toString(), icon: LayoutDashboard, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                                { label: 'Avg Attendance', value: '94%', icon: CheckCircle2, color: 'text-teal-500', bg: 'bg-teal-500/10' },
                                { label: 'Pending Doubts', value: '12', icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                            ].map((stat, i) => (
                                <Card key={i} className="border border-border shadow-sm bg-card/60 backdrop-blur-xl hover:shadow-md transition-all">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                                            <h3 className="text-3xl font-black tracking-tight">{stat.value}</h3>
                                        </div>
                                        <div className={`p-4 rounded-2xl ${stat.bg}`}>
                                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* AI Insight Placeholder - Futuristic Element */}
                        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-primary to-secondary p-[1px] shadow-2xl shadow-primary/20 group">
                            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay"></div>
                            <div className="relative bg-background/40 backdrop-blur-3xl p-8 rounded-[1.95rem] flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -mr-32 -mt-32" />
                                <div className="flex items-start gap-5 relative z-10">
                                    <div className="p-4 bg-primary/10 rounded-2xl backdrop-blur-md ring-1 ring-primary/20">
                                        <SparklesIcon className="w-8 h-8 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black tracking-tight mb-2">AI-Driven Insights</h3>
                                        <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed font-medium">
                                            Predictive analysis: 3 students in <span className="font-black text-foreground">Class 12 - Physics A</span> are showing a downward trend in mechanics.
                                            Scheduling a focus session for "Rotational Motion" is highly recommended.
                                        </p>
                                    </div>
                                </div>
                                <Button variant="secondary" className="relative z-10 bg-primary text-primary-foreground px-8 h-12 rounded-xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all w-full md:w-auto">
                                    Detailed Analysis
                                </Button>
                            </div>
                        </div>

                        {/* Classrooms Grid */}
                        <div>
                            <h2 className="text-2xl font-black tracking-tight mb-8 flex items-center gap-3">
                                <div className="w-2 h-8 bg-primary rounded-full" />
                                My Active Classrooms
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {classrooms.map((classroom) => (
                                    <Card key={classroom.id} className="group border border-border shadow-xl bg-card transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 overflow-hidden rounded-[2rem] relative">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <GraduationCap className="w-24 h-24 rotate-12" />
                                        </div>
                                        <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
                                        <CardHeader className="pb-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <Badge variant="secondary" className="mb-3 px-3 py-1 bg-primary/5 text-primary border-primary/20 font-black uppercase text-[10px] tracking-widest">
                                                        {classroom.subject}
                                                    </Badge>
                                                    <CardTitle className="text-xl font-black tracking-tight leading-tight">
                                                        {classroom.name}
                                                    </CardTitle>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <CardDescription className="flex items-center gap-2 mt-3 text-muted-foreground font-bold text-xs uppercase tracking-tighter">
                                                <Calendar className="w-4 h-4 text-primary" />
                                                {classroom.schedule}
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/50">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-4 h-4 text-primary" />
                                                        <span className="text-lg font-black tracking-tighter">{classroom.studentCount}</span>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Students</span>
                                                </div>
                                                <div className="flex flex-col gap-1 text-right">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                                        <span className="text-lg font-black tracking-tighter text-emerald-500">{classroom.avgAttendance}%</span>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Attendance</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Dialog open={isAddStudentOpen && selectedClassroom?.id === classroom.id} onOpenChange={(open) => {
                                                    setIsAddStudentOpen(open);
                                                    if (open) setSelectedClassroom(classroom);
                                                }}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" className="flex-1 rounded-xl h-12 border-border bg-background hover:bg-muted font-bold text-xs uppercase tracking-widest">
                                                            Invite
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 backdrop-blur-xl border-slate-200 dark:border-slate-800">
                                                        <DialogHeader>
                                                            <DialogTitle>Add Student to {classroom.name}</DialogTitle>
                                                            <DialogDescription>Invite a student via email or share the link</DialogDescription>
                                                        </DialogHeader>
                                                        <div className="space-y-4 py-4">
                                                            <div className="space-y-2">
                                                                <Label>Invite via Email</Label>
                                                                <div className="flex gap-2">
                                                                    <Input
                                                                        placeholder="student@example.com"
                                                                        value={inviteEmail}
                                                                        onChange={(e) => setInviteEmail(e.target.value)}
                                                                    />
                                                                    <Button onClick={handleAddStudent} size="icon" className="bg-primary text-primary-foreground hover:scale-105 transition-all">
                                                                        <Mail className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            <div className="relative">
                                                                <div className="absolute inset-0 flex items-center">
                                                                    <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                                                                </div>
                                                                <div className="relative flex justify-center text-xs uppercase">
                                                                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">Or share link</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                <code className="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate">
                                                                    https://origin.app/join/{classroom.id}
                                                                </code>
                                                                <Button variant="ghost" size="sm" onClick={copyInviteLink} className="h-8 w-8 p-0">
                                                                    <Copy className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>

                                                <Button className="flex-1 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 font-black uppercase text-xs tracking-widest hover:bg-primary hover:text-primary-foreground transition-all">
                                                    Manage
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {/* Empty State / Add New Card */}
                                <button
                                    onClick={() => setIsCreateClassOpen(true)}
                                    className="flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[300px]"
                                >
                                    <div className="w-16 h-16 rounded-3xl bg-muted group-hover:bg-primary/10 flex items-center justify-center mb-6 transition-all group-hover:scale-110 group-hover:rotate-12">
                                        <Plus className="w-8 h-8 stroke-[3px]" />
                                    </div>
                                    <p className="font-black uppercase tracking-widest text-[10px]">Create New Classroom</p>
                                </button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="avatar" className="mt-0">
                        <Card className="border border-border shadow-2xl bg-card rounded-[2.5rem] overflow-hidden relative">
                            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-5 mix-blend-overlay" />
                            <CardContent className="p-16 text-center flex flex-col items-center justify-center min-h-[600px] relative z-10">
                                <div className="w-40 h-40 bg-gradient-to-br from-primary to-secondary rounded-[2.5rem] mb-10 flex items-center justify-center shadow-2xl shadow-primary/30 relative overflow-hidden group border-4 border-background ring-2 ring-border">
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
                                        <Camera className="w-10 h-10 text-white" />
                                    </div>
                                    <UserCircle className="w-20 h-20 text-primary-foreground" />
                                </div>
                                <h1 className="text-4xl font-black tracking-tighter mb-6">Interactive <span className="text-primary italic">AI Teacher</span> Avatar</h1>
                                <p className="text-muted-foreground max-w-xl mx-auto mb-10 text-lg font-medium leading-relaxed">
                                    Revolutionize remote learning. Convert your recorded lectures into dynamic AI avatars that react to student questions in real-time.
                                </p>
                                <div className="flex flex-col sm:flex-row justify-center gap-6 w-full max-w-lg mx-auto">
                                    <Button className="flex-1 bg-primary text-primary-foreground h-16 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl shadow-primary/30">
                                        <Camera className="w-5 h-5 mr-3 stroke-[3px]" />
                                        Enter Creator Studio
                                    </Button>
                                    <Button variant="outline" className="flex-1 h-16 rounded-2xl text-xs font-black uppercase tracking-widest border-border hover:bg-muted transition-all">
                                        Access Library
                                    </Button>
                                </div>
                                <div className="mt-16 p-5 bg-primary/5 rounded-2xl border border-primary/10 inline-flex items-center gap-4 backdrop-blur-xl">
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                                    <span className="text-primary text-[10px] font-black uppercase tracking-widest">v2.4 Engine: Enhanced Real-time LipSync is active</span>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

            </main>
        </div>
    );
}

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
    );
}
