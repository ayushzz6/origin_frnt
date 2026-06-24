'use client';

import { useState } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiCall } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  username: string;
  initialFollowing: boolean;
  /** When the target already follows the viewer, offer "Follow back". */
  followsMe?: boolean;
  /** Receives the server's authoritative follower count after each toggle. */
  onCountChange?: (followerCount: number) => void;
  onFollowingChange?: (following: boolean) => void;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export default function FollowButton({
  username,
  initialFollowing,
  followsMe = false,
  onCountChange,
  onFollowingChange,
  size = 'default',
  className,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [hovering, setHovering] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !following;
    setFollowing(next);
    onFollowingChange?.(next);
    setBusy(true);
    try {
      const res = await apiCall('/social/follow', {
        method: next ? 'POST' : 'DELETE',
        body: JSON.stringify({ username }),
      });
      if (res && typeof res.followerCount === 'number') {
        onCountChange?.(res.followerCount);
      }
    } catch {
      // Revert optimistic update on failure.
      setFollowing(!next);
      onFollowingChange?.(!next);
    } finally {
      setBusy(false);
    }
  }

  const label = following
    ? hovering
      ? 'Unfollow'
      : 'Following'
    : followsMe
      ? 'Follow back'
      : 'Follow';

  return (
    <Button
      type="button"
      size={size}
      variant={following ? 'outline' : 'default'}
      onClick={toggle}
      disabled={busy}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      aria-pressed={following}
      className={cn(
        'gap-1.5 font-bold transition-all',
        following && hovering && 'border-red-500/40 text-red-500 hover:bg-red-500/10',
        className,
      )}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : following ? (
        <UserCheck className="w-4 h-4" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
      {label}
    </Button>
  );
}
