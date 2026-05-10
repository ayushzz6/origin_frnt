'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  Command, 
  FileText, 
  MessageSquare, 
  BookOpen, 
  HelpCircle, 
  ChevronRight,
  History,
  TrendingUp,
  User as UserIcon,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockTests, mockQuestions, mockBooks, mockDoubtSessions } from '@/data/mockData';
import type { ViewState } from '@/types';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

type SearchCategory = 'all' | 'tests' | 'questions' | 'books' | 'ai';

export default function GlobalSearch({ isOpen, onClose, currentView, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default category based on current view
  useEffect(() => {
    if (isOpen) {
      if (currentView === 'test-list' || currentView === 'test-interface') setActiveCategory('tests');
      else if (currentView === 'study-corner') setActiveCategory('books');
      else if (currentView === 'doubt-solver') setActiveCategory('ai');
      else setActiveCategory('all');
      
      // Auto-focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, currentView]);

  const categories: { id: SearchCategory; label: string; icon: any }[] = [
    { id: 'all', label: 'All', icon: Search },
    { id: 'tests', label: 'Tests', icon: FileText },
    { id: 'questions', label: 'Questions', icon: HelpCircle },
    { id: 'books', label: 'Books', icon: BookOpen },
    { id: 'ai', label: 'AI Hub', icon: MessageSquare },
  ];

  const results = useMemo(() => {
    if (!query.trim()) return [];

    const q = query.toLowerCase();
    const matches: any[] = [];

    // Search Tests
    if (activeCategory === 'all' || activeCategory === 'tests') {
      mockTests.filter(t => t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q))
        .forEach(t => matches.push({ type: 'test', id: t.id, title: t.title, subtitle: `Test • ${t.subject}`, icon: FileText, view: 'test-list' as ViewState }));
    }

    // Search Questions
    if (activeCategory === 'all' || activeCategory === 'questions') {
      mockQuestions.filter(q_item => q_item.text.toLowerCase().includes(q) || q_item.chapter.toLowerCase().includes(q))
        .forEach(q_item => matches.push({ type: 'question', id: q_item.id, title: q_item.chapter, subtitle: `Question • ${q_item.text.substring(0, 60)}...`, icon: HelpCircle, view: 'ogcode' as ViewState }));
    }

    // Search Books
    if (activeCategory === 'all' || activeCategory === 'books') {
      mockBooks.filter(b => b.title.toLowerCase().includes(q) || b.subject.toLowerCase().includes(q))
        .forEach(b => matches.push({ type: 'book', id: b.id, title: b.title, subtitle: `Book • ${b.subject}`, icon: BookOpen, view: 'study-corner' as ViewState }));
    }

    // Search AI Hub
    if (activeCategory === 'all' || activeCategory === 'ai') {
      mockDoubtSessions.filter(s => s.title.toLowerCase().includes(q))
        .forEach(s => matches.push({ type: 'ai', id: s.id, title: s.title, subtitle: 'AI Chat Session', icon: MessageSquare, view: 'doubt-solver' as ViewState }));
    }

    return matches.slice(0, 8);
  }, [query, activeCategory]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Handle shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (results.length || 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (results.length || 1)) % (results.length || 1));
      }
      if (e.key === 'Enter' && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleSelect = (result: any) => {
    onNavigate(result.view);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="relative w-full max-w-2xl bg-card dark:bg-slate-900 rounded-2xl shadow-2xl border border-primary/20 dark:border-slate-800 overflow-hidden"
        >
          {/* Search Header */}
          <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <Search className="w-5 h-5 text-slate-400 mr-3" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tests, questions, books..."
              className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 text-lg"
            />
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-500 font-medium">
                <Command className="w-3 h-3" /> K
              </span>
              <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Categories/Tabs */}
          <div className="flex items-center gap-1 px-4 py-2 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                    isActive 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Results Area */}
          <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
            {query.trim() === '' ? (
              <div className="py-8 px-4">
                <div className="mb-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-2">Popular Searches</h3>
                  <div className="flex flex-wrap gap-2">
                    {['JEE Main Tests', 'Circular Motion', 'Doubt Solver', 'NCERT Physics', 'Leaderboard'].map(s => (
                      <button 
                        key={s}
                        onClick={() => setQuery(s)}
                        className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-all flex items-center gap-2"
                      >
                        <TrendingUp className="w-3 h-3" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-2">Quick Navigation</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { label: 'My Dashboard', icon: UserIcon, view: 'dashboard' },
                      { label: 'Physics Hub', icon: FileText, view: 'test-list' },
                      { label: 'NCERT Library', icon: BookOpen, view: 'study-corner' },
                      { label: 'AI Study Mentor', icon: MessageSquare, view: 'doubt-solver' }
                    ].map(nav => (
                      <button 
                        key={nav.label}
                        onClick={() => onNavigate(nav.view as ViewState)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 dark:hover:bg-primary/20 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 flex items-center justify-center text-primary">
                          <nav.icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-primary group-hover:opacity-80 transition-colors">{nav.label}</span>
                        <ChevronRight className="w-4 h-4 ml-auto text-primary/30 dark:text-primary/60 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-1">
                {results.map((result, idx) => {
                  const Icon = result.icon;
                  const isSelected = selectedIndex === idx;
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left group",
                        isSelected ? "bg-blue-600 shadow-lg shadow-blue-500/20" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "bg-primary/20 text-primary" : "bg-primary/5 dark:bg-slate-800 text-slate-500 group-hover:text-primary"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-bold truncate leading-tight mb-0.5",
                          isSelected ? "text-white" : "text-slate-900 dark:text-white"
                        )}>{result.title}</p>
                        <p className={cn(
                          "text-[10px] truncate",
                          isSelected ? "text-white/70" : "text-slate-500 dark:text-slate-400"
                        )}>{result.subtitle}</p>
                      </div>
                      <ArrowRight className={cn(
                        "w-4 h-4 transition-all",
                        isSelected ? "text-white translate-x-0 opacity-100" : "text-slate-300 dark:text-slate-700 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                      )} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No results for "{query}"</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Try searching for something else or change category.</p>
              </div>
            )}
          </div>

          {/* Footer / Shortcuts */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-[10px] font-bold text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 rotate-90" /> Select</span>
              <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">ESC</span>
              <span>to close</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
