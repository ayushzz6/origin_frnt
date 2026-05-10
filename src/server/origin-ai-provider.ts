export interface OriginAiProviderRequest {
 systemInstruction: string;
 conversation: Array<{ role: "user" | "assistant"; content: string }>;
 requestId: string;
 maxOutputTokens?: number;
}

export interface OriginAiProviderResponse {
 content: string;
 provider: "origin_ai_service" | "local_fallback";
 model: string;
 metadata?: Record<string, unknown>;
}

export interface OriginAiLiveBootstrapRequest {
 systemInstruction: string;
 requestId: string;
}

export interface OriginAiLiveBootstrapResponse {
 provider: "gemini";
 transport: "server_voice";
 speechToTextModel: string;
 textToSpeechModel: string;
 voiceName: string;
}

export interface OriginAiVoiceTranscriptionResponse {
 transcript: string;
 provider: "origin_ai_service";
 model: string;
}

export interface OriginAiVoiceSynthesisResponse {
 data: string;
 mimeType: string;
 provider: "origin_ai_service";
 model: string;
 voiceName: string;
 duration?: number;
}

const DEFAULT_GEMINI_STT_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-pro-preview-tts";
const DEFAULT_GEMINI_LIVE_VOICE = "Aoede";
const DEFAULT_PROVIDER_TIMEOUT_MS = 45000;
const MAX_TTS_SEGMENT_CHARS = 4000;
const NON_LATIN_VOICE_SCRIPT_REGEX =
 /[\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Myanmar}\p{Script=Thai}\p{Script=Lao}\p{Script=Tibetan}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const META_VOICE_TRANSCRIPT_REGEX =
 /(^|[\r\n]+|\*\*)(analyzing the question|addressing the question|clarifying the query|acknowledging interruption|my focus is|my plan is|looks like it involves|i can see that(?: the)? user needs|i(?:'|’)ve understood|i plan to|i will now|i should give|i(?:'|’)ll start by|constraints)\b/i;

function providerTimeoutMs(): number {
 const raw = Number(process.env.ORIGIN_AI_PROVIDER_TIMEOUT_MS ?? "");
 if (Number.isFinite(raw) && raw > 0) {
 return raw;
 }
 return DEFAULT_PROVIDER_TIMEOUT_MS;
}

