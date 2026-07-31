import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Trash2, Plus } from 'lucide-react';
import type { Task } from '@workspace/api-client-react/src/generated/api.schemas';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface TaskPanelProps {
  tasks: Task[];
  isLoading: boolean;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onCreate: (text: string) => void;
}

export function TaskPanel({ tasks, isLoading, onToggle, onDelete, onCreate }: TaskPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  const handleCreate = () => {
    if (newTaskText.trim()) {
      onCreate(newTaskText.trim());
      setNewTaskText('');
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTaskText('');
    }
  };

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-card-border rounded-lg p-4 h-full flex flex-col" data-testid="task-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-sm tracking-widest text-primary drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
          TASK BOARD
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsAdding(true)}
          className="h-7 px-2 font-mono text-xs border-primary/30 hover:border-primary/50 hover:bg-primary/10"
          data-testid="button-add-task"
        >
          <Plus className="w-3 h-3 mr-1" />
          ADD
        </Button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-muted/20 border border-muted/30 rounded p-3 animate-pulse"
              >
                <div className="h-4 bg-muted/40 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Circle className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <div className="font-mono text-xs text-muted-foreground">
              NO TASKS YET
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-1">
              Say "add X to my list" or click ADD
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className={`group relative bg-card border rounded p-3 hover:border-primary/40 transition-all duration-300 ${
                  task.completed ? 'border-green-500/30 bg-green-500/5' : 'border-card-border'
                }`}
                data-testid={`task-item-${task.id}`}
              >
                {/* Scanline effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none rounded overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/50 to-transparent h-4 animate-scanline" />
                </div>

                <div className="relative z-10 flex items-start gap-3">
                  {/* Toggle button */}
                  <button
                    onClick={() => onToggle(task.id, !task.completed)}
                    className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    data-testid={`button-toggle-task-${task.id}`}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  {/* Task text */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-mono text-sm transition-all duration-300 ${
                        task.completed
                          ? 'line-through text-muted-foreground'
                          : 'text-foreground'
                      }`}
                    >
                      {task.text}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(task.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => onDelete(task.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive focus:outline-none flex-shrink-0"
                    data-testid={`button-delete-task-${task.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Add task input */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-primary/50 rounded p-3"
            >
              <Input
                autoFocus
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter task..."
                className="font-mono text-sm bg-transparent border-0 focus-visible:ring-0 px-0"
                data-testid="input-new-task"
              />
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newTaskText.trim()}
                  className="h-7 px-3 font-mono text-xs"
                  data-testid="button-create-task"
                >
                  CREATE
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    setNewTaskText('');
                  }}
                  className="h-7 px-3 font-mono text-xs"
                  data-testid="button-cancel-task"
                >
                  CANCEL
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
