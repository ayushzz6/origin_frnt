import {
  getOriginAiVoiceBootstrap,
  sendOriginAiMessage,
  synthesizeOriginAiVoiceText,
  type OriginAiClientPageContext,
} from '@/features/origin-ai/client';
import type { OriginAiReply, OriginAiVoiceStatus } from '@/types';

export interface OriginAiVoiceCallbacks {
  onStatusChange?: (status: OriginAiVoiceStatus) => void;
  onUserTranscript?: (text: string) => void;
  onAssistantTranscript?: (text: string) => void;
  onReplyCommitted?: (reply: OriginAiReply) => void;
  onError?: (message: string) => void;
}

export interface OriginAiVoiceController {
  stop: () => Promise<void>;
  isActive: () => boolean;
}

interface SpeechRecognitionPipeline {
  stop: () => void;
  finalizeActivity: () => void;
}

interface AudioPlayer {
  enqueue: (base64Data: string, mimeType?: string | null) => Promise<void>;
  interrupt: () => void;
  isPlaying: () => boolean;
  close: () => Promise<void>;
}

const DEFAULT_OUTPUT_SAMPLE_RATE = 24000;
const ASSISTANT_PLAYBACK_GAP_GRACE_MS = 900;
const VOICE_RESPOND_TIMEOUT_MS = 25000;
const VOICE_SPEAK_TIMEOUT_MS = 80000;

function emitStatus(callbacks: OriginAiVoiceCallbacks, status: OriginAiVoiceStatus): void {
  callbacks.onStatusChange?.(status);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function base64ToBytes(base64Data: string): Uint8Array {
  const binary = window.atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function parseSampleRate(mimeType?: string | null): number {
  const match = mimeType?.match(/rate=(\d+)/i);
  return Number(match?.[1] || DEFAULT_OUTPUT_SAMPLE_RATE);
}

function pcmChunkToAudioBuffer(
  audioContext: AudioContext,
  base64Data: string,
  sampleRate: number,
  endian: 'big' | 'little',
): AudioBuffer | null {
  if (!base64Data.trim()) {
    return null;
  }

  const bytes = base64ToBytes(base64Data);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  if (sampleCount <= 0) {
    return null;
  }

  const buffer = audioContext.createBuffer(1, sampleCount, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const byteOffset = sampleIndex * 2;
    const first = bytes[byteOffset] ?? 0;
    const second = bytes[byteOffset + 1] ?? 0;
    const high = endian === 'big' ? first : second;
    const low = endian === 'big' ? second : first;
    let value = (high << 8) | low;
    if (value >= 0x8000) {
      value -= 0x10000;
    }
    channel[sampleIndex] = value / 0x8000;
  }

  return buffer;
}

async function decodeAudioBuffer(
  audioContext: AudioContext,
  base64Data: string,
  mimeType?: string | null,
): Promise<AudioBuffer | null> {
  if (!base64Data.trim()) {
    return null;
  }

  // Gemini TTS returns raw 16-bit little-endian PCM, even when the MIME is audio/L16.
  const normalizedMimeType = mimeType?.toLowerCase();
  const isRawPcm = normalizedMimeType?.includes('audio/pcm') || normalizedMimeType?.includes('audio/l16');
  if (isRawPcm) {
    return pcmChunkToAudioBuffer(audioContext, base64Data, parseSampleRate(mimeType), 'little');
  }

  const bytes = base64ToBytes(base64Data);
  const arrayBuffer = Uint8Array.from(bytes).buffer;
  return audioContext.decodeAudioData(arrayBuffer);
}

function createAudioPlayer(callbacks: OriginAiVoiceCallbacks, onIdle: () => void): AudioPlayer {
  const AudioContextCtor = window.AudioContext;
  const audioContext = new AudioContextCtor();
  const activeSources = new Set<AudioBufferSourceNode>();
  let nextPlaybackTime = 0;

  void audioContext.resume().catch(() => {
    // browser will retry on user interaction
  });

  return {
    enqueue: async (base64Data: string, mimeType?: string | null) => {
      const audioBuffer = await decodeAudioBuffer(audioContext, base64Data, mimeType);
      if (!audioBuffer) {
        return;
      }

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      const startAt = Math.max(audioContext.currentTime + 0.02, nextPlaybackTime || audioContext.currentTime + 0.02);
      nextPlaybackTime = startAt + audioBuffer.duration;
      activeSources.add(source);
      emitStatus(callbacks, 'speaking');

      source.onended = () => {
        activeSources.delete(source);
        source.disconnect();
        if (activeSources.size === 0) {
          nextPlaybackTime = audioContext.currentTime;
          onIdle();
        }
      };

      source.start(startAt);
    },
    interrupt: () => {
      for (const source of activeSources) {
        try {
          source.stop();
        } catch {
          // already stopped
        }
        source.disconnect();
      }
      activeSources.clear();
      nextPlaybackTime = audioContext.currentTime;
    },
    isPlaying: () => activeSources.size > 0 || nextPlaybackTime > audioContext.currentTime + 0.01,
    close: async () => {
      for (const source of activeSources) {
        try {
          source.stop();
        } catch {
          // ignore shutdown race
        }
        source.disconnect();
      }
      activeSources.clear();
      nextPlaybackTime = audioContext.currentTime;
      await audioContext.close();
    },
  };
}

function pickBrowserSpeechVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    return null;
  }

  // Prefer friendly male voices for a teacher-like tone
  const malePreferredNames = ['daniel', 'alex', 'aaron', 'arthur', 'fred', 'mark', 'tom', 'google uk english male', 'google us english male', 'oliver', 'george'];
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  const preferred =
    englishVoices.find((voice) =>
      malePreferredNames.some((name) => voice.name.toLowerCase().includes(name)),
    ) ?? englishVoices[0];

  return preferred ?? voices[0] ?? null;
}

