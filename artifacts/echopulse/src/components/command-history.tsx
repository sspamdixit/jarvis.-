import { motion } from 'framer-motion';
import { Zap, Brain, ArrowRight } from 'lucide-react';
import type { CommandLog } from '@workspace/api-client-react/src/generated/api.schemas';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CommandHistoryProps {
  logs: CommandLog[];
  isLoading: boolean;
}

export function CommandHistory({ logs, isLoading }: CommandHistoryProps) {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-card-border rounded-lg p-4 h-full flex flex-col" data-testid="command-history">
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-mono text-sm tracking-widest text-secondary drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
          COMMAND LOG
        </h2>
      </div>

      {/* Log list */}
      <ScrollArea className="flex-1 -mx-4 px-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-muted/20 border border-muted/30 rounded p-3 animate-pulse"
              >
                <div className="h-3 bg-muted/40 rounded w-1/4 mb-2" />
                <div className="h-4 bg-muted/40 rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted/40 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Brain className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <div className="font-mono text-xs text-muted-foreground">
              NO COMMANDS YET
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-1">
              Start by activating the command orb
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log, index) => {
              const isLocal = log.source === 'local_router';
              const badgeColor = isLocal ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/20 text-secondary border-secondary/40';
              const badgeGlow = isLocal ? 'drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]' : 'drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]';

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-card border border-card-border rounded p-3 hover:border-primary/40 transition-all duration-300"
                  data-testid={`log-item-${log.id}`}
                >
                  {/* Scanline effect on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none rounded overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/50 to-transparent h-4 animate-scanline" />
                  </div>

                  <div className="relative z-10 space-y-2">
                    {/* Header with badge and timestamp */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Source badge */}
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-[10px] tracking-wider ${badgeColor} ${badgeGlow}`}>
                          {isLocal ? (
                            <>
                              <Zap className="w-3 h-3" />
                              LOCAL
                            </>
                          ) : (
                            <>
                              <Brain className="w-3 h-3" />
                              GEMINI
                            </>
                          )}
                        </div>

                        {/* Pattern or action */}
                        {log.matchedPattern && (
                          <div className="font-mono text-[9px] text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">
                            {log.matchedPattern}
                          </div>
                        )}
                        {log.action && (
                          <div className="font-mono text-[9px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {log.action}
                          </div>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="font-mono text-[9px] text-muted-foreground/60 flex-shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
                    </div>

                    {/* Query */}
                    <div className="font-mono text-sm text-foreground/90">
                      {log.query}
                    </div>

                    {/* Reply */}
                    {log.reply && (
                      <div className="flex items-start gap-2 pt-2 border-t border-border/50">
                        <ArrowRight className="w-3 h-3 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="font-mono text-xs text-muted-foreground">
                          {log.reply}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
