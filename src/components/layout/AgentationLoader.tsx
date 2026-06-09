'use client';
import dynamic from 'next/dynamic';

// Loaded dynamically with ssr:false so it never runs during Next.js builds.
// The parent (layout.tsx) wraps this in process.env.NODE_ENV === 'development'
// so Webpack dead-code-eliminates the entire import chain in production — zero
// bytes shipped to the browser.
const AgentationTool = dynamic(
  () => import('agentation').then(mod => ({ default: mod.Agentation })),
  { ssr: false }
);

export default function AgentationLoader() {
  return <AgentationTool />;
}
