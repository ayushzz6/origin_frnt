'use client';

import Link from 'next/link';

import type { SocialUserCard } from '@/server/social/social-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import FollowButton from '@/components/social/FollowButton';

interface StudentListProps {
  users: SocialUserCard[];
  emptyLabel?: string;
}

/** Reusable student row list — used by search, the /social page, and the
 * followers/following pages. Each row links to /u/<username> + a Follow button. */
export default function StudentList({ users, emptyLabel }: StudentListProps) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        {emptyLabel ?? 'No students to show yet.'}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-3 p-3 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 hover:border-border transition-colors"
        >
          <Link href={`/u/${u.username}`} className="flex items-center gap-3 flex-1 min-w-0 group">
            <Avatar className="w-11 h-11 shrink-0">
              {u.avatar ? <AvatarImage src={u.avatar} alt={u.name} className="object-cover" /> : null}
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-black">
                {u.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{u.name}</p>
              <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
            </div>
          </Link>
          {!u.isMe && (
            <FollowButton
              username={u.username}
              initialFollowing={u.isFollowedByMe}
              followsMe={u.followsMe}
              size="sm"
            />
          )}
        </div>
      ))}
    </div>
  );
}
