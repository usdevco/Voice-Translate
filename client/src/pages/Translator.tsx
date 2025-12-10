import React, { useState, useEffect, useRef } from "react";
import { SpeechManager } from "@/lib/speech";
import { SpeechVisualizer } from "@/components/SpeechVisualizer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Mic, Globe, RefreshCw, Volume2, Copy, ArrowRightLeft, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import soundWaveBg from "@assets/generated_images/abstract_neon_sound_waves_on_dark_background.png";

// Comprehensive Mock Translation Logic
// In a real app, this would use Google Translate API or similar
const LANGUAGES = [
  { code: "af-ZA", name: "Afrikaans", flag: "🇿🇦" },
  { code: "ar-SA", name: "Arabic", flag: "🇸🇦" },
  { code: "bg-BG", name: "Bulgarian", flag: "🇧🇬" },
  { code: "ca-ES", name: "Catalan", flag: "🇪🇸" },
  { code: "zh-CN", name: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "zh-TW", name: "Chinese (Traditional)", flag: "🇹🇼" },
  { code: "cs-CZ", name: "Czech", flag: "🇨🇿" },
  { code: "da-DK", name: "Danish", flag: "🇩🇰" },
  { code: "nl-NL", name: "Dutch", flag: "🇳🇱" },
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "fi-FI", name: "Finnish", flag: "🇫🇮" },
  { code: "fr-FR", name: "French", flag: "🇫🇷" },
  { code: "de-DE", name: "German", flag: "🇩🇪" },
  { code: "el-GR", name: "Greek", flag: "🇬🇷" },
  { code: "he-IL", name: "Hebrew", flag: "🇮🇱" },
  { code: "hi-IN", name: "Hindi", flag: "🇮🇳" },
  { code: "hu-HU", name: "Hungarian", flag: "🇭🇺" },
  { code: "id-ID", name: "Indonesian", flag: "🇮🇩" },
  { code: "it-IT", name: "Italian", flag: "🇮🇹" },
  { code: "ja-JP", name: "Japanese", flag: "🇯🇵" },
  { code: "ko-KR", name: "Korean", flag: "🇰🇷" },
  { code: "ms-MY", name: "Malay", flag: "🇲🇾" },
  { code: "no-NO", name: "Norwegian", flag: "🇳🇴" },
  { code: "pl-PL", name: "Polish", flag: "🇵🇱" },
  { code: "pt-PT", name: "Portuguese", flag: "🇵🇹" },
  { code: "ro-RO", name: "Romanian", flag: "🇷🇴" },
  { code: "ru-RU", name: "Russian", flag: "🇷🇺" },
  { code: "sr-RS", name: "Serbian", flag: "🇷🇸" },
  { code: "sk-SK", name: "Slovak", flag: "🇸🇰" },
  { code: "es-ES", name: "Spanish", flag: "🇪🇸" },
  { code: "sv-SE", name: "Swedish", flag: "🇸🇪" },
  { code: "th-TH", name: "Thai", flag: "🇹🇭" },
  { code: "tr-TR", name: "Turkish", flag: "🇹🇷" },
  { code: "uk-UA", name: "Ukrainian", flag: "🇺🇦" },
  { code: "vi-VN", name: "Vietnamese", flag: "🇻🇳" },
];

