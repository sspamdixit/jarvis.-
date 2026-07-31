import { motion } from 'framer-motion';
import type { VoiceState } from '@/hooks/use-voice-recognition';
import { Activity, Mic, MicOff, Zap, Brain } from 'lucide-react';

interface CommandOrbProps {
  state: VoiceState;
  interimTranscript: string;
  onClick: () => void;
  isSupported: boolean;
}

export function CommandOrb({ state, interimTranscript, onClick, isSupported }: CommandOrbProps) {
  const getStateColor = () => {
    switch (state) {
      case 'listening':
        return 'from-green-500/40 to-green-400/40 shadow-green-500/50';
      case 'processing':
        return 'from-primary/40 to-primary/40 shadow-primary/50';
      case 'speaking':
        return 'from-amber-500/40 to-amber-400/40 shadow-amber-500/50';
      case 'error':
        return 'from-destructive/40 to-destructive/40 shadow-destructive/50';
      default:
        return 'from-muted/20 to-muted/20 shadow-muted/30';
    }
  };

  const getStateIcon = () => {
    switch (state) {
      case 'listening':
        return <Mic className="w-16 h-16 text-green-400" />;
      case 'processing':
        return <Brain className="w-16 h-16 text-primary animate-pulse" />;
      case 'speaking':
        return <Activity className="w-16 h-16 text-amber-400 animate-pulse" />;
      case 'error':
        return <MicOff className="w-16 h-16 text-destructive" />;
      default:
        return <Zap className="w-16 h-16 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'listening':
        return 'LISTENING';
      case 'processing':
        return 'THINKING (GEMINI)';
      case 'speaking':
        return 'SPEAKING';
      case 'error':
        return 'ERROR';
      default:
        return 'IDLE';
    }
  };

  const getStatusGlow = () => {
    switch (state) {
      case 'listening':
        return 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]';
      case 'processing':
        return 'text-primary drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]';
      case 'speaking':
        return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]';
      case 'error':
        return 'text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]';
      default:
        return 'text-muted-foreground';
    }
  };

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center gap-8">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-destructive/20 to-destructive/10 border border-destructive/40" />
          <MicOff className="w-16 h-16 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <div className="font-mono text-sm tracking-wider text-destructive">
            SPEECH RECOGNITION NOT SUPPORTED
          </div>
          <div className="font-mono text-xs text-muted-foreground max-w-sm">
            Your browser doesn't support the Web Speech API. Try Chrome, Edge, or Safari.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8" data-testid="command-orb-container">
      {/* Status indicator */}
      <div className={`font-mono text-sm tracking-widest ${getStatusGlow()} transition-all duration-300`} data-testid="status-text">
        {getStatusText()}
        {state === 'processing' && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-2 inline-block"
          >
            <span className="animate-pulse">.</span>
            <span className="animate-pulse delay-100">.</span>
            <span className="animate-pulse delay-200">.</span>
          </motion.span>
        )}
      </div>

      {/* Main orb */}
      <motion.button
        onClick={onClick}
        className="relative w-64 h-64 flex items-center justify-center cursor-pointer focus:outline-none group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-orb"
      >
        {/* Outer pulse ring */}
        <motion.div
          className={`absolute inset-0 rounded-full bg-gradient-to-br ${getStateColor()} blur-xl transition-all duration-500`}
          animate={{
            scale: state === 'listening' ? [1, 1.1, 1] : state === 'processing' ? [1, 1.05, 1] : 1,
            opacity: state === 'idle' ? 0.3 : 0.6,
          }}
          transition={{
            duration: state === 'listening' ? 1.5 : state === 'processing' ? 2 : 3,
            repeat: state !== 'error' ? Infinity : 0,
            ease: 'easeInOut',
          }}
        />

        {/* Middle ring */}
        <motion.div
          className={`absolute inset-8 rounded-full bg-gradient-to-br ${getStateColor()} border-2 transition-all duration-500`}
          style={{
            borderColor: state === 'listening' ? 'rgb(34 197 94 / 0.5)' :
                         state === 'processing' ? 'rgb(6 182 212 / 0.5)' :
                         state === 'speaking' ? 'rgb(251 191 36 / 0.5)' :
                         state === 'error' ? 'rgb(239 68 68 / 0.5)' :
                         'rgb(148 163 184 / 0.3)',
          }}
          animate={{
            rotate: state === 'processing' ? 360 : 0,
          }}
          transition={{
            duration: 4,
            repeat: state === 'processing' ? Infinity : 0,
            ease: 'linear',
          }}
        />

        {/* Inner core */}
        <div className="absolute inset-16 rounded-full bg-card border border-card-border backdrop-blur-sm flex items-center justify-center overflow-hidden">
          {/* Scanline effect */}
          {state !== 'idle' && (
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/30 to-transparent h-8 animate-scanline" />
            </div>
          )}
          
          {/* Icon */}
          <div className="relative z-10 transition-transform duration-300 group-hover:scale-110">
            {getStateIcon()}
          </div>
        </div>

        {/* Hover glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:to-secondary/10 transition-all duration-500" />
      </motion.button>

      {/* Interim transcript display */}
      {interimTranscript && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="font-mono text-sm text-primary bg-card/80 backdrop-blur-sm border border-primary/30 rounded px-4 py-2 max-w-md text-center"
          data-testid="text-interim-transcript"
        >
          {interimTranscript}
        </motion.div>
      )}

      {/* Click prompt */}
      {state === 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-mono text-xs text-muted-foreground tracking-wider"
        >
          CLICK TO ACTIVATE
        </motion.div>
      )}
    </div>
  );
}
