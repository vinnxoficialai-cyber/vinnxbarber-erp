import React, { useState, useMemo } from 'react';
import { Plus, Search, Filter, FileText, CheckCircle2, XCircle, Clock, Trash2, Pencil, Download, PlusCircle, MinusCircle, User, Calendar, Calculator, DollarSign, Layers, ChevronDown, ChevronRight, ChevronLeft, X, Eye, Package, ArrowRight, Check, Percent } from 'lucide-react';
import { Budget, Client, BudgetItem, Service } from '../types';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { CustomDropdown } from '../components/CustomDropdown';
import { saveBudget, deleteBudget } from '../lib/dataService';

interface BudgetsProps {
  budgets: Budget[];
  setBudgets: (budgets: Budget[]) => void;
  clients: Client[];
  services: Service[];
  isDarkMode: boolean;
}

export const Budgets: React.FC<BudgetsProps> = ({ budgets, setBudgets, clients, services, isDarkMode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  // Theme Helpers
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
  const shadowClass = isDarkMode ? '' : 'shadow-sm';

  // Form State
  const initialFormState = {
    clientId: '',
    title: '',
    status: 'Draft' as Budget['status'],
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString().split('T')[0],
    items: [{ id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }] as BudgetItem[],
    discount: 0
  };

  const [formData, setFormData] = useState(initialFormState);

  // Derived Values
  const subTotal = formData.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const totalProposalValue = Math.max(0, subTotal - (formData.discount || 0));

  // Filter Logic
  const filteredBudgets = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return budgets.filter(b =>
      b.title.toLowerCase().includes(query) ||
      clients.find(c => c.id === b.clientId)?.name.toLowerCase().includes(query)
    );
  }, [budgets, searchQuery, clients]);

  // Step validation
  const isStep1Valid = formData.title.trim() !== '' && formData.clientId !== '';
  const isStep2Valid = formData.items.some(item => item.description.trim() !== '' && item.unitPrice > 0);
  const isFormValid = isStep1Valid && isStep2Valid;

  // Helpers
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Sent': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved': return <CheckCircle2 size={14} />;
      case 'Rejected': return <XCircle size={14} />;
      case 'Sent': return <FileText size={14} />;
      default: return <Clock size={14} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Approved': return 'Aprovado';
      case 'Rejected': return 'Rejeitado';
      case 'Sent': return 'Enviado';
      default: return 'Rascunho';
    }
  };

  // Handlers
  const handleOpenModal = (budget?: Budget) => {
    setSelectedServiceId('');
    setCurrentStep(0);
    if (budget) {
      setEditingId(budget.id);
      setFormData({
        clientId: budget.clientId,
        title: budget.title,
        status: budget.status,
        createdAt: budget.createdAt,
        validUntil: budget.validUntil,
        items: budget.items.length > 0 ? budget.items : [{ id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }],
        discount: budget.discount || 0
      });
    } else {
      setEditingId(null);
      setFormData({ ...initialFormState, items: [{ id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }] });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSaving) return;

    setIsSaving(true);
    try {
      const newBudget: Budget = {
        id: editingId || Date.now().toString(),
        clientId: formData.clientId,
        title: formData.title,
        status: formData.status,
        items: formData.items.filter(item => item.description.trim() !== ''),
        totalValue: totalProposalValue,
        discount: formData.discount,
        createdAt: formData.createdAt,
        validUntil: formData.validUntil
      };

      const result = await saveBudget(newBudget);
      if (!result.success) {
        toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
        return;
      }

      if (editingId) {
        setBudgets(budgets.map(b => b.id === editingId ? newBudget : b));
        toast.success('Orçamento atualizado');
      } else {
        setBudgets([newBudget, ...budgets]);
        toast.success('Orçamento criado com sucesso!');
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Orçamento',
      message: 'Tem certeza que deseja excluir este orçamento?',
      variant: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (ok) {
      const result = await deleteBudget(id);
      if (!result.success) {
        toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
        return;
      }
      setBudgets(budgets.filter(b => b.id !== id));
      toast.success('Orçamento excluído');
    }
  };

  // Item Handlers
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }]
    }));
  };

  const handleAddService = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const serviceId = e.target.value;
    setSelectedServiceId(serviceId);
    if (!serviceId) return;

    const service = services.find(s => s.id === serviceId);
    if (service) {
      const lastItem = formData.items[formData.items.length - 1];
      const isLastItemEmpty = lastItem && !lastItem.description && lastItem.unitPrice === 0;

      if (isLastItemEmpty) {
        setFormData(prev => ({
          ...prev,
          items: prev.items.map(item => item.id === lastItem.id ? { ...item, description: service.name, unitPrice: service.price, quantity: 1 } : item)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          items: [...prev.items, { id: Date.now().toString(), description: service.name, quantity: 1, unitPrice: service.price }]
        }));
      }
      setTimeout(() => setSelectedServiceId(''), 100);
    }
  };

  const removeItem = (id: string) => {
    if (formData.items.length === 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id)
    }));
  };

  const updateItem = (id: string, field: keyof BudgetItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  // Step definitions
  const steps = [
    { label: 'Informações', icon: FileText },
    { label: 'Itens & Valores', icon: Package },
    { label: 'Revisão', icon: Eye },
  ];

  const selectedClient = clients.find(c => c.id === formData.clientId);

  // ================ RENDER ================
  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col pb-16 md:pb-0">

      {/* ==================== WIZARD MODAL ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}>

            {/* Modal Header */}
            <div className={`px-6 py-4 border-b ${borderCol} flex justify-between items-center`}>
              <div>
                <h3 className={`font-bold text-lg ${textMain}`}>
                  {editingId ? 'Editar Orçamento' : 'Novo Orçamento'}
                </h3>
                <p className={`text-xs ${textSub} mt-0.5`}>
                  {steps[currentStep].label} — Etapa {currentStep + 1} de {steps.length}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Step Indicator */}
            <div className={`px-6 py-3 border-b ${borderCol} ${isDarkMode ? 'bg-dark/50' : 'bg-slate-50/50'}`}>
              <div className="flex items-center gap-1">
                {steps.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isActive = idx === currentStep;
                  const isCompleted = idx < currentStep;
                  return (
                    <React.Fragment key={idx}>
                      <button
                        type="button"
                        onClick={() => {
                          // Allow going back, or forward only if current step is valid
                          if (idx < currentStep) setCurrentStep(idx);
                          else if (idx === 1 && isStep1Valid) setCurrentStep(idx);
                          else if (idx === 2 && isStep1Valid && isStep2Valid) setCurrentStep(idx);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${isActive
                          ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                          : isCompleted
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : `${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`
                          }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive
                          ? 'bg-primary text-white'
                          : isCompleted
                            ? 'bg-emerald-500 text-white'
                            : `${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`
                          }`}>
                          {isCompleted ? <Check size={12} /> : idx + 1}
                        </div>
                        <span className="hidden sm:inline">{step.label}</span>
                      </button>
                      {idx < steps.length - 1 && (
                        <ChevronRight size={14} className={`${isDarkMode ? 'text-slate-600' : 'text-slate-300'} flex-shrink-0`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Form Content — all steps inside one form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6">

                {/* ===== STEP 1: Informações Gerais ===== */}
                {currentStep === 0 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                    {/* Título */}
                    <div>
                      <label className={`block text-sm font-semibold ${textMain} mb-2`}>
                        Título da Proposta <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className={`w-full ${bgInput} border ${borderCol} rounded-xl px-4 py-3 text-sm ${textMain} focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all`}
                        placeholder="Ex: Desenvolvimento de Site Institucional"
                        autoFocus
                      />
                    </div>

                    {/* Cliente + Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-semibold ${textMain} mb-2 flex items-center gap-1.5`}>
                          <User size={14} className="text-primary" /> Cliente <span className="text-red-400">*</span>
                        </label>
                        <CustomDropdown
                          value={formData.clientId}
                          onChange={v => setFormData({ ...formData, clientId: v })}
                          options={[{ value: '', label: 'Selecione um cliente...' }, ...clients.map(c => ({ value: c.id, label: `${c.name}${c.company ? ` — ${c.company}` : ''}` }))]}
                          isDarkMode={isDarkMode}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-semibold ${textMain} mb-2`}>Status</label>
                        <CustomDropdown
                          value={formData.status}
                          onChange={v => setFormData({ ...formData, status: v as Budget['status'] })}
                          options={[
                            { value: 'Draft', label: 'Rascunho' },
                            { value: 'Sent', label: 'Enviado' },
                            { value: 'Approved', label: 'Aprovado' },
                            { value: 'Rejected', label: 'Rejeitado' }
                          ]}
                          isDarkMode={isDarkMode}
                        />
                      </div>
                    </div>

                    {/* Datas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-semibold ${textMain} mb-2 flex items-center gap-1.5`}>
                          <Calendar size={14} className="text-primary" /> Data de Criação
                        </label>
                        <input
                          type="date"
                          value={formData.createdAt}
                          onChange={(e) => setFormData({ ...formData, createdAt: e.target.value })}
                          className={`w-full ${bgInput} border ${borderCol} rounded-xl px-4 py-3 text-sm ${textMain} focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all [color-scheme:${isDarkMode ? 'dark' : 'light'}]`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-semibold ${textMain} mb-2 flex items-center gap-1.5`}>
                          <Calendar size={14} className="text-primary" /> Validade
                        </label>
                        <input
                          type="date"
                          value={formData.validUntil}
                          onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                          className={`w-full ${bgInput} border ${borderCol} rounded-xl px-4 py-3 text-sm ${textMain} focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all [color-scheme:${isDarkMode ? 'dark' : 'light'}]`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== STEP 2: Itens & Valores ===== */}
                {currentStep === 1 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                    {/* Quick actions bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className={`text-sm font-bold ${textMain} flex items-center gap-2`}>
                          <Package size={16} className="text-primary" /> Itens do Orçamento
                        </h4>
                        <p className={`text-xs ${textSub} mt-0.5`}>Adicione serviços ou crie itens personalizados</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Quick service dropdown */}
                        {services.filter(s => s.active).length > 0 && (
                          <div className={`relative border rounded-xl overflow-hidden flex items-center ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-white border-slate-300'}`}>
                            <Layers size={14} className="ml-3 text-primary absolute left-0 z-10 pointer-events-none" />
                            <CustomDropdown
                              value={selectedServiceId}
                              onChange={v => { setSelectedServiceId(v); if (v) { const service = services.find(s => s.id === v); if (service) { const lastItem = formData.items[formData.items.length - 1]; const isLastItemEmpty = lastItem && !lastItem.description && lastItem.unitPrice === 0; if (isLastItemEmpty) { setFormData(prev => ({ ...prev, items: prev.items.map(item => item.id === lastItem.id ? { ...item, description: service.name, unitPrice: service.price, quantity: 1 } : item) })); } else { setFormData(prev => ({ ...prev, items: [...prev.items, { id: Date.now().toString(), description: service.name, quantity: 1, unitPrice: service.price }] })); } setTimeout(() => setSelectedServiceId(''), 100); } } }}
                              options={[{ value: '', label: '+ Serviço Rápido' }, ...services.filter(s => s.active).map(s => ({ value: s.id, label: `${s.name} — ${formatCurrency(s.price)}` }))]}
                              isDarkMode={isDarkMode}
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={addItem}
                          className="flex items-center gap-1.5 px-3 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-colors text-xs font-semibold"
                        >
                          <PlusCircle size={14} /> Item
                        </button>
                      </div>
                    </div>

                    {/* Items list — card style */}
                    <div className="space-y-3">
                      {formData.items.map((item, index) => (
                        <div
                          key={item.id}
                          className={`border ${borderCol} rounded-xl p-4 transition-all ${isDarkMode ? 'bg-dark/50 hover:bg-dark/80' : 'bg-slate-50/50 hover:bg-slate-50'}`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Item number */}
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                              {index + 1}
                            </div>

                            {/* Fields */}
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-3">
                              {/* Description */}
                              <div className="sm:col-span-5">
                                <label className={`block text-[10px] uppercase font-bold ${textSub} mb-1`}>Descrição</label>
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                  placeholder="Nome do serviço ou produto"
                                  className={`w-full ${bgInput} border ${borderCol} rounded-lg px-3 py-2 text-sm ${textMain} focus:ring-1 focus:ring-primary/40 focus:border-primary outline-none transition-all`}
                                />
                              </div>

                              {/* Quantity */}
                              <div className="sm:col-span-2">
                                <label className={`block text-[10px] uppercase font-bold ${textSub} mb-1`}>Qtd</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, Number(e.target.value)))}
                                  className={`w-full ${bgInput} border ${borderCol} rounded-lg px-3 py-2 text-sm text-center ${textMain} focus:ring-1 focus:ring-primary/40 focus:border-primary outline-none transition-all`}
                                />
                              </div>

                              {/* Unit Price */}
                              <div className="sm:col-span-3">
                                <label className={`block text-[10px] uppercase font-bold ${textSub} mb-1`}>Valor Unit.</label>
                                <div className="relative">
                                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${textSub}`}>R$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unitPrice || ''}
                                    onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                                    placeholder="0,00"
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg pl-9 pr-3 py-2 text-sm text-right ${textMain} focus:ring-1 focus:ring-primary/40 focus:border-primary outline-none transition-all`}
                                  />
                                </div>
                              </div>

                              {/* Total */}
                              <div className="sm:col-span-2">
                                <label className={`block text-[10px] uppercase font-bold ${textSub} mb-1`}>Total</label>
                                <div className={`px-3 py-2 rounded-lg text-sm font-bold text-right ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                  {formatCurrency(item.quantity * item.unitPrice)}
                                </div>
                              </div>
                            </div>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className={`p-1.5 rounded-lg transition-colors mt-5 flex-shrink-0 ${formData.items.length === 1
                                ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                : 'text-slate-400 hover:text-red-500 hover:bg-red-500/10'
                                }`}
                              disabled={formData.items.length === 1}
                            >
                              <MinusCircle size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Summary cards */}
                    <div className={`border ${borderCol} rounded-xl overflow-hidden`}>
                      <div className={`grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x ${isDarkMode ? 'divide-dark-border' : 'divide-slate-200'}`}>
                        {/* Subtotal */}
                        <div className={`p-4 ${isDarkMode ? 'bg-dark/50' : 'bg-slate-50'}`}>
                          <div className={`text-[10px] uppercase font-bold ${textSub} mb-1 flex items-center gap-1`}>
                            <Calculator size={10} /> Subtotal
                          </div>
                          <div className={`text-lg font-bold ${textMain}`}>{formatCurrency(subTotal)}</div>
                        </div>

                        {/* Discount */}
                        <div className={`p-4 ${isDarkMode ? 'bg-dark/50' : 'bg-slate-50'}`}>
                          <div className={`text-[10px] uppercase font-bold ${textSub} mb-1 flex items-center gap-1`}>
                            <Percent size={10} /> Desconto
                          </div>
                          <div className="relative">
                            <span className={`absolute left-0 top-1/2 -translate-y-1/2 text-sm font-bold text-red-400`}>- R$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={formData.discount || ''}
                              onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                              className={`w-full bg-transparent outline-none text-lg font-bold text-red-400 pl-12`}
                              placeholder="0,00"
                            />
                          </div>
                        </div>

                        {/* Total */}
                        <div className={`p-4 ${isDarkMode ? 'bg-primary/5' : 'bg-primary/5'}`}>
                          <div className="text-[10px] uppercase font-bold text-primary mb-1 flex items-center gap-1">
                            <DollarSign size={10} /> Total Final
                          </div>
                          <div className="text-xl font-bold text-primary">{formatCurrency(totalProposalValue)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== STEP 3: Revisão ===== */}
                {currentStep === 2 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className={`text-center py-2`}>
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold ${isDarkMode ? 'bg-primary/10 text-primary' : 'bg-primary/10 text-primary'}`}>
                        <Eye size={14} /> Revise os dados antes de {editingId ? 'salvar' : 'criar'}
                      </div>
                    </div>

                    {/* Summary card */}
                    <div className={`border ${borderCol} rounded-xl overflow-hidden`}>
                      {/* Header info */}
                      <div className={`p-5 border-b ${borderCol}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className={`text-lg font-bold ${textMain}`}>{formData.title}</h4>
                            <div className={`flex items-center gap-3 mt-2 text-sm ${textSub}`}>
                              <span className="flex items-center gap-1">
                                <User size={13} /> {selectedClient?.name || '—'}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar size={13} /> {formatDate(formData.createdAt)}
                              </span>
                              <span>•</span>
                              <span>Validade: {formatDate(formData.validUntil)}</span>
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(formData.status)}`}>
                            {getStatusIcon(formData.status)}
                            {getStatusLabel(formData.status)}
                          </span>
                        </div>
                      </div>

                      {/* Items table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={`text-xs uppercase ${textSub} ${isDarkMode ? 'bg-dark/50' : 'bg-slate-50'}`}>
                            <tr>
                              <th className="px-5 py-3 text-left font-medium">Item</th>
                              <th className="px-5 py-3 text-center font-medium">Qtd</th>
                              <th className="px-5 py-3 text-right font-medium">Valor Unit.</th>
                              <th className="px-5 py-3 text-right font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDarkMode ? 'divide-dark-border' : 'divide-slate-100'}`}>
                            {formData.items.filter(i => i.description.trim()).map((item, idx) => (
                              <tr key={item.id}>
                                <td className={`px-5 py-3 ${textMain} font-medium`}>
                                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold mr-2 ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{idx + 1}</span>
                                  {item.description}
                                </td>
                                <td className={`px-5 py-3 text-center ${textSub}`}>{item.quantity}x</td>
                                <td className={`px-5 py-3 text-right ${textSub}`}>{formatCurrency(item.unitPrice)}</td>
                                <td className={`px-5 py-3 text-right font-bold ${textMain}`}>{formatCurrency(item.quantity * item.unitPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Totals */}
                      <div className={`border-t ${borderCol} ${isDarkMode ? 'bg-dark/30' : 'bg-slate-50/50'}`}>
                        <div className="flex flex-col items-end p-5 space-y-1">
                          <div className="flex justify-between w-60">
                            <span className={`text-sm ${textSub}`}>Subtotal:</span>
                            <span className={`text-sm font-medium ${textMain}`}>{formatCurrency(subTotal)}</span>
                          </div>
                          {(formData.discount || 0) > 0 && (
                            <div className="flex justify-between w-60">
                              <span className="text-sm text-red-400">Desconto:</span>
                              <span className="text-sm font-medium text-red-400">- {formatCurrency(formData.discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between w-60 pt-2 border-t border-dashed mt-1" style={{ borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                            <span className="text-base font-bold text-primary">Total Final:</span>
                            <span className="text-base font-bold text-primary">{formatCurrency(totalProposalValue)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Footer Actions (INSIDE form) ===== */}
              <div className={`px-6 py-4 border-t ${borderCol} flex items-center justify-between ${isDarkMode ? 'bg-dark/50' : 'bg-slate-50/50'}`}>
                <div>
                  {currentStep > 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                  )}
                  {currentStep === 0 && (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Next / Submit */}
                  {currentStep < steps.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(currentStep + 1)}
                      disabled={currentStep === 0 ? !isStep1Valid : !isStep2Valid}
                      className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${(currentStep === 0 ? isStep1Valid : isStep2Valid)
                        ? 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20'
                        : `${isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400'} cursor-not-allowed`
                        }`}
                    >
                      Próximo <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!isFormValid || isSaving}
                      className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${isFormValid && !isSaving
                        ? 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20'
                        : `${isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400'} cursor-not-allowed`
                        }`}
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Check size={16} /> {editingId ? 'Salvar Alterações' : 'Criar Orçamento'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== PAGE HEADER ==================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className={`text-2xl font-bold ${textMain}`}>Orçamentos</h1>
          <p className={`${textSub} text-sm`}>Crie e gerencie propostas comerciais.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1 md:flex-none">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar orçamento..."
              className={`pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full md:w-64 ${isDarkMode ? 'bg-dark border-dark-border text-slate-200 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-700 placeholder:text-slate-400'}`}
            />
          </div>
          <button className={`p-2 border rounded-lg transition-colors ${isDarkMode ? 'bg-dark border-dark-border text-slate-400 hover:text-primary hover:border-primary' : 'bg-white border-slate-300 text-slate-500 hover:text-primary hover:border-primary'}`}>
            <Filter size={20} />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={18} /> <span className="hidden md:inline">Novo Orçamento</span><span className="md:hidden">Novo</span>
          </button>
        </div>
      </div>

      {/* ==================== STATS ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className={`${bgCard} border ${borderCol} p-5 rounded-xl shadow-sm`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><FileText size={20} /></div>
            <span className={`text-sm font-medium ${textSub}`}>Total em Aberto</span>
          </div>
          <p className={`text-2xl font-bold ${textMain}`}>
            {formatCurrency(budgets.filter(b => b.status === 'Sent' || b.status === 'Draft').reduce((acc, curr) => acc + curr.totalValue, 0))}
          </p>
        </div>
        <div className={`${bgCard} border ${borderCol} p-5 rounded-xl shadow-sm`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><CheckCircle2 size={20} /></div>
            <span className={`text-sm font-medium ${textSub}`}>Aprovados (Mês)</span>
          </div>
          <p className={`text-2xl font-bold ${textMain}`}>
            {formatCurrency(budgets.filter(b => b.status === 'Approved').reduce((acc, curr) => acc + curr.totalValue, 0))}
          </p>
        </div>
        <div className={`${bgCard} border ${borderCol} p-5 rounded-xl shadow-sm`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-violet-500/10 rounded-lg text-violet-500"><Calculator size={20} /></div>
            <span className={`text-sm font-medium ${textSub}`}>Ticket Médio</span>
          </div>
          <p className={`text-2xl font-bold ${textMain}`}>
            {budgets.length > 0 ? formatCurrency(budgets.reduce((acc, curr) => acc + curr.totalValue, 0) / budgets.length) : 'R$ 0,00'}
          </p>
        </div>
      </div>

      {/* ==================== BUDGET LIST ==================== */}
      <div className="space-y-4">
        {/* Mobile View: Cards */}
        <div className="md:hidden grid grid-cols-1 gap-4">
          {filteredBudgets.map(budget => {
            const client = clients.find(c => c.id === budget.clientId);
            return (
              <div key={budget.id} className={`${bgCard} border ${borderCol} p-4 rounded-xl shadow-sm flex flex-col gap-3 animate-in fade-in duration-300`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold ${textMain} truncate`}>{budget.title}</h3>
                    <div className={`text-xs ${textSub} mt-0.5 flex items-center gap-1`}>
                      {client ? (
                        <>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                            {client.name.charAt(0)}
                          </div>
                          <span className="truncate">{client.name}</span>
                        </>
                      ) : (
                        <span className="text-red-400">Cliente Removido</span>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 border ${getStatusColor(budget.status)}`}>
                    {getStatusIcon(budget.status)}
                    {getStatusLabel(budget.status)}
                  </span>
                </div>
                <div className={`grid grid-cols-2 gap-3 py-3 border-t border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="col-span-2">
                    <span className={`text-[10px] uppercase ${textSub} block mb-1 flex items-center gap-1`}><DollarSign size={10} /> Valor Total</span>
                    <span className="font-bold text-primary text-lg">{formatCurrency(budget.totalValue)}</span>
                  </div>
                  <div>
                    <span className={`text-[10px] uppercase ${textSub} block mb-1 flex items-center gap-1`}><Calendar size={10} /> Criado</span>
                    <span className={`${textMain} text-sm`}>{formatDate(budget.createdAt)}</span>
                  </div>
                  <div>
                    <span className={`text-[10px] uppercase ${textSub} block mb-1 flex items-center gap-1`}><Clock size={10} /> Validade</span>
                    <span className={`${textMain} text-sm`}>{formatDate(budget.validUntil)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors flex items-center justify-center gap-2 ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                    <Download size={14} /> PDF
                  </button>
                  <button
                    onClick={() => handleOpenModal(budget)}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View: Table */}
        <div className={`hidden md:block ${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden flex flex-col`}>
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className={`${isDarkMode ? 'bg-dark text-slate-400' : 'bg-slate-50 text-slate-600'} uppercase text-xs sticky top-0 z-10`}>
                <tr>
                  <th className="px-6 py-4 font-medium">Orçamento</th>
                  <th className="px-6 py-4 font-medium">Cliente</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Data</th>
                  <th className="px-6 py-4 font-medium">Validade</th>
                  <th className="px-6 py-4 font-medium text-right">Valor Total</th>
                  <th className="px-6 py-4 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-dark-border' : 'divide-slate-200'}`}>
                {filteredBudgets.map(budget => {
                  const client = clients.find(c => c.id === budget.clientId);
                  return (
                    <tr key={budget.id} className={`group ${isDarkMode ? 'hover:bg-dark-border/30' : 'hover:bg-slate-50'} transition-colors`}>
                      <td className="px-6 py-4">
                        <div className={`font-medium ${textMain}`}>{budget.title}</div>
                        <div className={`text-xs ${textSub} font-mono`}>#{budget.id.substring(0, 8)}</div>
                      </td>
                      <td className="px-6 py-4">
                        {client ? (
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                              {client.name.charAt(0)}
                            </div>
                            <span className={textMain}>{client.name}</span>
                          </div>
                        ) : (
                          <span className="text-red-400">Cliente Removido</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(budget.status)}`}>
                          {getStatusIcon(budget.status)}
                          {getStatusLabel(budget.status)}
                        </span>
                      </td>
                      <td className={`px-6 py-4 ${textSub}`}>{formatDate(budget.createdAt)}</td>
                      <td className={`px-6 py-4 ${textSub}`}>{formatDate(budget.validUntil)}</td>
                      <td className={`px-6 py-4 text-right font-bold ${textMain}`}>{formatCurrency(budget.totalValue)}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 rounded hover:bg-blue-500/10 hover:text-blue-500 text-slate-400 transition-colors" title="Download PDF">
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenModal(budget)}
                            className={`p-1.5 rounded hover:bg-slate-500/10 hover:text-slate-500 ${textSub} transition-colors`}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(budget.id)}
                            className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-500 text-slate-400 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredBudgets.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`px-6 py-12 text-center ${textSub}`}>
                      Nenhum orçamento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};