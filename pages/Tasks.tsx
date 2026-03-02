import React, { useState, useEffect, useMemo } from 'react';
import { Plus, CheckCircle, Circle, Trash2, Calendar, Layout, CalendarDays, User, Filter, ShieldAlert, History, ChevronUp, ChevronDown } from 'lucide-react';
import { PersonalTask, TeamMember } from '../types';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { savePersonalTask, deletePersonalTask } from '../lib/dataService';
import { HistoryModal, taskToHistoryItem } from '../components/HistoryModal';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';
import { CustomDropdown } from '../components/CustomDropdown';

interface TasksProps {
  tasks: PersonalTask[];
  setTasks: (tasks: PersonalTask[]) => void;
  members: TeamMember[];
  currentUser: TeamMember;
  isDarkMode: boolean;
}

export const Tasks: React.FC<TasksProps> = ({ tasks, setTasks, members, currentUser, isDarkMode }) => {
  const [inputs, setInputs] = useState({ day: '', week: '', month: '' });
  const confirm = useConfirm();
  const toast = useToast();

  // Guard: prevent crash if currentUser is not loaded yet
  const userId = currentUser?.id || '';
  const userRole = currentUser?.role || '';

  // Theme Helpers
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
  const headerBg = isDarkMode ? 'bg-dark' : 'bg-slate-50';
  const shadowClass = isDarkMode ? '' : 'shadow-sm';

  // Admin State: Who are we creating the task for? (Independent per scope)
  const [assignees, setAssignees] = useState({
    day: userId,
    week: userId,
    month: userId
  });

  // Admin State: Filter view by user
  const [filterMemberId, setFilterMemberId] = useState<string | 'all'>('all');

  // History toggle
  const [showHistory, setShowHistory] = useState(false);

  // Permissions
  const { permissions: contextPermissions } = useAppData();
  const { isAdmin } = usePermissions(currentUser, contextPermissions);

  // Cleanup logic on mount (Carry over logic)
  useEffect(() => {
    const today = new Date();
    const currentWeekNum = getWeekNumber(today);
    const currentMonthNum = today.getMonth();
    const currentYear = today.getFullYear();

    const cleanedTasks = tasks.filter(task => {
      if (!task.completed) return true; // Always keep incomplete tasks (carry over)

      const taskDate = new Date(task.createdAt);

      // Daily: Keep only if created Today
      if (task.scope === 'day') {
        return taskDate.toDateString() === today.toDateString();
      }

      // Weekly: Keep only if created in current ISO week
      if (task.scope === 'week') {
        return getWeekNumber(taskDate) === currentWeekNum && taskDate.getFullYear() === currentYear;
      }

      // Monthly: Keep only if created in current Month
      if (task.scope === 'month') {
        return taskDate.getMonth() === currentMonthNum && taskDate.getFullYear() === currentYear;
      }

      return true;
    });

    // Only update if there's a difference to avoid infinite loop
    if (cleanedTasks.length !== tasks.length) {
      setTasks(cleanedTasks);
    }
  }, []);

  function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  }

  // Filter Tasks based on Permissions
  const visibleTasks = useMemo(() => {
    if (isAdmin) {
      if (filterMemberId === 'all') return tasks;
      return tasks.filter(t => t.assigneeId === filterMemberId);
    } else {
      // Standard User: Only see own tasks
      return tasks.filter(t => t.assigneeId === userId);
    }
  }, [tasks, isAdmin, filterMemberId, userId]);

  const handleAddTask = async (scope: 'day' | 'week' | 'month') => {
    if (!inputs[scope].trim()) return;

    const targetUserId = isAdmin ? assignees[scope] : userId;

    const newTask: PersonalTask = {
      id: Date.now(),
      text: inputs[scope],
      scope,
      completed: false,
      createdAt: new Date().toISOString(),
      assigneeId: targetUserId
    };

    // Persistir no Supabase
    const result = await savePersonalTask(newTask);
    if (!result.success) {
      toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
      return;
    }

    setTasks([...tasks, newTask]);
    setInputs(prev => ({ ...prev, [scope]: '' }));
  };

  const toggleTask = async (id: number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const updatedTask = {
      ...task,
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : undefined
    };

    // Persistir no Supabase
    await savePersonalTask(updatedTask);

    setTasks(tasks.map(t => t.id === id ? updatedTask : t));
  };

  const deleteTask = async (id: number) => {
    if (!isAdmin) return;
    const ok = await confirm({
      title: 'Excluir Tarefa',
      message: 'Tem certeza que deseja excluir esta tarefa?',
      variant: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (ok) {
      // Persistir no Supabase
      const result = await deletePersonalTask(id);
      if (!result.success) {
        toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
        return;
      }
      setTasks(tasks.filter(t => t.id !== id));
      toast.success('Tarefa excluída');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, scope: 'day' | 'week' | 'month') => {
    if (e.key === 'Enter') {
      handleAddTask(scope);
    }
  };

  const renderColumn = (scope: 'day' | 'week' | 'month', title: string, icon: React.ElementType, colorClass: string) => {
    const scopeTasks = visibleTasks.filter(t => t.scope === scope);
    const Icon = icon;

    return (
      <div className={`flex-1 flex flex-col ${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden h-full min-h-[400px]`}>
        {/* Header */}
        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${headerBg}`}>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10 text-opacity-100`}>
              <Icon size={18} />
            </div>
            <h3 className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{title}</h3>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full border ${isDarkMode ? 'bg-dark border-dark-border text-slate-400' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
            {scopeTasks.filter(t => !t.completed).length} pendentes
          </span>
        </div>

        {/* Input Area - Only Visible to Admin (Delegation) */}
        {isAdmin && (
          <div className={`p-3 border-b ${borderCol} ${isDarkMode ? 'bg-dark/50' : 'bg-white'}`}>
            <div className="flex gap-2 mb-2">
              <CustomDropdown
                value={assignees[scope]}
                onChange={v => setAssignees(prev => ({ ...prev, [scope]: v }))}
                options={[
                  { value: userId, label: 'Para Mim', icon: <User size={12} /> },
                  ...members.filter(m => m.id !== userId).map(m => ({ value: m.id, label: `Para: ${m.name}`, icon: <User size={12} /> }))
                ]}
                isDarkMode={isDarkMode}
              />
            </div>
            <div className="relative">
              <input
                type="text"
                value={inputs[scope]}
                onChange={(e) => setInputs(prev => ({ ...prev, [scope]: e.target.value }))}
                onKeyDown={(e) => handleKeyDown(e, scope)}
                placeholder={`Adicionar tarefa...`}
                className={`w-full border rounded-lg py-2.5 pl-3 pr-10 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none ${isDarkMode ? 'bg-dark border-dark-border text-white placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'}`}
              />
              <button
                onClick={() => handleAddTask(scope)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Input Area - For Standard User (Own Tasks) */}
        {!isAdmin && (
          <div className={`p-3 border-b ${borderCol} ${isDarkMode ? 'bg-dark/50' : 'bg-white'}`}>
            <div className="relative">
              <input
                type="text"
                value={inputs[scope]}
                onChange={(e) => setInputs(prev => ({ ...prev, [scope]: e.target.value }))}
                onKeyDown={(e) => handleKeyDown(e, scope)}
                placeholder={`Adicionar tarefa...`}
                className={`w-full border rounded-lg py-2.5 pl-3 pr-10 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none ${isDarkMode ? 'bg-dark border-dark-border text-white placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'}`}
              />
              <button
                onClick={() => handleAddTask(scope)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
          {scopeTasks.length === 0 && (
            <div className={`text-center py-10 ${textSub} text-sm flex flex-col items-center`}>
              <span className="opacity-50 mb-2">📭</span>
              Nenhuma tarefa.
            </div>
          )}
          {scopeTasks.map(task => {
            const assignee = members.find(m => m.id === task.assigneeId);

            return (
              <div
                key={task.id}
                className={`group flex items-start gap-3 p-3 rounded-lg border transition-all duration-200
                  ${task.completed
                    ? (isDarkMode ? 'bg-dark/50 border-dark-border/50 opacity-60' : 'bg-slate-50 border-slate-100 opacity-60')
                    : (isDarkMode ? 'bg-dark/30 border-dark-border hover:border-dark-border/80 hover:bg-dark/60' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50')
                  }
                `}
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`mt-0.5 flex-shrink-0 transition-colors ${task.completed ? 'text-primary' : `${textSub} hover:${textMain}`}`}
                  title="Marcar como concluída / pendente"
                >
                  {task.completed ? <CheckCircle size={18} /> : <Circle size={18} />}
                </button>

                <div className="flex-1 min-w-0">
                  <span className={`text-sm break-words block ${task.completed ? 'line-through text-slate-500' : textMain}`}>
                    {task.text}
                  </span>
                  {/* Show assignee badge if Admin viewing all */}
                  {isAdmin && filterMemberId === 'all' && assignee && (
                    <div className="mt-1 flex items-center gap-1">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {assignee.name.charAt(0)}
                      </div>
                      <span className={`text-[10px] ${textSub} truncate`}>{assignee.name}</span>
                    </div>
                  )}
                </div>

                {/* Delete Button - Admin Only */}
                {isAdmin && (
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Excluir (Admin)"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
            Tarefas & Delegação
            {!isAdmin && <span className={`text-xs px-2 py-1 rounded border font-normal ${isDarkMode ? 'bg-dark text-slate-400 border-dark-border' : 'bg-white text-slate-600 border-slate-200'}`}>Minhas Tarefas</span>}
          </h1>
          <p className={`${textSub} text-sm mt-1`}>
            {isAdmin
              ? "Gerencie e delegue tarefas para toda a equipe. Tarefas não concluídas acumulam."
              : "Visualize e conclua suas tarefas diárias atribuídas pela gestão."}
          </p>
        </div>

        {/* Admin Filter Toolbar */}
        {isAdmin && (
          <div className={`flex items-center gap-2 p-1.5 rounded-lg border ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-300'}`}>
            <Filter size={16} className={`${textSub} ml-2`} />
            <span className={`text-xs ${textSub} font-medium hidden sm:inline`}>Visualizar:</span>
            <CustomDropdown
              value={filterMemberId}
              onChange={setFilterMemberId}
              options={[
                { value: 'all', label: 'Todos os Colaboradores' },
                { value: userId, label: 'Minhas Tarefas (Admin)', icon: <User size={12} /> },
                ...members.filter(m => m.id !== userId).map(m => ({ value: m.id, label: m.name, icon: <User size={12} /> }))
              ]}
              isDarkMode={isDarkMode}
              className="flex-1"
            />
          </div>
        )}

        {/* History Toggle Button */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${showHistory ? 'bg-primary text-white border-primary' : `${isDarkMode ? 'bg-dark-surface border-dark-border text-slate-400 hover:text-primary' : 'bg-white border-slate-300 text-slate-600 hover:text-primary'}`}`}
        >
          <History size={16} />
          <span className="text-sm font-medium hidden sm:inline">{showHistory ? 'Ocultar' : 'Histórico'}</span>
          {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {!isAdmin && (
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-3 rounded-lg mb-6 flex items-center gap-2 text-sm">
          <ShieldAlert size={16} />
          Você está no modo colaborador: Apenas marque as tarefas como concluídas. Edições são restritas à gestão.
        </div>
      )}

      {/* History Modal */}
      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="Histórico de Tarefas"
        items={tasks.map(taskToHistoryItem)}
        members={members}
        isDarkMode={isDarkMode}
        itemType="task"
      />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {renderColumn('day', 'Tarefas do Dia', Calendar, 'text-primary bg-primary')}
        {renderColumn('week', 'Tarefas da Semana', Layout, 'text-blue-500 bg-blue-500')}
        {renderColumn('month', 'Tarefas do Mês', CalendarDays, 'text-violet-500 bg-violet-500')}
      </div>
    </div>
  );
};