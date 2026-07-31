// Types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: Event & { error: string }) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

interface ISpeechRecognitionConstructor {
  new(): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionConstructor;
    webkitSpeechRecognition?: ISpeechRecognitionConstructor;
  }
}

// ---

import { useState, useEffect, useRef, useCallback } from 'react';

export type VoiceState = 'waiting' | 'activated' | 'processing' | 'speaking' | 'error' | 'unsupported';

interface UseVoiceRecognitionProps {
  /** Wake word to listen for. Default: "echo" */
  wakeWord?: string;
  /** Called with the command transcript after wake word is detected */
  onCommand: (transcript: string) => void;
  /** Called the moment the wake word is heard */
  onWakeWordDetected?: () => void;
  /** Called on hard errors (e.g. mic denied) */
  onError?: (error: string) => void;
}

export function useVoiceRecognition({
  wakeWord = 'echo',
  onCommand,
  onWakeWordDetected,
  onError,
}: UseVoiceRecognitionProps) {
  const [state, setState] = useState<VoiceState>('waiting');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Use refs for values that drive recognition callbacks so closures don't go stale
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const stateRef = useRef<VoiceState>('waiting');
  const shouldRestartRef = useRef(true);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommandRef = useRef(onCommand);
  const onWakeWordDetectedRef = useRef(onWakeWordDetected);

  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { onWakeWordDetectedRef.current = onWakeWordDetected; }, [onWakeWordDetected]);

  const setVoiceState = useCallback((next: VoiceState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const tryStart = useCallback(() => {
    if (!recognitionRef.current || !shouldRestartRef.current) return;
    try {
      recognitionRef.current.start();
    } catch {
      // already started — fine
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceState('unsupported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;      // keep session alive
    recognition.interimResults = true;  // show live text
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    const wakeWordLower = wakeWord.toLowerCase();

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const currentState = stateRef.current;

      // Ignore results while we're speaking or already processing
      if (currentState === 'speaking' || currentState === 'processing') return;

      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        const transcriptLower = transcript.toLowerCase();

        if (event.results[i].isFinal) {
          setInterimTranscript('');

          if (currentState === 'waiting') {
            // Look for wake word anywhere in the utterance
            const wakeIdx = transcriptLower.indexOf(wakeWordLower);
            if (wakeIdx !== -1) {
              onWakeWordDetectedRef.current?.();
              // Grab anything said after the wake word on the same breath
              const afterWake = transcript.slice(wakeIdx + wakeWord.length).trim();
              if (afterWake.length > 2) {
                // Command came in the same utterance: "Echo what time is it"
                setLastCommand(afterWake);
                setVoiceState('processing');
                onCommandRef.current(afterWake);
              } else {
                // Wake word only — wait for the next utterance as the command
                setVoiceState('activated');
              }
            }
          } else if (currentState === 'activated') {
            // The user just said their command
            if (transcript.length > 0) {
              setLastCommand(transcript);
              setVoiceState('processing');
              onCommandRef.current(transcript);
            }
          }
        } else {
          interim += transcript;
        }
      }

      if (interim && stateRef.current !== 'speaking' && stateRef.current !== 'processing') {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: Event & { error: string }) => {
      const err = (event as Event & { error: string }).error;
      // 'no-speech' and 'aborted' are routine — the onend handler will restart
      if (err === 'no-speech' || err === 'aborted') return;

      console.error('Speech recognition error:', err);

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        const msg = 'Microphone access denied. Allow microphone permission in your browser, then refresh.';
        setVoiceState('error');
        setErrorMessage(msg);
        shouldRestartRef.current = false;
        onError?.(msg);
      } else {
        setErrorMessage(`Speech error: ${err}. Retrying...`);
      }
      // Other errors (network, audio-capture): onend will restart
    };

    recognition.onend = () => {
      setInterimTranscript('');
      // Auto-restart unless blocked by processing/speaking (resumeListening handles that)
      if (
        shouldRestartRef.current &&
        stateRef.current !== 'processing' &&
        stateRef.current !== 'speaking' &&
        stateRef.current !== 'error'
      ) {
        restartTimerRef.current = setTimeout(tryStart, 250);
      }
    };

    shouldRestartRef.current = true;
    tryStart();

    return () => {
      shouldRestartRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recognition.abort();
    };
    // Only re-run if wakeWord changes (other deps are stable refs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeWord]);

  /**
   * Call this after the spoken reply finishes to return to wake-word listening.
   */
  const resumeListening = useCallback(() => {
    setVoiceState('waiting');
    // Short delay so the mic doesn't pick up the tail of synthesized speech
    restartTimerRef.current = setTimeout(tryStart, 600);
  }, [setVoiceState, tryStart]);

  return {
    state,
    interimTranscript,
    lastCommand,
    errorMessage,
    isSupported: state !== 'unsupported',
    setVoiceState,
    resumeListening,
  };
}
