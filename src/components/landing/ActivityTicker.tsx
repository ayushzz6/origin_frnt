'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface FeedEvent {
  emoji: string;
  text: string;
}

const FALLBACK: FeedEvent[] = [
  { emoji: '🔥', text: 'Aarav from Kota just hit a 21-day streak' },
  { emoji: '🧠', text: 'Priya solved a 3-star Irodov problem' },
  { emoji: '📈', text: "Rahul's predicted percentile rose to 98.2" },
  { emoji: '⚡', text: '14,203 doubts resolved today' },
  { emoji: '🎯', text: 'Sneha cracked a JEE-level electrostatics problem' },
  { emoji: '🏆', text: "Arjun topped this week's Physics leaderboard" },
  { emoji: '📚', text: '847 students completed their DPP today' },
  { emoji: '🔥', text: 'Meera extended her streak to 34 days' },
];

export default function ActivityTicker() {
  const [events, setEvents] = useState<FeedEvent[]>(FALLBACK);
  const trackRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    fetch('/api/public/activity-feed')
      .then((r) => r.json())
      .then((d) => { if (d.events?.length) setEvents(d.events); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || prefersReduced) return;

    const SPEED = 0.6; // px per frame (~36px/s at 60fps)

    function loop() {
      if (!pausedRef.current && track) {
        const singleWidth = track.scrollWidth / 2;
        xRef.current -= SPEED;
        if (Math.abs(xRef.current) >= singleWidth) xRef.current = 0;
        track.style.transform = `translateX(${xRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafRef.current);
  }, [events, prefersReduced]);

  const items = [...events, ...events]; // duplicate for seamless loop

  if (prefersReduced) {
    return (
      <div className="flex flex-wrap gap-3 justify-center px-4 py-3">
        {events.slice(0, 4).map((e, i) => (
          <span key={i} className="text-xs text-white/60">{e.emoji} {e.text}</span>
        ))}
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden py-3"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      aria-hidden="true"
    >
      {/* Fade edges */}
      <div className="absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-black/40 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-black/40 to-transparent z-10 pointer-events-none" />

      <div ref={trackRef} className="flex items-center gap-0 will-change-transform whitespace-nowrap">
        {items.map((event, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-6 text-xs font-medium text-white/70"
          >
            <span>{event.emoji}</span>
            <span>{event.text}</span>
            <span className="ml-4 text-white/20">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
