// Simple wrapper for Web Speech API
// Handles browser differences and provides a clean interface

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error';

export class SpeechManager {
  recognition: any = null;
  
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
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
      }
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

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.resultIndex];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      onResult(transcript, isFinal);
    };

    this.recognition.onend = () => {
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
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  speak(text: string, lang: string = 'en-US') {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      window.speechSynthesis.speak(utterance);
    }
  }
}
