const DEFAULT_PUBLIC_SITE_URL = "https://www.o3origin.com";
const CANONICAL_HOST = "www.o3origin.com";
const APEX_HOST = "o3origin.com";
const CANONICAL_HOSTS = new Set([APEX_HOST, CANONICAL_HOST]);

export function getCanonicalSiteUrl(rawUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  const candidate = rawUrl?.trim() || DEFAULT_PUBLIC_SITE_URL;
  const normalizedCandidate = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const url = new URL(normalizedCandidate);
    if (!CANONICAL_HOSTS.has(url.hostname)) {
      return DEFAULT_PUBLIC_SITE_URL;
    }
    url.protocol = "https:";
    url.hostname = CANONICAL_HOST;
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/u, "");
  } catch {
    return DEFAULT_PUBLIC_SITE_URL;
  }
}
