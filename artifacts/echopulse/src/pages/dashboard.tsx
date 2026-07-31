import { useEffect, useCallback, useRef, useState } from 'react';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import { useSpeechSynthesis } from '@/hooks/use-speech-synthesis';

// ── Tauri detection & API layer ───────────────────────────────────────────────

const IS_TAURI = '__TAURI_INTERNALS__' in window;

interface CommandResponse { reply: string; source: string; action: string | null }
interface CommandLog      { id: number; source: string; created_at: string }

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Dynamically import so Vite doesn't error in browser mode
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

async function apiProcessCommand(query: string): Promise<CommandResponse> {
  if (!IS_TAURI) return { reply: `[preview] got: "${query}"`, source: 'local', action: null };
  return tauriInvoke('process_command', { query });
}

async function apiGetLogs(): Promise<CommandLog[]> {
  if (!IS_TAURI) return [];
  return tauriInvoke('get_command_logs', { limit: 50 });
}

async function apiGetGeminiKey(): Promise<string | null> {
  if (!IS_TAURI) return null;
  return tauriInvoke('get_gemini_key');
}

async function apiSetGeminiKey(key: string): Promise<void> {
  if (!IS_TAURI) return;
  return tauriInvoke('set_gemini_key', { key });
}

// ── Constants & helpers ───────────────────────────────────────────────────────

const WAKE_WORD = 'david';

const ASCII_ART = `                                -=                                              
                           ======--.===                                          
                         ========-::---=-                                        
                         =:--:::-......:-                                        
                       --:.... .:...... .-                                       
                       :-.:..::::..:::. .:                                       
                       *- ::----:.-:... .                                        
                        ..::==----=-::::.                                        
                         --====-:-::::::                                         
                         =--===---:::::                                          
                         ==-===--=-::::                                          
                          --===--:----==                                         
                            +===-:-=-::--===+++                                  
                            +===--====--====++===                                
                            ====--=======-:--======                              
                          -=+==-========------======                             
                      =+++=======+==--------::--====-                            
                    -++++++=====+====-:. .----======-=                           
                   -++++=++=====++====-...::--=========                          
                   ++++++++====-++=====-::.:::--========                         
                  ==+++++++=====++==-==---:::::::---=====                        
                  +++==+++====--+==-----::--:::::::..::--                        
                  +++===:=====-=+======----:...:::::---==                        
                  +++=-:-====+======-==---:::...:.  ... .                        
                  =++=--:=+++=--===-------::....  ..:::..                        
                  +++=--.=+=====+==-----::::....                                 
                  ++==--.-====--==---:--:-::...:                                 
                  ++==-:.====---==------::::..:                                  
                  ++=--:.=======++=--------::.-                                  
                 =+==-::.++++==-+==----===-::.                                   
                 +++=-::.=+++=====----====--::                                   
                 +===-:.=+=+=====-----====--::                                   
                ++===-::++=+====-----=====--::                                   
                ++==--::+========------=----:::                                  
               =++==--:=+====-----::---------::                                  
               ++==---:++=+==-----:::-====---::                                  
               ++==--::++=====-:-::--=====--:::                                  
               +==--:.=++===---=-:--======--::-                                  
              =+=--:. =++===--=-::.======---:::                                  
              ++=--=   ++====-=----=====----::.                                  
              ===-==== ++====--:.:=======----:                                   
              =======--+=====---:--=====-----:                                   
              =====-----====----::-=====-----:                                   
               @====---:=====---::-=====-----:                                   
                 =-=-:.:-====---:.:======----:                                   
                  -==-::.====---:..======----:                                   
                   -::..:-===---:..-=====---::                                   
                         ====-=--..-=====--::                                    
                          ===-=--:.-====---::                                    
                           -===--:.:====-----                                    
                            ===--:..====------                                   
                            ===--...----------=                                  
                            ===--...:-:.::----===                                
                             =--:..:.:-...:---=--                                
                              +=-::::::.:------=---=                             
                              +==-:--:: .--=--------                             
                              =+=----::: :-==--------                            
                               +=-----::..--=--------                            
                               +==----:::.:--=--------                           
                                ==-:--::..:::-=------:                           
                                ===-:--:..--:--=-----::                          
                                 ===-:-:: :::.-==------                          
                                 =-=-::-: :::. -==----:                          
                                -=--=---:.:-::  :==--:::                         
                                -:--==--:.:-:-   ===----:                        
                                  ---=---:.-:-:  +===----                        
                                  -=-==--:.:--:: ====---:                        
                                   ====--:..--::: +====----                      
                                  ====-:::..---:: ======--==                     
                                  ===-:::::.:---:  +=====+==                     
                           =====----:::......------===+=+--:----                 
                         =-=---:-:....---=------=========::.:-----==             
                        ====-::-:..::::-:---==--===--:-::....::--:-:.            
                        =====---:::--:---::::-:::--:... ...:..::....::           
                        =--===--:::------::::::--=-=-::....:.... ..:..=          
                    =----:----:::-:--------=============-:----::::::::---        
                     -=-----:::.::-----------==---=--=--.  .....  . ... :        
                     =========---=======================:.::::::::::::::.        
                  -------------------------=======---===:::::::::.::.::::...=    
                 -----:::-------:----------=------::-----::.................:    
                   ::::::::----:::::---:-.:-------::----:. ..             .      
                    :::::::::-::::::---:-::------::.::::. ......          -      
                     ---------------------:-------:::---.................        
                     ====-----=----=--==-=--======------.:::..::::...:..:        
                     -=--==-===-------==-=--======----==::::.:::::.:::..:        `;

