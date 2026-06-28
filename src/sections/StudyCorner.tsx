'use client';
import React, { useEffect, useState } from 'react';

import {
  BookOpen,
  Search,
  Library,
  PenTool,
  Heart,
  Download,
  Folder as LucideFolder,
  FolderPlus,
  ChevronDown,
  FileText,
  Share2,
  Clock,
  ExternalLink
} from 'lucide-react';
import AnimatedFolder from '@/components/ui/Folder';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { ViewState, Book } from '@/types';
import type { NCERTBook } from '@/data/ncertBooks';
import { mockBooks, mockNotes } from '@/data/mockData';
import NCERTReader from '@/components/study/NCERTReader';
import NCERTCorner from '@/components/study/NCERTCorner';
import { useAuth } from '@/context/AuthContext';

interface StudyCornerProps {
    catalog: NCERTBook[];
}

type TabType = 'dashboard' | 'discover' | 'library' | 'notes' | 'bookmarks' | 'ncert';

export default function StudyCorner({ catalog }: StudyCornerProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);

    // Local state for library management (would be DB in real app)
    const [localBooks] = useState<Book[]>(mockBooks);
    const [userLibrary, setUserLibrary] = useState<Set<string>>(new Set(['book-1', 'book-3'])); // Default mock library
    const [likedBooks, setLikedBooks] = useState<Set<string>>(
        new Set(localBooks.filter(b => b.isLiked).map(b => b.id))
    );

    // --- Folder & Organization State ---
    const [folders, setFolders] = useState<Record<string, string[]>>({
        'Board Prep': [],
        'Reference': []
    });
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

    // --- Dynamic Note Aggregation Logic ---
    // Reads localStorage, so must run client-side only (skipped during SSR prerender).
    const getAggregatedNotes = () => {
        const aggregated: any[] = [];
        if (typeof window === 'undefined') return mockNotes;

        mockBooks.forEach(book => {
            const savedNote = localStorage.getItem(`origin_notes_${book.id}`);
            const savedStrokes = localStorage.getItem(`origin_strokes_${book.id}`);

            // If user has typed notes
            if (savedNote && savedNote.trim() !== '' && !savedNote.includes("Start typing here...")) {
                aggregated.push({
                    id: `note-${book.id}`,
                    bookId: book.id,
                    content: savedNote.substring(0, 200) + (savedNote.length > 200 ? '...' : ''),
                    fullContent: savedNote,
                    type: 'notebook',
                    color: '#e11d48',
                    createdAt: new Date(), // Mock date since we don't store it yet
                    tags: ['myself', book.subject.toLowerCase()]
                });
            }

            // If user has highlights/strokes
            if (savedStrokes) {
                try {
                    const strokes = JSON.parse(savedStrokes);
                    if (strokes.length > 0) {
                        const highlightsCount = strokes.filter((s: any) => s.type === 'highlight').length;
                        if (highlightsCount > 0) {
                            aggregated.push({
                                id: `highlight-${book.id}`,
                                bookId: book.id,
                                content: `Successfully highlighted ${highlightsCount} important segments in this book.`,
                                type: 'highlight',
                                color: '#fbbf24',
                                createdAt: new Date(),
                                tags: ['highlight', 'important']
                            });
                        }
                    }
                } catch (e) { console.error(e); }
            }
        });

        return aggregated.length > 0 ? aggregated : mockNotes; // Fallback to mock if empty
    };

    const [aggregatedNotes, setAggregatedNotes] = useState<any[]>(mockNotes);
    useEffect(() => {
        setAggregatedNotes(getAggregatedNotes());
    }, []);

    const toggleLike = (bookId: string) => {
        const newLiked = new Set(likedBooks);
        if (newLiked.has(bookId)) {
            newLiked.delete(bookId);
        } else {
            newLiked.add(bookId);
        }
        setLikedBooks(newLiked);
    };

    const toggleLibrary = (bookId: string) => {
        const newLib = new Set(userLibrary);
        if (newLib.has(bookId)) {
            newLib.delete(bookId);
        } else {
            newLib.add(bookId);
        }
        setUserLibrary(newLib);
    };

    const filteredBooks = mockBooks.filter(book =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.subject.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const libraryBooks = localBooks.filter(book => {
        const isInLibrary = userLibrary.has(book.id);
        if (!isInLibrary) return false;
        if (selectedFolder) {
            return folders[selectedFolder]?.includes(book.id);
        }
        return true;
    });

    const createFolder = () => {
        const name = prompt("Enter folder name:");
        if (name && !folders[name]) {
            setFolders({ ...folders, [name]: [] });
        }
    };

    const addBookToFolder = (bookId: string, folderName: string) => {
        const updated = { ...folders };
        Object.keys(updated).forEach((f: string) => {
            updated[f] = updated[f].filter((id: string) => id !== bookId);
        });
        updated[folderName] = [...(updated[folderName] || []), bookId];
        setFolders(updated);
    };

    const handleAddNCERTBook = (ncertBook: any, _folderName: string) => {
        // In this dynamic version, adding to library just means updating userLibrary
        toggleLibrary(ncertBook.id);
        toast.success(`${ncertBook.title} added to your collection!`);
    };

    // --- Dynamic Dashboard Folder Generation ---
    const generateDashboardFolders = () => {
        const folders: any[] = [];
        const subjects = Array.from(new Set(catalog.map((b: any) => b.subject)));

        subjects.forEach((subject: string) => {
            const subjectBooks = catalog.filter((b: any) => b.subject === subject);
            const classes = Array.from(new Set(subjectBooks.map((b: any) => b.bookClass))).sort((a: any, b: any) => parseInt(b) - parseInt(a));
            
            folders.push({
                name: subject,
                isOpen: false,
                type: 'subject',
                children: classes.map(cls => ({
                    name: `Class ${cls}`,
                    isOpen: false,
                    type: 'class',
                    children: subjectBooks
                        .filter((b: any) => b.bookClass === cls)
                        .flatMap((book: any) => [
                            { 
                                name: book.title, 
                                type: 'folder', 
                                isOpen: false,
                                children: (book.chapters || []).map((ch: any) => ({
                                    name: ch.title,
                                    type: 'pdf',
                                    url: `/books/${book.basePath}/${ch.pdfFile}`,
                                    bookId: book.id,
                                    chapterId: ch.id
                                }))
                            }
                        ])
                }))
            });
        });
        return folders;
    };

    // --- Dashboard Data & Components ---
    const [dashboardFolders, setDashboardFolders] = useState(generateDashboardFolders());


    const [selectedPath, setSelectedPath] = useState<number[] | null>(null);
    const [selectedPDF, setSelectedPDF] = useState<any | null>(null);

    const toggleFolder = (path: number[]) => {
        const newFolders = [...dashboardFolders];
        let current: any = newFolders;

        path.forEach((index, i) => {
            if (i === path.length - 1) {
                current[index].isOpen = !current[index].isOpen;
            } else {
                current = current[index].children;
            }
        });

        setDashboardFolders(newFolders);
        setSelectedPath(path);
    };

    const getCurrentItems = () => {
        if (!selectedPath) return []; // Root state shows no files, use selection prompt

        let current: any = dashboardFolders;
        selectedPath.forEach((index) => {
            current = current?.[index]?.children || [];
        });

        // Return both sub-folders AND pdf leaf files
        const items = Array.isArray(current) ? current
            .filter((item: any) => item.name !== '.DS_Store')
            .map((item: any, i: number) => ({
                ...item,
                path: [...selectedPath, i],
                // preserve 'folder' type for sub-folders, mark leaves as 'pdf'
                type: item.children ? 'folder' : 'pdf',
            })) : [];

        if (searchQuery.trim()) {
            return items.filter((item: any) =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return items;
    };

    const currentItems = getCurrentItems();
    const breadcrumbs = selectedPath ? selectedPath.reduce((acc: any[], index, i) => {
        const current: any = i === 0 ? dashboardFolders[index] : acc[i - 1].children[index];
        acc.push(current);
        return acc;
    }, []) : [];

    const RecentNoteCard = ({ title, date }: any) => (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:bg-muted/50 hover:border-primary/30 transition-all duration-300 group cursor-pointer shadow-lg">
            <div className="flex-1 pr-4">
                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{title}</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">{date}</p>
            </div>
            <div className="relative shrink-0 w-12 h-16 bg-card rounded-md shadow-xl rotate-3 group-hover:rotate-6 transition-transform overflow-hidden flex flex-col p-2 gap-1.5 ring-2 ring-primary/20 group-hover:ring-primary/40">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/20"></div>
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-0.5 bg-border rounded-full ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`}></div>
                ))}
                <div className="mt-auto text-[7px] font-black text-primary tracking-tighter self-end opacity-40">ORIGIN</div>
            </div>
        </div>
    );

    const FileGridItem = ({ item, onClick }: { item: any, onClick: () => void }) => (
        <div
            onClick={onClick}
            className="aspect-square rounded-[2rem] bg-card border border-border flex flex-col items-center justify-center group cursor-pointer hover:border-primary/50 transition-all hover:bg-primary/5 shadow-inner relative overflow-hidden p-6"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative transform group-hover:-translate-y-2 transition-transform duration-500 flex flex-col items-center text-center gap-4">
                {item.type === 'folder' ? (
                    <AnimatedFolder
                        size={0.6}
                        color="var(--primary-hex, #e11d48)"
                        className="mb-2"
                        items={[
                            <div key="1" className="w-full h-full bg-primary/20" />,
                            <div key="2" className="w-full h-full bg-primary/15" />,
                            <div key="3" className="w-full h-full bg-card" />
                        ]}
                    />
                ) : (
                    <div className="p-3 rounded-2xl bg-background/40 ring-1 ring-border group-hover:ring-primary/40 transition-all shadow-xl mb-2">
                        <FileText className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:drop-shadow-[0_0_12px_rgba(251,113,133,0.6)]" />
                    </div>
                )}
                <div>
                    <p className="text-[10px] font-black text-foreground uppercase tracking-widest line-clamp-1">{item.name}</p>
                    {item.type === 'file' && (
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                            <p className="text-[8px] text-muted-foreground font-bold uppercase">Chapter</p>
                            <ExternalLink className="w-2 h-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full border-[2.5px] border-background scale-0 group-hover:scale-100 transition-transform shadow-lg shadow-primary/50"></div>
            </div>
        </div>
    );

    const renderBookCard = (book: Book, inLibrary: boolean = false) => (
        <Card key={book.id} className="group flex flex-col overflow-hidden neu-raised hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 rounded-2xl">
            <div className="relative aspect-[3/4] overflow-hidden neu-inset rounded-t-2xl">
                <img
                    src={book.coverImage}
                    alt={book.title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 z-10">
                    <div className="flex justify-end transform -translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-75">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleLike(book.id); }}
                            className="p-2.5 rounded-full bg-primary/10 backdrop-blur-md hover:bg-primary/20 transition-colors shadow-sm"
                        >
                            <Heart className={`w-5 h-5 transition-transform active:scale-75 ${likedBooks.has(book.id) ? 'fill-primary text-primary' : 'text-white'}`} />
                        </button>
                    </div>
                    <div className="flex gap-2 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-100">
                        {inLibrary ? (
                            <Button
                                className="flex-1 bg-primary text-white font-bold h-11 rounded-xl shadow-lg shadow-primary/20"
                                onClick={(e) => { e.stopPropagation(); setSelectedBook(book); }}
                            >
                                Read Now
                            </Button>
                        ) : (
                            <Button
                                className="flex-1 bg-card hover:bg-primary/5 text-primary font-bold h-11 rounded-xl shadow-lg"
                                onClick={() => toggleLibrary(book.id)}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Add to Library
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                    <Badge variant="secondary" className="bg-primary/10 text-primary font-bold text-[10px] tracking-wider uppercase border-primary/10 dark:border-rose-800 px-2 leading-tight">
                        {book.subject}
                    </Badge>
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider">CLASS {book.bookClass}</span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug mb-2 group-hover:text-primary transition-colors">
                    {book.title}
                </h3>
                <div className="mt-auto pt-4 flex items-center text-xs font-medium text-muted-foreground gap-3 border-t border-border/40">
                    <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />{book.chapters.length} Ch</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                    <span>{book.chapters.reduce((acc, ch) => acc + ch.pages, 0)} Pgs</span>
                </div>
            </CardContent>
        </Card>
    );

    if (selectedBook) {
        return (
            <NCERTReader
                book={selectedBook}
                onBack={() => setSelectedBook(null)}
                initialNotes={mockNotes.filter(n => n.bookId === selectedBook.id)}
            />
        );
    }

    if (selectedPDF) {
        // Parse subject and class from breadcrumbs if available based on selectedPath
        let subject = '';
        let classNum = '';
        if (selectedPath && dashboardFolders[selectedPath[0]]) {
            subject = dashboardFolders[selectedPath[0]].name;
            if (selectedPath.length > 1 && dashboardFolders[selectedPath[0]].children) {
                const clsNode = dashboardFolders[selectedPath[0]].children[selectedPath[1]];
                if (clsNode) {
                    classNum = clsNode.name.replace('Class ', '');
                }
            }
        }

        const bookFromMetadata = catalog.find(b => b.id === selectedPDF.bookId);
        const fallbackBasePath = selectedPDF.url
            ? selectedPDF.url.replace(/^\/books\//, '').split('/').slice(0, -1).join('/')
            : '';
        const chapters = bookFromMetadata?.chapters || [
            { id: selectedPDF.chapterId || 'ch1', title: selectedPDF.name, pdfFile: selectedPDF.url.split('/').pop() }
        ];

        return (
            <NCERTReader
                book={{
                    id: selectedPDF.bookId || 'temp-id',
                    title: bookFromMetadata?.title || selectedPDF.name.split(' - ')[0],
                    bookClass: classNum,
                    subject: subject,
                    coverImage: 'https://images.unsplash.com/photo-1636466497769-f81855aebf13?auto=format&fit=crop&q=80&w=400',
                    isLiked: false,
                    basePath: bookFromMetadata?.basePath || fallbackBasePath,
                    chapters: chapters.map((ch: any) => ({ ...ch, pages: 0 })) // pages not needed for reader now
                }}
                activeChapterId={selectedPDF.chapterId || 'ch1'}
                onBack={() => setSelectedPDF(null)}
            />
        );
    }

    return (
        <div className="min-h-screen neu-surface font-sans text-foreground transition-colors duration-500 overflow-x-hidden relative">
            {/* Ambient Background Elements */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[0%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 relative z-10">

                {/* Study Dashboard Tab (Mockup Implementation) */}
                {activeTab === 'dashboard' && (
                    <div className="relative space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700 min-h-[800px]">
                        
                        <header className="flex flex-col sm:flex-row items-center justify-between gap-6">
                            <h2 className="text-3xl sm:text-7xl lg:text-8xl font-black tracking-tighter text-foreground drop-shadow-2xl uppercase">
                                Study <span className="text-gradient">Hub.</span>
                            </h2>
                            <div className="glass px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border-border/50 flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                <input 
                                    placeholder="Search modules..." 
                                    className="bg-transparent border-none outline-none text-xs sm:text-sm font-bold flex-1 sm:w-48 placeholder:text-muted-foreground/50"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-10 pb-32">

                            {/* Left Panel: FOLDERS */}
                            <div className="md:col-span-12 lg:col-span-3 rounded-[2rem] sm:rounded-[3rem] glass p-5 sm:p-10 shadow-2xl relative overflow-hidden group border-border/50">
                                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
                                <h3 className="text-[10px] font-black text-primary tracking-[0.3em] uppercase mb-6 sm:mb-10 flex items-center gap-3">
                                    <LucideFolder className="w-4 h-4 sm:w-5 sm:h-5" /> Navigation
                                </h3>

                                <div className="space-y-6">
                                    {dashboardFolders.map((subject, i) => {
                                        const isSelected = selectedPath?.length === 1 && selectedPath[0] === i;
                                        return (
                                            <div key={i} className="space-y-4">
                                                <div
                                                    className={`flex items-center gap-4 cursor-pointer transition-all group/folder py-2 px-3 rounded-2xl ${isSelected ? 'bg-primary/10 text-foreground border border-primary/20 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'}`}
                                                    onClick={() => toggleFolder([i])}
                                                >
                                                    <div className="shrink-0 transition-transform duration-300" style={{ transform: subject.isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
                                                        <ChevronDown className={`w-4 h-4 transition-colors ${isSelected ? 'text-primary' : 'text-primary/40 group-hover/folder:text-primary'}`} />
                                                    </div>
                                                    <div className={`p-2 rounded-xl transition-all ${isSelected ? 'bg-primary text-white shadow-[0_0_20px_rgba(244,63,94,0.4)] ring-2 ring-primary/50 scale-110' : 'bg-primary/20 text-primary shadow-[0_0_20px_rgba(244,63,94,0.2)] ring-1 ring-primary/30 group-hover:scale-105'}`}>
                                                        <LucideFolder className="w-5 h-5 fill-current" />
                                                    </div>
                                                    <span className={`text-sm tracking-tight transition-all ${isSelected ? 'font-black' : 'font-bold'}`}>{subject.name}</span>
                                                </div>

                                                {subject.isOpen && (
                                                    <div className="pl-12 space-y-4 border-l-2 border-primary/10 ml-[1.65rem] animate-in slide-in-from-top-2 duration-300">
                                                        {subject.children.map((cls: any, j: number) => {
                                                            const isSubSelected = selectedPath?.length === 2 && selectedPath[0] === i && selectedPath[1] === j;
                                                            return (
                                                                <div key={j} className="space-y-3">
                                                                    <div
                                                                        className={`flex items-center gap-4 cursor-pointer transition-all group/subfolder py-1.5 px-3 rounded-xl ${isSubSelected ? 'bg-primary/5 text-primary border border-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-muted/50 border border-transparent'}`}
                                                                        onClick={() => toggleFolder([i, j])}
                                                                    >
                                                                        <div className="shrink-0 transition-transform duration-300" style={{ transform: cls.isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
                                                                            <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                                                                        </div>
                                                                        <Library className={`w-5 h-5 transition-colors ${isSubSelected ? 'text-primary shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'text-primary/60 group-hover/subfolder:text-primary'}`} />
                                                                        <span className={`text-sm tracking-tight transition-all ${isSubSelected ? 'font-black' : 'font-bold'}`}>{cls.name}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Middle Panel: MY NOTES & FILES */}
                            <div className="md:col-span-8 lg:col-span-6 rounded-[2rem] sm:rounded-[3rem] bg-card/50 backdrop-blur-3xl border border-border p-5 sm:p-10 shadow-2xl relative group overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
                                <div className="flex items-center justify-between mb-8 sm:mb-12 relative z-10">
                                    <div className="flex flex-col gap-1 sm:gap-2">
                                        <h3 className="text-[10px] sm:text-xs font-black text-primary tracking-[0.3em] uppercase flex items-center gap-2 sm:gap-2.5">
                                            <FileText className="w-4 h-4 sm:w-5 sm:h-5" /> My Notes
                                        </h3>
                                        {breadcrumbs.length > 0 && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                                <button onClick={() => setSelectedPath(null)} className="hover:text-primary transition-colors">Root</button>
                                                {breadcrumbs.map((b, idx) => (
                                                    <React.Fragment key={idx}>
                                                        <span className="opacity-30">/</span>
                                                        <button
                                                            onClick={() => setSelectedPath(selectedPath!.slice(0, idx + 1))}
                                                            className="hover:text-primary transition-colors"
                                                        >
                                                            {b.name}
                                                        </button>
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button className="text-[10px] font-black text-foreground/30 hover:text-foreground transition-colors uppercase tracking-[0.2em] border-b border-border pb-0.5">View All</button>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 relative z-10 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                                    {currentItems.length > 0 ? currentItems.map((item: any, i: number) => (
                                    <FileGridItem
                                        key={i}
                                        item={item}
                                        onClick={() => {
                                            if (item.type === 'folder') {
                                                toggleFolder(item.path);
                                            } else if (item.url) {
                                                setSelectedPDF(item);
                                            }
                                        }}
                                    />
                                )) : (
                                        <div className="col-span-full py-20 text-center flex flex-col items-center justify-center">
                                            <div className="w-24 h-24 bg-primary/5 rounded-[2rem] flex items-center justify-center mb-8 border border-primary/10 shadow-2xl animate-pulse">
                                                <LucideFolder className="w-10 h-10 text-primary/50" />
                                            </div>
                                            <h4 className="text-xl font-black text-foreground mb-2 uppercase tracking-tighter">
                                                {!selectedPath ? 'Select a Folder' : 'No Files Found'}
                                            </h4>
                                            <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                                                {!selectedPath ? 'Choose a subject or class from the sidebar to view chapters.' : 'This category currently has no study materials.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Panel: Sidebar Widgets */}
                            <div className="md:col-span-4 lg:col-span-3 space-y-8">
                                {/* Recent Notes */}
                                <div className="rounded-[2.5rem] sm:rounded-[3rem] bg-card/50 backdrop-blur-3xl border border-border p-6 sm:p-10 shadow-2xl relative group overflow-hidden">
                                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
                                    <h3 className="text-[10px] sm:text-xs font-black text-primary tracking-[0.3em] uppercase mb-6 sm:mb-8 flex items-center gap-2.5">
                                        <Clock className="w-4 h-4 sm:w-5 sm:h-5" /> Activity
                                    </h3>
                                    <div className="space-y-5">
                                        {aggregatedNotes.slice(0, 3).map((note, idx) => (
                                            <RecentNoteCard
                                                key={idx}
                                                title={note.bookId ? mockBooks.find(b => b.id === note.bookId)?.title || "Unknown Book" : note.title || "Quick Note"}
                                                date={note.type === 'highlight' ? 'Recent Highlight' : '2h ago'}
                                            />
                                        ))}
                                        {aggregatedNotes.length === 0 && (
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase text-center py-4">No recent notes</p>
                                        )}
                                    </div>
                                </div>

                                {/* Shared Files */}
                                <div className="rounded-[2.5rem] sm:rounded-[3rem] bg-card/50 backdrop-blur-3xl border border-border p-6 sm:p-10 shadow-2xl relative group overflow-hidden">
                                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
                                    <h3 className="text-[10px] sm:text-xs font-black text-primary tracking-[0.3em] uppercase mb-6 sm:mb-8 flex items-center gap-2.5">
                                        <Share2 className="w-4 h-4 sm:w-5 sm:h-5" /> Suggested
                                    </h3>
                                    <div className="space-y-4">
                                        {mockBooks.slice(0, 3).map((book, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setSelectedBook(book)}
                                                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                                            >
                                                <div className="p-2 rounded-lg bg-muted border border-border group-hover:border-primary/30 transition-colors">
                                                    <BookOpen className="w-4 h-4 text-primary" />
                                                </div>
                                                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground truncate transition-colors">{book.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {/* Discover Tab */}
                {activeTab === 'discover' && (
                    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                        {/* Hero Section for Discover */}
                        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-primary px-6 py-10 sm:px-12 sm:py-16 flex items-center shadow-xl shadow-primary/10">
                            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay"></div>
                            <div className="absolute -right-20 -top-40 w-96 h-96 bg-white/10 blur-3xl rounded-full pointer-events-none"></div>
                            <div className="relative z-10 max-w-2xl">
                                <Badge className="bg-white/20 hover:bg-white/30 text-white border-white/10 mb-3 sm:mb-4 backdrop-blur-md font-bold px-2 sm:px-3 py-1 text-[10px] sm:text-xs">NCERT Digital Library</Badge>
                                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white mb-3 sm:mb-4 leading-tight tracking-tight drop-shadow-sm">
                                    Master Your Syllabus
                                </h2>
                                <p className="text-white/80 text-sm sm:text-xl max-w-xl font-medium">
                                    Read, highlight, and annotate your class {user?.class || '12'} books.
                                </p>
                            </div>
                        </div>

                        <div className="mt-12">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-bold tracking-tight text-foreground">Trending in Class {user?.class || '12'}</h3>
                                <Button variant="ghost" className="text-primary hover:bg-primary/10">View All</Button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 gap-y-10">
                                {filteredBooks.map(book => renderBookCard(book, userLibrary.has(book.id)))}
                            </div>
                        </div>
                    </div>
                )}

                {/* My Library Tab */}
                {activeTab === 'library' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-foreground">Your NCERT Collection</h2>
                                <p className="text-sm text-neutral-500">Manage and organize your study materials</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={createFolder}
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl border-primary/20 text-primary hover:bg-primary/5"
                                >
                                    <FolderPlus className="w-4 h-4 mr-2" />
                                    New Folder
                                </Button>
                            </div>
                        </div>

                        {/* Folder Filters */}
                        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
                            <button
                                onClick={() => setSelectedFolder(null)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${!selectedFolder ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                            >
                                All Books
                            </button>
                            {Object.keys(folders).map(folder => (
                                <button
                                    key={folder}
                                    onClick={() => setSelectedFolder(folder)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${selectedFolder === folder ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                >
                                    <Library className="w-3.5 h-3.5" />
                                    {folder}
                                    <Badge className={`ml-1 border-none text-[10px] h-4 min-w-[16px] px-1 flex items-center justify-center ${selectedFolder === folder ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>{folders[folder].length}</Badge>
                                </button>
                            ))}
                        </div>

                        {libraryBooks.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 gap-y-10">
                                {libraryBooks.map(book => (
                                    <div key={book.id} className="relative group/card">
                                        {renderBookCard(book, true)}
                                        <div className="absolute top-2 left-2 z-20 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                            <select
                                                onChange={(e) => addBookToFolder(book.id, e.target.value)}
                                                className="text-[10px] bg-card/90 backdrop-blur-md border border-border rounded-lg px-2 py-1 font-bold outline-none shadow-xl cursor-pill text-foreground"
                                                value={Object.keys(folders).find(f => folders[f].includes(book.id)) || ""}
                                            >
                                                <option value="" disabled>Move to...</option>
                                                {Object.keys(folders).map(f => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-24 px-4 rounded-3xl border border-dashed border-border bg-card/50 backdrop-blur-sm">
                                <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center mb-6 shadow-inner relative">
                                    <Library className="w-10 h-10 text-muted-foreground" />
                                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-card rounded-full flex items-center justify-center shadow-md">
                                        <span className="text-lg">📚</span>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">Your library is empty</h3>
                                <p className="text-muted-foreground max-w-sm mx-auto mb-8 text-lg">
                                    Curate your perfect study environment. Discover and add NCERT books to your collection to start reading.
                                </p>
                                <Button
                                    onClick={() => setActiveTab('discover')}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 h-12 text-md font-bold shadow-lg transition-all active:scale-95"
                                >
                                    Browse Books
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* NCERT Corner Tab */}
                {activeTab === 'ncert' && (
                    <NCERTCorner
                        catalog={catalog}
                        onAddBook={handleAddNCERTBook}
                        existingFolders={dashboardFolders.map(s => s.name)}
                    />
                )}

                {/* Personal Study Hub - Upgraded Annotation Center */}
                {activeTab === 'notes' && (
                    <div className="space-y-12 animate-in fade-in zoom-in-95 duration-700 pb-20">
                        {/* Immersive Header */}
                        <div className="relative rounded-[3rem] overflow-hidden bg-card/50 backdrop-blur-3xl border border-border px-12 py-16 flex items-center shadow-2xl relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none"></div>
                            <div className="relative z-10 w-full flex flex-col md:flex-row items-center justify-between gap-10">
                                <div className="text-center md:text-left">
                                    <h2 className="text-3xl sm:text-5xl font-black text-foreground mb-3 sm:mb-4 tracking-tighter drop-shadow-2xl uppercase">
                                        Personal <span className="text-primary">Study Hub.</span>
                                    </h2>
                                    <p className="text-muted-foreground text-sm sm:text-lg max-w-xl font-medium leading-relaxed">
                                        Every highlight and thought you've captured across the NCERT library.
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 sm:gap-6">
                                    <div className="px-5 sm:px-8 py-4 sm:py-6 rounded-2xl sm:rounded-[2.5rem] bg-primary/10 border border-primary/20 text-center ring-1 ring-primary/10">
                                        <p className="text-xl sm:text-3xl font-black text-primary mb-0.5 sm:mb-1">{aggregatedNotes.length}</p>
                                        <p className="text-[8px] sm:text-[10px] font-black text-primary/60 uppercase tracking-widest">Notes</p>
                                    </div>
                                    <div className="px-5 sm:px-8 py-4 sm:py-6 rounded-2xl sm:rounded-[2.5rem] bg-primary/10 border border-primary/20 text-center ring-1 ring-primary/10">
                                        <p className="text-xl sm:text-3xl font-black text-primary mb-0.5 sm:mb-1">{likedBooks.size}</p>
                                        <p className="text-[8px] sm:text-[10px] font-black text-primary/60 uppercase tracking-widest">Favs</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                            {/* Intelligent Filters Sidebar */}
                            <div className="space-y-8">
                                <div className="p-8 rounded-[2.5rem] bg-card/40 backdrop-blur-3xl border border-border shadow-xl group">
                                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                                        <Search className="w-4 h-4" /> Global Search
                                    </h4>
                                    <div className="relative">
                                        <input
                                            placeholder="Keywords, topics..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-xs text-foreground focus:outline-none focus:border-primary/50 transition-all font-bold placeholder:text-muted-foreground/50 ring-1 ring-border"
                                        />
                                    </div>
                                </div>

                                <div className="p-8 rounded-[2.5rem] bg-card/40 backdrop-blur-3xl border border-border shadow-xl">
                                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                                        <LucideFolder className="w-4 h-4" /> Quick Filter
                                    </h4>
                                    <div className="space-y-3">
                                        {['All Brain-Bits', 'Recent Highlights', 'Notebook Entries', 'Board Specific'].map((cat, i) => (
                                            <button
                                                key={i}
                                                className={`w-full text-left px-5 py-3.5 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest ${i === 0 ? 'bg-primary text-white shadow-lg shadow-primary/20 ring-1 ring-primary/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Aggregated Knowledge Feed */}
                            <div className="md:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {aggregatedNotes.filter(n =>
                                    n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    mockBooks.find(b => b.id === n.bookId)?.title.toLowerCase().includes(searchQuery.toLowerCase())
                                ).map((note, i) => {
                                    const book = localBooks.find(b => b.id === note.bookId);
                                    return (
                                        <div
                                            key={i}
                                            onClick={() => book && setSelectedBook(book)}
                                            className="p-8 rounded-[2.5rem] bg-card/40 backdrop-blur-3xl border border-border hover:border-primary/50 transition-all group cursor-pointer relative overflow-hidden flex flex-col h-full shadow-lg"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <div className="relative z-10 flex flex-col h-full">
                                                <div className="flex items-center justify-between mb-8">
                                                    <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[8px] font-black uppercase tracking-[0.2em] ring-1 ring-primary/30">
                                                        {note.type}
                                                    </div>
                                                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5" /> Recent
                                                    </div>
                                                </div>

                                                <h5 className="text-md font-black text-foreground mb-4 tracking-tight group-hover:text-primary transition-colors uppercase">
                                                    {book?.title || "Quick Reflection"}
                                                </h5>

                                                <div className="neu-inset rounded-2xl p-6 mb-8 flex-1">
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic line-clamp-5">
                                                        "{note.content}"
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                                    <div className="flex gap-2">
                                                        {note.tags.slice(0, 2).map((tag: string) => (
                                                            <span key={tag} className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-md">#{tag}</span>
                                                        ))}
                                                    </div>
                                                    <button className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-indigo-400/20 pb-0.5 hover:border-indigo-400 transition-all">Review Hub</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {aggregatedNotes.length === 0 && (
                                    <div className="col-span-full py-32 text-center rounded-[3rem] neu-inset">
                                        <div className="w-20 h-20 neu-raised rounded-full flex items-center justify-center mx-auto mb-8 opacity-50">
                                            <PenTool className="w-10 h-10 text-muted-foreground" />
                                        </div>
                                        <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.4em]">Your knowledge vault is currently empty</p>
                                        <p className="mt-4 text-muted-foreground text-sm font-bold">Start reading NCERT books to capture your thoughts here.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
