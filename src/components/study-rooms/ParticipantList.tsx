'use client';

import { Crown, Shield, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatStudyRoomTime } from '@/lib/study-rooms/date-format';
import type { ParticipantSummary } from '@/lib/study-rooms/events';

export function ParticipantList({
  participants,
  currentUserId,
  isAdmin,
  onKick,
  onTransferAdmin,
}: {
  participants: ParticipantSummary[];
  currentUserId: string;
  isAdmin: boolean;
  onKick: (userId: string) => Promise<void>;
  onTransferAdmin: (userId: string) => Promise<void>;
}) {
  const activeParticipants = participants.filter((participant) => !participant.left_at && !participant.kicked);

  const run = async (operation: () => Promise<void>, success: string): Promise<void> => {
    try {
      await operation();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  return (
    <section className="rounded-lg border border-primary/20 bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Participants</h2>
        <Badge variant="secondary" className="rounded-md">{activeParticipants.length}/100</Badge>
      </div>

      <div className="space-y-3">
        {activeParticipants.map((participant) => {
          const isSelf = participant.user_id === currentUserId;
          const participantIsAdmin = participant.role === 'admin';
          return (
            <div key={participant.user_id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-blue-600 text-sm font-black text-white">
                  {participant.display_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold">{participant.display_name}</p>
                  {isSelf && <Badge className="h-5 rounded-md px-1.5 text-[10px]">You</Badge>}
                  {participantIsAdmin && (
                    <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px]">
                      <Crown className="mr-1 h-3 w-3 text-amber-500" />
                      Admin
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Joined {formatStudyRoomTime(participant.joined_at)}
                </p>
              </div>

              {isAdmin && !isSelf && (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Transfer admin"
                    onClick={() => run(() => onTransferAdmin(participant.user_id), 'Admin transferred.')}
                  >
                    <Shield className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Kick participant"
                    onClick={() => run(() => onKick(participant.user_id), 'Participant removed.')}
                  >
                    <UserMinus className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