function cleanTextForSpeech(text: string): string {
 return text
 .replace(/\*\*(.*?)\*\*/g, "$1")
 .replace(/`([^`]+)`/g, "$1")
 .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
 .replace(/^\s*[-*]\s+/gm, "")
 .replace(/^\s*\d+\.\s+/gm, "")
 .replace(/\s+/g, " ")
 .trim();
}

function splitTextForSpeech(text: string): string[] {
 const cleaned = cleanTextForSpeech(text);
 if (!cleaned) {
 return [];
 }

 const sentences = cleaned
 .split(/(?<=[.!?])\s+/)
 .map((part) => part.trim())
 .filter(Boolean);

 if (sentences.length === 0) {
 return [cleaned];
 }

 const segments: string[] = [];
 let current = "";

 for (const sentence of sentences) {
 const next = current ? `${current} ${sentence}` : sentence;
 if (next.length <= MAX_TTS_SEGMENT_CHARS) {
 current = next;
 continue;
 }

 if (current) {
 segments.push(current);
 }

 if (sentence.length <= MAX_TTS_SEGMENT_CHARS) {
 current = sentence;
 continue;
 }

 const words = sentence.split(/\s+/).filter(Boolean);
 let chunk = "";
 for (const word of words) {
 const chunkNext = chunk ? `${chunk} ${word}` : word;
 if (chunkNext.length <= MAX_TTS_SEGMENT_CHARS) {
 chunk = chunkNext;
 continue;
 }
 if (chunk) {
 segments.push(chunk);
 }
 chunk = word;
 }
 current = chunk;
 }

 if (current) {
 segments.push(current);
 }

 return segments;
}

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
 let timeoutId: ReturnType<typeof setTimeout> | undefined;
 try {
 return await Promise.race([
 promise,
 new Promise<T>((_, reject) => {
 timeoutId = setTimeout(() => reject(new Error(message)), providerTimeoutMs());
 }),
 ]);
 } finally {
 if (timeoutId) {
 clearTimeout(timeoutId);
 }
 }
}

function originAiServiceEndpoint(path: string): string | null {
 const base = process.env.ORIGIN_AI_SERVICE_URL?.trim();
 if (!base) {
 return null;
 }
 return `${base.replace(/\/$/, "")}${path}`;
}

function originAiServiceHeaders(requestId: string): HeadersInit {
 const token = process.env.ORIGIN_AI_SERVICE_TOKEN?.trim();
 return {
 "content-type": "application/json",
 ...(token ? { Authorization: `Bearer ${token}` } : {}),
 "x-request-id": requestId,
 };
}

async function callExternalOriginAiService(
 payload: OriginAiProviderRequest,
): Promise<OriginAiProviderResponse | null> {
 const endpoint = originAiServiceEndpoint("/v1/origin-ai/respond");
 if (!endpoint) {
 return null;
 }

 try {
 const response = await withTimeout(fetch(endpoint, {
 method: "POST",
 headers: originAiServiceHeaders(payload.requestId),
 body: JSON.stringify(payload),
 }), "Origin AI service text provider timed out.");

 if (!response.ok) {
 return null;
 }

 const data = (await response.json()) as {
 content?: string;
 reply?: string;
 response?: string;
 model?: string;
 metadata?: Record<string, unknown>;
 };

 const content = data.content ?? data.reply ?? data.response ?? "";
 if (!content.trim()) {
 return null;
 }

 return {
 content: content.trim(),
 provider: "origin_ai_service",
 model: data.model?.trim() || "external-origin-ai-service",
 metadata: data.metadata ?? {},
 };
 } catch {
 return null;
 }
}

export async function generateOriginAiProviderReply(
 payload: OriginAiProviderRequest,
): Promise<OriginAiProviderResponse | null> {
 return callExternalOriginAiService(payload);
}

export async function normalizeVoiceTranscriptForChat(
 text: string,
 role: "user" | "assistant",
): Promise<string> {
 const cleaned = text.replace(/\*\*/g, "").trim();
 if (!cleaned) {
 return "";
 }

 const needsRomanization = NON_LATIN_VOICE_SCRIPT_REGEX.test(cleaned);
 const needsAssistantRewrite = role === "assistant" && META_VOICE_TRANSCRIPT_REGEX.test(cleaned);

 if (!needsRomanization && !needsAssistantRewrite) {
 return cleaned;
 }

 const prompt =
 role === "assistant"
 ? "Rewrite this spoken assistant transcript into a clean natural conversational reply. Remove internal planning, headings, meta analysis, and broken partial setup lines. Keep the meaning and guardrails. If the language is Hinglish, write it only in Roman script. Never use any non-Latin script, including Devanagari, Gujarati, Burmese, Thai, Urdu, or Arabic. Return only the cleaned transcript."
 : "Convert this spoken student transcript into natural Roman-script English or Hinglish only. Do not change the meaning. Keep question numbers, formulas, symbols, names, and technical terms intact. Never use any non-Latin script, including Devanagari, Gujarati, Burmese, Thai, Urdu, or Arabic. Return only the cleaned Roman-script transcript.";

 const rewritten = await callExternalOriginAiService({
 systemInstruction: prompt,
 conversation: [{ role: "user", content: cleaned }],
 requestId: `voice_transcript_normalize_${role}_${Date.now()}`,
 });

 return rewritten?.content.trim() || cleaned;
}

export async function createOriginAiLiveBootstrap(
 _payload: OriginAiLiveBootstrapRequest,
): Promise<OriginAiLiveBootstrapResponse> {
 void _payload;
 const voiceName = process.env.GEMINI_LIVE_VOICE_NAME?.trim() || DEFAULT_GEMINI_LIVE_VOICE;
 return {
 provider: "gemini",
 transport: "server_voice",
 speechToTextModel:
 process.env.GEMINI_STT_MODEL?.trim() ||
 process.env.GEMINI_MODEL?.trim() ||
 DEFAULT_GEMINI_STT_MODEL,
 textToSpeechModel: process.env.GEMINI_TTS_MODEL?.trim() || DEFAULT_GEMINI_TTS_MODEL,
 voiceName,
 };
}

export async function transcribeOriginAiVoiceAudio(
 audioData: string,
 mimeType: string,
 requestId: string,
): Promise<OriginAiVoiceTranscriptionResponse> {
 const endpoint = originAiServiceEndpoint("/v1/origin-ai/transcribe");
 if (!endpoint) {
 throw new Error("Origin AI service is not configured for voice transcription.");
 }

 const response = await withTimeout(fetch(endpoint, {
 method: "POST",
 headers: originAiServiceHeaders(requestId),
 body: JSON.stringify({ audioData, mimeType }),
 }), "Origin AI voice transcription timed out.");

 if (!response.ok) {
 throw new Error("Origin AI voice transcription service returned an error.");
 }

 const data = (await response.json()) as { transcript?: string; model?: string };
 const transcript = data.transcript?.trim() || "";
 if (!transcript) {
 throw new Error("Origin AI could not transcribe the voice message.");
 }

 return {
 transcript,
 provider: "origin_ai_service",
 model: data.model?.trim() || DEFAULT_GEMINI_STT_MODEL,
 };
}

export async function synthesizeOriginAiVoiceAudio(
 text: string,
 requestId: string,
 voiceNameOverride?: string | null,
): Promise<OriginAiVoiceSynthesisResponse> {
 const cleaned = cleanTextForSpeech(text);

 if (!cleaned) {
 throw new Error("Origin AI voice synthesis text is empty after cleaning.");
 }

 const endpoint = originAiServiceEndpoint("/v1/origin-ai/speak");
 if (!endpoint) {
 throw new Error("Origin AI service is not configured for voice synthesis.");
 }

 const voiceName = voiceNameOverride?.trim() || process.env.GEMINI_LIVE_VOICE_NAME?.trim() || DEFAULT_GEMINI_LIVE_VOICE;
 let response: Response;
 try {
 response = await withTimeout(
 fetch(endpoint, {
 method: "POST",
 headers: originAiServiceHeaders(requestId),
 body: JSON.stringify({ text: cleaned, voiceName }),
 }),
 "Origin AI voice synthesis timed out.",
 );
 } catch (error) {
 const detail = error instanceof Error ? error.message : String(error);
 console.error(
 `[OriginAI TTS] service synthesis failed (voice=${voiceName}, req=${requestId}): ${detail}`,
 );
 throw new Error(`Origin AI voice synthesis failed: ${detail}`);
 }

 if (!response.ok) {
 throw new Error("Origin AI voice synthesis service returned an error.");
 }

 const data = (await response.json()) as {
 voice_audio?: (Partial<OriginAiVoiceSynthesisResponse> & { mime_type?: string; voice_name?: string }) | null;
 voice_audio_segments?: Array<Partial<OriginAiVoiceSynthesisResponse> & { mime_type?: string; voice_name?: string }>;
 };
 const audio = data.voice_audio ?? data.voice_audio_segments?.find((segment) => segment.data);
 if (!audio?.data) {
 console.error(
 `[OriginAI TTS] No audio in service response (voice=${voiceName}, req=${requestId})`,
 );
 throw new Error("Origin AI could not extract audio from the synthesis response.");
 }

 return {
 data: audio.data ?? "",
 mimeType: audio.mimeType ?? audio.mime_type ?? "audio/wav",
 provider: "origin_ai_service",
 model: audio.model ?? DEFAULT_GEMINI_TTS_MODEL,
 voiceName: audio.voiceName ?? audio.voice_name ?? voiceName,
 duration: audio.duration ?? cleaned.length / 15,
 };
}

export async function synthesizeOriginAiVoiceAudioSegments(
 text: string,
 requestId: string,
 voiceNameOverride?: string | null,
): Promise<OriginAiVoiceSynthesisResponse[]> {
 const segments = splitTextForSpeech(text);
 if (segments.length === 0) {
 throw new Error("Origin AI voice synthesis text is empty.");
 }

 // Synthesize sequentially so a quota/rate error on segment N does not
 // also waste calls on segments N+1…M. The successfully synthesized
 // segments are still usable — the caller can play what we got and fall
 // back to browser speech for the remainder.
 const results: OriginAiVoiceSynthesisResponse[] = [];
 for (let i = 0; i < segments.length; i++) {
 try {
 const result = await synthesizeOriginAiVoiceAudio(
 segments[i]!,
 `${requestId}_${i + 1}`,
 voiceNameOverride,
 );
 results.push(result);
 } catch (error) {
 // If this is the first segment, re-throw so the caller knows
 // nothing was synthesized. Otherwise return what we have.
 if (results.length === 0) {
 throw error;
 }
 const detail = error instanceof Error ? error.message : String(error);
 console.warn(
 `[OriginAI TTS] Segment ${i + 1}/${segments.length} failed, returning ${results.length} completed segment(s): ${detail}`,
 );
 break;
 }
 }

 return results;
}
