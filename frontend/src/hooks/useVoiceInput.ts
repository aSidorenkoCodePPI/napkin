import { useState, useCallback, useRef } from 'react';

export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const callbackRef = useRef<((text: string) => void) | null>(null);
  const transcriptRef = useRef('');

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  console.log('[Voice] isSupported:', isSupported);

  const startListening = useCallback((onResult: (text: string) => void) => {
    console.log('[Voice] startListening called, isSupported:', isSupported);
    if (!isSupported) return;

    callbackRef.current = onResult;
    transcriptRef.current = '';

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    console.log('[Voice] SpeechRecognition constructor:', SpeechRecognitionCtor?.name || 'not found');
    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    console.log('[Voice] using language:', recognition.lang);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const combined = final + interim;
      console.log('[Voice] onresult - final:', JSON.stringify(final), 'interim:', JSON.stringify(interim));
      transcriptRef.current = combined;
      setTranscript(combined);
    };

    recognition.onaudiostart = () => console.log('[Voice] onaudiostart - mic is capturing');
    recognition.onspeechstart = () => console.log('[Voice] onspeechstart - speech detected');
    recognition.onspeechend = () => console.log('[Voice] onspeechend - speech stopped');
    recognition.onaudioend = () => console.log('[Voice] onaudioend - mic stopped');

    recognition.onend = () => {
      console.log('[Voice] onend - recognition ended, transcriptRef:', JSON.stringify(transcriptRef.current));
      setIsListening(false);
      const text = transcriptRef.current.trim();
      if (text && callbackRef.current) {
        console.log('[Voice] onend firing callback with:', JSON.stringify(text));
        const cb = callbackRef.current;
        callbackRef.current = null;
        cb(text);
      } else {
        console.log('[Voice] onend - no text or no callback. text:', JSON.stringify(text), 'hasCallback:', !!callbackRef.current);
      }
    };

    recognition.onerror = (event) => {
      console.error('[Voice] onerror:', event.error, event);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setIsListening(false);
      }
    };

    setTranscript('');
    setIsListening(true);
    try {
      recognition.start();
      console.log('[Voice] recognition.start() called successfully');
    } catch (err) {
      console.error('[Voice] recognition.start() threw:', err);
      setIsListening(false);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    console.log('[Voice] stopListening called, transcriptRef:', JSON.stringify(transcriptRef.current));
    const recognition = recognitionRef.current;
    const text = transcriptRef.current.trim();
    const cb = callbackRef.current;

    callbackRef.current = null;
    recognitionRef.current = null;

    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.stop();
      console.log('[Voice] recognition.stop() called');
    }

    setIsListening(false);

    if (text && cb) {
      console.log('[Voice] stopListening firing callback with:', JSON.stringify(text));
      cb(text);
    } else {
      console.log('[Voice] stopListening - no text or no callback. text:', JSON.stringify(text), 'hasCb:', !!cb);
    }
  }, []);

  return { isListening, transcript, isSupported, startListening, stopListening };
}
