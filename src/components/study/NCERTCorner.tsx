'use client';
import { useState } from 'react';
import {
    PlusCircle,
    CheckCircle2,
    Download,
    Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NCERTBook } from '@/data/ncertBooks';
import GlassSurface from '@/components/ui/GlassSurface';
import NCERTReader from './NCERTReader';

interface NCERTCornerProps {
    catalog: NCERTBook[];
    onAddBook: (book: any, folderName: string) => void;
    existingFolders: string[];
}

export default function NCERTCorner({ catalog, onAddBook, existingFolders }: NCERTCornerProps) {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedBookId, setSelectedBookId] = useState('');
    const [viewingBook, setViewingBook] = useState<NCERTBook | null>(null);
    const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
    const [isAdded, setIsAdded] = useState(false);

    // Derive classes (descending) and subjects from the passed catalog
    const classes = Array.from(new Set(catalog.map(b => b.bookClass)))
        .sort((a, b) => Number(b) - Number(a));
    const subjects = selectedClass
        ? Array.from(new Set(catalog.filter(b => b.bookClass === selectedClass).map(b => b.subject)))
        : [];
    const books = catalog.filter(
        (b) => b.bookClass === selectedClass && b.subject === selectedSubject
    );

    const handleGo = () => {
        const book = catalog.find((b) => b.id === selectedBookId);
        if (book) {
            // Transform NCERTBook to Book type for NCERTReader
            const readerBook = {
                id: book.id,
                title: book.title,
                bookClass: book.bookClass,
                subject: book.subject,
                coverImage: 'https://images.unsplash.com/photo-1636466497769-f81855aebf13?auto=format&fit=crop&q=80&w=400',
                isLiked: false,
                chapters: (book.chapters || []).map(ch => ({ ...ch, pages: 0 }))
            };
            setViewingBook(readerBook as any);
            if (book.chapters && book.chapters.length > 0) {
                setActiveChapterId(book.chapters[0].id);
            }
        }
    };

    const handleAddToLibrary = () => {
        if (viewingBook) {
            onAddBook(viewingBook, viewingBook.subject);
            setIsAdded(true);
            setTimeout(() => setIsAdded(false), 3000);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-background rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-500 border border-border">

            <div className="relative h-24 shrink-0 overflow-hidden">
                {/* Background Image Mockup */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary/60 z-10"></div>
                <img
                    src="https://images.unsplash.com/photo-1523050853064-909241584b80?auto=format&fit=crop&q=80&w=1200"
                    alt="Education"
                    className="absolute inset-0 w-full h-full object-cover grayscale mix-blend-overlay"
                />
                <div className="relative z-20 h-full flex items-center px-10">
                    <h1 className="text-3xl font-black text-white italic tracking-tight drop-shadow-md">
                        Textbooks PDF (I-XII)
                    </h1>
                </div>
            </div>

            {/* 2. Selection Bar */}
            <div className="bg-primary p-4 flex flex-wrap items-center justify-center gap-3 shrink-0 z-30 shadow-lg border-y border-white/10">
                <select
                    value={selectedClass}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setSelectedClass(e.target.value);
                        setSelectedSubject('');
                        setSelectedBookId('');
                    }}
                    className="h-10 px-3 rounded text-foreground text-xs font-bold border-none outline-none min-w-[150px] bg-background/90 hover:bg-background transition-colors"
                >
                    <option value="" className="text-foreground">..Select Class..</option>
                    {classes.map((c) => (
                        <option key={c} value={c} className="text-foreground">Class {c}</option>
                    ))}
                </select>

                <select
                    value={selectedSubject}
                    onChange={(e) => {
                        setSelectedSubject(e.target.value);
                        setSelectedBookId('');
                    }}
                    disabled={!selectedClass}
                    className="h-10 px-3 rounded text-foreground text-xs font-bold border-none outline-none min-w-[150px] bg-background/90 hover:bg-background transition-colors disabled:opacity-50"
                >
                    <option value="" className="text-foreground">..Select Subject..</option>
                    {subjects.map((s) => (
                        <option key={s} value={s} className="text-foreground">{s}</option>
                    ))}
                </select>

                <select
                    value={selectedBookId}
                    onChange={(e) => setSelectedBookId(e.target.value)}
                    disabled={!selectedSubject}
                    className="h-10 px-3 rounded text-foreground text-xs font-bold border-none outline-none min-w-[180px] bg-background/90 hover:bg-background transition-colors disabled:opacity-50"
                >
                    <option value="" className="text-foreground">..Select Book Title..</option>
                    {books.map((b) => (
                        <option key={b.id} value={b.id} className="text-foreground">{b.title}</option>
                    ))}
                </select>

                <Button
                    onClick={handleGo}
                    disabled={!selectedBookId}
                    className="h-10 px-6 bg-background hover:bg-background/90 text-primary font-black text-xs rounded transition-all active:scale-95 disabled:opacity-50 border border-white/20"
                >
                    Go
                </Button>
            </div>

            {/* 3. Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">

                {viewingBook ? (
                    <>
                        {/* Sidebar: Chapter Links */}
                        <div className="w-72 bg-muted/30 border-r border-border overflow-y-auto shrink-0 custom-scrollbar">
                            <div className="p-4">
                                <h3 className="text-primary font-black text-xs uppercase tracking-wider mb-4 border-b border-primary/20 pb-2">
                                    {viewingBook.title}
                                </h3>
                                <div className="space-y-1">
                                    {viewingBook && viewingBook.chapters && viewingBook.chapters.map((ch) => (
                                        <button
                                            key={ch.id}
                                            onClick={() => setActiveChapterId(ch.id)}
                                            className={`w-full text-left px-3 py-2.5 text-[11px] font-bold transition-all flex items-center justify-between group rounded-md ${activeChapterId === ch.id
                                                ? 'bg-primary text-primary-foreground shadow-md'
                                                : 'text-foreground/80 hover:bg-primary/10 hover:text-primary'
                                                }`}
                                        >
                                            <span className="truncate">{ch.title}</span>
                                            <span className={`text-[9px] font-medium opacity-70 group-hover:opacity-100 italic transition-opacity ${activeChapterId === ch.id ? 'text-primary-foreground' : 'text-primary'}`}>
                                                (Open)
                                            </span>
                                        </button>
                                    ))}

                                    <button
                                        onClick={handleAddToLibrary}
                                        className="w-full mt-6 py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 border border-primary-foreground/10"
                                    >
                                        {isAdded ? (
                                            <><CheckCircle2 className="w-4 h-4" /> Added to Study Corner</>
                                        ) : (
                                            <><PlusCircle className="w-4 h-4" /> Add to Study Corner</>
                                        )}
                                    </button>
                                </div>
                                <div className="mt-8 pt-4 border-t border-border">
                                    <button className="text-primary font-bold text-[10px] uppercase tracking-widest hover:underline flex items-center gap-2">
                                        <Download className="w-3 h-3" /> Download complete book
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Unified Reader Integration */}
                        <div className="flex-1 bg-background relative">
                            {viewingBook && activeChapterId && (
                                <NCERTReader
                                    book={viewingBook as any}
                                    activeChapterId={activeChapterId}
                                    onBack={() => setViewingBook(null)}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-8 animate-in fade-in duration-1000">
                        <div className="w-32 h-32 rounded-[2.5rem] bg-primary/5 flex items-center justify-center border border-primary/20 shadow-inner group">
                            <PlusCircle className="w-16 h-16 text-primary group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="max-w-md space-y-4">
                            <h2 className="text-2xl font-black text-foreground uppercase tracking-tighter italic">Ready to Explore?</h2>
                            <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                                Use the official NCERT selection panel above to find your textbooks. You can browse chapters, highlight key concepts, and sync everything directly to your Study Corner.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mt-8">
                            <GlassSurface className="p-6 border-border group cursor-pointer hover:border-primary/40 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-primary/20 text-primary"><PlusCircle className="w-5 h-5" /></div>
                                    <div className="text-left">
                                        <span className="block text-xs font-black text-foreground uppercase tracking-wider">Storage Target</span>
                                        <select className="bg-transparent text-[10px] text-muted-foreground font-bold uppercase outline-none border-none cursor-pointer">
                                            {existingFolders.map(f => (
                                                <option key={f} value={f} className="bg-background">{f}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </GlassSurface>
                            <GlassSurface className="p-6 border-border group cursor-pointer hover:border-amber-500/40 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400"><Save className="w-5 h-5" /></div>
                                    <div className="text-left">
                                        <span className="block text-xs font-black text-foreground uppercase tracking-wider">Auto-Sync</span>
                                        <span className="block text-[10px] text-muted-foreground font-bold uppercase">Cloud persistence on</span>
                                    </div>
                                </div>
                            </GlassSurface>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
