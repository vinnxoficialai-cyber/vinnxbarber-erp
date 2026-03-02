import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Briefcase, Phone, User, CalendarDays, AlertTriangle, CheckCircle2, Pencil, Hourglass, Trash2, Clock } from 'lucide-react';
import { ProjectTask, TaskStatus, DeadlineOption, Client, TeamMember } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { saveProjectTask, deleteProjectTask } from '../lib/dataService';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';


interface ProjectsProps {
  initialModalOpen?: boolean;
  onConsumeModalTrigger?: () => void;
  tasks: ProjectTask[];
  setTasks: (tasks: ProjectTask[]) => void;
  clients: Client[];
  globalSearchTerm?: string;
  isDarkMode: boolean;
  currentUser: TeamMember;
}

const ProjectCard: React.FC<{
  task: ProjectTask;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onEdit: (task: ProjectTask) => void;
  onDelete: (id: number) => void;
  isDarkMode: boolean;
  canEdit: boolean;
  canDelete: boolean;
}> = ({ task, onDragStart, onEdit, onDelete, isDarkMode, canEdit, canDelete }) => {

  const timeElapsed = task.deadline - task.daysLeft;
  const progressPercent = Math.min((timeElapsed / task.deadline) * 100, 100);

  const isOverdue = task.daysLeft < 0 && task.status !== 'done';
  const isUrgent = task.daysLeft >= 0 && task.daysLeft <= 3 && task.status !== 'done';
  const isOnTrack = task.daysLeft > 3 && task.status !== 'done';

  const isReview = task.status === 'review';
  const isDone = task.status === 'done';

  const cardBg = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderColor = isOverdue
    ? 'border-red-500/70'
    : isUrgent
      ? 'border-yellow-500/50'
      : isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const shadowClass = isOverdue
    ? 'shadow-[0_0_12px_rgba(239,68,68,0.15)]'
    : isDarkMode ? '' : 'shadow-sm';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className={`${cardBg} border ${borderColor} ${shadowClass} p-4 rounded-lg hover:border-emerald-500/50 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group animate-in zoom-in-95 duration-200 ${isOverdue ? 'animate-pulse-subtle' : ''}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${isDarkMode ? 'bg-dark text-slate-400 border-dark-border' : 'bg-slate-100 text-slate-600 border-slate-200'} border truncate max-w-[120px]`}>
            {task.segment}
          </span>
          {isOverdue && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
              ATRASADO
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {canEdit && (
            <button
              onClick={() => onEdit(task)}
              className="text-slate-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all duration-200 transform hover:scale-110"
            >
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(task.id)}
              className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 transform hover:scale-110"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <h4 className={`text-sm font-bold ${textMain} mb-1 truncate`}>{task.title}</h4>

      <div className={`flex items-center gap-1.5 text-xs ${textSub} mb-4`}>
        <User size={12} className={textSub} />
        <span className="truncate">{task.clientName}</span>
      </div>

      <div className="mb-3">
        {isDone ? (
          <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="text-xs font-bold text-emerald-500">Concluído</span>
          </div>
        ) : isReview ? (
          <div className="w-full py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center justify-center gap-2">
            <Hourglass size={14} className="text-yellow-500" />
            <span className="text-xs font-bold text-yellow-500">Em Aprovação</span>
          </div>
        ) : isOverdue ? (
          <div className="w-full py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-xs font-bold text-red-400">
              {Math.abs(task.daysLeft)}d atrasado
            </span>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-end mb-1.5">
              <span className={`text-[10px] ${textSub} font-medium`}>{task.deadline} dias</span>
              <span className={`text-[10px] font-bold flex items-center gap-1
                ${isUrgent ? 'text-yellow-400' : 'text-emerald-400'}
              `}>
                {isUrgent && <AlertTriangle size={10} />}
                {task.daysLeft}d restantes
              </span>
            </div>
            <div className={`h-1.5 w-full ${isDarkMode ? 'bg-dark' : 'bg-slate-200'} rounded-full overflow-hidden`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${isUrgent ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}
      </div>

      <div className={`flex justify-between items-center pt-3 border-t ${isDarkMode ? 'border-dark-border' : 'border-slate-300'}`}>
        <div className={`flex items-center gap-1.5 text-xs ${textSub} hover:text-slate-300 transition-colors cursor-pointer truncate`} title={task.clientPhone}>
          <Phone size={12} />
          <span className="truncate">{task.clientPhone}</span>
        </div>
      </div>
    </div>
  );
};

const Column: React.FC<{
  id: TaskStatus;
  title: string;
  tasks: ProjectTask[];
  color: string;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onAddTask: (status: TaskStatus) => void;
  onEdit: (task: ProjectTask) => void;
  onDelete: (id: number) => void;
  isDarkMode: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}> = ({ id, title, tasks, color, onDrop, onDragOver, onDragStart, onAddTask, onEdit, onDelete, isDarkMode, canCreate, canEdit, canDelete }) => (
  <div
    className="flex flex-col h-full min-w-0"
    onDrop={(e) => onDrop(e, id)}
    onDragOver={onDragOver}
  >
    <div className="flex items-center justify-between mb-4 px-1 shrink-0">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`}></div>
        <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{title}</h3>
        <span className={`text-xs ${isDarkMode ? 'text-slate-500 bg-dark border-dark-border' : 'text-slate-600 bg-white border-slate-300'} px-2 py-0.5 rounded-full border`}>{tasks.length}</span>
      </div>
      {canCreate && (
        <button
          onClick={() => onAddTask(id)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Plus size={16} />
        </button>
      )}
    </div>

    <div className={`flex-1 overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-dark/20' : 'bg-slate-200/50'} rounded-xl p-2 space-y-3 transition-colors`}>
      {tasks.map((task) => (
        <ProjectCard
          key={task.id}
          task={task}
          onDragStart={onDragStart}
          onEdit={onEdit}
          onDelete={onDelete}
          isDarkMode={isDarkMode}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ))}

      {canCreate && (
        <button
          onClick={() => onAddTask(id)}
          className={`w-full py-2 border-2 border-dashed ${isDarkMode ? 'border-dark-border text-slate-500 hover:border-slate-700 hover:text-slate-400' : 'border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500'} rounded-lg text-sm transition-colors flex items-center justify-center gap-2 opacity-60 hover:opacity-100 shrink-0`}
        >
          <Plus size={14} /> Adicionar
        </button>
      )}
    </div>
  </div>
);

export const Projects: React.FC<ProjectsProps> = ({ initialModalOpen = false, onConsumeModalTrigger, tasks, setTasks, clients, globalSearchTerm, isDarkMode, currentUser }) => {
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo');
  const confirm = useConfirm();
  const toast = useToast();

  // Access Control
  const { permissions: contextPermissions } = useAppData();
  const { canCreate, canEdit, canDelete, isAdminOrManager } = usePermissions(currentUser, contextPermissions);
  const canCreateProject = canCreate('/projects');
  const canEditProject = canEdit('/projects');
  const canDeleteProject = canDelete('/projects');
  // Note: canViewAllData returns true for 'read' level, but Sales should only see their OWN tasks.
  const viewAll = isAdminOrManager;

  // Theme Helpers
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const textMain = isDarkMode ? 'text-white' : 'text-slate-900';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';

  // Filtered Tasks for Search
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    if (globalSearchTerm !== undefined) {
      setLocalSearch(globalSearchTerm);
    }
  }, [globalSearchTerm]);

  const filteredTasks = tasks.filter(t => {
    // Data Scoping
    if (!viewAll && t.salesExecutiveId !== currentUser.id) return false;

    return t.title.toLowerCase().includes(localSearch.toLowerCase()) ||
      t.clientName.toLowerCase().includes(localSearch.toLowerCase())
  });

  // Overdue projects notification
  const overdueProjects = filteredTasks.filter(t => t.daysLeft < 0 && t.status !== 'done');
  const urgentProjects = filteredTasks.filter(t => t.daysLeft >= 0 && t.daysLeft <= 3 && t.status !== 'done');

  const [formData, setFormData] = useState({
    title: '',
    clientName: '',
    clientPhone: '',
    segment: '',
    deadline: 15 as DeadlineOption,
    selectedClientId: ''
  });

  // Form validation - required fields
  const isFormValid = useMemo(() => {
    return formData.title.trim() !== '' &&
      formData.clientName.trim() !== '' &&
      formData.segment.trim() !== '';
  }, [formData.title, formData.clientName, formData.segment]);

  // FUNCTIONS DEFINED BEFORE USE EFFECT
  const openNewTaskModal = (status: TaskStatus = 'todo') => {
    setEditingId(null);
    setNewTaskStatus(status);
    setFormData({
      title: '',
      clientName: '',
      clientPhone: '',
      segment: '',
      deadline: 15,
      selectedClientId: ''
    });
    setIsModalOpen(true);
  };

  const handleEditTask = (task: ProjectTask) => {
    setEditingId(task.id);
    setNewTaskStatus(task.status);
    setFormData({
      title: task.title,
      clientName: task.clientName,
      clientPhone: task.clientPhone,
      segment: task.segment,
      deadline: task.deadline,
      selectedClientId: ''
    });
    setIsModalOpen(true);
  };

  // Effect to handle navigation from Dashboard that requests to open the modal
  useEffect(() => {
    if (initialModalOpen) {
      setTimeout(() => {
        openNewTaskModal('todo');
      }, 50);

      if (onConsumeModalTrigger) {
        onConsumeModalTrigger();
      }
    }
  }, [initialModalOpen]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('taskId', id.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = Number(e.dataTransfer.getData('taskId'));
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === status) return;

    const updatedTask = { ...task, status };

    // Update local state immediately for snappy UX
    setTasks(tasks.map((t) => (t.id === taskId ? updatedTask : t)));

    // Persist to Supabase
    const result = await saveProjectTask(updatedTask);
    if (!result.success) {
      // Revert on failure
      setTasks(tasks.map((t) => (t.id === taskId ? task : t)));
      toast.error('Erro ao mover', result.error || 'Não foi possível salvar a mudança de status.');
    }
  };

  // Handle Client Selection
  const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clientId = Number(e.target.value);
    const selectedClient = clients.find(c => c.id === clientId.toString());

    if (selectedClient) {
      setFormData(prev => ({
        ...prev,
        selectedClientId: e.target.value,
        clientName: selectedClient.name,
        clientPhone: selectedClient.phone,
        segment: selectedClient.segment || prev.segment
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        selectedClientId: '',
        clientName: '',
        clientPhone: '',
        segment: ''
      }));
    }
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
        .replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, clientPhone: formatPhoneNumber(e.target.value) });
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();

    let taskToSave: ProjectTask;

    if (editingId) {
      const existingTask = tasks.find(t => t.id === editingId);
      if (!existingTask) return;

      const newDaysLeft = existingTask.deadline !== formData.deadline ? formData.deadline : existingTask.daysLeft;
      taskToSave = {
        ...existingTask,
        title: formData.title,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        segment: formData.segment,
        deadline: formData.deadline,
        daysLeft: newDaysLeft
      };
    } else {
      taskToSave = {
        id: Date.now(),
        title: formData.title,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        segment: formData.segment,
        deadline: formData.deadline,
        daysLeft: formData.deadline, // Inicialmente igual ao prazo total
        status: newTaskStatus,
        createdAt: new Date().toISOString(),
        salesExecutiveId: currentUser.id // Set owner
      };
    }

    // Persistir no Supabase
    const result = await saveProjectTask(taskToSave);
    if (!result.success) {
      toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
      return;
    }

    if (editingId) {
      setTasks(tasks.map(t => t.id === editingId ? taskToSave : t));
      toast.success('Projeto atualizado');
    } else {
      setTasks([...tasks, taskToSave]);
      toast.success('Projeto criado');
    }

    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleDeleteTask = async (id: number) => {
    const ok = await confirm({
      title: 'Excluir Projeto',
      message: 'Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (ok) {
      // Persistir no Supabase
      const result = await deleteProjectTask(id);
      if (!result.success) {
        toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
        return;
      }
      setTasks(tasks.filter(t => t.id !== id));
      toast.success('Projeto excluído');
    }
  };

  const columns: { id: TaskStatus; title: string; color: string }[] = [
    { id: 'todo', title: 'A Fazer', color: 'bg-slate-500' },
    { id: 'in-progress', title: 'Em Progresso', color: 'bg-blue-500' },
    { id: 'review', title: 'Em Revisão', color: 'bg-yellow-500' },
    { id: 'done', title: 'Concluído', color: 'bg-emerald-500' },
  ];

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col animate-in fade-in zoom-in-95 duration-500 relative">

      {/* Modal with High Z-Index */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <h3 className={`font-semibold text-lg ${textMain}`}>
                {editingId ? 'Editar Projeto' : 'Novo Projeto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Nome do Projeto</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-slate-500`}
                  placeholder="Ex: Integração IA WhatsApp"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <User size={12} /> Selecionar Cliente Existente
                  </label>
                  <CustomDropdown
                    value={formData.selectedClientId}
                    onChange={v => {
                      const selectedClient = clients.find(c => c.id === v);
                      if (selectedClient) {
                        setFormData(prev => ({
                          ...prev,
                          selectedClientId: v,
                          clientName: selectedClient.name,
                          clientPhone: selectedClient.phone,
                          segment: selectedClient.segment || prev.segment
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          selectedClientId: '',
                          clientName: '',
                          clientPhone: '',
                          segment: ''
                        }));
                      }
                    }}
                    options={[
                      { value: '', label: 'Selecione um cliente...' },
                      ...clients.map(c => ({ value: c.id, label: `${c.name} - ${c.company}`, icon: <User size={12} /> }))
                    ]}
                    isDarkMode={isDarkMode}
                    placeholder="Selecione um cliente..."
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <User size={12} /> Nome do Cliente
                  </label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-slate-500`}
                    placeholder="Nome do cliente"
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <Phone size={12} /> Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.clientPhone}
                    onChange={handlePhoneChange}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-slate-500`}
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <Briefcase size={12} /> Segmento
                  </label>
                  <input
                    type="text"
                    value={formData.segment}
                    onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-slate-500`}
                    placeholder="Ex: Varejo, Saúde..."
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <CalendarDays size={12} /> Prazo de Entrega
                  </label>
                  <CustomDropdown
                    value={String(formData.deadline)}
                    onChange={v => setFormData({ ...formData, deadline: Number(v) as DeadlineOption })}
                    options={[
                      { value: '7', label: '7 Dias (Rápido)' },
                      { value: '15', label: '15 Dias (Padrão)' },
                      { value: '30', label: '30 Dias (Extenso)' },
                    ]}
                    isDarkMode={isDarkMode}
                    icon={<CalendarDays size={12} />}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isFormValid}
                className={`w-full py-2.5 font-bold rounded-lg transition-colors mt-2 ${isFormValid ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}
              >
                {editingId ? 'Salvar Alterações' : 'Criar Projeto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Overdue Notification Banner */}
      {overdueProjects.length > 0 && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-400">
              {overdueProjects.length} {overdueProjects.length === 1 ? 'projeto atrasado' : 'projetos atrasados'}!
            </p>
            <p className={`text-xs ${textSub}`}>
              {overdueProjects.map(p => p.title).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Urgent Notification Banner */}
      {urgentProjects.length > 0 && overdueProjects.length === 0 && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Clock size={18} className="text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-400">
              {urgentProjects.length} {urgentProjects.length === 1 ? 'projeto com prazo próximo' : 'projetos com prazo próximo'}
            </p>
            <p className={`text-xs ${textSub}`}>
              {urgentProjects.map(p => `${p.title} (${p.daysLeft}d)`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${textMain}`}>Projetos</h1>
          <p className={`${textSub} text-sm`}>Gerencie o fluxo de entrega dos serviços</p>
        </div>
        <div className="flex gap-3">
          {canCreateProject && (
            <button
              onClick={() => openNewTaskModal('todo')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> Novo Projeto
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board - Responsive Grid, No Horizontal Page Scroll */}
      <div className="flex-1 min-h-0 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
          {columns.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              color={col.color}
              tasks={filteredTasks.filter(t => t.status === col.id)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onAddTask={openNewTaskModal}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              isDarkMode={isDarkMode}
              canCreate={canCreateProject}
              canEdit={canEditProject}
              canDelete={canDeleteProject}
            />
          ))}
        </div>
      </div>
    </div>
  );
};