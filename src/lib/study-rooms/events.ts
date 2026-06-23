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
  // Live presence (Teacher Live Rooms): when the participant first opened the
  // test surface, and their most recent heartbeat. Both nullable + optional so
  // pre-migration rows and older clients still validate.
  entered_test_at: z.string().nullable().optional().default(null),
  last_seen_at: z.string().nullable().optional().default(null),
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
  | { type: "room_closed" }
  // Ephemeral "who is typing" ping (WhatsApp-style). Never persisted; debounced
  // on the client and auto-expired by the reducer.
  | { type: "typing"; user_id: string; display_name: string; is_typing: boolean };

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
  z.object({ type: z.literal("typing"), user_id: z.string(), display_name: z.string(), is_typing: z.boolean() }),
]);

export function parseRoomEvent(value: unknown): RoomEvent | null {
  const result = roomEventSchema.safeParse(value);
  return result.success ? result.data : null;
}