interface LogEntry { id: number; text: string; color?: string }

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

// ── Settings modal ────────────────────────────────────────────────────────────

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetGeminiKey().then(k => { setKey(k ?? ''); setLoading(false); });
  }, []);

  const save = async () => {
    await apiSetGeminiKey(key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, fontFamily: "'Space Mono', monospace",
    }}>
      <div style={{
        background: '#111', border: `1px solid ${C.teal}`, padding: '1.5rem 2rem',
        width: 440, maxWidth: '90vw', color: C.white,
      }}>
        <div style={{ color: C.teal, marginBottom: '1rem', fontSize: '14px' }}>
          settings — david
        </div>
        <div style={{ color: C.dim, fontSize: '12px', marginBottom: '0.4rem' }}>
          GEMINI_API_KEY
        </div>
        {loading ? (
          <div style={{ color: C.dim }}>loading…</div>
        ) : (
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="paste your key here"
            style={{
              width: '100%', background: '#0d0d0d', border: `1px solid #333`,
              color: C.white, padding: '0.5rem', fontFamily: 'inherit',
              fontSize: '13px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        )}
        <div style={{ color: C.dim, fontSize: '11px', marginTop: '0.4rem', marginBottom: '1.2rem' }}>
          Stored locally. Only needed for queries that local routing can't handle.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={save} style={{
            background: saved ? C.green : C.teal, color: '#000',
            border: 'none', padding: '0.4rem 1rem', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '13px',
          }}>
            {saved ? 'saved ✓' : 'save'}
          </button>
          <button onClick={onClose} style={{
            background: 'transparent', color: C.dim,
            border: `1px solid #333`, padding: '0.4rem 1rem',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px',
          }}>
            close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { speak, cancel: cancelSpeech } = useSpeechSynthesis();
  const [termLog, setTermLog]   = useState<LogEntry[]>([]);
  const [logId, setLogId]       = useState(0);
  const [apiLogs, setApiLogs]   = useState<CommandLog[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const voiceRef  = useRef<ReturnType<typeof useVoiceRecognition> | null>(null);

  const addLog = useCallback((text: string, color?: string) => {
    setLogId(prev => {
      const id = prev + 1;
      setTermLog(log => [...log.slice(-200), { id, text, color }]);
      return id;
    });
  }, []);

  const reloadLogs = useCallback(() => {
    apiGetLogs().then(setApiLogs).catch(console.error);
  }, []);

  const handleCommand = useCallback(async (transcript: string) => {
    addLog(`you   > ${transcript}`, C.white);
    try {
      const response = await apiProcessCommand(transcript);
      addLog(`david > ${response.reply}`, C.teal);
      voiceRef.current?.setVoiceState('speaking');
      speak(response.reply, () => {
        voiceRef.current?.resumeListening();
        addLog('', undefined);
      });
      reloadLogs();
    } catch {
      addLog(`david > error: command processing failed`, C.red);
      speak('Something went wrong.', () => voiceRef.current?.resumeListening());
    }
  }, [speak, addLog, reloadLogs]);

  const voice = useVoiceRecognition({
    wakeWord: WAKE_WORD,
    onCommand: handleCommand,
    onWakeWordDetected: () => { cancelSpeech(); addLog('[wake word detected]', C.yellow); },
    onError: (err) => addLog(`[error] ${err}`, C.red),
  });

  useEffect(() => { voiceRef.current = voice; }, [voice]);

  // Boot messages
  useEffect(() => {
    const lines = [
      { text: 'david v0.1.0 — voice assistant', color: C.teal },
      { text: `wake word: "${WAKE_WORD}"`, color: C.dim },
      { text: 'initializing speech recognition…', color: C.dim },
    ];
    lines.forEach((l, i) => setTimeout(() => addLog(l.text, l.color), i * 120));
    reloadLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log state transitions
  const prevStateRef = useRef(voice.state);
  useEffect(() => {
    if (prevStateRef.current === voice.state) return;
    prevStateRef.current = voice.state;
    const msgs: Record<string, { text: string; color: string }> = {
      waiting:     { text: `[ready] listening for "${WAKE_WORD}"…`, color: C.dim },
      activated:   { text: '[activated] speak your command', color: C.yellow },
      processing:  { text: '[processing]', color: C.magenta },
      speaking:    { text: '[speaking]', color: C.green },
      error:       { text: `[error] ${voice.errorMessage || 'mic permission denied'}`, color: C.red },
      unsupported: { text: '[error] Web Speech API not supported', color: C.red },
    };
    const msg = msgs[voice.state];
    if (msg) addLog(msg.text, msg.color);
  }, [voice.state, voice.errorMessage, addLog]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [termLog]);
  useEffect(() => () => cancelSpeech(), [cancelSpeech]);

  const promptColor =
    voice.state === 'waiting'    ? C.dim :
    voice.state === 'activated'  ? C.yellow :
    voice.state === 'processing' ? C.magenta :
    voice.state === 'speaking'   ? C.green : C.red;

  const localCount  = apiLogs.filter(l => l.source === 'local').length;
  const geminiCount = apiLogs.filter(l => l.source === 'gemini').length;

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.white,
      fontFamily: "'Space Mono', 'Courier New', monospace",
      fontSize: '13px', lineHeight: '1.5',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', gap: '2.5rem', padding: '1rem 2rem',
        borderBottom: '1px solid #1a1a1a', flexShrink: 0,
        maxHeight: '42vh', overflow: 'hidden', alignItems: 'flex-start',
      }}>
        {/* ASCII art */}
        <div style={{ overflow: 'hidden', flexShrink: 1, minWidth: 0, alignSelf: 'stretch' }}>
          <pre style={{
            margin: 0, color: C.teal, fontSize: '7px',
            lineHeight: '1.1', letterSpacing: '0em',
            userSelect: 'none', whiteSpace: 'pre',
          }}>
            {ASCII_ART}
          </pre>
        </div>

        {/* System info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingTop: '0.25rem', flexShrink: 0 }}>
          <div style={{ color: C.teal, marginBottom: '0.4rem' }}>
            user<span style={{ color: C.white }}>@</span>david
          </div>
          <div style={{ color: C.dim, marginBottom: '0.6rem' }}>{'─'.repeat(20)}</div>
          {[
            ['Wake Word',   `"${WAKE_WORD}"`],
            ['Status',      voice.state.toUpperCase()],
            ['Local hits',  String(localCount)],
            ['Gemini hits', String(geminiCount)],
            ['Speech API',  voice.isSupported ? 'active' : 'unavailable'],
            ['Mode',        IS_TAURI ? 'desktop' : 'browser preview'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ color: C.red, minWidth: '90px' }}>{label}:</span>
              <span style={{ color: C.white }}>{value}</span>
            </div>
          ))}
          <div style={{ marginTop: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[C.red, '#ff8800', C.yellow, C.green, C.teal, '#0088ff', C.magenta, C.white].map(c => (
              <div key={c} style={{ width: 14, height: 14, background: c, borderRadius: 2 }} />
            ))}
            {/* Settings gear */}
            <button
              onClick={() => setShowSettings(true)}
              title="Settings"
              style={{
                marginLeft: '4px', background: 'transparent', border: 'none',
                color: C.dim, cursor: 'pointer', fontSize: '14px', padding: 0,
                lineHeight: 1,
              }}
            >
              ⚙
            </button>
          </div>
        </div>
      </div>

      {/* ── TERMINAL LOG ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '1rem 2rem',
        display: 'flex', flexDirection: 'column', gap: '1px',
      }}>
        {termLog.map((entry) => (
          <div key={entry.id} style={{ color: entry.color ?? C.white, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {entry.text}
          </div>
        ))}
        {voice.interimTranscript && (
          <div style={{ color: C.dim, fontStyle: 'italic' }}>{voice.interimTranscript}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── PROMPT LINE ── */}
      <div style={{
        padding: '0.5rem 2rem 1rem', borderTop: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0,
      }}>
        <span style={{ color: C.teal }}>user</span>
        <span style={{ color: C.white }}>@</span>
        <span style={{ color: C.teal }}>david</span>
        <span style={{ color: C.white }}>:~$</span>
        <span style={{ color: promptColor, marginLeft: '0.4rem', fontSize: '12px' }}>
          {voice.state === 'waiting'     && `listening for "${WAKE_WORD}"…`}
          {voice.state === 'activated'   && 'speak your command_'}
          {voice.state === 'processing'  && 'processing…'}
          {voice.state === 'speaking'    && 'speaking…'}
          {voice.state === 'error'       && 'mic error — allow access and refresh'}
          {voice.state === 'unsupported' && 'speech api unavailable'}
        </span>
        <span style={{ animation: 'blink 1s step-end infinite', color: C.white }}>█</span>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: #222; }
      `}</style>
    </div>
  );
}
