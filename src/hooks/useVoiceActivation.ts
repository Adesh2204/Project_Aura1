import { useState, useEffect, useCallback, useRef } from 'react';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface UseVoiceActivationProps {
  triggerPhrase: string;
  onActivate: () => void;
  enabled: boolean;
  language?: string;
}

export const useVoiceActivation = ({
  triggerPhrase,
  onActivate,
  enabled,
  language = 'en-US'
}: UseVoiceActivationProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Initialize speech recognition
  useEffect(() => {
    // Check if browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      setPermissionStatus('unsupported');
      return;
    }
    
    // Check for microphone permission
    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then((result) => {
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        
        // Listen for permission changes
        result.onchange = () => {
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        };
      })
      .catch(() => {
        // Fallback if permissions API is not supported
        setPermissionStatus('prompt');
      });
  }, []);
  
  // Start/stop listening based on enabled prop
  useEffect(() => {
    if (enabled && permissionStatus === 'granted') {
      startListening();
    } else if (!enabled && isListening) {
      stopListening();
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [enabled, permissionStatus]);
  
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    
    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;
      
      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        const currentTranscript = finalTranscript || interimTranscript;
        setTranscript(currentTranscript);
        
        // Check for trigger phrase with error tolerance
        const normalizedTranscript = currentTranscript.toLowerCase().trim();
        const normalizedTrigger = triggerPhrase.toLowerCase().trim();
        
        // Simple fuzzy matching - checks if the transcript contains the trigger phrase
        // or if it's similar enough (e.g., "help aura" vs "help aurora")
        if (
          normalizedTranscript.includes(normalizedTrigger) ||
          normalizedTranscript.includes(normalizedTrigger.replace(' ', '')) ||
          levenshteinDistance(normalizedTranscript, normalizedTrigger) <= 2 ||
          normalizedTranscript.split(' ').some(word => 
            levenshteinDistance(word, 'help') <= 1 && 
            normalizedTranscript.includes('aura') || 
            normalizedTranscript.includes('aurora')
          )
        ) {
          onActivate();
          // Restart recognition after activation
          recognition.stop();
          setTimeout(() => {
            if (enabled) {
              startListening();
            }
          }, 1000);
        }
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setError(`Speech recognition error: ${event.error}`);
        if (event.error === 'not-allowed') {
          setPermissionStatus('denied');
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
        // Restart if still enabled and not manually stopped
        if (enabled && permissionStatus === 'granted') {
          recognition.start();
        }
      };
      
      recognition.start();
    } catch (err) {
      setError(`Failed to start speech recognition: ${err}`);
      setIsListening(false);
    }
  }, [triggerPhrase, onActivate, enabled, language, permissionStatus]);
  
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);
  
  const requestPermission = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionStatus('granted');
      return true;
    } catch (err) {
      setError(`Microphone permission denied: ${err}`);
      setPermissionStatus('denied');
      return false;
    }
  }, []);
  
  // Levenshtein distance for fuzzy matching
  const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    return matrix[b.length][a.length];
  };
  
  return {
    isListening,
    transcript,
    error,
    permissionStatus,
    startListening,
    stopListening,
    requestPermission
  };
};

// Add TypeScript declarations for the Web Speech API
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}