async function speakWithBrowserFallback(text: string): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    return;
  }

  const cleanText = text.replace(/[*_#`~>]/g, '').trim();
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 0.92;
  const voice = pickBrowserSpeechVoice();
  if (voice) {
    utterance.voice = voice;
  }

  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      console.warn('[OriginAI Voice] Browser speech error:', e);
      reject(new Error('Origin AI browser speech fallback failed.'));
    };
    window.speechSynthesis.cancel();
    
    // Fix: Timeout prevents Mac/Safari from cancelling the utterance immediately after cancel()
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 50);
  });
}

/**
 * Split AI response text into TTS-friendly sentence chunks.
 * - Strips markdown formatting
 * - Merges very short fragments
 * - Caps each chunk at 250 chars
 * - Returns all chunks so spoken replies do not stop before the main explanation.
 */
function splitIntoTtsChunks(text: string): string[] {
  // Strip markdown and normalise whitespace
  const cleaned = text
    .replace(/[*_#`~>]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (!cleaned) return [];

  // Split on sentence-ending punctuation followed by whitespace or newline
  const raw = cleaned
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map((s) => s.trim())
    // Skip pure bullet-list lines like "1. " or "- " starters — they sound bad spoken
    .filter((s) => s.length > 3 && !/^[\-\d]+[\.\)]\s/.test(s));

  // Merge very short fragments into their neighbour, cap each chunk at 250 chars
  const merged: string[] = [];
  let buffer = '';
  for (const sentence of raw) {
    if (!buffer) {
      buffer = sentence.slice(0, 250);
    } else if (buffer.length < 25) {
      buffer = (buffer + ' ' + sentence).slice(0, 250);
    } else {
      merged.push(buffer);
      buffer = sentence.slice(0, 250);
    }
  }
  if (buffer) merged.push(buffer);

  return merged;
}


async function startSpeechRecognitionPipeline(

  isAssistantBusy: () => boolean,
  onUserTranscript: (text: string) => void,
  onUserTurnEnded: (text: string) => void,
): Promise<SpeechRecognitionPipeline> {
  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  if (!SpeechRecognitionCtor) {
    throw new Error('This browser does not support Web Speech API for voice mode. Please use Chrome, Edge or Safari.');
  }

  await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
    throw new Error('Microphone permission denied.');
  });

  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';
  let isActive = true;
  let silenceTimeout: ReturnType<typeof setTimeout> | null = null;

  const resetSilenceTimeout = () => {
    if (silenceTimeout) clearTimeout(silenceTimeout);
    silenceTimeout = setTimeout(() => {
      if (finalTranscript.trim()) {
        finishTurn();
      }
    }, 700); // 0.7s of silence triggers completion
  };

  const finishTurn = () => {
    if (silenceTimeout) clearTimeout(silenceTimeout);
    if (!finalTranscript.trim()) return;
    const textToSubmit = finalTranscript.trim();
    finalTranscript = '';
    onUserTurnEnded(textToSubmit);
  };

  recognition.onresult = (event: any) => {
    if (isAssistantBusy()) {
      finalTranscript = '';
      return;
    }

    let interimTranscript = '';
    let currentFinal = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        currentFinal += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (currentFinal) {
      finalTranscript += ' ' + currentFinal;
      finalTranscript = finalTranscript.trim();
    }

    onUserTranscript((finalTranscript + ' ' + interimTranscript).trim());
    resetSilenceTimeout();
  };

  recognition.onerror = (event: any) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    console.warn('[OriginAI Voice] Speech recognition error:', event.error);
  };

  recognition.onend = () => {
    if (isActive && !isAssistantBusy()) {
      try {
        recognition.start();
      } catch (e) {
        // ignore already started
      }
    }
  };

  try {
    recognition.start();
  } catch (e) {
    // ignore
  }

  return {
    stop: () => {
      isActive = false;
      if (silenceTimeout) clearTimeout(silenceTimeout);
      try {
        recognition.stop();
      } catch (e) {}
    },
    finalizeActivity: finishTurn,
  };
}

