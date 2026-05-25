'use client';

/**
 * Teacher profile — identity + workspace list.
 *
 * The teacher-admin launch plan (V1/teacher-admin-launch-plan/02-database-schema-design.md)
 * keeps user identity in `origin_users` (name, email, fieldOfInterest,
 * location, yearsOfExperience) and exposes the public-facing identity
 * via `app.teacher_workspaces` (one row per personal teacher or
 * institute). There is no separate "teacher profile" surface in the
 * plan — the profile page is just the existing /api/users/me record
 * plus the list of workspaces the user belongs to.
 *
 * The previous version of this file rendered a designer mock with
 * fabricated metrics ("12 active classes", "450+ total students",
 * static milestones, hard-coded syllabus progress). Those numbers
 * were never wired to anything. They have been removed.
 */

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
    BookOpen,
    Briefcase,
    Building2,
    ChevronLeft,
    Edit3,
    LogOut,
    MapPin,
    Moon,
    Save,
    Sun,
    X,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiJson } from '@/lib/teacher-client';
import type { User as UserType } from '@/types';

interface WorkspaceSummary {
    workspaceId: string;
    workspace: {
        id: string;
        displayName: string;
        workspaceType: 'personal' | 'institute';
        status: string;
        verificationStatus?: string;
        city?: string | null;
        state?: string | null;
        country?: string | null;
    };
    role: string;
    status: string;
}

interface TeacherProfileProps {
    user: UserType;
    onBack: () => void;
    onLogout: () => void;
}

const ROLE_BADGE_COPY: Record<string, string> = {
    teacher: 'TEACHER',
    admin: 'PLATFORM ADMIN',
};

export default function TeacherProfile({ user, onBack, onLogout }: TeacherProfileProps) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [workspacesError, setWorkspacesError] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState({
        name: user.name,
        fieldOfInterest: user.fieldOfInterest ?? '',
        yearsOfExperience: user.yearsOfExperience ?? '',
        location: user.location ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await apiJson<{ workspaces: WorkspaceSummary[] }>(
                '/api/teacher/workspaces',
            );
            if (cancelled) return;
            if (result.ok) {
                setWorkspaces(result.data.workspaces ?? []);
            } else if (result.status !== 401 && result.status !== 403) {
                setWorkspacesError(result.detail);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const initials = user.name
        ? user.name
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? '')
              .join('') || user.name.charAt(0).toUpperCase()
        : (user.email[0]?.toUpperCase() ?? 'U');

    async function handleSave() {
        setSaving(true);
        setSaveError(null);
        const result = await apiJson<UserType>('/api/users/me', {
            method: 'PATCH',
            json: {
                name: draft.name.trim() || user.name,
                fieldOfInterest: draft.fieldOfInterest.trim() || null,
                yearsOfExperience: draft.yearsOfExperience.trim() || null,
                location: draft.location.trim() || null,
            },
        });
        setSaving(false);
        if (!result.ok) {
            setSaveError(result.detail);
            return;
        }
        setIsEditing(false);
        // Force a fresh server fetch so /api/users/me reads the new row.
        if (typeof window !== 'undefined') window.location.reload();
    }

    function cancelEdit() {
        setDraft({
            name: user.name,
            fieldOfInterest: user.fieldOfInterest ?? '',
            yearsOfExperience: user.yearsOfExperience ?? '',
            location: user.location ?? '',
        });
        setIsEditing(false);
        setSaveError(null);
    }

    return (
        <div className="bg-background text-foreground min-h-screen">
            <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
                <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="bg-card hover:bg-accent rounded-lg border p-2"
                            aria-label="Back"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <h1 className="text-base font-semibold tracking-tight">Profile</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() =>
                                setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                            }
                            className="bg-card hover:bg-accent rounded-lg border p-2"
                            aria-label="Toggle theme"
                        >
                            {mounted && resolvedTheme === 'dark' ? (
                                <Sun className="h-4 w-4" />
                            ) : (
                                <Moon className="h-4 w-4" />
                            )}
                        </button>
                        <Button variant="outline" size="sm" onClick={onLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </Button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
                <Card>
                    <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
                        <Avatar className="h-20 w-20 border">
                            <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold uppercase">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-xl font-semibold tracking-tight">
                                    {user.name || user.email}
                                </h2>
                                <Badge variant="secondary">
                                    {ROLE_BADGE_COPY[user.role] ?? user.role.toUpperCase()}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">{user.email}</p>
                            {!isEditing && (user.fieldOfInterest || user.location || user.yearsOfExperience) && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {user.fieldOfInterest && (
                                        <Badge variant="outline" className="font-normal">
                                            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                                            {user.fieldOfInterest}
                                        </Badge>
                                    )}
                                    {user.yearsOfExperience && (
                                        <Badge variant="outline" className="font-normal">
                                            <Briefcase className="mr-1.5 h-3.5 w-3.5" />
                                            {user.yearsOfExperience} yrs experience
                                        </Badge>
                                    )}
                                    {user.location && (
                                        <Badge variant="outline" className="font-normal">
                                            <MapPin className="mr-1.5 h-3.5 w-3.5" />
                                            {user.location}
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>
                        {!isEditing && (
                            <Button variant="outline" onClick={() => setIsEditing(true)}>
                                <Edit3 className="mr-2 h-4 w-4" />
                                Edit
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {isEditing && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Edit profile</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="profile-name">Name</Label>
                                    <Input
                                        id="profile-name"
                                        value={draft.name}
                                        onChange={(e) =>
                                            setDraft((d) => ({ ...d, name: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="profile-field">Subject focus</Label>
                                    <Input
                                        id="profile-field"
                                        value={draft.fieldOfInterest}
                                        onChange={(e) =>
                                            setDraft((d) => ({
                                                ...d,
                                                fieldOfInterest: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. Physics"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="profile-experience">
                                        Years of experience
                                    </Label>
                                    <Input
                                        id="profile-experience"
                                        value={draft.yearsOfExperience}
                                        onChange={(e) =>
                                            setDraft((d) => ({
                                                ...d,
                                                yearsOfExperience: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. 8"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="profile-location">Location</Label>
                                    <Input
                                        id="profile-location"
                                        value={draft.location}
                                        onChange={(e) =>
                                            setDraft((d) => ({ ...d, location: e.target.value }))
                                        }
                                        placeholder="e.g. Mumbai, India"
                                    />
                                </div>
                            </div>
                            {saveError && (
                                <p className="text-destructive text-sm" role="alert">
                                    {saveError}
                                </p>
                            )}
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    disabled={saving}
                                >
                                    <X className="mr-2 h-4 w-4" />
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    <Save className="mr-2 h-4 w-4" />
                                    {saving ? 'Saving…' : 'Save changes'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Workspaces</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {workspacesError && (
                            <p className="text-destructive text-sm" role="alert">
                                {workspacesError}
                            </p>
                        )}
                        {!workspacesError && workspaces.length === 0 && (
                            <p className="text-muted-foreground text-sm">
                                You are not a member of any workspace yet.
                            </p>
                        )}
                        {workspaces.map((m) => (
                            <a
                                key={m.workspaceId}
                                href={`/teacher/workspaces/${m.workspaceId}`}
                                className="hover:bg-accent flex items-center justify-between rounded-lg border p-4 transition"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">
                                            {m.workspace.displayName}
                                        </p>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide">
                                            {m.workspace.workspaceType} · {m.role} · {m.workspace.status}
                                        </p>
                                    </div>
                                </div>
                                <ChevronLeft className="text-muted-foreground h-4 w-4 rotate-180" />
                            </a>
                        ))}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
