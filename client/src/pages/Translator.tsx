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
import { Mic, Globe, RefreshCw, Volume2, Copy, ArrowRightLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import soundWaveBg from "@assets/generated_images/abstract_neon_sound_waves_on_dark_background.png";

// Mock translation logic for prototype
const TRANSLATION_MOCK: Record<string, Record<string, string>> = {
  "hello": { es: "Hola", fr: "Bonjour", de: "Hallo", ja: "こんにちは" },
  "how are you": { es: "¿Cómo estás?", fr: "Comment allez-vous?", de: "Wie geht es dir?", ja: "お元気ですか" },
  "thank you": { es: "Gracias", fr: "Merci", de: "Danke", ja: "ありがとう" },
  "good morning": { es: "Buenos días", fr: "Bonjour", de: "Guten Morgen", ja: "おはようございます" },
};

const LANGUAGES = [
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "es-ES", name: "Spanish", flag: "🇪🇸" },
  { code: "fr-FR", name: "French", flag: "🇫🇷" },
  { code: "de-DE", name: "German", flag: "🇩🇪" },
  { code: "ja-JP", name: "Japanese", flag: "🇯🇵" },
];

export default function Translator() {
  const [isListening, setIsListening] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState("en-US");
  const [targetLang, setTargetLang] = useState("es-ES");
  
  const speechManager = useRef(new SpeechManager());
  const { toast } = useToast();

  useEffect(() => {
    // Basic translation simulation
    if (!sourceText) {
      setTranslatedText("");
      return;
    }

    const timer = setTimeout(() => {
      const lowerText = sourceText.toLowerCase().trim();
      // Try to find exact match mock
      let mockTranslation = TRANSLATION_MOCK[lowerText]?.[targetLang.split("-")[0]];
      
      if (!mockTranslation) {
        // Fallback simulation: Just show it's translated visually
        // In a real app, this would call an API
        mockTranslation = `[Translated to ${LANGUAGES.find(l => l.code === targetLang)?.name}]: ${sourceText}`;
      }
      
      setTranslatedText(mockTranslation);
    }, 600); // Simulate network delay

    return () => clearTimeout(timer);
  }, [sourceText, targetLang]);

  const toggleListening = () => {
    if (isListening) {
      speechManager.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      setSourceText(""); // Clear previous on new recording
      speechManager.current.start(
        (text, isFinal) => {
          setSourceText(text);
          if (isFinal) {
            setIsListening(false);
          }
        },
        () => setIsListening(false),
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
    speechManager.current.speak(text, lang);
  };

  const handleSwapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-start pt-8 pb-20 px-4 md:px-0 bg-background text-foreground font-sans">
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
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
            <RefreshCw className="w-5 h-5 opacity-70" onClick={() => { setSourceText(""); setTranslatedText(""); }} />
          </Button>
        </header>

        {/* Language Selection Bar */}
        <Card className="glass-card p-2 rounded-2xl flex items-center justify-between gap-2">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger className="w-[140px] bg-transparent border-0 focus:ring-0 text-base font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
            <SelectContent>
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
            <Card className="glass-card min-h-[160px] p-6 rounded-3xl border-l-4 border-l-primary/50 flex flex-col">
              <div className="flex-1">
                {sourceText ? (
                  <p className="text-2xl font-medium leading-relaxed">{sourceText}</p>
                ) : (
                  <p className="text-xl text-muted-foreground/50 italic">Tap microphone to speak...</p>
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
        <div className="mt-auto pt-8 flex flex-col items-center justify-center gap-6">
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
            <Mic className={`w-10 h-10 ${isListening ? 'animate-pulse' : ''}`} />
          </motion.button>
          
          <p className="text-sm font-medium text-muted-foreground">
            {isListening ? "Listening..." : "Tap to Speak"}
          </p>
        </div>
      </div>
    </div>
  );
}