export async function startOriginAiVoiceMode(
  pageContext: OriginAiClientPageContext | undefined,
  getHighlightedText: () => string | null | undefined,
  callbacks: OriginAiVoiceCallbacks,
): Promise<OriginAiVoiceController> {
  // Warm up the speech synthesis engine synchronously with the user interaction
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const warmUp = new SpeechSynthesisUtterance('');
    warmUp.volume = 0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(warmUp);
  }

  emitStatus(callbacks, 'bootstrapping');
  const bootstrap = await getOriginAiVoiceBootstrap(pageContext);

  let isActive = true;
  let isAwaitingResponse = false;
  let speechRecognitionPipeline: SpeechRecognitionPipeline | null = null;
  let assistantPlaybackHoldUntil = 0;
  let isBrowserFallbackSpeaking = false;

  const maybeReturnToListening = () => {
    if (!isActive) {
      return;
    }
    if (isAwaitingResponse) {
      return;
    }
    if (audioPlayer.isPlaying()) {
      return;
    }
    if (isBrowserFallbackSpeaking) {
      return;
    }
    if (Date.now() < assistantPlaybackHoldUntil) {
      window.setTimeout(maybeReturnToListening, assistantPlaybackHoldUntil - Date.now());
      return;
    }
    emitStatus(callbacks, 'listening');
  };

  const audioPlayer = createAudioPlayer(callbacks, maybeReturnToListening);

  emitStatus(callbacks, 'connecting');

  speechRecognitionPipeline = await startSpeechRecognitionPipeline(
    () => isAwaitingResponse || audioPlayer.isPlaying() || Date.now() < assistantPlaybackHoldUntil,
    (interimText) => {
      if (!isAwaitingResponse) {
        callbacks.onUserTranscript?.(interimText);
      }
    },
    (finalText) => {
      if (!isActive || isAwaitingResponse) {
        return;
      }

      isAwaitingResponse = true;
      emitStatus(callbacks, 'thinking');

      void (async () => {
        try {
          const highlightedText = getHighlightedText();
          const reply = await withTimeout(
            sendOriginAiMessage(finalText, pageContext, highlightedText),
            VOICE_RESPOND_TIMEOUT_MS,
            'Origin AI took too long to prepare the voice reply.',
          );

          if (!isActive) {
            return;
          }

          callbacks.onUserTranscript?.(reply.userMessage.content);
          callbacks.onAssistantTranscript?.(reply.aiMessage.content);
          callbacks.onReplyCommitted?.(reply);

          // Emit 'speaking' so the UI reflects that TTS is in progress
          emitStatus(callbacks, 'speaking');

          if (!isActive) {
            return;
          }


          // ---------------------------------------------------------------
          // Pipelined TTS: split response into sentence chunks, fire all
          // synthesis requests simultaneously, then play each in order as
          // it arrives. The first sentence starts playing ~2-3s after the
          // text is ready instead of waiting for the entire reply to be
          // synthesized (~10-15s).
          // ---------------------------------------------------------------
          const sentences = splitIntoTtsChunks(reply.aiMessage.content);
          const fallbackText = reply.aiMessage.content;

          if (sentences.length === 0) {
            // Nothing to speak
          } else {
            // Fire all TTS requests in parallel
            const ttsPromises = sentences.map((sentence) =>
              synthesizeOriginAiVoiceText(sentence, bootstrap.voice.voiceName).catch((err) => {
                console.warn('[OriginAI Voice] TTS chunk failed:', sentence.slice(0, 40), err);
                return null;
              }),
            );

            let anyAudioPlayed = false;
            assistantPlaybackHoldUntil = Date.now() + ASSISTANT_PLAYBACK_GAP_GRACE_MS;

            // Await and enqueue each chunk IN ORDER (not as each resolves)
            // This ensures gapless sequential playback even if a later chunk
            // arrives before an earlier one.
            for (const promise of ttsPromises) {
              if (!isActive) break;
              const speakResponse = await promise;
              if (!speakResponse) continue;

              const segments =
                speakResponse.voiceAudioSegments && speakResponse.voiceAudioSegments.length > 0
                  ? speakResponse.voiceAudioSegments
                  : speakResponse.voiceAudio
                    ? [speakResponse.voiceAudio]
                    : [];

              for (const segment of segments) {
                if (segment?.data) {
                  await audioPlayer.enqueue(segment.data, segment.mimeType);
                  anyAudioPlayed = true;
                }
              }
            }

            if (!isActive) {
              return;
            }

            // If no audio was produced at all, fall back to browser TTS
            if (!anyAudioPlayed && fallbackText.trim()) {
              isBrowserFallbackSpeaking = true;
              emitStatus(callbacks, 'speaking');
              try {
                await speakWithBrowserFallback(fallbackText);
              } catch {
                // Ignore fallback speech errors; the text reply is already visible.
              } finally {
                isBrowserFallbackSpeaking = false;
              }
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Origin AI voice mode could not finish the turn.';
          callbacks.onError?.(message);
        } finally {
          isAwaitingResponse = false;
          maybeReturnToListening();
        }
      })();
    },
  );

  emitStatus(callbacks, 'listening');

  return {
    stop: async () => {
      if (!isActive) {
        return;
      }

      isActive = false;
      isAwaitingResponse = false;

      try {
        audioPlayer.interrupt();
      } catch {
        // ignore shutdown race
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      isBrowserFallbackSpeaking = false;

      if (speechRecognitionPipeline) {
        try {
          speechRecognitionPipeline.stop();
        } catch {
          // ignore shutdown race
        }
      }

      await audioPlayer.close();
      emitStatus(callbacks, 'idle');
    },
    isActive: () => isActive,
  };
}