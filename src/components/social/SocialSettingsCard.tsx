'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AtSign, Check, Loader2, Lock, Globe, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/AuthContext';
import { updateSocialSettingsAction } from '@/server/actions/social-actions';
import { normalizeUsername } from '@/server/social/username';
import { cn } from '@/lib/utils';

interface SocialSettingsCardProps {
  initialUsername: string;
  initialPrivate: boolean;
}

export default function SocialSettingsCard({ initialUsername, initialPrivate }: SocialSettingsCardProps) {
  const { refreshUser } = useAuth();
  const [username, setUsername] = useState(initialUsername);
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const [savedUsername, setSavedUsername] = useState(initialUsername);
  const [savedPrivate, setSavedPrivate] = useState(initialPrivate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = username !== savedUsername || isPrivate !== savedPrivate;

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      await updateSocialSettingsAction({ username, profilePrivate: isPrivate });
      setSavedUsername(username);
      setSavedPrivate(isPrivate);
      setJustSaved(true);
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <AtSign className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-black text-sm">Public Profile</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Your @handle and who can see your profile.</p>
        </div>
      </div>

      {/* Username */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Username</label>
        <div className="relative">
          <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={username}
            onChange={(e) => {
              setUsername(normalizeUsername(e.target.value));
              setJustSaved(false);
            }}
            maxLength={30}
            spellCheck={false}
            autoCapitalize="none"
            className="w-full h-11 pl-10 pr-3 rounded-xl bg-background/60 border border-border/60 text-sm font-bold outline-none focus:border-primary/50 transition-colors"
            placeholder="your_handle"
          />
        </div>
        {savedUsername && (
          <Link
            href={`/u/${savedUsername}`}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
          >
            View public profile
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Privacy toggle */}
      <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-background/40 border border-border/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', isPrivate ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500')}>
            {isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm">{isPrivate ? 'Private profile' : 'Public profile'}</p>
            <p className="text-xs text-muted-foreground">
              {isPrivate
                ? 'Only your name and @handle are visible to others.'
                : 'Other students can see your rank, badges and Activity Vault.'}
            </p>
          </div>
        </div>
        <Switch
          checked={isPrivate}
          onCheckedChange={(v) => {
            setIsPrivate(v);
            setJustSaved(false);
          }}
          aria-label="Private profile"
        />
      </div>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || saving} className="font-bold gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : justSaved ? <Check className="w-4 h-4" /> : null}
          {justSaved && !dirty ? 'Saved' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
