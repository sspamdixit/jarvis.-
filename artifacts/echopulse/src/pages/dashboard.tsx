import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useProcessCommand,
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useListCommandLogs,
  useGetStats,
  getListTasksQueryKey,
  getListCommandLogsQueryKey,
  getGetStatsQueryKey,
} from '@workspace/api-client-react';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import { useSpeechSynthesis } from '@/hooks/use-speech-synthesis';
import { CommandOrb } from '@/components/command-orb';
import { StatsBar } from '@/components/stats-bar';
import { TaskPanel } from '@/components/task-panel';
import { CommandHistory } from '@/components/command-history';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { speak, cancel: cancelSpeech } = useSpeechSynthesis();

  // API queries
  const { data: tasks = [], isLoading: tasksLoading } = useListTasks();
  const { data: logs = [], isLoading: logsLoading } = useListCommandLogs({ limit: 20 });
  const { data: stats, isLoading: statsLoading } = useGetStats();

  // API mutations
  const processCommand = useProcessCommand();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Speech synthesis state management
  const isSpeakingRef = useRef(false);

  const handleTranscript = useCallback((transcript: string) => {
    // Send to API
    processCommand.mutate(
      { data: { query: transcript } },
      {
        onSuccess: (response) => {
          // Speak the reply
          isSpeakingRef.current = true;
          voiceState.setState('speaking');
          
          speak(response.reply, () => {
            isSpeakingRef.current = false;
            voiceState.setState('idle');
          });

          // Refresh data
          queryClient.invalidateQueries({ queryKey: getListCommandLogsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          
          // If it was a task action, refresh tasks too
          if (response.action?.includes('task')) {
            queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          }
        },
        onError: (error) => {
          voiceState.setState('error');
          toast({
            title: 'Command failed',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
          setTimeout(() => {
            voiceState.setState('idle');
          }, 2000);
        },
      }
    );
  }, [processCommand, queryClient, speak, toast]);

  const voiceState = useVoiceRecognition({
    onTranscript: handleTranscript,
    onError: (error) => {
      toast({
        title: 'Voice recognition error',
        description: error,
        variant: 'destructive',
      });
    },
  });

  // Update state when processing
  useEffect(() => {
    if (processCommand.isPending && !isSpeakingRef.current) {
      voiceState.setState('processing');
    }
  }, [processCommand.isPending, voiceState]);

  // Task handlers
  const handleToggleTask = useCallback((id: number, completed: boolean) => {
    updateTask.mutate(
      { id, data: { completed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        },
        onError: (error) => {
          toast({
            title: 'Failed to update task',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
        },
      }
    );
  }, [updateTask, queryClient, toast]);

  const handleDeleteTask = useCallback((id: number) => {
    deleteTask.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        },
        onError: (error) => {
          toast({
            title: 'Failed to delete task',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
        },
      }
    );
  }, [deleteTask, queryClient, toast]);

  const handleCreateTask = useCallback((text: string) => {
    createTask.mutate(
      { data: { text } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          toast({
            title: 'Task created',
            description: text,
          });
        },
        onError: (error) => {
          toast({
            title: 'Failed to create task',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
        },
      }
    );
  }, [createTask, queryClient, toast]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      cancelSpeech();
    };
  }, [cancelSpeech]);

  return (
    <div className="min-h-screen bg-background noise-overlay scanlines" data-testid="dashboard-page">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-mono text-4xl font-bold tracking-wider mb-2">
            <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-pulse-glow">
              ECHOPULSE
            </span>
          </h1>
          <div className="font-mono text-xs tracking-widest text-muted-foreground">
            VOICE ASSISTANT COMMAND CENTER
          </div>
        </div>

        {/* Stats bar */}
        <div className="mb-8">
          <StatsBar stats={stats} isLoading={statsLoading} />
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Command orb - takes center stage */}
          <div className="lg:col-span-2 flex items-center justify-center py-12 bg-card/30 backdrop-blur-sm border border-card-border rounded-lg">
            <CommandOrb
              state={voiceState.state}
              interimTranscript={voiceState.interimTranscript}
              onClick={voiceState.toggleListening}
              isSupported={voiceState.isSupported}
            />
          </div>

          {/* Task panel */}
          <div className="h-[500px]">
            <TaskPanel
              tasks={tasks}
              isLoading={tasksLoading}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
              onCreate={handleCreateTask}
            />
          </div>

          {/* Command history */}
          <div className="h-[500px]">
            <CommandHistory logs={logs} isLoading={logsLoading} />
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center">
          <div className="font-mono text-[10px] text-muted-foreground/60 tracking-wider">
            {voiceState.isSupported ? (
              <>SYSTEM READY • WEB SPEECH API ACTIVE</>
            ) : (
              <>SYSTEM DEGRADED • WEB SPEECH API UNAVAILABLE</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
