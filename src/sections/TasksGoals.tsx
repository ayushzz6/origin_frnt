'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Trash2, 
  Calendar, 
  Clock, 
  ArrowLeft, 
  ListTodo, 
  Target, 
  Search,
  LayoutGrid,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Task, User } from '@/types';

interface TasksGoalsProps {
  tasks: Task[];
  onAddTask: (text: string, due: string) => void;
  onToggleTask: (id: string) => void;
  onRemoveTask: (id: string) => void;
  onBack: () => void;
  user: User;
}

import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';
import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import { useHydratedNow } from '@/hooks/useHydratedNow';

const TASK_DUE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});
const ONE_DAY_MS = 86_400_000;

function getDefaultDueDate(now: number) {
  return new Date(now + ONE_DAY_MS).toISOString().slice(0, 16);
}

export default function TasksGoals({ tasks, onAddTask, onToggleTask, onRemoveTask, onBack, user }: TasksGoalsProps) {
  const { availableWidth } = useLayout();
  const isConstrained = availableWidth < 1024;
  const isMobile = availableWidth < 640;

  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const hydratedNow = useHydratedNow();
  const [lastMutationNow, setLastMutationNow] = useState<number | null>(null);
  const now = lastMutationNow ?? hydratedNow;
  const displayedNewTaskDue = newTaskDue || (now === null ? '' : getDefaultDueDate(now));

  const filteredTasks = tasks.filter(t => {
    const matchesFilter = 
      filter === 'all' ? true : 
      filter === 'active' ? !t.completed : 
      t.completed;
    const matchesSearch = t.text.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    pending: tasks.filter(t => !t.completed).length,
    overdue: now === null ? 0 : tasks.filter(t => !t.completed && new Date(t.due).getTime() < now).length
  };

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    const current = Date.now();
    const dueInput = newTaskDue || displayedNewTaskDue;
    const due = dueInput ? new Date(dueInput).toISOString() : new Date(current + ONE_DAY_MS).toISOString();
    onAddTask(newTaskText.trim(), due);
    setNewTaskText('');
    setLastMutationNow(current);
    setNewTaskDue(getDefaultDueDate(current));
  };

  const isOverdue = (dateString: string) => {
    return now !== null && new Date(dateString).getTime() < now;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? 'Invalid date' : TASK_DUE_FORMATTER.format(date);
  };

  return (
    <div id="tutorial-goals-hub" className="min-h-screen neu-surface text-foreground p-3 sm:p-4 md:p-8 pb-24 md:pb-10 relative overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <button 
              onClick={onBack}
              className="group flex items-center gap-2 text-sky-600 dark:text-sky-400 font-semibold text-sm hover:translate-x-[-4px] transition-transform"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <h1 className="text-xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 bg-sky-500 rounded-lg sm:rounded-2xl shadow-lg shadow-sky-500/20">
                <Target className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
              </div>
              Tasks & Goals
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium pl-9 sm:pl-14 text-[10px] sm:text-sm">
              Hey {user.name}, stay on top of your milestones.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={cn(
          "grid gap-4",
          isConstrained ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"
        )}>
          {[
            { label: 'Total Tasks', value: stats.total, icon: ListTodo, color: 'sky' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'sky' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'amber' },
            { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: 'sky' }
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-slate-900/60 p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all group"
            >
              <div className={cn(
                "rounded-lg sm:rounded-xl flex items-center justify-center mb-1.5 sm:mb-3 group-hover:scale-110 transition-transform",
                isMobile ? "w-7 h-7" : "w-10 h-10",
                `bg-${stat.color}-100 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400`
              )}>
                <stat.icon className={cn(isMobile ? "w-3.5 h-3.5" : "w-5 h-5")} />
              </div>
              <p className={cn("font-black text-slate-900 dark:text-white", isMobile ? "text-lg" : "text-2xl")}>{stat.value}</p>
              <p className="text-[8px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search your tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-card dark:bg-slate-900/60 border border-sky-100 dark:border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="flex bg-white dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm overflow-x-auto no-scrollbar">
              {(['all', 'active', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 sm:px-4 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                    filter === f 
                      ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/20' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* New Task Form - Moved here */}
          <Card className="neu-raised border-0 shadow-none relative overflow-hidden">

            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-6 space-y-1.5">
                  <label className="text-[8px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Task Description</label>
                  <input 
                    type="text"
                    placeholder="What needs to be done?"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 rounded-xl p-3 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[8px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Deadline</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input 
                      type="datetime-local" 
                      value={displayedNewTaskDue}
                      onChange={(e) => setNewTaskDue(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 rounded-xl pl-10 pr-3 py-3 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Button 
                    onClick={handleAddTask}
                    disabled={!newTaskText.trim()}
                    className="w-full h-[46px] bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-lg shadow-sky-500/20 text-xs sm:text-sm font-black gap-2 group"
                  >
                    Add
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task List */}
          <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {filteredTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`group relative bg-white dark:bg-slate-900/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex items-start gap-3 sm:gap-4 ${
                    task.completed 
                      ? 'border-slate-100 dark:border-white/5 opacity-60' 
                      : isOverdue(task.due)
                        ? 'border-sky-100 dark:border-sky-900/30'
                        : 'border-slate-100 dark:border-white/5 hover:border-sky-200 dark:hover:border-sky-900/30'
                  }`}
                >
                  <button 
                    onClick={() => onToggleTask(task.id)}
                    className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      task.completed 
                        ? 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-500/10' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 ${task.completed ? 'block' : 'hidden md:block opacity-0 group-hover:opacity-30'}`} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-sm sm:text-base font-bold transition-all",
                      task.completed ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'
                    )}>
                      <FormattedMessage content={task.text} inline isAssistant={false} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <Badge variant="outline" className={`h-6 px-2 border-0 font-bold text-[10px] uppercase tracking-wider ${
                        task.completed 
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' 
                          : isOverdue(task.due)
                            ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-600'
                            : 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                      }`}>
                        <Calendar className="w-3 h-3 mr-1.5" />
                        {task.completed ? 'Completed' : isOverdue(task.due) ? `Missed: ${formatDate(task.due)}` : `Due: ${formatDate(task.due)}`}
                      </Badge>
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveTask(task.id)}
                    className="p-2 text-slate-300 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-xl transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredTasks.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                  <LayoutGrid className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">No tasks found</h3>
                  <p className="text-sm text-slate-500">Try adjusting your filters or search query.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
