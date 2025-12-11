import { Capacitor } from "@capacitor/core";
import { NativeAudio } from "@capacitor-community/native-audio";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const apiKey =
  import.meta.env.VITE_ELEVENLABS_API_KEY ||
  // fallback provided by user (better to move to env)
  "sk_cede2d533c34f96118a0ddc1832296b2585f99c86fb22c54";

// Language → voice mapping tuned for clarity; falls back to default if missing.
const VOICE_MAP: Record<string, string> = {
  en: "JBFqnCBsd6RMkjVDRZzb", // Adam (Eleven Labs sample)
  es: "EXAVITQu4vr4xnSDxMaL", // Bella
  fr: "TxGEqnHWrfWFTfGW9XjX",
  de: "VR6AewLTigWG4xSOukaG",
  it: "qvyoSlaC5qJvGN0p2Z8I",
  pt: "pqHfZKP75CvOlQylNhV4",
  // Use a widely-available voice for Russian to avoid missing IDs
  ru: "EXAVITQu4vr4xnSDxMaL",
  he: "EXAVITQu4vr4xnSDxMaL", // fallback voice with language_code=he
  ja: "yoZ06aMxZJJ28mfd3POQ",
  ko: "A0oDE3VSIQsPE0WR5kbJ",
  zh: "ThT5KcBeYPX3keUQqHPh",
  ar: "JBFqnCBsd6RMkjVDRZzb",
  bg: "JBFqnCBsd6RMkjVDRZzb",
  ca: "JBFqnCBsd6RMkjVDRZzb",
  cs: "JBFqnCBsd6RMkjVDRZzb",
  da: "JBFqnCBsd6RMkjVDRZzb",
  nl: "JBFqnCBsd6RMkjVDRZzb",
  fi: "JBFqnCBsd6RMkjVDRZzb",
  el: "JBFqnCBsd6RMkjVDRZzb",
  hi: "JBFqnCBsd6RMkjVDRZzb",
  hu: "JBFqnCBsd6RMkjVDRZzb",
  id: "JBFqnCBsd6RMkjVDRZzb",
  ms: "JBFqnCBsd6RMkjVDRZzb",
  no: "JBFqnCBsd6RMkjVDRZzb",
  pl: "JBFqnCBsd6RMkjVDRZzb",
  ro: "JBFqnCBsd6RMkjVDRZzb",
  sr: "JBFqnCBsd6RMkjVDRZzb",
  sk: "JBFqnCBsd6RMkjVDRZzb",
  sv: "JBFqnCBsd6RMkjVDRZzb",
  th: "JBFqnCBsd6RMkjVDRZzb",
  tr: "JBFqnCBsd6RMkjVDRZzb",
  uk: "JBFqnCBsd6RMkjVDRZzb",
  vi: "JBFqnCBsd6RMkjVDRZzb",
  default: "JBFqnCBsd6RMkjVDRZzb",
};

let client: ElevenLabsClient | null = null;

export function hasElevenLabsKey() {
  return Boolean(apiKey);
}

function voiceForLang(lang: string) {
  const iso = (lang || "en").split("-")[0];
  const overrideKey = `VITE_ELEVENLABS_VOICE_${iso.toUpperCase()}`;
  const override =
    (import.meta as any)?.env?.[overrideKey] ||
    (typeof process !== "undefined" ? (process as any)?.env?.[overrideKey] : undefined);
  if (override) return override as string;
  return VOICE_MAP[iso] || VOICE_MAP.default;
}

function languageCodeFor(lang: string) {
  return (lang || "en").split("-")[0] || "en";
}

let audioCtx: AudioContext | null = null;

