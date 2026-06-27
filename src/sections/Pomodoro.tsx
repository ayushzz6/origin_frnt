'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Coffee,
  Clock,
  Volume2,
  VolumeX,
  Flame,
  Target,
  CheckCircle2,
  X,
  History,
  Calendar,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Music
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@/types';
import { apiCall } from '@/lib/api';
import StudyMusicPlayer from '@/sections/StudyMusicPlayer';
import { toast } from 'sonner';

import type { TimeType } from '@/hooks/useTimeTracker';

// Sentinel for the "no objective" dropdown option (Radix Select disallows empty-string values).
const NO_OBJECTIVE = '__none__';


export interface PomodoroSession {
  id?: number;
  start_time: string;
  end_time?: string;
  duration: number;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  break_reason?: string;
  interruption_count?: number;
  is_completed: boolean;
}

const PREDEFINED_REASONS = [
  "Stretching / Movement",
  "Water / Snack",
  "Feeling Tired",
  "Distraction / Phone",
  "Bathroom Break",
  "Burnout Prevention",
  "Social Interaction",
  "Other"
];

const formatSessionDate = (dateStr: string | undefined) => {
  if (!dateStr) return { date: 'No Date', time: 'No Time' };
  try {
    const isoStr = dateStr.includes(' ') && !dateStr.includes('T')
      ? dateStr.replace(' ', 'T')
      : dateStr;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return { date: 'Invalid Date', time: 'Invalid Time' };

    return {
      date: d.toLocaleDateString(),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (e) {
    return { date: 'Error Date', time: 'Error Time' };
  }
};

interface PomodoroProps {
  onBack: () => void;
  user: User;
  setTimeMode?: (mode: TimeType, subject?: string) => void;
  onNavigate?: (view: any) => void;
  onLock?: (locked: boolean) => void;
  tasks?: any[]; // Tasks from AuthContext
}

export default function Pomodoro({ onBack, user, setTimeMode, onNavigate: _onNavigate, onLock, tasks = [] }: PomodoroProps) {
  const [mode, setMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus');
  const [timeRemaining, setTimeRemaining] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  // Focus Task Integration
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const activeFocusTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

  // Ambient Sound State
  const [ambientSound, setAmbientSound] = useState<'none' | 'white' | 'brown' | 'rain' | 'lofi'>('none');
  const [ambientVolume, setAmbientVolume] = useState(0.5);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambientNodeRef = useRef<AudioNode | null>(null);

  // Background Atmosphere
  const [showAtmosphere, setShowAtmosphere] = useState(false);


  // Session History & Break Reason
  const [history, setHistory] = useState<PomodoroSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [currentSession, setCurrentSession] = useState<PomodoroSession | null>(null);

  // Live Editing State
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeValue, setEditTimeValue] = useState("");

  // Navigation lock: prevent leaving during focus
  const [showNavLock, setShowNavLock] = useState(false);

  // Continuous Alarm State
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const audioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nextMode, setNextMode] = useState<'focus' | 'shortBreak' | 'longBreak' | null>(null);

  const [settings, setSettings] = useState({
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
    alarmSound: 'classic' as 'classic' | 'digital' | 'bell',
    fullscreenFocus: true
  });
  
  const [interruptionCount, setInterruptionCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const modes = {
    focus: {
      label: 'Deep Focus',
      color: 'from-primary to-primary/80',
      shadow: 'shadow-primary/20',
      icon: () => <img src="/iconsax/Ai-Icon.png" className="w-8 h-8 object-contain" />,
      defaultTime: settings.focusDuration * 60
    },
    shortBreak: {
      label: 'Quick Rest',
      color: 'from-emerald-400 to-emerald-600',
      shadow: 'shadow-emerald-500/20',
      icon: Coffee,
      defaultTime: settings.shortBreakDuration * 60
    },
    longBreak: {
      label: 'Deep Rest',
      color: 'from-amber-400 to-amber-600',
      shadow: 'shadow-amber-500/20',
      icon: Coffee,
      defaultTime: settings.longBreakDuration * 60
    },
  };

  // Today's Stats Calculation
  const { todaySessions, todayMinutes, focusRate } = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    
    // Filter history for today's focus sessions
    const todayFocusSessions = history.filter(s => {
      const { date } = formatSessionDate(s.start_time);
      return date === todayStr && s.mode === 'focus';
    });

    // Sum historical duration (exclude current session ID to avoid double counting if part-synced)
    const historicalSecs = todayFocusSessions
      .filter(s => s.id !== currentSession?.id)
      .reduce((acc, s) => acc + s.duration, 0);
    
    // Add live seconds from current active session
    let liveSecs = 0;
    if (isRunning && mode === 'focus') {
      liveSecs = Math.max(0, modes[mode].defaultTime - timeRemaining);
    }

    const totalSecs = historicalSecs + liveSecs;
    
    // Sessions card: count completed sessions today
    const completedCount = todayFocusSessions.filter(s => s.is_completed).length;
    
    // Focus Rate: Completed / Total Focus Sessions for today
    const rate = todayFocusSessions.length > 0 
      ? Math.round((completedCount / todayFocusSessions.length) * 100) 
      : 100;

    return {
      todaySessions: completedCount,
      todayMinutes: Math.floor(totalSecs / 60),
      focusRate: rate
    };
  }, [history, timeRemaining, isRunning, mode, currentSession]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isRunning) {
      setIsRunning(false);
      setIsAlarmRinging(true);

      let upcomingMode: 'focus' | 'shortBreak' | 'longBreak' = 'focus';

      if (mode === 'focus') {
        const newSessions = sessionsCompleted + 1;
        setSessionsCompleted(newSessions);
        // Determine what comes after the alarm is stopped
        if (newSessions % settings.sessionsBeforeLongBreak === 0) {
          upcomingMode = 'longBreak';
        } else {
          upcomingMode = 'shortBreak';
        }
      } else {
        // Break ended, switch back to focus
        upcomingMode = 'focus';
      }

      setNextMode(upcomingMode);

      if (soundEnabled) {
        startContinuousAlarm();
      }
    }

    return () => clearInterval(interval);
  }, [isRunning, timeRemaining, mode, sessionsCompleted, settings, soundEnabled]);

  useEffect(() => {
    fetchHistory();

    return () => {
      stopContinuousAlarm();
      if (setTimeMode) setTimeMode('webpage');
    };
  }, []);

  // Sync mode to global tracker
  useEffect(() => {
    if (setTimeMode) {
      if (isRunning && mode === 'focus') {
        setTimeMode('pomodoro');
      } else {
        setTimeMode('webpage');
      }
    }
  }, [isRunning, mode, setTimeMode]);

  // Warn browser on tab close during focus session
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isRunning && mode === 'focus') {
        e.preventDefault();
        e.returnValue = 'You have an active focus session. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isRunning, mode]);

  // Tab switching detection (Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRunning && mode === 'focus') {
        const timestamp = new Date().toLocaleTimeString();
        console.warn(`[Focus-Lock] User left the tab at ${timestamp}`);
        setInterruptionCount(prev => prev + 1);
        
        toast.error("Focus Interrupted! 🧠", {
          description: "You left the focus tab. This will be recorded as an interruption.",
          duration: 4000
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, mode]);

  // ── ZEN AUDIO ENGINE ──
  useEffect(() => {
    if (ambientSound === 'none' || !isRunning) {
      if (ambientNodeRef.current) {
        ambientNodeRef.current.disconnect();
        ambientNodeRef.current = null;
      }
      return;
    }

    const initAudio = async () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      if (ambientNodeRef.current) {
        ambientNodeRef.current.disconnect();
      }

      let source: AudioNode;

      if (ambientSound === 'white' || ambientSound === 'brown') {
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);
        let lastOut = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (ambientSound === 'brown') {
            // Brown noise approximation (integration of white noise)
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            output[i] = lastOut * 3.5; // Gain compensation
          } else {
            output[i] = white;
          }
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        source = noise;
        (source as AudioBufferSourceNode).start();
      } else if (ambientSound === 'rain') {
        // Synthesized rain using filtered white noise
        const bufferSize = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.Q.value = 1;

        noise.connect(filter);
        source = filter;
        noise.start();
      } else {
        // Lofi placeholder - a simple pleasant oscillator drone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, ctx.currentTime); // A2
        osc.connect(gain);
        source = gain;
        osc.start();
      }

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(ambientVolume * 0.2, ctx.currentTime);
      source.connect(masterGain);
      masterGain.connect(ctx.destination);
      ambientNodeRef.current = masterGain;
    };

    initAudio().catch(console.error);

    return () => {
      if (ambientNodeRef.current) {
        ambientNodeRef.current.disconnect();
        ambientNodeRef.current = null;
      }
    };
  }, [ambientSound, isRunning, ambientVolume]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error(`Error attempting to toggle fullscreen: ${err}`);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await apiCall('/users/pomodoro/', { method: 'GET' });
      if (response && Array.isArray(response)) {
        setHistory(response);
        
        // Sync sessionsCompleted for break logic
        const todayStr = new Date().toLocaleDateString();
        const completedToday = response.filter(s => {
          const { date } = formatSessionDate(s.start_time);
          return date === todayStr && s.mode === 'focus' && s.is_completed;
        }).length;
        setSessionsCompleted(completedToday);
      }
    } catch (error) {
      console.error('Failed to fetch pomodoro history:', error);
    }
  };

  const startBackendSession = async (sMode: 'focus' | 'shortBreak' | 'longBreak') => {
    try {
      const resp = await apiCall('/users/pomodoro/', {
        method: 'POST',
        body: JSON.stringify({
          mode: sMode,
          duration: 0,
          is_completed: false
        })
      });
      if (resp && resp.id) {
        setCurrentSession(resp);
      }
    } catch (error) {
      console.error('Failed to start session in backend:', error);
    }
  };

  const updateBackendSession = async (sessionId: number, data: Partial<PomodoroSession>) => {
    try {
      await apiCall(`/users/pomodoro/${sessionId}/`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      fetchHistory(); // Refresh
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  };

  const handleBack = () => {
    if (isRunning && mode === 'focus') {
      setShowNavLock(true);
      return;
    }
    if (onLock) onLock(false);
    if (setTimeMode) setTimeMode('webpage');
    onBack();
  };

  const handleForceLeave = () => {
    // Pause session and record it as stopped
    if (currentSession?.id) {
      updateBackendSession(currentSession.id, {
        is_completed: false,
        duration: Math.max(0, modes[mode].defaultTime - timeRemaining),
        interruption_count: interruptionCount,
        end_time: new Date().toISOString()
      });
    }
    stopContinuousAlarm();
    if (onLock) onLock(false);
    if (setTimeMode) setTimeMode('webpage');
    onBack();
  };

  const playNotificationSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;

    switch (settings.alarmSound) {
      case 'digital':
        // Rapid high-pitched beeps
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, now); // A5
        oscillator.frequency.setValueAtTime(1108.73, now + 0.1); // C#6

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gainNode.gain.setValueAtTime(0, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.15);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);

        oscillator.start(now);
        oscillator.stop(now + 0.25);
        break;

      case 'bell':
        // Smooth ringing sound with slow decay
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, now);

        // Add some harmonics for a bell-like quality
        const harmOsc = audioContext.createOscillator();
        const harmGain = audioContext.createGain();
        harmOsc.type = 'sine';
        harmOsc.frequency.setValueAtTime(1600, now);
        harmOsc.connect(harmGain);
        harmGain.connect(audioContext.destination);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

        harmGain.gain.setValueAtTime(0, now);
        harmGain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        harmGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);

        oscillator.start(now);
        harmOsc.start(now);
        oscillator.stop(now + 1.5);
        harmOsc.stop(now + 1.5);
        break;

      case 'classic':
      default:
        // Standard beep
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;

        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        oscillator.start(now);
        oscillator.stop(now + 0.5);
        break;
    }
  };

  const startContinuousAlarm = () => {
    playNotificationSound(); // Play immediately
    if (!audioIntervalRef.current) {
      audioIntervalRef.current = setInterval(() => {
        playNotificationSound();
      }, 1500); // Beep every 1.5 seconds
    }
  };

  const stopContinuousAlarm = () => {
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
  };


  const handleStopAlarm = () => {
    stopContinuousAlarm();
    setIsAlarmRinging(false);

    if (currentSession?.id) {
      updateBackendSession(currentSession.id, {
        is_completed: true,
        duration: Math.max(0, modes[mode].defaultTime - timeRemaining),
        interruption_count: interruptionCount,
        end_time: new Date().toISOString()
      });
    }

    if (mode === 'focus') {
      if (onLock) onLock(false);
      setShowReasonModal(true);
    } else {
      if (nextMode) {
        setMode(nextMode);
        setTimeRemaining(modes[nextMode].defaultTime);
        setNextMode(null);
      }
      setCurrentSession(null);
    }
  };

  const submitBreakReason = async () => {
    const finalReason = selectedReason === "Other" ? customReason : selectedReason;
    if (!finalReason) {
      toast.error("Please provide a reason for the break");
      return;
    }

    setShowReasonModal(false);

    // Start the break session in backend with the reason
    if (nextMode) {
      setMode(nextMode);
      setTimeRemaining(modes[nextMode].defaultTime);

      try {
        const resp = await apiCall('/users/pomodoro/', {
          method: 'POST',
          body: JSON.stringify({
            mode: nextMode,
            duration: 0,
            is_completed: false,
            break_reason: finalReason
          })
        });
        if (resp && resp.id) {
          setCurrentSession(resp);
        }
      } catch (e) {
        console.error("Failed to log break start:", e);
      }

      setNextMode(null);
      setIsRunning(true); // Auto start break
    }

    setSelectedReason("");
    setCustomReason("");
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    if (isAlarmRinging) return;
    const newIsRunning = !isRunning;
    setIsRunning(newIsRunning);

    if (newIsRunning && !currentSession) {
      startBackendSession(mode);
      setInterruptionCount(0); // Reset for new session

      if (mode === 'focus' && settings.fullscreenFocus && !document.fullscreenElement) {
        toggleFullscreen();
      }
    }

    if (onLock) {
      onLock(newIsRunning && mode === 'focus');
    }
  };

  const resetTimer = () => {
    if (currentSession?.id && isRunning) {
      updateBackendSession(currentSession.id, {
        is_completed: false,
        duration: Math.max(0, modes[mode].defaultTime - timeRemaining),
        interruption_count: interruptionCount,
        end_time: new Date().toISOString()
      });
    }
    setCurrentSession(null);
    setIsRunning(false);
    setIsAlarmRinging(false);
    stopContinuousAlarm();
    if (onLock) onLock(false);
    setTimeRemaining(modes[mode].defaultTime);
  };

  const switchMode = (newMode: 'focus' | 'shortBreak' | 'longBreak') => {
    if (isRunning && mode !== newMode) {
      const confirmed = window.confirm(
        `An active ${modes[mode].label} session is in progress. Switching to ${modes[newMode].label} will interrupt your current session. Do you want to proceed?`
      );
      if (!confirmed) return;
    }

    if (currentSession?.id && isRunning) {
      updateBackendSession(currentSession.id, {
        is_completed: false,
        duration: Math.max(0, modes[mode].defaultTime - timeRemaining),
        interruption_count: interruptionCount,
        end_time: new Date().toISOString()
      });
    }
    setCurrentSession(null);

    setMode(newMode);
    setIsRunning(false);
    setIsEditingTime(false);
    setIsAlarmRinging(false);
    stopContinuousAlarm();
    if (onLock) onLock(false);
    setTimeRemaining(modes[newMode].defaultTime);
  };

  const handleTimeEditClick = () => {
    if (!isRunning) {
      setEditTimeValue(formatTime(timeRemaining));
      setIsEditingTime(true);
    }
  };

  const handleTimeEditSave = () => {
    setIsEditingTime(false);
    // Parse input (MM:SS or MM)
    const parts = editTimeValue.split(':');
    let newSeconds = 0;

    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const s = parseInt(parts[1], 10);
      if (!isNaN(m) && !isNaN(s)) {
        newSeconds = (m * 60) + s;
      }
    } else if (parts.length === 1) {
      const m = parseInt(parts[0], 10);
      if (!isNaN(m)) {
        newSeconds = m * 60;
      }
    }

    if (newSeconds > 0) {
      // Cap at 120 minutes
      newSeconds = Math.min(newSeconds, 120 * 60);
      setTimeRemaining(newSeconds);

      // Update the base setting so progress calculations remain accurate
      if (mode === 'focus') setSettings(prev => ({ ...prev, focusDuration: Math.ceil(newSeconds / 60) }));
      else if (mode === 'shortBreak') setSettings(prev => ({ ...prev, shortBreakDuration: Math.ceil(newSeconds / 60) }));
      else if (mode === 'longBreak') setSettings(prev => ({ ...prev, longBreakDuration: Math.ceil(newSeconds / 60) }));
    }
  };

  const handleTimeEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTimeEditSave();
    } else if (e.key === 'Escape') {
      setIsEditingTime(false);
    }
  };

  const currentMode = modes[mode];
  const progress = ((currentMode.defaultTime - timeRemaining) / currentMode.defaultTime) * 100;

  return (
    <div ref={containerRef} className="min-h-screen neu-surface text-foreground transition-colors duration-500 relative overflow-hidden flex flex-col">
      
      {/* ── ATMOSPHERE BACKGROUND ── */}
      <AnimatePresence>
        {showAtmosphere && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-0 pointer-events-none"
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-40 dark:opacity-20 transition-opacity duration-1000"
            >
              <source src="/videos/Pomodoro-Focus.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 backdrop-blur-[2px]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MESH GRADIENT (Fallback/Base) ── */}
      {!showAtmosphere && (
        <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />
        </div>
      )}

      {/* ── NAV LOCK OVERLAY ── */}
      {showNavLock && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="neu-raised rounded-3xl p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <Flame className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-foreground mb-2">🚫 Focus in Progress</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Your focus timer is still running! Leaving now will <span className="font-bold text-primary">interrupt your session</span>.
              Stay locked in — you've got this!
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowNavLock(false)}
                className="w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-bold shadow-[3px_3px_8px_hsl(var(--neu-shadow))] hover:-translate-y-0.5 transition-all active:scale-95"
              >
                🔒 Stay Focused
              </button>
              <button
                onClick={handleForceLeave}
                className="w-full py-2.5 px-6 rounded-xl neu-raised text-muted-foreground text-sm hover:-translate-y-0.5 transition-all"
              >
                Stop Timer & Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="z-40 bg-[hsl(var(--neu-bg)/0.85)] border-b border-border/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="hidden xs:block">
                  <h1 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Focus Lab</h1>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Zen / Atmosphere on-off toggle */}
              <label className="zen-toggle-wrapper" title="Toggle Zen Atmosphere">
                <input
                  type="checkbox"
                  className="zen-toggle-checkbox"
                  checked={showAtmosphere}
                  onChange={() => setShowAtmosphere(!showAtmosphere)}
                  aria-label="Toggle Zen Atmosphere"
                />
                <div className="zen-toggle-container">
                  <div className="zen-toggle-button">
                    <div className="zen-toggle-button-circles-container">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="zen-toggle-button-circle" />
                      ))}
                    </div>
                  </div>
                </div>
              </label>
              <button
                onClick={() => setShowHistory(true)}
                className="p-2 sm:p-2.5 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400"
              >
                <History className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 sm:p-2.5 rounded-xl hover:bg-white/50 dark:hover:bg-white/5"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 z-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto flex flex-col gap-8 w-full">
          
          {/* Top Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex gap-1 sm:gap-2 p-1 sm:p-1.5 neu-inset rounded-xl sm:rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
              {(['focus', 'shortBreak', 'longBreak'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 sm:flex-none px-3 sm:px-8 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${mode === m
                    ? `bg-gradient-to-r ${modes[m].color} text-white shadow-lg ${modes[m].shadow}`
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  {modes[m].label}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-2xl">
                <Flame className="w-4 h-4 text-primary" />
                <span className="text-xs font-black text-primary uppercase tracking-widest leading-none">
                  {user.streak} Day Study Streak
                </span>
              </div>
            </div>
          </div>

          {/* Core Lab Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Main Engine (Timer) */}
            <div className="lg:col-span-8 relative flex flex-col gap-8">
              <Card className="border-0 neu-raised rounded-[48px] overflow-hidden group" style={{boxShadow: 'var(--neu-dist) var(--neu-dist) var(--neu-blur) hsl(var(--neu-shadow)), calc(var(--neu-dist) * -1) calc(var(--neu-dist) * -1) var(--neu-blur) hsl(var(--neu-light))'}}>
                <CardContent className="p-10 sm:p-20 flex flex-col items-center">
                   {/* Interruption Indicator */}
                  {mode === 'focus' && isRunning && interruptionCount > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-8 flex items-center gap-3 p-3 px-6 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md z-20"
                    >
                      <ShieldAlert className="w-4 h-4 text-primary" />
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Interrupted {interruptionCount}x</p>
                    </motion.div>
                  )}

                  <div className="relative group/timer transition-transform duration-500 hover:scale-105">
                     {/* Glow pulses when running */}
                    <AnimatePresence>
                      {isRunning && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 0.15, scale: 1.1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                          className={`absolute inset-0 rounded-full bg-gradient-to-br ${currentMode.color} blur-[80px] z-0`}
                        />
                      )}
                    </AnimatePresence>

                    {isAlarmRinging ? (
                       <div className="w-72 h-72 sm:w-[400px] sm:h-[400px] flex items-center justify-center relative z-10">
                        <div className="neu-raised rounded-[64px] p-8 w-full text-center">
                          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter uppercase">
                            Phase Concluded
                          </h2>
                          <Button
                            onClick={handleStopAlarm}
                            className="w-full h-14 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest"
                          >
                           Next Protocol
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative z-10">
                        <svg className="w-64 h-64 sm:w-80 sm:h-80 transform -rotate-90">
                          <circle
                            cx="50%"
                            cy="50%"
                            r="46%"
                            className="stroke-[hsl(var(--neu-shadow))] fill-none"
                            strokeWidth="4"
                          />
                          <motion.circle
                            cx="50%"
                            cy="50%"
                            r="46%"
                            className={`fill-none ${
                               mode === 'focus' ? 'stroke-primary' : 'stroke-emerald-500'
                            }`}
                            strokeWidth="4"
                            strokeLinecap="round"
                            style={{
                              pathLength: timeRemaining / currentMode.defaultTime,
                            }}
                            transition={{ duration: 0.5 }}
                          />
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          {isEditingTime ? (
                            <input
                              type="text" value={editTimeValue} autoFocus
                              onChange={(e) => setEditTimeValue(e.target.value.replace(/[^0-9:]/g, ''))}
                              onBlur={handleTimeEditSave} onKeyDown={handleTimeEditKeyDown}
                              className="w-full text-center text-7xl sm:text-8xl font-black bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white font-mono tracking-tighter"
                            />
                          ) : (
                            <button
                              onClick={handleTimeEditClick}
                              className="text-6xl sm:text-8xl font-black text-slate-900 dark:text-white tracking-tighter italic"
                            >
                              {formatTime(timeRemaining)}
                            </button>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                             <div className={`p-1 px-3 rounded-full text-[10px] font-black uppercase tracking-widest ${isRunning ? 'animate-pulse text-primary' : 'text-slate-400'}`}>
                                {isRunning ? "Active Phase" : "Standby"}
                             </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 mt-12 sm:mt-16">
                    <button
                      onClick={toggleTimer}
                      disabled={isAlarmRinging}
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-2xl ${
                        isRunning 
                        ? 'bg-primary text-white shadow-primary/20' 
                        : 'bg-primary/90 text-white shadow-primary/20'
                      }`}
                    >
                      {isRunning ? <Pause className="w-6 h-6 sm:w-8 sm:h-8" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8 ml-1" />}
                    </button>
                    <button
                      onClick={resetTimer}
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-full neu-raised text-muted-foreground hover:text-primary flex items-center justify-center transition-all active:scale-95"
                    >
                      <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Analytics Quick View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 {[
                  { label: 'Minutes Focused', value: todayMinutes, icon: History, color: 'text-primary', bg: 'bg-primary/10' },
                  { label: 'Sessions Today', value: todaySessions, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                 ].map((stat, i) => (
                    <Card key={i} className="border-0 neu-raised rounded-2xl">
                      <CardContent className="p-5 sm:p-8 flex items-center justify-between">
                        <div>
                          <p className="text-[8px] sm:text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">{stat.label}</p>
                          <p className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white">{stat.value}</p>
                        </div>
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                          <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
                        </div>
                      </CardContent>
                    </Card>
                 ))}
              </div>
            </div>

            {/* Sidebar Controls */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Task Selection */}
              <Card className="border-0 neu-raised overflow-hidden rounded-3xl">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="neu-raised flex h-9 w-9 items-center justify-center rounded-full text-primary">
                      <Target className="h-4 w-4" />
                    </span>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">Active Objective</h3>
                  </div>

                  {tasks.length > 0 ? (
                    <Select
                      value={selectedTaskId ?? NO_OBJECTIVE}
                      onValueChange={(value) => setSelectedTaskId(value === NO_OBJECTIVE ? null : value)}
                      disabled={isRunning}
                    >
                      <SelectTrigger className="neu-inset w-full rounded-xl border-0 bg-transparent text-xs font-bold">
                        <SelectValue placeholder="No objective" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_OBJECTIVE} className="text-xs font-bold">No objective</SelectItem>
                        {tasks.map((task) => (
                          <SelectItem key={task.id} value={task.id} className="text-xs font-bold">
                            {task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center py-4">Select a task from your dashboard</p>
                  )}
                </CardContent>
              </Card>

              {/* Study Music — neumorphic player */}
              <Card className="border-0 neu-raised overflow-hidden rounded-3xl">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="neu-raised flex h-9 w-9 items-center justify-center rounded-full text-primary">
                      <Music className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground leading-none">Study Music</h3>
                      <p className="mt-1 text-[9px] font-semibold text-muted-foreground">Lo-fi & focus playlists</p>
                    </div>
                  </div>

                  <StudyMusicPlayer />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Protocol & Guide */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-0 neu-raised rounded-2xl">
              <CardContent className="p-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-6 flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-primary" />
                  Focus Protocol
                </h3>
                <ul className="space-y-4">
                  {[
                    "Silence all digital visual incursions",
                    "Commit exclusively to a singular workflow",
                    "Protect recovery periods from cognitive effort"
                  ].map((tip, i) => (
                    <li key={i} className="flex items-center gap-3 group">
                       <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-black group-hover:bg-primary group-hover:text-white transition-all italic">{i+1}</div>
                       <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">{tip}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 neu-raised rounded-2xl bg-emerald-500/10">
              <CardContent className="p-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-6 flex items-center gap-3">
                  <Coffee className="w-5 h-5" />
                  Recovery Engine
                </h3>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed uppercase tracking-tight">
                  Your brain requires oscillation between focus and deep-rest. Every 4 sessions, enter a Long Break phase.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* ── MODALS ── */}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-lg border-0 neu-raised rounded-3xl overflow-hidden">
            <CardContent className="p-10">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter">Laboratory Settings</h3>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-3 rounded-full neu-raised hover:-translate-y-0.5 transition-all text-muted-foreground">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-10">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Focus Duration: {settings.focusDuration}m</Label>
                    <Slider value={[settings.focusDuration]} onValueChange={(v) => setSettings({...settings, focusDuration: v[0]})} min={5} max={120} step={5} />
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Short Rest: {settings.shortBreakDuration}m</Label>
                        <Slider value={[settings.shortBreakDuration]} onValueChange={(v) => setSettings({...settings, shortBreakDuration: v[0]})} min={1} max={30} step={1} />
                     </div>
                     <div className="space-y-4">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Deep Rest: {settings.longBreakDuration}m</Label>
                        <Slider value={[settings.longBreakDuration]} onValueChange={(v) => setSettings({...settings, longBreakDuration: v[0]})} min={5} max={60} step={5} />
                     </div>
                  </div>
                </div>
              </div>

              <Button onClick={() => setShowSettings(false)} className="w-full h-14 mt-10 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-sm uppercase tracking-widest">
                Save laboratory settings
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History Side Panel */}
      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-[hsl(var(--neu-bg))] backdrop-blur-2xl border-l border-border/40 p-0 overflow-hidden flex flex-col">
          <SheetHeader className="p-8 border-b border-border/40">
            <h3 className="text-2xl font-black tracking-tighter dark:text-white uppercase">Focus Log</h3>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {history.length > 0 ? history.map((session, idx) => {
              const { date, time } = formatSessionDate(session.start_time);
              const isFocus = session.mode === 'focus';
              return (
                <div key={idx} className="p-5 rounded-2xl neu-raised">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isFocus ? 'bg-primary' : 'bg-emerald-500'} text-white`}>
                           {isFocus ? <Target className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                        </div>
                        <div>
                           <p className="font-black text-[10px] uppercase tracking-widest dark:text-white">{session.mode}</p>
                           <p className="text-[8px] text-slate-500 font-bold uppercase">{date} • {time}</p>
                        </div>
                     </div>
                     <p className="text-xs font-black text-slate-900 dark:text-white">{Math.floor(session.duration/60)}m</p>
                  </div>
                </div>
              );
            }) : (
              <p className="text-center py-24 text-xs font-bold text-slate-500 uppercase">No session intel recorded</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Break Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-lg border-0 neu-raised rounded-3xl overflow-hidden transform animate-in zoom-in-95">
            <CardContent className="p-10 text-center">
              <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter mb-8">Rest Intel</h3>
              <div className="space-y-6">
                <Select value={selectedReason} onValueChange={setSelectedReason}>
                    <SelectTrigger className="h-14 rounded-2xl neu-inset border-0">
                      <SelectValue placeholder="Choose classification..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {PREDEFINED_REASONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                </Select>
                {selectedReason === "Other" && (
                    <Textarea
                      placeholder="Specify details..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="min-h-[100px] rounded-2xl"
                    />
                )}
                <Button onClick={submitBreakReason} className="w-full h-16 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 text-white font-black text-sm uppercase tracking-widest">
                  Confirm & Initialize Rest
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
