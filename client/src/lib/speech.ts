// Simple wrapper for Web Speech API
// Handles browser differences and provides a clean interface

import { hasElevenLabsKey, elevenSpeak } from "./tts";

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error';

export class SpeechManager {
  recognition: any = null;
  continuous: boolean = false;
  shouldStop: boolean = false;
  currentLang: string = 'en-US';
  voices: SpeechSynthesisVoice[] = [];
  voicesWarmed: boolean = false;
  
  constructor() {
    if (typeof window !== 'undefined') {
      if ('webkitSpeechRecognition' in window) {
        // @ts-ignore
        this.recognition = new window.webkitSpeechRecognition();
      } else if ('SpeechRecognition' in window) {
        // @ts-ignore
        this.recognition = new window.SpeechRecognition();
      }
      
      if (this.recognition) {
        this.recognition.continuous = this.continuous;
        this.recognition.interimResults = true;
        this.recognition.lang = this.currentLang;
      }

      if ('speechSynthesis' in window) {
        this.warmVoices();
      }
    }
  }

  setContinuous(enabled: boolean) {
    this.continuous = enabled;
    if (this.recognition) {
      this.recognition.continuous = enabled;
    }
  }

  setLanguage(lang: string) {
    this.currentLang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  start(
    onResult: (text: string, isFinal: boolean) => void,
    onEnd: () => void,
    onError: (error: any) => void
  ) {
    if (!this.recognition) {
      onError('Speech recognition not supported in this browser');
      return;
    }

    this.shouldStop = false;

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // If continuous, we might want to just send the latest chunk
      // But for this simple implementation, let's just send what we have
      const text = finalTranscript || interimTranscript;
      const isFinal = !!finalTranscript;
      
      onResult(text, isFinal);
    };

    this.recognition.onend = () => {
      if (this.continuous && !this.shouldStop) {
        try {
          this.recognition.start();
        } catch (e) {
          onError(e);
        }
        return;
      }

      onEnd();
    };

    this.recognition.onerror = (event: any) => {
      onError(event.error);
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error('Speech recognition start error:', e);
      onError(e);
    }
  }

  stop() {
    this.shouldStop = true;
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  private warmVoices() {
    this.voices = window.speechSynthesis.getVoices();
    if (this.voices.length === 0) {
      // Trigger async load
      window.speechSynthesis.onvoiceschanged = () => {
        this.voices = window.speechSynthesis.getVoices();
        this.voicesWarmed = true;
      };
    } else {
      this.voicesWarmed = true;
    }
  }

  // Prefer richer voices (Google/Wavenet/Premium) matching the target language
  private pickVoice(lang: string) {
    const iso = lang.split('-')[0];
    const preferredVendors = ["Google", "Wavenet", "Premium", "Cloud"];

    const matches = (voice: SpeechSynthesisVoice) =>
      voice.lang === lang ||
      voice.lang.toLowerCase() === lang.toLowerCase() ||
      voice.lang.startsWith(`${iso}-`) ||
      voice.lang.startsWith(iso);

    const vendorBoost = (voice: SpeechSynthesisVoice) =>
      preferredVendors.some(v => voice.name.includes(v));

    const candidates = this.voices.filter(matches);
    const boosted = candidates.find(vendorBoost);
    if (boosted) return boosted;
    if (candidates.length > 0) return candidates[0];

    const fallback = this.voices.find(vendorBoost);
    if (fallback) return fallback;

    return this.voices.find(v => v.default) || this.voices[0];
  }

  // Slight pacing tweak by language family to reduce robotic feel
  private getPacingForLang(lang: string) {
    const iso = lang.split('-')[0];
    const gentle = { rate: 0.97, pitch: 1.02 };
    const snappier = { rate: 1.02, pitch: 1.0 };
    const lowerPitch = { rate: 0.98, pitch: 0.96 };

    if (["ja", "zh", "ko"].includes(iso)) return snappier;
    if (["de", "ru", "pl", "nl"].includes(iso)) return lowerPitch;
    return gentle;
  }

  async speak(text: string, lang: string = 'en-US') {
    if (!text) return;

    if (hasElevenLabsKey()) {
      try {
        await elevenSpeak(text, lang);
        return;
      } catch (err) {
        console.error('ElevenLabs speak failed (no browser fallback to avoid robotic voice):', err);
        return;
      }
    }

    this.speakWithBrowser(text, lang);
  }

  private speakWithBrowser(text: string, lang: string) {
    if (!('speechSynthesis' in window)) return;
    // Cancel current speech if any
    window.speechSynthesis.cancel();
    if (!this.voicesWarmed || this.voices.length === 0) {
      this.warmVoices();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const pacing = this.getPacingForLang(lang);
    utterance.rate = pacing.rate;
    utterance.pitch = pacing.pitch;
    utterance.volume = 1.0;

    const voice = this.pickVoice(lang);

    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  }
}
