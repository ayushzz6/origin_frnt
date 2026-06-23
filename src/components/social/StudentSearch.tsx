'use client';

import { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

import type { SocialUserCard } from '@/server/social/social-service';
import { apiCall } from '@/lib/api';
import StudentList from '@/components/social/StudentList';

interface StudentSearchProps {
  autoFocus?: boolean;
  placeholder?: string;
}

/** Debounced student search backed by GET /api/social/search. */
export default function StudentSearch({ autoFocus, placeholder }: StudentSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocialUserCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 1) {
      setResults([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const data = await apiCall(`/social/search?q=${encodeURIComponent(term)}`);
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 280);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Search students by @username or name'}
          className="w-full h-12 pl-11 pr-11 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/60 text-sm font-medium outline-none focus:border-primary/50 transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {query.trim().length > 0 && (
        <StudentList
          users={results}
          emptyLabel={searched && !loading ? `No students match "${query.trim()}".` : 'Searching…'}
        />
      )}
    </div>
  );
}
