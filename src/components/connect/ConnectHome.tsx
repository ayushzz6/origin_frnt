'use client';

/**
 * Phase 14 — student "Connect" home. Three tabs:
 *   • Enter code     — Flow 1 (redeem + subject pick)
 *   • Browse         — active collaborator institutes (Flow 2 entry, checkout in 2B)
 *   • My institutes  — the subjects the student has already unlocked
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Loader2, Radio } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  joinConnectRoom,
  listConnectCollaborators,
  listConnectRooms,
  listMyInstitutes,
  type ConnectCollaborator,
  type ConnectRoom,
  type StudentInstitute,
} from '@/features/connect/client';

import { ConnectRedeemPanel } from './ConnectRedeemPanel';

function BrowsePanel() {
  const [collaborators, setCollaborators] = useState<ConnectCollaborator[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listConnectCollaborators()
      .then((rows) => {
        if (!cancelled) setCollaborators(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load institutes.');
        setCollaborators([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (collaborators === null) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading institutes…
      </div>
    );
  }

  if (error) {
    return <p className="py-8 text-sm text-destructive">{error}</p>;
  }

  if (collaborators.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No institutes yet</CardTitle>
          <CardDescription>
            Collaborating institutes will appear here. If you have a code, use the “Enter code” tab.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {collaborators.map((inst) => (
        <Card key={inst.workspaceId}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle>{inst.displayName}</CardTitle>
              {inst.verified ? <Badge>Verified</Badge> : null}
            </div>
            <CardDescription>
              {[inst.city, inst.state, inst.country].filter(Boolean).join(', ') || 'Online'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {inst.subjects.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {inst.subjects.slice(0, 6).map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {inst.studentCount} students · {inst.batchCount} batches
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href={`/connect/collaborators/${inst.workspaceId}`}>View institute</Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function JoinableRoomsPanel() {
  const router = useRouter();
  const [rooms, setRooms] = useState<ConnectRoom[] | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listConnectRooms()
      .then((rows) => {
        if (!cancelled) setRooms(rows);
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleJoin(roomId: string) {
    setJoiningId(roomId);
    try {
      const { roomId: joined } = await joinConnectRoom(roomId);
      router.push(`/study-rooms/${joined}/lobby`);
    } catch {
      setJoiningId(null);
    }
  }

  // Nothing to show (no live rooms or not loaded yet) → render nothing so the panel
  // stays clean for students without an active institute room.
  if (!rooms || rooms.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" /> Live institute rooms
        </CardTitle>
        <CardDescription>Test rooms your teachers have opened for your batches.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{room.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[room.workspaceName, room.batchName].filter(Boolean).join(' · ') || 'Institute room'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {room.status === 'in_test' ? <Badge variant="destructive">Live</Badge> : <Badge>Lobby</Badge>}
              <Button size="sm" disabled={joiningId === room.id} onClick={() => handleJoin(room.id)}>
                {joiningId === room.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join'}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const ENROLLMENT_STATUS_BADGE: Record<
  StudentInstitute['enrollmentStatus'],
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  active: { label: 'Active', variant: 'default' },
  unassigned: { label: 'Enrolled', variant: 'secondary' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  left: { label: 'Left', variant: 'outline' },
};

function InstituteCard({ inst }: { inst: StudentInstitute }) {
  const status = ENROLLMENT_STATUS_BADGE[inst.enrollmentStatus] ?? ENROLLMENT_STATUS_BADGE.unassigned;
  const location = [inst.city, inst.state, inst.country].filter(Boolean).join(', ') || 'Online';
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> {inst.displayName}
          </CardTitle>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <Badge variant={status.variant}>{status.label}</Badge>
            {inst.verified ? <Badge variant="outline">Verified</Badge> : null}
          </div>
        </div>
        <CardDescription>{location}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Your batches</p>
          {inst.batches.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {inst.batches.map((b) => (
                <Badge key={b.id} variant="outline">
                  {b.name}
                  {b.subject ? ` · ${b.subject}` : ''}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Awaiting batch assignment by the institute.
            </p>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Unlocked subjects</p>
          {inst.subjects.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {inst.subjects.map((s) => (
                <Badge key={s} variant="secondary" className="capitalize">
                  {s}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No subject unlocked yet — pick one from the “Enter code” tab.
            </p>
          )}
        </div>
      </CardContent>
      {inst.isActiveCollaborator ? (
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/connect/collaborators/${inst.workspaceId}`}>View institute</Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function MyInstitutesPanel() {
  const [institutes, setInstitutes] = useState<StudentInstitute[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyInstitutes()
      .then((rows) => {
        if (!cancelled) setInstitutes(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load your institutes.');
        setInstitutes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      {institutes === null ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your institutes…
        </div>
      ) : error ? (
        <p className="py-8 text-sm text-destructive">{error}</p>
      ) : institutes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No institutes yet</CardTitle>
            <CardDescription>
              Redeem an institute code in the “Enter code” tab or browse institutes to connect.
              Once you join, your institute and batches show up here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {institutes.map((inst) => (
            <InstituteCard key={inst.workspaceId} inst={inst} />
          ))}
        </div>
      )}
      <JoinableRoomsPanel />
    </div>
  );
}

export function ConnectHome({ defaultTab = 'enter-code' }: { defaultTab?: string }) {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connect</h1>
        <p className="text-sm text-muted-foreground">
          Link your coaching institute, redeem a code, or browse institutes on ORIGIN.
        </p>
      </div>
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="enter-code">Enter code</TabsTrigger>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="my-institutes">My institutes</TabsTrigger>
        </TabsList>
        <TabsContent value="enter-code">
          <ConnectRedeemPanel />
        </TabsContent>
        <TabsContent value="browse">
          <BrowsePanel />
        </TabsContent>
        <TabsContent value="my-institutes">
          <MyInstitutesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ConnectHome;
