export type MetricTags = Record<string, string | number | boolean | null | undefined>;

type MetricPayload = {
  name: string;
  tags: Record<string, string>;
  timestamp: string;
};

function normalizeTags(tags: MetricTags = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tags)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

export function metric(name: string, tags: MetricTags = {}): void {
  if (process.env.NODE_ENV !== "production") return;

  const endpoint = process.env.METRICS_OTLP_HTTP_ENDPOINT;
  if (!endpoint) return;

  const payload: MetricPayload = {
    name,
    tags: normalizeTags(tags),
    timestamp: new Date().toISOString(),
  };

  void fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.METRICS_OTLP_HTTP_TOKEN
        ? { Authorization: `Bearer ${process.env.METRICS_OTLP_HTTP_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => undefined);
}
