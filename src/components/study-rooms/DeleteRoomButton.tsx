'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
};

export function DeleteRoomButton({
  roomName,
  onDelete,
  label = 'Delete Room',
  iconOnly = false,
  size,
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
        <Button
          type="button"
          variant={iconOnly ? 'ghost' : 'destructive'}
          size={size ?? (iconOnly ? 'icon' : 'default')}
          className={className}
          title={label}
          aria-label={iconOnly ? label : undefined}
        >
          <Trash2 className="h-4 w-4" />
          {!iconOnly && label}
        </Button>
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
            className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60"
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
