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
      <div className="neu-raised rounded-2xl flex items-center gap-3 px-4 h-13">
        <Search className="w-4 h-4 text-primary shrink-0" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Search students by @username or name…'}
          className="flex-1 h-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/50 outline-none py-3.5"
        />
        {loading && (
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
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
