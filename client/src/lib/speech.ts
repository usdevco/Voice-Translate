// Simple wrapper for Web Speech API
// Handles browser differences and provides a clean interface

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error';

export class SpeechManager {
  recognition: any = null;
  continuous: boolean = false;
  
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
        this.recognition.lang = 'en-US';
      }
    }
  }

  setContinuous(enabled: boolean) {
    this.continuous = enabled;
    if (this.recognition) {
      this.recognition.continuous = enabled;
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
      // If continuous mode is on, we might want to restart?
      // Actually, standard continuous mode keeps going until stopped or silence timeout
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
      // Cancel current speech if any
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }
}
