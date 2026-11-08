import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';

interface RecognitionResult {
  readonly [index: number]: { readonly transcript: string };
  readonly isFinal: boolean;
}

interface RecognitionEvent {
  readonly results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  readonly error: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

interface VoiceSearchButtonProps {
  onTranscript: (transcript: string) => void;
  onStatus: (status: string) => void;
}

export function VoiceSearchButton({ onTranscript, onStatus }: VoiceSearchButtonProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      onStatus('Voice input is not supported on this platform yet.');
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      onStatus('Voice search is not supported by this browser. You can still type your search.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript.trim();
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      onStatus(event.error === 'not-allowed'
        ? 'Allow microphone access in your browser to use voice search.'
        : 'Voice search could not start. Please try again or type your search.');
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      onStatus('Listening… Speak your search.');
    } catch {
      recognitionRef.current = null;
      setListening(false);
      onStatus('Voice search could not start. Please try again or type your search.');
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listening ? 'Stop voice search' : 'Search by voice'}
      accessibilityState={{ selected: listening }}
      onPress={toggleListening}
      style={({ pressed }) => ({
        width: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        backgroundColor: listening || pressed ? '#d9ebe5' : 'transparent',
      })}
    >
      <Text style={{ color: listening ? '#145B50' : '#68736e', fontSize: 20 }}>
        {listening ? '■' : '🎙'}
      </Text>
    </Pressable>
  );
}
