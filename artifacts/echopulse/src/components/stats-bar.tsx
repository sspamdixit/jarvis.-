import { motion } from 'framer-motion';
import { Activity, Cpu, CheckCircle2, ListTodo } from 'lucide-react';
import type { AssistantStats } from '@workspace/api-client-react/src/generated/api.schemas';

interface StatsBarProps {
  stats: AssistantStats | undefined;
  isLoading: boolean;
}

export function StatsBar({ stats, isLoading }: StatsBarProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-card border border-card-border rounded p-3 animate-pulse"
          >
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-6 bg-muted rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statItems = [
    {
      label: 'LOCAL',
      value: stats.localCommands,
      icon: Activity,
      color: 'text-primary',
      glow: 'drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]',
    },
    {
      label: 'GEMINI',
      value: stats.geminiCommands,
      icon: Cpu,
      color: 'text-secondary',
      glow: 'drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]',
    },
    {
      label: 'COMPLETED',
      value: stats.tasksCompleted,
      icon: CheckCircle2,
      color: 'text-green-400',
      glow: 'drop-shadow-[0_0_6px_rgba(34,197,94,0.5)]',
    },
    {
      label: 'TOTAL TASKS',
      value: stats.tasksTotal,
      icon: ListTodo,
      color: 'text-amber-400',
      glow: 'drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="stats-bar">
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-card/50 backdrop-blur-sm border border-card-border rounded p-3 relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
          data-testid={`stat-${item.label.toLowerCase().replace(' ', '-')}`}
        >
          {/* Background glow on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-secondary/0 group-hover:from-primary/5 group-hover:to-secondary/5 transition-all duration-500" />
          
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-widest text-muted-foreground mb-1">
                {item.label}
              </div>
              <div className={`font-mono text-2xl font-bold ${item.color} ${item.glow} transition-all duration-300`}>
                {item.value.toLocaleString()}
              </div>
            </div>
            <item.icon className={`w-5 h-5 ${item.color} opacity-50`} />
          </div>

          {/* Scanline effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/50 to-transparent h-4 animate-scanline" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
