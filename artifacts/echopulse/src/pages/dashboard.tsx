import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useProcessCommand,
  useListCommandLogs,
  getListTasksQueryKey,
  getListCommandLogsQueryKey,
  getGetStatsQueryKey,
} from '@workspace/api-client-react';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import { useSpeechSynthesis } from '@/hooks/use-speech-synthesis';

const WAKE_WORD = 'echo';

// ASCII art for ECHOPULSE — cyan teal, neofetch style
const ASCII_ART = `
  ███████╗ ██████╗██╗  ██╗ ██████╗ 
  ██╔════╝██╔════╝██║  ██║██╔═══██╗
  █████╗  ██║     ███████║██║   ██║
  ██╔══╝  ██║     ██╔══██║██║   ██║
  ███████╗╚██████╗██║  ██║╚██████╔╝
  ╚══════╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝ 
  ██████╗ ██╗   ██╗██╗     ███████╗███████╗
  ██╔══██╗██║   ██║██║     ██╔════╝██╔════╝
  ██████╔╝██║   ██║██║     ███████╗█████╗  
  ██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  
  ██║     ╚██████╔╝███████╗███████║███████╗
  ╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝
`.trim();

interface LogEntry {
  id: number;
  text: string;
  color?: string;
}

const C = {
  bg:      '#0d0d0d',
  teal:    '#00b4b4',
  red:     '#ff4444',
  white:   '#e8e8e8',
  dim:     '#555555',
  green:   '#44ff88',
  yellow:  '#ffcc00',
  magenta: '#cc88ff',
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { speak, cancel: cancelSpeech } = useSpeechSynthesis();
  const [termLog, setTermLog] = useState<LogEntry[]>([]);
  const [logId, setLogId] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<ReturnType<typeof useVoiceRecognition> | null>(null);
  const processCommand = useProcessCommand();
  const { data: apiLogs = [] } = useListCommandLogs({ limit: 50 });

  const addLog = useCallback((text: string, color?: string) => {
    setLogId(prev => {
      const id = prev + 1;
      setTermLog(log => [...log.slice(-200), { id, text, color }]);
      return id;
    });
  }, []);

  const handleCommand = useCallback((transcript: string) => {
    addLog(`you  > ${transcript}`, C.white);

    processCommand.mutate(
      { data: { query: transcript } },
      {
        onSuccess: (response) => {
          addLog(`echo > ${response.reply}`, C.teal);
          voiceRef.current?.setVoiceState('speaking');

          speak(response.reply, () => {
            voiceRef.current?.resumeListening();
            addLog('', undefined);
          });

          queryClient.invalidateQueries({ queryKey: getListCommandLogsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          if (response.action?.includes('task')) {
            queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          }
        },
        onError: () => {
          const msg = 'error: command processing failed';
          addLog(`echo > ${msg}`, C.red);
          speak('Something went wrong.', () => {
            voiceRef.current?.resumeListening();
          });
        },
      }
    );
  }, [processCommand, queryClient, speak, addLog]);

  const voice = useVoiceRecognition({
    wakeWord: WAKE_WORD,
    onCommand: handleCommand,
    onWakeWordDetected: () => {
      cancelSpeech();
      addLog(`[wake word detected]`, C.yellow);
    },
    onError: (err) => {
      addLog(`[error] ${err}`, C.red);
    },
  });

  useEffect(() => { voiceRef.current = voice; }, [voice]);

  // Boot messages on mount
  useEffect(() => {
    const lines = [
      { text: 'EchoPulse v1.0.0 — voice assistant daemon', color: C.teal },
      { text: `wake word: "${WAKE_WORD}"`, color: C.dim },
      { text: 'initializing speech recognition...', color: C.dim },
    ];
    lines.forEach((l, i) => {
      setTimeout(() => addLog(l.text, l.color), i * 120);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log state transitions
  const prevStateRef = useRef(voice.state);
  useEffect(() => {
    if (prevStateRef.current === voice.state) return;
    prevStateRef.current = voice.state;
    const msgs: Record<string, { text: string; color: string }> = {
      waiting:     { text: `[ready] listening for "${WAKE_WORD}"...`, color: C.dim },
      activated:   { text: '[activated] speak your command', color: C.yellow },
      processing:  { text: '[processing]', color: C.magenta },
      speaking:    { text: '[speaking]', color: C.green },
      error:       { text: `[error] ${voice.errorMessage || 'mic permission denied — refresh after allowing mic access'}`, color: C.red },
      unsupported: { text: '[error] Web Speech API not supported in this browser', color: C.red },
    };
    const msg = msgs[voice.state];
    if (msg) addLog(msg.text, msg.color);
  }, [voice.state, voice.errorMessage, addLog]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [termLog]);

  useEffect(() => () => cancelSpeech(), [cancelSpeech]);

  // Status indicator for prompt prefix
  const promptColor =
    voice.state === 'waiting'    ? C.dim :
    voice.state === 'activated'  ? C.yellow :
    voice.state === 'processing' ? C.magenta :
    voice.state === 'speaking'   ? C.green :
    C.red;

  // Stats from recent API logs
  const localCount = apiLogs.filter(l => l.source === 'local').length;
  const geminiCount = apiLogs.filter(l => l.source === 'gemini').length;

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.white,
      fontFamily: "'Space Mono', 'Courier New', monospace",
      fontSize: '13px',
      lineHeight: '1.5',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── NEOFETCH-STYLE HEADER ── */}
      <div style={{
        display: 'flex',
        gap: '3rem',
        padding: '1.5rem 2rem',
        borderBottom: `1px solid #1a1a1a`,
        flexShrink: 0,
      }}>
        {/* ASCII art */}
        <pre style={{
          margin: 0,
          color: C.teal,
          fontSize: '9px',
          lineHeight: '1.2',
          letterSpacing: '0.02em',
          flexShrink: 0,
          userSelect: 'none',
        }}>
          {ASCII_ART}
        </pre>

        {/* System info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingTop: '0.25rem' }}>
          <div style={{ color: C.teal, marginBottom: '0.4rem' }}>
            user<span style={{ color: C.white }}>@</span>echopulse
          </div>
          <div style={{ color: C.dim, marginBottom: '0.6rem' }}>{'─'.repeat(20)}</div>

          {[
            ['Wake Word',   `"${WAKE_WORD}"`],
            ['Status',      voice.state.toUpperCase()],
            ['Local hits',  String(localCount)],
            ['Gemini hits', String(geminiCount)],
            ['Speech API',  voice.isSupported ? 'active' : 'unavailable'],
            ['Synthesis',   typeof window !== 'undefined' && window.speechSynthesis ? 'active' : 'unavailable'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ color: C.red, minWidth: '90px' }}>{label}:</span>
              <span style={{ color: C.white }}>{value}</span>
            </div>
          ))}

          <div style={{ marginTop: '1rem', display: 'flex', gap: '6px' }}>
            {[C.red, '#ff8800', C.yellow, C.green, C.teal, '#0088ff', C.magenta, C.white].map(c => (
              <div key={c} style={{ width: 16, height: 16, background: c, borderRadius: 2 }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── TERMINAL LOG ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
      }}>
        {termLog.map((entry) => (
          <div key={entry.id} style={{ color: entry.color ?? C.white, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {entry.text}
          </div>
        ))}

        {/* Live interim transcript */}
        {voice.interimTranscript && (
          <div style={{ color: C.dim, fontStyle: 'italic' }}>
            {voice.interimTranscript}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── PROMPT LINE ── */}
      <div style={{
        padding: '0.5rem 2rem 1rem',
        borderTop: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        flexShrink: 0,
      }}>
        <span style={{ color: C.teal }}>user</span>
        <span style={{ color: C.white }}>@</span>
        <span style={{ color: C.teal }}>echopulse</span>
        <span style={{ color: C.white }}>:~$</span>
        <span style={{
          color: promptColor,
          marginLeft: '0.4rem',
          fontSize: '12px',
        }}>
          {voice.state === 'waiting'    && `listening for "${WAKE_WORD}"...`}
          {voice.state === 'activated'  && 'speak your command_'}
          {voice.state === 'processing' && 'processing...'}
          {voice.state === 'speaking'   && 'speaking...'}
          {voice.state === 'error'      && 'mic error — allow access and refresh'}
          {voice.state === 'unsupported' && 'speech api unavailable'}
        </span>
        {/* blinking cursor */}
        <span style={{ animation: 'blink 1s step-end infinite', color: C.white }}>█</span>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: #222; }
      `}</style>
    </div>
  );
}