export default function Translator() {
  const [isListening, setIsListening] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState("en-US");
  const [targetLang, setTargetLang] = useState("ru-RU"); // Default to user request
  
  // New features
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [continuousMode, setContinuousMode] = useState(false);

  const speechManager = useRef(new SpeechManager());
  const lastSpokenRef = useRef("");
  const lastSpokenAtRef = useRef(0);
  const translationAbortRef = useRef<AbortController | null>(null);
  const translationRequestId = useRef(0);
  const { toast } = useToast();

  const MIN_SPEAK_GAP_MS = 1500;
  const MIN_CHARS_TO_SPEAK = 6;

  const getIsoLang = (code: string) => code.split("-")[0] || code;

  const mockTranslate = (text: string, target: string) => {
    if (!text) return "";
    const targetLangObj = LANGUAGES.find((l) => l.code === target);
    const prefix = targetLangObj ? `[${targetLangObj.name}] ` : "";

    // Tiny demo dictionary to make it feel translated
    const commonPhrases: Record<string, Record<string, string>> = {
      "ru": {
        "hello": "Привет",
        "how are you": "Как дела",
        "thank you": "Спасибо",
        "good morning": "Доброе утро",
        "i love music": "Я люблю музыку",
        "playing a song": "Играю песню",
      },
      "es": {
        "hello": "Hola",
        "how are you": "¿Cómo estás?",
        "thank you": "Gracias",
        "good morning": "Buenos días",
        "i love music": "Me encanta la música",
        "playing a song": "Reproduciendo una canción",
      },
      "fr": {
        "hello": "Bonjour",
        "how are you": "Comment ça va",
        "thank you": "Merci",
        "good morning": "Bonjour",
        "i love music": "J'aime la musique",
        "playing a song": "Lecture d'une chanson",
      }
    };

    const lowerText = text.toLowerCase().trim();
    const targetIso = getIsoLang(target);
    if (commonPhrases[targetIso]?.[lowerText]) {
      return commonPhrases[targetIso][lowerText];
    }

    // Generic fallback for prototype so it isn't identical to input
    return `${prefix}${text.split(" ").reverse().join(" ")}`;
  };

  const translateAndMaybeSpeak = async (text: string, speakAfter: boolean) => {
    if (!text) {
      setTranslatedText("");
      return;
    }

    translationAbortRef.current?.abort();
    const controller = new AbortController();
    translationAbortRef.current = controller;
    const requestId = ++translationRequestId.current;

    const sourceIso = getIsoLang(sourceLang);
    const targetIso = getIsoLang(targetLang);
    let translated = "";

    try {
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceIso}|${targetIso}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await response.json();
      translated = data?.responseData?.translatedText || "";
    } catch {
      // Fallback to local mock if network fails or blocked
      translated = mockTranslate(text, targetLang);
    }

    if (controller.signal.aborted || requestId !== translationRequestId.current) {
      return;
    }

    const safeTranslation = translated || mockTranslate(text, targetLang);
    setTranslatedText(safeTranslation);

    if (speakAfter && autoSpeak) {
      const now = Date.now();
      const longEnough = safeTranslation.length >= MIN_CHARS_TO_SPEAK;
      const gapOk = now - lastSpokenAtRef.current >= MIN_SPEAK_GAP_MS;
      if (longEnough && gapOk) {
        void speechManager.current.speak(safeTranslation, targetLang);
        lastSpokenRef.current = safeTranslation;
        lastSpokenAtRef.current = now;
      }
    }
  };

  useEffect(() => {
    // Update continuous mode setting
    speechManager.current.setContinuous(continuousMode);
  }, [continuousMode]);

  useEffect(() => {
    // Keep recognition language in sync with selected source language
    speechManager.current.setLanguage(sourceLang);
  }, [sourceLang]);

  useEffect(() => {
    if (!sourceText) {
      setTranslatedText("");
      lastSpokenRef.current = "";
      return;
    }

    // Re-translate if target language changes
    translateAndMaybeSpeak(sourceText, false);
  }, [targetLang, sourceText]);

  const toggleListening = () => {
    if (isListening) {
      speechManager.current.stop();
      setIsListening(false);
      lastSpokenRef.current = "";
      lastSpokenAtRef.current = 0;
    } else {
      setIsListening(true);
      if (!continuousMode) {
        setSourceText(""); // Clear only if not continuous? Or always clear on new session?
        lastSpokenRef.current = "";
        lastSpokenAtRef.current = 0;
      }

      speechManager.current.start(
        (text, isFinal) => {
          if (continuousMode) {
             // In continuous mode, we might append or just show the latest phrase
             // For a translator, usually showing the latest phrase is better
             setSourceText(text);
          } else {
             setSourceText(text);
          }

          // Only speak on finals to avoid firing on tiny pauses
          translateAndMaybeSpeak(text, isFinal);

          if (isFinal && !continuousMode) {
            setIsListening(false);
          }
        },
        () => {
           if (!continuousMode) setIsListening(false);
        },
        (err) => {
          console.error(err);
          setIsListening(false);
          toast({
            title: "Microphone Error",
            description: "Could not access microphone. Please check permissions.",
            variant: "destructive",
          });
        }
      );
    }
  };

  const handleSpeak = (text: string, lang: string) => {
    if (!text) return;
    void speechManager.current.speak(text, lang);
  };

  const handleSwapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-start pt-8 pb-24 px-4 md:px-0 bg-background text-foreground font-sans">
      {/* Background Asset */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <img src={soundWaveBg} alt="Background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col gap-6">
        {/* Header */}
        <header className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/50">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
              LinguaFlow
            </h1>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10" onClick={() => { setSourceText(""); setTranslatedText(""); }}>
              <RefreshCw className="w-5 h-5 opacity-70" />
            </Button>
          </div>
        </header>

        {/* Settings Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${continuousMode ? "text-accent" : "text-muted-foreground"}`} />
            <span className="text-xs font-medium text-muted-foreground">Continuous</span>
            <Switch checked={continuousMode} onCheckedChange={setContinuousMode} className="scale-75" />
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <Volume2 className={`w-4 h-4 ${autoSpeak ? "text-accent" : "text-muted-foreground"}`} />
            <span className="text-xs font-medium text-muted-foreground">Auto-Speak</span>
            <Switch checked={autoSpeak} onCheckedChange={setAutoSpeak} className="scale-75" />
          </div>
        </div>

        {/* Language Selection Bar */}
        <Card className="glass-card p-2 rounded-2xl flex items-center justify-between gap-2">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger className="w-[140px] bg-transparent border-0 focus:ring-0 text-base font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="mr-2">{lang.flag}</span> {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full hover:bg-white/10 shrink-0"
            onClick={handleSwapLanguages}
          >
            <ArrowRightLeft className="w-4 h-4 opacity-70" />
          </Button>

          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="w-[140px] bg-transparent border-0 focus:ring-0 text-base font-medium text-right justify-end">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="mr-2">{lang.flag}</span> {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* Main Interface */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Source Text Card */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
          >
            <Card className="glass-card min-h-[160px] p-6 rounded-3xl border-l-4 border-l-primary/50 flex flex-col transition-all duration-300">
              <div className="flex-1">
                {sourceText ? (
                  <p className="text-2xl font-medium leading-relaxed">{sourceText}</p>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                    <p className="text-xl italic mb-2">
                       {continuousMode ? "Listening for audio..." : "Tap mic to speak..."}
                    </p>
                    {continuousMode && <div className="animate-pulse text-xs uppercase tracking-widest text-accent">Live Mode Active</div>}
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                <span className="text-xs font-bold tracking-wider opacity-50 uppercase">{LANGUAGES.find(l => l.code === sourceLang)?.name}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => handleSpeak(sourceText, sourceLang)}>
                    <Volume2 className="w-4 h-4 opacity-70" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Target Text Card */}
          <AnimatePresence>
            {translatedText && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <Card className="glass-card min-h-[160px] p-6 rounded-3xl bg-primary/10 border-none flex flex-col">
                  <div className="flex-1">
                    <p className="text-2xl font-medium leading-relaxed text-primary-foreground text-glow">
                      {translatedText}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                    <span className="text-xs font-bold tracking-wider opacity-50 uppercase text-accent">{LANGUAGES.find(l => l.code === targetLang)?.name}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => navigator.clipboard.writeText(translatedText)}>
                        <Copy className="w-4 h-4 opacity-70" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => handleSpeak(translatedText, targetLang)}>
                        <Volume2 className="w-4 h-4 opacity-70" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls Area */}
        <div className="mt-auto pt-4 flex flex-col items-center justify-center gap-6">
           {/* Visualizer */}
          <div className="h-12 w-full flex items-center justify-center">
             <SpeechVisualizer isListening={isListening} />
          </div>

          {/* Mic Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            animate={isListening ? { scale: [1, 1.1, 1], boxShadow: ["0 0 0 0px rgba(124, 58, 237, 0.4)", "0 0 0 20px rgba(124, 58, 237, 0)"] } : {}}
            transition={isListening ? { repeat: Infinity, duration: 2 } : {}}
            className={`
              w-24 h-24 rounded-full flex items-center justify-center
              shadow-2xl transition-all duration-300
              ${isListening 
                ? 'bg-destructive text-white shadow-destructive/50' 
                : 'bg-primary text-white shadow-primary/50 hover:shadow-primary/80'}
            `}
            onClick={toggleListening}
            data-testid="button-mic"
          >
            {isListening && continuousMode ? (
              <div className="flex flex-col items-center">
                 <div className="w-3 h-3 bg-white rounded-sm animate-pulse mb-1" />
                 <span className="text-[10px] font-bold tracking-wider uppercase">Live</span>
              </div>
            ) : (
              <Mic className={`w-10 h-10 ${isListening ? 'animate-pulse' : ''}`} />
            )}
          </motion.button>
          
          <p className="text-sm font-medium text-muted-foreground">
            {isListening ? (continuousMode ? "Listening continuously..." : "Listening...") : "Tap to Speak"}
          </p>
        </div>
      </div>
    </div>
  );
}