async function playArrayBuffer(buffer: ArrayBuffer, contentType: string) {
  // Native path for iOS to avoid WKWebView audio issues
  if (Capacitor.isNativePlatform()) {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const decoded = await audioCtx.decodeAudioData(buffer.slice(0));
      const durationMs = decoded.duration * 1000 + 500;

      const base64 = arrayBufferToBase64(buffer);
      const assetId = `tts-${Date.now()}`;
      const fileName = `${assetId}.mp3`;
      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });
      const uriResult = await Filesystem.getUri({
        directory: Directory.Cache,
        path: fileName,
      });
      const assetPath = uriResult.uri;
      console.log("Playing TTS via NativeAudio:", { assetPath });

      await NativeAudio.preload({
        assetId,
        assetPath,
        audioChannelNum: 1,
        isUrl: true,
      });
      await NativeAudio.play({ assetId, time: 0 });
      // Wait for playback duration before unloading/deleting
      await new Promise((res) => setTimeout(res, durationMs));
      await NativeAudio.unload({ assetId });
      await Filesystem.deleteFile({ directory: Directory.Cache, path: fileName });
      return;
    } catch (err) {
      console.error("Native audio playback failed, falling back to WebView:", err);
    }
  }

  // Prefer Web Audio (less likely to be blocked by autoplay policies after user gesture)
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    await audioCtx.resume();
    const decoded = await audioCtx.decodeAudioData(buffer.slice(0));
    const source = audioCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(audioCtx.destination);
    source.start(0);
    return;
  } catch (err) {
    console.warn("Web Audio playback failed, falling back to HTMLAudio:", err);
  }

  const blob = new Blob([buffer], { type: contentType || "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  try {
    await audio.play();
  } catch (err) {
    console.error("HTMLAudio playback failed:", err);
  }
  URL.revokeObjectURL(url);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

async function speakViaRest(text: string, lang: string) {
  const languageCode = languageCodeFor(lang);

  const makeEndpoint = (voiceId: string) =>
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

  const payload = (modelId: string, withLang: boolean) => ({
    text,
    model_id: modelId,
    output_format: "mp3_44100_128",
    ...(withLang ? { language_code: languageCode } : {}),
    voice_settings: {
      stability: 0.35,
      similarity_boost: 0.9,
      style: 0.55,
      use_speaker_boost: true,
    },
  });

  const tryRequest = async (voiceId: string, modelId: string, withLang: boolean) => {
    const res = await fetch(makeEndpoint(voiceId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(payload(modelId, withLang)),
    });

    if (!res.ok) {
      const message = await res.text().catch(() => "Unknown error");
      throw new Error(`REST ${modelId} failed: ${res.status} ${message}`);
    }

    const buffer = await res.arrayBuffer();
    await playArrayBuffer(buffer, res.headers.get("Content-Type") || "audio/mpeg");
  };

  const primaryVoice = voiceForLang(lang);
  const fallbackVoice = VOICE_MAP.default;

  try {
    // Try turbo with explicit language
    await tryRequest(primaryVoice, "eleven_turbo_v2_5", true);
  } catch (e1: any) {
    const msg = String(e1?.message || "");
    if (msg.includes("voice_not_found") && primaryVoice !== fallbackVoice) {
      console.warn("Primary voice missing, retrying with default voice (REST)");
      await tryRequest(fallbackVoice, "eleven_turbo_v2_5", true);
      return;
    }
    console.warn("Turbo (REST) failed, retrying multilingual v2 without language_code", e1);
    await tryRequest(primaryVoice, "eleven_multilingual_v2", false);
  }
}

async function speakViaSdk(text: string, lang: string) {
  if (!client) client = new ElevenLabsClient({ apiKey });
  const voiceId = voiceForLang(lang);
  const languageCode = languageCodeFor(lang);
  try {
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: "eleven_turbo_v2_5",
      outputFormat: "mp3_44100_128",
      languageCode,
      voiceSettings: {
        stability: 0.35,
        similarityBoost: 0.9,
        style: 0.55,
        useSpeakerBoost: true,
      },
    });
    const buffer = await streamToArrayBuffer(audioStream as unknown as ReadableStream<Uint8Array>);
    await playArrayBuffer(buffer, "audio/mpeg");
  } catch (e1: any) {
    const msg = String(e1?.message || "");
    if (msg.includes("voice_not_found") && voiceId !== VOICE_MAP.default) {
      console.warn("Primary voice missing, retrying with default voice (SDK)");
      const audioStream = await client.textToSpeech.convert(VOICE_MAP.default, {
        text,
        modelId: "eleven_turbo_v2_5",
        outputFormat: "mp3_44100_128",
        languageCode,
        voiceSettings: {
          stability: 0.35,
          similarityBoost: 0.9,
          style: 0.55,
          useSpeakerBoost: true,
        },
      });
      const buffer = await streamToArrayBuffer(audioStream as unknown as ReadableStream<Uint8Array>);
      await playArrayBuffer(buffer, "audio/mpeg");
      return;
    }

    console.warn("Turbo (SDK) failed, retrying multilingual v2", e1);
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
      voiceSettings: {
        stability: 0.35,
        similarityBoost: 0.9,
        style: 0.55,
        useSpeakerBoost: true,
      },
    });
    const buffer = await streamToArrayBuffer(audioStream as unknown as ReadableStream<Uint8Array>);
    await playArrayBuffer(buffer, "audio/mpeg");
  }
}

export async function elevenSpeak(text: string, lang: string) {
  if (!apiKey) throw new Error("Missing ElevenLabs API key");
  console.log("[ElevenLabs] speak start", { lang, len: text.length });
  // Try REST (works reliably in browser with CORS), fallback to SDK/play helper.
  try {
    await speakViaRest(text, lang);
    console.log("[ElevenLabs] speak via REST success");
    return;
  } catch (restErr) {
    console.warn("ElevenLabs REST failed, trying SDK:", restErr);
  }

  await speakViaSdk(text, lang);
  console.log("[ElevenLabs] speak via SDK success");
}
