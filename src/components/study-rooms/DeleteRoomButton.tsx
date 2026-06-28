'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type DeleteRoomButtonProps = {
  roomName: string;
  onDelete: () => Promise<void>;
  label?: string;
  iconOnly?: boolean;
  className?: string;
};

export function DeleteRoomButton({
  roomName,
  onDelete,
  label = 'Delete Room',
  iconOnly = false,
  className,
}: DeleteRoomButtonProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async (): Promise<void> => {
    setIsDeleting(true);
    try {
      await onDelete();
      toast.success('Room deleted.');
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete room.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          title={label}
          aria-label={iconOnly ? label : undefined}
          className={cn(
            'flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors',
            iconOnly ? 'h-8 w-8' : 'gap-2 px-3 py-2 text-sm font-bold',
            className
          )}
        >
          <Trash2 className="h-4 w-4" />
          {!iconOnly && label}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this room?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the room, invite code, chat, participants, and drafts for {roomName}. Generated tests,
            submitted results, analysis, and DPPs stay available.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-white hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              void confirmDelete();
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete room'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
