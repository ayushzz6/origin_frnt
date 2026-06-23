/**
 * Teacher Live Rooms — participant search provider.
 *
 * Search is abstracted behind a small interface so the backend can change
 * without touching the route or UI. The default implementation is Postgres
 * (pg_trgm-accelerated ILIKE) which runs natively on the current Vercel + Neon
 * pipeline with no extra infrastructure. If institution-wide search ever needs
 * a dedicated engine, drop in a managed Elasticsearch/OpenSearch implementation
 * on GCP (alongside the other microservices) behind this same interface — the
 * route below and the UI stay unchanged.
 */

import { searchRoomParticipants } from "@/server/study-rooms";
import type { ParticipantSummary } from "@/lib/study-rooms/events";

export interface ParticipantSearchProvider {
  search(roomId: string, query: string, limit?: number): Promise<ParticipantSummary[]>;
}

const postgresParticipantSearch: ParticipantSearchProvider = {
  search: (roomId, query, limit) => searchRoomParticipants(roomId, query, limit),
};

export function getParticipantSearchProvider(): ParticipantSearchProvider {
  // Swap this for an Elasticsearch-backed provider (GCP) when search must span
  // more than a single room's participants.
  return postgresParticipantSearch;
}
