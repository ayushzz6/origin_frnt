import { Card, CardContent } from '@/components/ui/card';
import type { User } from '@/types';
import { useLayout } from '@/context/LayoutContext';

interface PastWeekProgressProps {
    user: User;
}

const COLORS = {
    webpage: '#4F46E5', // Vibrant Indigo
    practice: '#059669', // Emerald
    pomodoro: '#D97706', // Amber
    empty: '#F1F5F9'     // Neutral Gray
};

export default function PastWeekProgress({ user }: PastWeekProgressProps) {
    const timeData = user?.timeAnalytics || [];

    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    const { availableWidth } = useLayout();
    const isMobile = availableWidth < 640;
    const isSmall = availableWidth < 1024;

    return (
        <Card className="neu-raised border-0 h-full flex flex-col justify-center">
            <CardContent className="py-5 flex flex-col items-center justify-between px-4 sm:px-6 gap-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
                    <div className="flex flex-col items-center sm:items-start">
                        <span className="text-[10px] sm:text-xs font-black text-[#334155] tracking-[0.2em] sm:tracking-[0.3em] uppercase mb-1 opacity-80">App Time Analytics</span>
                        <p className="text-[8px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Weekly Activity Report</p>
                    </div>
                    
                    {/* Legend - Centered or right-aligned */}
                    <div className="flex flex-wrap justify-center gap-3 sm:gap-6 text-[8px] sm:text-[10px] font-black text-[#64748B] uppercase tracking-widest bg-muted/20 sm:bg-muted/30 px-4 sm:px-6 py-2 rounded-full border border-border/40">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#1E293B] shadow-sm shadow-navy/20" /> 
                            <span>Webpage</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#059669] shadow-sm shadow-emerald/20" /> 
                            <span>Practice</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#D97706] shadow-sm shadow-amber/20" /> 
                            <span>Pomodoro</span>
                        </div>
                    </div>
                </div>

                {/* 7-Day Mini Charts - Spaced out and Larger */}
                <div className="flex flex-wrap lg:flex-nowrap justify-center sm:justify-around items-end gap-2 sm:gap-4 md:gap-6 w-full pb-2">
                    {timeData.map((item: any, index: number) => {
                        const isToday = index === timeData.length - 1;
                        const totalSecs = item.webpageTime + item.practiceTime + item.pomodoroTime;
                        
                        // Responsive Math - Reactive and consistent
                        const size = isMobile ? 56 : isSmall ? 68 : 80;
                        const r = isMobile ? 22 : isSmall ? 26 : 32;
                        const c = 2 * Math.PI * r;
                        const center = size / 2;
                        const strokeWidth = isMobile ? 3 : 4;
                        const activeStrokeWidth = isMobile ? 4 : 5;

                        const total = totalSecs || 1;
                        const webPct = item.webpageTime / total;
                        const pracPct = item.practiceTime / total;
                        const pomPct = item.pomodoroTime / total;

                        const webDash = c * webPct;
                        const pracDash = c * pracPct;
                        const pomDash = c * pomPct;

                        return (
                            <div key={item.date} className="flex flex-col items-center gap-2 sm:gap-4 group relative">
                                {isToday && (
                                    <div className="absolute -top-6 sm:-top-8 text-[8px] sm:text-[10px] font-black text-white bg-primary px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border-2 border-background shadow-lg shadow-primary/20 z-20 scale-105 sm:scale-110">
                                        TODAY
                                    </div>
                                )}

                                <div 
                                    className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                                    style={{ width: `${size}px`, height: `${size}px` }}
                                >
                                    <svg 
                                        width={size} 
                                        height={size} 
                                        viewBox={`0 0 ${size} ${size}`}
                                        className="transform -rotate-90 filter drop-shadow-sm"
                                    >
                                        {/* Background Empty Track */}
                                        <circle cx={center} cy={center} r={r} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100 dark:text-slate-800/10" />

                                        {totalSecs > 0 ? (
                                            <>
                                                {/* Webpage Segment */}
                                                {webDash > 0 && (
                                                    <circle cx={center} cy={center} r={r} fill="transparent" strokeWidth={activeStrokeWidth} stroke={COLORS.webpage}
                                                        strokeDasharray={`${c}`} strokeDashoffset={c - webDash} strokeLinecap="round" />
                                                )}
                                                {/* Practice Segment */}
                                                {pracDash > 0 && (
                                                    <circle cx={center} cy={center} r={r} fill="transparent" strokeWidth={activeStrokeWidth} stroke={COLORS.practice}
                                                        strokeDasharray={`${c}`} strokeDashoffset={c - pracDash} strokeLinecap="round" transform={`rotate(${(item.webpageTime / total) * 360} ${center} ${center})`} />
                                                )}
                                                {/* Pomodoro Segment */}
                                                {pomDash > 0 && (
                                                    <circle cx={center} cy={center} r={r} fill="transparent" strokeWidth={activeStrokeWidth} stroke={COLORS.pomodoro}
                                                        strokeDasharray={`${c}`} strokeDashoffset={c - pomDash} strokeLinecap="round" transform={`rotate(${((item.webpageTime + item.practiceTime) / total) * 360} ${center} ${center})`} />
                                                )}
                                            </>
                                        ) : null}
                                    </svg>

                                    {/* Center Text (Total Time) */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none w-full">
                                        <span className="text-[9px] sm:text-[11px] font-black text-foreground text-center leading-none">
                                            {totalSecs > 0 ? formatTime(totalSecs) : '0m'}
                                        </span>
                                    </div>
                                </div>
                                <span className={`text-[9px] sm:text-[11px] font-black tracking-widest transition-colors ${isToday ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground'}`}>
                                    {item.dayName.toUpperCase()}
                                </span>
                            </div>
                        );
                    })}
                    {/* Fallback if user is null or offline */}
                    {timeData.length === 0 && (
                        <div className="w-full text-center text-sm text-slate-500 py-4">Data not available yet.</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
