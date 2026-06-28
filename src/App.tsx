/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Flag, 
  Search,
  Filter,
  Check,
  X,
  AlertCircle,
  Clock,
  Bell,
  BellRing,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isPast, isToday, isTomorrow, parseISO, compareAsc } from 'date-fns';

type Priority = 'low' | 'medium' | 'high';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  reminderAt?: string;
  tags: string[];
  createdAt: number;
}

const PRIORITY_COLORS = {
  low: 'text-blue-500 bg-blue-50 border-blue-100',
  medium: 'text-amber-500 bg-amber-50 border-amber-100',
  high: 'text-rose-500 bg-rose-50 border-rose-100',
};

export default function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('focusflow_todos');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((todo: any) => ({
        ...todo,
        tags: todo.tags || []
      }));
    } catch (e) {
      console.error('Failed to parse todos', e);
      return [];
    }
  });
  const [inputText, setInputText] = useState('');
  const [inputPriority, setInputPriority] = useState<Priority>('medium');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTags, setEditTags] = useState('');
  const [reminderEditingId, setReminderEditingId] = useState<string | null>(null);
  const [tempReminderDate, setTempReminderDate] = useState('');
  const [tempReminderTime, setTempReminderTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [sortMethod, setSortMethod] = useState<'created' | 'alpha' | 'reminderAt' | 'priority'>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [lastDeletedTodo, setLastDeletedTodo] = useState<Todo | null>(null);
  const [showUndo, setShowUndo] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('focusflow_todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: inputText.trim(),
      completed: false,
      priority: inputPriority,
      tags: [],
      createdAt: Date.now(),
    };

    setTodos([newTodo, ...todos]);
    setInputText('');
    setInputPriority('medium');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: string) => {
    const todoToDelete = todos.find(t => t.id === id);
    if (todoToDelete) {
      setLastDeletedTodo(todoToDelete);
      setTodos(todos.filter(t => t.id !== id));
      setShowUndo(true);
      // Auto-hide undo after 5 seconds
      setTimeout(() => setShowUndo(false), 5000);
    }
  };

  const undoDelete = () => {
    if (lastDeletedTodo) {
      setTodos(prev => [lastDeletedTodo, ...prev]);
      setLastDeletedTodo(null);
      setShowUndo(false);
    }
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
    setEditTags(todo.tags.join(', '));
  };

  const saveEdit = (id: string) => {
    if (!editText.trim()) return;
    setTodos(todos.map(t => t.id === id ? { 
      ...t, 
      text: editText.trim(),
      tags: editTags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
    } : t));
    setEditingId(null);
  };

  const startReminderEdit = (todo: Todo) => {
    setReminderEditingId(todo.id);
    if (todo.reminderAt) {
      const [date, time] = todo.reminderAt.split('T');
      setTempReminderDate(date);
      setTempReminderTime(time.substring(0, 5));
    } else {
      setTempReminderDate(format(new Date(), 'yyyy-MM-dd'));
      setTempReminderTime('12:00');
    }
  };

  const saveReminder = (id: string) => {
    const newReminder = (tempReminderDate && tempReminderTime) ? `${tempReminderDate}T${tempReminderTime}:00` : undefined;
    setTodos(todos.map(t => t.id === id ? { ...t, reminderAt: newReminder } : t));
    setReminderEditingId(null);
  };

  const removeReminder = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, reminderAt: undefined } : t));
    setReminderEditingId(null);
  };

  const filteredTodos = useMemo(() => {
    return todos
      .filter(t => {
        const matchesFilter = filter === 'all' || 
          (filter === 'active' && !t.completed) || 
          (filter === 'completed' && t.completed);
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = t.text.toLowerCase().includes(searchLower) || 
                             t.tags.some(tag => tag.toLowerCase().includes(searchLower));
        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => {
        // Always keep completed at the bottom if sorting by priority or general
        if (a.completed !== b.completed) return a.completed ? 1 : -1;

        let comparison = 0;
        
        switch (sortMethod) {
          case 'alpha':
            comparison = a.text.localeCompare(b.text);
            break;
          case 'priority':
            const weights = { high: 0, medium: 1, low: 2 };
            comparison = weights[a.priority] - weights[b.priority];
            break;
          case 'reminderAt':
            if (a.reminderAt && b.reminderAt) comparison = compareAsc(parseISO(a.reminderAt), parseISO(b.reminderAt));
            else if (a.reminderAt) comparison = -1;
            else if (b.reminderAt) comparison = 1;
            break;
          case 'created':
            comparison = a.createdAt - b.createdAt;
            break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [todos, filter, searchQuery, sortMethod, sortDirection]);

  const counts = {
    all: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length,
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 mb-2"
          >
            <div className="bg-brand-primary p-2 rounded-xl text-white">
              <CheckCircle2 size={28} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">FocusFlow</h1>
          </motion.div>
          <p className="text-brand-secondary text-sm">Quiet your mind, one task at a time.</p>
        </header>

        {/* Input Area */}
        <section className="card p-5 mb-8">
          <form onSubmit={addTodo} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="What needs to be done?"
                className="input-field flex-1 text-lg"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button 
                type="submit" 
                className="btn-primary flex items-center gap-2 h-[52px] px-6"
                disabled={!inputText.trim()}
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Add Task</span>
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-brand-secondary">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <Flag size={14} className={inputPriority === 'high' ? 'text-rose-500' : 'text-gray-400'} />
                <select 
                  className="bg-transparent outline-none cursor-pointer font-medium"
                  value={inputPriority}
                  onChange={(e) => setInputPriority(e.target.value as Priority)}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
            </div>
          </form>
        </section>

        {/* Status & Filters */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
              {(['all', 'active', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filter === f 
                      ? 'bg-white text-brand-primary shadow-sm' 
                      : 'text-gray-500 hover:text-brand-primary'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-2 opacity-30 tabular-nums text-[10px]">{counts[f]}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
              <select 
                className="bg-transparent outline-none text-xs font-semibold px-2 py-1 text-gray-600 cursor-pointer"
                value={sortMethod}
                onChange={(e) => setSortMethod(e.target.value as any)}
              >
                <option value="priority">Priority</option>
                <option value="reminderAt">Reminder</option>
                <option value="created">Created</option>
                <option value="alpha">A-Z</option>
              </select>
              <button 
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-1 hover:bg-white rounded-lg transition-colors text-gray-500"
                title="Toggle Sort Direction"
              >
                <Filter size={14} className={sortDirection === 'desc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
            </div>
          </div>

          <div className="relative flex-1 md:max-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search tasks..."
              className="input-field pl-10 w-full text-sm py-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </section>

        {/* Todo List */}
        <div className="space-y-3 relative">
          <AnimatePresence mode="popLayout">
            {filteredTodos.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-20 text-center flex flex-col items-center justify-center opacity-40"
              >
                <div className="mb-4 bg-gray-100 p-6 rounded-full">
                  <Check size={48} className="text-gray-400" />
                </div>
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm">Enjoy your clean headspace.</p>
              </motion.div>
            ) : (
              filteredTodos.map((todo) => (
                <motion.div
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className={`card group transition-all duration-300 ${
                    todo.completed ? 'opacity-60 bg-gray-50/50 grayscale-[0.3]' : 'hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="p-4 flex items-start gap-4">
                    <button 
                      onClick={() => toggleTodo(todo.id)}
                      className={`mt-1 transition-transform active:scale-90 ${
                        todo.completed ? 'text-green-500' : 'text-gray-300 hover:text-brand-primary'
                      }`}
                    >
                      {todo.completed ? (
                        <CheckCircle2 size={24} />
                      ) : (
                        <Circle size={24} />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      {editingId === todo.id ? (
                        <div className="flex flex-col gap-2">
                          <input 
                            autoFocus
                            className="input-field py-1"
                            placeholder="Task name"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                          />
                          <div className="flex items-center gap-2">
                            <Tag size={12} className="text-gray-400" />
                            <input 
                              className="input-field flex-1 py-0.5 text-xs"
                              placeholder="Tags (comma separated)"
                              value={editTags}
                              onChange={(e) => setEditTags(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                            />
                            <button onClick={() => saveEdit(todo.id)} className="text-brand-primary p-1">
                              <Check size={20} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 p-1">
                              <X size={20} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <p className={`text-base font-medium break-words leading-tight ${
                            todo.completed ? 'line-through text-gray-500' : 'text-brand-primary'
                          }`}>
                            {todo.text}
                          </p>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[todo.priority]}`}>
                              {todo.priority}
                            </span>
                            
                            {todo.tags.map((tag, i) => (
                              <span key={i} className="text-[10px] lowercase font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                                #{tag}
                              </span>
                            ))}
                            
                            {reminderEditingId === todo.id ? (
                              <div className="flex items-center gap-2 bg-white shadow-sm border border-gray-100 rounded-lg p-1 animate-in zoom-in-95 duration-150">
                                <input 
                                  type="date"
                                  className="text-[10px] outline-none"
                                  value={tempReminderDate}
                                  onChange={(e) => setTempReminderDate(e.target.value)}
                                />
                                <input 
                                  type="time"
                                  className="text-[10px] outline-none"
                                  value={tempReminderTime}
                                  onChange={(e) => setTempReminderTime(e.target.value)}
                                />
                                <button onClick={() => saveReminder(todo.id)} className="p-0.5 text-green-500 hover:bg-green-50 rounded">
                                  <Check size={12} />
                                </button>
                                <button onClick={() => removeReminder(todo.id)} className="p-0.5 text-rose-500 hover:bg-rose-50 rounded">
                                  <Trash2 size={12} />
                                </button>
                                <button onClick={() => setReminderEditingId(null)} className="p-0.5 text-gray-400 hover:bg-gray-50 rounded">
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              todo.reminderAt && (
                                <button 
                                  onClick={() => startReminderEdit(todo)}
                                  className={`text-xs flex items-center gap-1.5 px-2 py-0.5 rounded-full hover:bg-gray-100 transition-colors ${
                                    isPast(parseISO(todo.reminderAt)) && !todo.completed
                                      ? 'text-rose-500 font-medium'
                                      : 'text-brand-secondary'
                                  }`}
                                >
                                  <Bell size={12} className={isPast(parseISO(todo.reminderAt)) && !todo.completed ? 'animate-pulse' : ''} />
                                  {isToday(parseISO(todo.reminderAt)) ? `Today at ${format(parseISO(todo.reminderAt), 'p')}` : 
                                   isTomorrow(parseISO(todo.reminderAt)) ? `Tomorrow at ${format(parseISO(todo.reminderAt), 'p')}` : 
                                   format(parseISO(todo.reminderAt), 'MMM d, p')}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!todo.reminderAt && reminderEditingId !== todo.id && (
                        <button 
                          onClick={() => startReminderEdit(todo)}
                          className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-50 rounded-lg transition-colors"
                          title="Add Reminder"
                        >
                          <Bell size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => startEdit(todo)}
                        className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => deleteTodo(todo.id)}
                        className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Footer Meta */}
        <footer className="mt-20 py-8 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>© {new Date().getFullYear()} FocusFlow • Your focus, organized.</p>
        </footer>
      </div>

      {/* Undo Notification */}
      <AnimatePresence>
        {showUndo && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-brand-primary text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4"
          >
            <span className="text-sm font-medium">Task deleted</span>
            <button 
              onClick={undoDelete}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Undo
            </button>
            <button onClick={() => setShowUndo(false)} className="opacity-50 hover:opacity-100">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
