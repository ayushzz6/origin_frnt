'use client';

/**
 * Study Music — Spotify player for the Pomodoro page.
 *
 * A plain Spotify embed iframe (reliable, no JS API). The student plays music
 * by pasting any Spotify link; the embed handles its own play/pause controls.
 *
 * Note: Spotify embeds play 30-second previews for logged-out listeners; a
 * student logged into Spotify in the same browser gets full songs.
 */

import { useState } from 'react';
import { Music, Link2 } from 'lucide-react';
import { toast } from 'sonner';

// Default embed: a lofi study playlist.
const DEFAULT_EMBED = { type: 'playlist', id: '0vvXsWCC9xrXsKd4FyS8kM' };

// Parse any Spotify share link / URI into an embeddable { type, id }.
// Handles open.spotify.com URLs (incl. /intl-xx/ locale prefixes and ?si= params)
// and spotify:track:ID style URIs.
function parseSpotifyLink(input: string): { type: string; id: string } | null {
  const match = input
    .trim()
    .match(/(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?|spotify:)(track|playlist|album|artist|show|episode)[/:]([A-Za-z0-9]+)/i);
  if (!match) return null;
  return { type: match[1].toLowerCase(), id: match[2] };
}

export default function StudyMusicPlayer() {
  const [embed, setEmbed] = useState<{ type: string; id: string }>(DEFAULT_EMBED);
  const [query, setQuery] = useState('');

  const handleLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseSpotifyLink(query);
    if (!parsed) {
      toast.error('Paste a valid Spotify link (Share → Copy link).');
      return;
    }
    setEmbed(parsed);
    setQuery('');
  };

  return (
    <div>
      {/* Spotify player */}
      <iframe
        key={`${embed.type}-${embed.id}`}
        title="Spotify player"
        src={`https://open.spotify.com/embed/${embed.type}/${embed.id}?utm_source=generator&theme=0`}
        width="100%"
        height={embed.type === 'track' ? 152 : 352}
        className="rounded-2xl"
        style={{ border: 0 }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />

      {/* Paste a Spotify link */}
      <form onSubmit={handleLoad} className="relative mt-3">
        <Link2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Paste a Spotify link…"
          className="w-full rounded-2xl border border-border/40 bg-white/60 py-2.5 pl-9 pr-3 text-xs font-bold text-slate-700 placeholder:font-medium placeholder:text-slate-400 focus:border-primary/40 focus:outline-none dark:bg-slate-900/40 dark:text-slate-200"
        />
      </form>
      <p className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold leading-relaxed text-slate-400">
        <Music className="h-3 w-3 shrink-0" />
        In Spotify: Share → Copy link, then paste here. Log in to Spotify for full songs (otherwise 30s previews).
      </p>
    </div>
  );
}
