'use client';
import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronLeft,
    PenTool,
    Save,
    Bookmark,
    List,
    Maximize2,
    Type,
    Sparkles,
    Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLayout } from '@/context/LayoutContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiCall } from '@/lib/api';
import type { Book, Note } from '@/types';
import { setManualSelection, extractSelectionText, wrapUnwrappedMath } from '@/features/origin-ai/highlight-capture';


interface NCERTReaderProps {
    book: Book;
    onBack: () => void;
    initialNotes?: Note[];
    activeChapterId?: string;
}

export default function NCERTReader({ book, onBack, initialNotes = [], activeChapterId }: NCERTReaderProps) {
    // --- State for Reader & Notebook ---
    const [markdownNote, setMarkdownNote] = useState(
        initialNotes.map(n => n.content).join('\n\n') || `# Notes for ${book.title}\n\nStart typing here...`
    );
    const [activeChapter, setActiveChapter] = useState(activeChapterId || book.chapters[0]?.id);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    // --- Sidebar Width & Resizing ---
    const [sidebarWidth, setSidebarWidth] = useState(380);
    const [isResizing, setIsResizing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const sidebarRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Track active page (mocked for now, but used for pinning)
    const [currentPage, setCurrentPage] = useState(1);

    const { triggerAskSelection } = useLayout();
    const [floatingMenuPos, setFloatingMenuPos] = useState<{ x: number, y: number } | null>(null);

    // --- Selection Bridge logic ---
    useEffect(() => {
        const iframe = iframeRef.current;
        
        const handleSelection = (e: MouseEvent) => {
            let text = '';
            
            // 1. Check standard window selection
            const selection = window.getSelection();
            text = selection?.toString().trim() || '';

            // 2. Check textarea selection (for Smart Notebook)
            const activeEl = document.activeElement;
            if (activeEl instanceof HTMLTextAreaElement && activeEl.id === 'notebook-textarea') {
                const start = activeEl.selectionStart;
                const end = activeEl.selectionEnd;
                if (start !== end) {
                    text = activeEl.value.substring(start, end).trim();
                }
            }

            if (text && text.length > 2) {
                setManualSelection(text);
                // Position near the mouse click
                setFloatingMenuPos({ x: e.clientX, y: e.clientY });
            } else if (!text) {
                // Only hide if we aren't clicking the floating menu itself
                const target = e.target as HTMLElement;
                if (!target.closest('.floating-menu-container')) {
                    setFloatingMenuPos(null);
                }
            }
        };

        // Listen to selection in the main window (Notebook area)
        document.addEventListener('mouseup', handleSelection);
        
        const setupIframeListener = () => {
            try {
                const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
                doc?.addEventListener('selectionchange', () => {
                    const selText = doc.getSelection()?.toString().trim();
                    if (selText) {
                        setManualSelection(selText);
                        // For iframe, we show it at a fixed but prominent position 
                        // since we can't easily get coordinates inside the iframe
                        setFloatingMenuPos({ x: window.innerWidth / 2, y: window.innerHeight - 100 });
                    }
                });
            } catch (e) {
                console.warn("Iframe selection capture restricted");
            }
        };

        iframe?.addEventListener('load', setupIframeListener);
        return () => {
            document.removeEventListener('mouseup', handleSelection);
            iframe?.removeEventListener('load', setupIframeListener);
        };
    }, []);

    const handleAskOriginAi = () => {
        triggerAskSelection();
        setFloatingMenuPos(null);
    };
    const [noteId, setNoteId] = useState<number | null>(null);

    // --- Load Saved Notes on Mount ---
    useEffect(() => {
        // Fetch real notes from backend API
        const fetchNotes = async () => {
            try {
                const notes = await apiCall('/study/notes/');
                const bookNote = notes.find((n: any) => n.book === book.id || n.book?.id === book.id);
                if (bookNote) {
                    setMarkdownNote(bookNote.content);
                    setNoteId(bookNote.id);
                }
            } catch (error) {
                console.error("Failed to fetch notes", error);
            }
        };
        fetchNotes();
    }, [book.id]);

    // --- Auto-save Notes ---
    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (noteId) {
                await apiCall(`/study/notes/${noteId}/`, {
                    method: 'PUT',
                    body: JSON.stringify({ book: book.id, content: markdownNote })
                });
            } else {
                const newNote = await apiCall('/study/notes/', {
                    method: 'POST',
                    body: JSON.stringify({ book: book.id, content: markdownNote })
                });
                setNoteId(newNote.id);
            }
        } catch (error) {
            console.error("Failed to save note", error);
        } finally {
            setTimeout(() => setIsSaving(false), 800);
        }
    };

    // --- Resizing Logic ---
    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 280 && newWidth < window.innerWidth * 0.6) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => setIsResizing(false);

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // --- Notebook Formatting ---
    const insertFormatting = (prefix: string, suffix: string) => {
        const textarea = document.getElementById('notebook-textarea') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const selection = text.substring(start, end);
        const after = text.substring(end);

        const newText = before + prefix + selection + suffix + after;
        setMarkdownNote(newText);
        
        // Restore focus and selection
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 10);
    };

    return (
        <div className={`flex flex-col h-screen bg-background text-foreground font-sans transition-all duration-300 relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>

            <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-background border-b border-border z-20 shrink-0">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">{book.title}</h1>
                        <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{book.subject} • Class {book.bookClass}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-muted/50 border border-border">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mr-2">Status:</span>
                        {isSaving ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary animate-pulse">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                Saving
                            </div>
                        ) : (
                            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3" />
                                Synced
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={async () => {
                            try {
                                const text = await navigator.clipboard.readText();
                                if (text) {
                                    const mathText = wrapUnwrappedMath(text);
                                    setManualSelection(mathText);
                                    triggerAskSelection();
                                    setFloatingMenuPos(null);
                                }
                            } catch (err) {
                                // Fallback if clipboard fails or no permission
                                handleAskOriginAi();
                            }
                        }}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 rounded-full px-4 h-9 flex items-center gap-2 transition-all"
                        title="Sync selection from clipboard (Ctrl+C then click here)"
                    >
                        <Save className="w-4 h-4" />
                        <span className="text-xs font-bold tracking-tight">Sync Selection</span>
                    </Button>

                    <Button
                        onClick={handleAskOriginAi}
                        className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-full px-4 h-9 flex items-center gap-2 group transition-all"
                    >
                        <Sparkles className="w-4 h-4 group-hover:animate-spin-slow" />
                        <span className="text-xs font-bold tracking-tight">Ask Origin AI</span>
                    </Button>
                    
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </Button>
                </div>
            </header>

            {/* Floating "Ask Origin AI" Action Menu */}
            {floatingMenuPos && (
                <div 
                    className="fixed z-[100] animate-in fade-in zoom-in-95 duration-200 floating-menu-container"
                    style={{ 
                        left: `${Math.min(floatingMenuPos.x, window.innerWidth - 180)}px`, 
                        top: `${Math.min(floatingMenuPos.y + 20, window.innerHeight - 80)}px` 
                    }}
                >
                    <div className="flex items-center gap-1 bg-background/80 backdrop-blur-xl border border-primary/20 p-1.5 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] ring-1 ring-primary/5">
                        <Button
                            size="sm"
                            onClick={handleAskOriginAi}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[11px] rounded-xl px-4 py-1.5 h-auto flex items-center gap-2 group transition-all"
                        >
                            <Sparkles className="w-3.5 h-3.5 group-hover:animate-spin-slow" />
                            ASK ORIGIN AI
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFloatingMenuPos(null)}
                            className="text-muted-foreground hover:text-foreground p-2 h-auto rounded-xl"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ----- Main Split View ----- */}
            <div className="flex-1 flex overflow-hidden">                <div className="flex-1 relative flex flex-col overflow-hidden">
                    <div className="flex overflow-x-auto no-scrollbar bg-background border-b border-border py-2 px-4 gap-2 z-10 shrink-0">
                        {book.chapters.map(ch => (
                            <button
                                key={ch.id}
                                onClick={() => setActiveChapter(ch.id)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeChapter === ch.id
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'bg-muted text-muted-foreground border border-border hover:bg-background hover:text-primary'
                                    }`}
                            >
                                {ch.title}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 relative flex justify-center bg-muted/5 overflow-hidden">
                        <div className="w-full h-full flex items-center justify-center p-1 md:p-2">
                            {(() => {
                                const activeChapterMeta = book.chapters.find(c => c.id === activeChapter);
                                const pdfFile = activeChapterMeta?.pdfFile;
                                const basePath = book.basePath;
                                if (pdfFile && basePath) {
                                    const pdfUrl = `/books/${basePath}/${pdfFile}#toolbar=0&navpanes=0&scrollbar=1`;
                                    return (
                                        <iframe
                                            ref={iframeRef}
                                            src={pdfUrl}
                                            className="w-full h-full rounded-lg shadow-2xl border border-border bg-white"
                                            title="NCERT Viewer"
                                        />
                                    );
                                }
                                return (
                                    <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                                        <p className="text-lg text-muted-foreground font-serif">PDF source unavailable.</p>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Page Pin Indicator */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur border border-border px-4 py-2 rounded-full shadow-lg z-30 flex items-center gap-3">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reader Mode</span>
                            <div className="w-px h-3 bg-border" />
                            <span className="text-xs font-bold text-foreground">Single Page View</span>
                        </div>
                    </div>
                </div>

                {/* --- Right: Smart Notebook (Resizable) --- */}
                <div className="flex shrink-0 h-full">
                    <div
                        onMouseDown={startResizing}
                        className={`w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-40 shrink-0 ${isResizing ? 'bg-primary' : 'bg-border border-r border-border/50'}`}
                    />
                    <div 
                        ref={sidebarRef}
                        style={{ width: `${sidebarWidth}px` }}
                        className={`bg-background border-l border-border flex flex-col shrink-0 z-30 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] overflow-hidden ${isResizing ? '' : 'transition-all duration-300'}`}
                    >
                        <div className="h-14 flex items-center justify-between px-5 border-b border-border bg-muted/20 shrink-0">
                            <div className="flex items-center gap-2">
                                <PenTool className="w-4 h-4 text-primary" />
                                <span className="font-bold text-sm tracking-wide text-foreground">Smart Notebook</span>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleSave}
                                className="h-8 px-2 text-[10px] font-bold text-primary hover:bg-primary/10"
                            >
                                <Save className="w-3 h-3 mr-1" />
                                SYNC
                            </Button>
                        </div>

                        {/* Notebook Toolbar */}
                        <div className="px-4 py-2 border-b border-border bg-background flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => insertFormatting('**', '**')}
                                title="Bold"
                            >
                                <span className="font-bold text-sm">B</span>
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => insertFormatting('*', '*')}
                                title="Italic"
                            >
                                <span className="italic text-sm font-serif">I</span>
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => insertFormatting('\n- ', '')}
                                title="Bullet List"
                            >
                                <List className="w-4 h-4" />
                            </Button>
                            <div className="w-px h-4 bg-border mx-1" />
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md whitespace-nowrap"
                                onClick={() => insertFormatting(`\n\n### PIN PAGE ${currentPage}\n`, '')}
                            >
                                <Bookmark className="w-3 h-3 mr-1" />
                                PIN PAGE
                            </Button>
                            <div className="flex-1" />
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => setMarkdownNote('')}
                                title="Clear All"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        <div className="flex-1 p-5 overflow-y-auto bg-card">
                            <textarea
                                id="notebook-textarea"
                                value={markdownNote}
                                onChange={(e) => setMarkdownNote(e.target.value)}
                                className="w-full h-full bg-transparent border-none resize-none focus:ring-0 text-foreground text-sm leading-relaxed font-sans placeholder:text-muted-foreground/50 outline-none"
                                placeholder="Start taking notes here..."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
