'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

import type { SocialUserCard } from '@/server/social/social-service';
import StudentList from '@/components/social/StudentList';
import { Button } from '@/components/ui/button';
import { apiCall } from '@/lib/api';

interface FollowListViewProps {
  username: string;
  direction: 'followers' | 'following';
  title: string;
  initialItems: SocialUserCard[];
  initialHasMore: boolean;
  hidden: boolean;
}

export default function FollowListView({
  username,
  direction,
  title,
  initialItems,
  initialHasMore,
  hidden,
}: FollowListViewProps) {
  const [items, setItems] = useState<SocialUserCard[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    const next = page + 1;
    try {
      const data = await apiCall(`/social/${direction}/${encodeURIComponent(username)}?page=${next}`);
      setItems((prev) => [...prev, ...(Array.isArray(data?.items) ? data.items : [])]);
      setHasMore(Boolean(data?.hasMore));
      setPage(next);
    } catch {
      // keep current list on failure
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-5">
        <Link
          href={`/u/${username}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          @{username}
        </Link>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>

        {hidden ? (
          <div className="flex flex-col items-center text-center gap-3 py-16">
            <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-bold">This profile is private</p>
          </div>
        ) : (
          <>
            <StudentList
              users={items}
              emptyLabel={direction === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            />
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={loadMore} disabled={loading} className="font-bold">
                  {loading ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
