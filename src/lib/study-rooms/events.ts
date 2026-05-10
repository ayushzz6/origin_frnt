import { z } from "zod";

export const participantSummarySchema = z.object({
  room_id: z.string(),
  user_id: z.string(),
  display_name: z.string(),
  role: z.enum(["admin", "participant"]),
  joined_at: z.string(),
  left_at: z.string().nullable(),
  kicked: z.boolean(),
  finished_at: z.string().nullable(),
  score: z.number().nullable(),
  rank: z.number().nullable(),
  time_taken_seconds: z.number().nullable(),
  test_result_id: z.string().nullable(),
  auto_submitted: z.boolean(),
});

export const roomMessageSchema = z.object({
  id: z.number(),
  room_id: z.string(),
  user_id: z.string(),
  display_name: z.string(),
  content: z.string(),
  created_at: z.string(),
});

export type ParticipantSummary = z.infer<typeof participantSummarySchema>;
export type RoomMessage = z.infer<typeof roomMessageSchema>;

export type RoomEvent =
  | { type: "presence"; participants: ParticipantSummary[] }
  | { type: "chat"; message: RoomMessage }
  | { type: "admin_changed"; new_admin_user_id: string }
  | { type: "kicked"; user_id: string }
  | { type: "test_configured"; custom_test_id: string }
  | {
      type: "test_started";
      custom_test_id: string;
      started_at: string;
      duration_seconds: number;
      server_emit_ts: number;
    }
  | { type: "participant_finished"; user_id: string; rank?: number }
  | { type: "test_ended"; ended_at: string }
  | { type: "room_closed" };

export const roomEventSchema: z.ZodType<RoomEvent> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("presence"), participants: z.array(participantSummarySchema) }),
  z.object({ type: z.literal("chat"), message: roomMessageSchema }),
  z.object({ type: z.literal("admin_changed"), new_admin_user_id: z.string() }),
  z.object({ type: z.literal("kicked"), user_id: z.string() }),
  z.object({ type: z.literal("test_configured"), custom_test_id: z.string() }),
  z.object({
    type: z.literal("test_started"),
    custom_test_id: z.string(),
    started_at: z.string(),
    duration_seconds: z.number(),
    server_emit_ts: z.number(),
  }),
  z.object({ type: z.literal("participant_finished"), user_id: z.string(), rank: z.number().optional() }),
  z.object({ type: z.literal("test_ended"), ended_at: z.string() }),
  z.object({ type: z.literal("room_closed") }),
]);

export function parseRoomEvent(value: unknown): RoomEvent | null {
  const result = roomEventSchema.safeParse(value);
  return result.success ? result.data : null;
}
