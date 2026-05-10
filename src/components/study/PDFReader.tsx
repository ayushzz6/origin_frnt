'use client';
import { useState, useEffect, useCallback } from 'react';
import {
    ChevronLeft, BookOpen, Save, Maximize2, Minimize2,
    PenTool, FileText, CheckCircle2, Clock, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PDFReaderProps {
    url: string;
    name: string;
    subject?: string;
    classNum?: string;
    onBack: () => void;
}

const NOTES_KEY_PREFIX = 'origin_pdf_notes_';

function getNoteKey(url: string) {
    // Sanitize the URL to a safe localStorage key
    return NOTES_KEY_PREFIX + url.replace(/[^a-z0-9]/gi, '_');
}

export default function PDFReader({ url, name, subject, classNum, onBack }: PDFReaderProps) {
    const [notes, setNotes] = useState('');
    const [saved, setSaved] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const noteKey = getNoteKey(url);

    // Load saved notes from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(noteKey);
        if (stored) {
            setNotes(stored);
        } else {
            setNotes(`# Notes — ${name}\n\nStart typing your notes here...\n\n## Key Points\n- \n\n## Questions\n- \n\n## Summary\n`);
        }
        setSaved(true);
    }, [noteKey, name]);

    // Mark unsaved when notes change
    const handleNotesChange = (val: string) => {
        setNotes(val);
        setSaved(false);
    };

    // Save to localStorage
    const handleSave = useCallback(() => {
        localStorage.setItem(noteKey, notes);
        setSaved(true);
        setLastSaved(new Date());
        toast.success('Notes saved!', { duration: 1500 });
    }, [noteKey, notes]);

    // Ctrl+S shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleSave]);

    // Auto-save every 30 seconds
    useEffect(() => {
        if (saved) return;
        const timer = setTimeout(() => {
            handleSave();
        }, 30000);
        return () => clearTimeout(timer);
    }, [notes, saved, handleSave]);

    const handleClearNotes = () => {
        if (window.confirm('Clear all notes for this document?')) {
            localStorage.removeItem(noteKey);
            setNotes(`# Notes — ${name}\n\nStart typing your notes here...\n`);
            setSaved(true);
            toast.info('Notes cleared');
        }
    };

    return (
        <div className={`flex flex-col bg-background text-slate-900 dark:text-slate-200 font-sans transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50' : 'h-screen'}`}>

            {/* Header */}
            <header className="h-14 flex items-center justify-between px-4 sm:px-6 bg-card dark:bg-[#030712]/60 backdrop-blur-xl border-b border-rose-200 dark:border-indigo-500/10 shadow-sm z-20 shrink-0 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="shrink-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 dark:border-indigo-500/30 shrink-0">
                        <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">{name}</h1>
                        {(subject || classNum) && (
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
                                {[subject, classNum && `Class ${classNum}`].filter(Boolean).join(' • ')}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Save status indicator */}
                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {saved ? (
                            <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Saved</span>
                            </>
                        ) : (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-amber-600 dark:text-amber-400">Unsaved</span>
                            </>
                        )}
                        {lastSaved && (
                            <span className="text-slate-400 ml-1 hidden md:inline">
                                · {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>

                    <Button
                        onClick={handleSave}
                        className="h-8 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                    >
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        Save
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="w-8 h-8 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 hidden sm:flex"
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                </div>
            </header>

            {/* Main Split View */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left: PDF Viewer */}
                <div className="flex-1 bg-slate-200 dark:bg-[#0f1423] relative overflow-hidden">
                    <iframe
                        src={`${url}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
                        className="w-full h-full border-none"
                        title={name}
                    />
                </div>

                {/* Right: Notes Panel */}
                <div className="w-80 lg:w-96 bg-card dark:bg-[#030712]/90 backdrop-blur-xl border-l border-rose-200 dark:border-white/5 flex flex-col shrink-0 shadow-[-4px_0_15px_rgba(0,0,0,0.05)] dark:shadow-[-8px_0_30px_rgba(0,0,0,0.5)]">
                    {/* Notes Header */}
                    <div className="h-13 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-transparent shrink-0">
                        <div className="flex items-center gap-2">
                            <PenTool className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="font-bold text-sm tracking-wide text-slate-900 dark:text-white">My Notes</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide hidden sm:block">Ctrl+S to save</span>
                            <button
                                onClick={handleClearNotes}
                                className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all ml-1"
                                title="Clear notes"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Notes Metadata strip */}
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-transparent shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            <FileText className="w-3 h-3" />
                            <span>{name}</span>
                        </div>
                        {lastSaved && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-auto">
                                <Clock className="w-3 h-3" />
                                <span>{lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        )}
                    </div>

                    {/* Textarea Notes Editor */}
                    <div className="flex-1 overflow-hidden relative">
                        <textarea
                            value={notes}
                            onChange={(e) => handleNotesChange(e.target.value)}
                            className="w-full h-full p-5 bg-transparent border-none resize-none focus:ring-0 focus:outline-none text-slate-700 dark:text-slate-300 text-sm leading-7 font-mono placeholder-slate-400 custom-scrollbar"
                            placeholder={`# Notes — ${name}\n\nStart typing here...`}
                            spellCheck
                        />
                        {/* Subtle line guide overlay */}
                        <div
                            className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.04]"
                            style={{
                                backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, #6366f1 27px, #6366f1 28px)',
                                backgroundPositionY: '20px'
                            }}
                        />
                    </div>

                    {/* Bottom action bar */}
                    <div className="border-t border-slate-100 dark:border-white/5 px-4 py-3 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-transparent">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            {notes.split('\n').length} lines · {notes.length} chars
                        </span>
                        <Button
                            onClick={handleSave}
                            size="sm"
                            className={`h-7 px-3 text-xs font-bold rounded-lg transition-all ${saved
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                                }`}
                        >
                            {saved ? (
                                <><CheckCircle2 className="w-3 h-3 mr-1" />Saved</>
                            ) : (
                                <><Save className="w-3 h-3 mr-1" />Save Notes</>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
