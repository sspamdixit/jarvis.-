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

const STATE_LABELS: Record<string, string> = {
  waiting:     '● LISTENING FOR "ECHO"',
  activated:   '◉ WAKE WORD HEARD — SPEAK YOUR COMMAND',
  processing:  '⟳ PROCESSING...',
  speaking:    '▶ SPEAKING',
  error:       '✕ ERROR',
  unsupported: '✕ SPEECH NOT SUPPORTED IN THIS BROWSER',
};

const STATE_COLORS: Record<string, string> = {
  waiting:     '#4b5563',   // muted gray
  activated:   '#22d3ee',   // cyan
  processing:  '#a78bfa',   // violet
  speaking:    '#34d399',   // green
  error:       '#f87171',   // red
  unsupported: '#f87171',
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { speak, cancel: cancelSpeech } = useSpeechSynthesis();
  const [lastReply, setLastReply] = useState('');
  const processCommand = useProcessCommand();
  const { data: logs = [] } = useListCommandLogs({ limit: 10 });

  const handleCommand = useCallback((transcript: string) => {
    processCommand.mutate(
      { data: { query: transcript } },
      {
        onSuccess: (response) => {
          setLastReply(response.reply);
          voiceRef.current?.setVoiceState('speaking');

          speak(response.reply, () => {
            voiceRef.current?.resumeListening();
          });

          queryClient.invalidateQueries({ queryKey: getListCommandLogsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          if (response.action?.includes('task')) {
            queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          }
        },
        onError: () => {
          setLastReply('Sorry, something went wrong.');
          speak('Sorry, something went wrong.', () => {
            voiceRef.current?.resumeListening();
          });
        },
      }
    );
  }, [processCommand, queryClient, speak]);

  const voice = useVoiceRecognition({
    wakeWord: WAKE_WORD,
    onCommand: handleCommand,
    onWakeWordDetected: () => {
      // Brief audio cue: cancel any ongoing speech
      cancelSpeech();
    },
  });

  // Keep a stable ref so callbacks above can access current voice methods
  const voiceRef = useRef(voice);
  useEffect(() => { voiceRef.current = voice; }, [voice]);

  useEffect(() => {
    return () => cancelSpeech();
  }, [cancelSpeech]);

  const stateColor = STATE_COLORS[voice.state] ?? '#4b5563';
  const stateLabel = STATE_LABELS[voice.state] ?? voice.state.toUpperCase();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#e2e8f0',
      fontFamily: "'Space Mono', 'Courier New', monospace",
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      maxWidth: '800px',
      margin: '0 auto',
    }}>

      {/* Title */}
      <div>
        <h1 style={{ fontSize: '1.25rem', letterSpacing: '0.2em', color: '#22d3ee', margin: 0 }}>
          ECHOPULSE
        </h1>
        <p style={{ fontSize: '0.65rem', color: '#4b5563', margin: '0.25rem 0 0', letterSpacing: '0.15em' }}>
          VOICE ASSISTANT — ALWAYS LISTENING
        </p>
      </div>

      {/* Status */}
      <div style={{
        border: `1px solid ${stateColor}`,
        borderRadius: '4px',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <span style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: stateColor,
          flexShrink: 0,
          boxShadow: `0 0 8px ${stateColor}`,
          animation: voice.state === 'waiting' ? 'pulse 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: '0.75rem', color: stateColor, letterSpacing: '0.1em', flex: 1 }}>
          {stateLabel}
        </span>
        {voice.state === 'error' && (
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'transparent',
              border: '1px solid #f87171',
              color: '#f87171',
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            REFRESH
          </button>
        )}
      </div>

      {/* Error detail */}
      {voice.state === 'error' && voice.errorMessage && (
        <div style={{ fontSize: '0.7rem', color: '#f87171', lineHeight: 1.6 }}>
          {voice.errorMessage}
        </div>
      )}

      {/* Interim live transcript */}
      {voice.interimTranscript && (
        <div style={{
          fontSize: '0.8rem',
          color: '#94a3b8',
          fontStyle: 'italic',
          minHeight: '1.2em',
        }}>
          {voice.interimTranscript}
        </div>
      )}

      {/* Last exchange */}
      {(voice.lastCommand || lastReply) && (
        <div style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '4px',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          {voice.lastCommand && (
            <div>
              <div style={{ fontSize: '0.6rem', color: '#4b5563', letterSpacing: '0.15em', marginBottom: '0.25rem' }}>
                YOU SAID
              </div>
              <div style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>
                {voice.lastCommand}
              </div>
            </div>
          )}
          {lastReply && (
            <div>
              <div style={{ fontSize: '0.6rem', color: '#4b5563', letterSpacing: '0.15em', marginBottom: '0.25rem' }}>
                ECHO REPLIED
              </div>
              <div style={{ fontSize: '0.9rem', color: '#22d3ee' }}>
                {lastReply}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent command log */}
      {logs.length > 0 && (
        <div>
          <div style={{ fontSize: '0.6rem', color: '#4b5563', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
            RECENT COMMANDS
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}>
            {logs.map((log) => (
              <div key={log.id} style={{
                display: 'flex',
                gap: '1rem',
                fontSize: '0.7rem',
                color: '#6b7280',
                borderLeft: '2px solid #1f2937',
                paddingLeft: '0.75rem',
              }}>
                <span style={{ color: '#374151', flexShrink: 0 }}>
                  {log.source === 'gemini' ? 'AI' : 'LOCAL'}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.query}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How to use hint */}
      <div style={{
        marginTop: 'auto',
        fontSize: '0.65rem',
        color: '#374151',
        letterSpacing: '0.1em',
        lineHeight: '1.8',
      }}>
        SAY "ECHO" TO ACTIVATE, THEN SPEAK YOUR COMMAND.<br />
        EXAMPLE: "ECHO what time is it" or "ECHO" then "add milk to my list"
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
