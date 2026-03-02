import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, X, FileSignature, CheckCircle2, AlertCircle, Clock, Calendar, User, DollarSign, Briefcase, Trash2, Pencil } from 'lucide-react';
import { Contract, Client, TeamMember, Transaction } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { saveContract, deleteContract } from '../lib/dataService';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';

interface ContractsProps {
  contracts: Contract[];
  setContracts: (contracts: Contract[]) => void;
  clients: Client[];
  members: TeamMember[];
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;
  onAddNotification?: (title: string, message: string, type: 'info' | 'success' | 'warning') => void;
  globalSearchTerm?: string;
  isDarkMode: boolean;
  currentUser: TeamMember;
}

export const Contracts: React.FC<ContractsProps> = ({ contracts, setContracts, clients, members, transactions, setTransactions, onAddNotification, globalSearchTerm, isDarkMode, currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  const { permissions: contextPermissions } = useAppData();
  const { canCreate, canEdit, canDelete } = usePermissions(currentUser, contextPermissions);
  const canCreateContract = canCreate('/contracts');
  const canEditContract = canEdit('/contracts');
  const canDeleteContract = canDelete('/contracts');

  // Theme Helpers
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-slate-50';

  // Sync Global Search with Local Search
  useEffect(() => {
    if (globalSearchTerm !== undefined) {
      setSearchQuery(globalSearchTerm);
    }
  }, [globalSearchTerm]);

  const [formData, setFormData] = useState({
    clientId: '',
    salesExecutiveId: '',
    title: '',
    monthlyValue: '',
    setupValue: '',
    startDate: new Date().toISOString().split('T')[0],
    contractDuration: '12',
    status: 'Active' as Contract['status']
  });

  const filteredContracts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return contracts.filter(c =>
      c.title.toLowerCase().includes(query) ||
      clients.find(cl => cl.id === c.clientId)?.name.toLowerCase().includes(query) ||
      clients.find(cl => cl.id === c.clientId)?.company.toLowerCase().includes(query)
    );
  }, [contracts, clients, searchQuery]);

  // Form validation - required fields
  const isFormValid = useMemo(() => {
    return formData.clientId !== '' &&
      formData.monthlyValue.trim() !== '' &&
      parseFloat(formData.monthlyValue) > 0;
  }, [formData.clientId, formData.monthlyValue]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleOpenModal = (contract?: Contract) => {
    if (contract) {
      setEditingId(contract.id);
      setFormData({
        clientId: contract.clientId.toString(),
        salesExecutiveId: contract.salesExecutiveId.toString(),
        title: contract.title,
        monthlyValue: contract.monthlyValue.toString(),
        setupValue: contract.setupValue.toString(),
        startDate: contract.startDate,
        contractDuration: contract.contractDuration.toString(),
        status: contract.status
      });
    } else {
      setEditingId(null);
      setFormData({
        clientId: '',
        salesExecutiveId: '',
        title: '',
        monthlyValue: '',
        setupValue: '',
        startDate: new Date().toISOString().split('T')[0],
        contractDuration: '12',
        status: 'Active'
      });
    }
    setIsModalOpen(true);
  };

  const handleClientChange = (clientIdStr: string) => {
    const selectedClient = clients.find(c => c.id === clientIdStr);

    setFormData(prev => ({
      ...prev,
      clientId: clientIdStr,
      // Auto-fill: find matching sales exec teamMemberId from client's salesExecutiveId
      salesExecutiveId: selectedClient?.salesExecutiveId ? selectedClient.salesExecutiveId.toString() : prev.salesExecutiveId
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const monthlyVal = Number(formData.monthlyValue);
    const setupVal = Number(formData.setupValue);
    const duration = Number(formData.contractDuration);
    const salesExecId = formData.salesExecutiveId;
    const clientId = formData.clientId;

    const newContract: Contract = {
      id: editingId || Date.now().toString(),
      clientId: clientId,
      salesExecutiveId: salesExecId,
      title: formData.title,
      monthlyValue: monthlyVal,
      setupValue: setupVal,
      startDate: formData.startDate,
      status: formData.status,
      contractDuration: duration
    };

    // Update Contracts State
    if (editingId) {
      setContracts(contracts.map(c => c.id === editingId ? newContract : c));
    } else {
      setContracts([newContract, ...contracts]);

      // Trigger Notification for New Active Contract
      if (formData.status === 'Active' && onAddNotification) {
        const clientName = clients.find(c => c.id === clientId)?.name || 'Cliente';
        const salesExecName = members.find(m => m.id === salesExecId)?.name || 'Vendedor';

        onAddNotification(
          'Novo Contrato Fechado! 🚀',
          `${salesExecName} fechou um contrato com ${clientName}: ${formData.title} (${formatCurrency(monthlyVal)}/mês)`,
          'success'
        );
      }
    }

    // AUTOMATIC FINANCIAL TRANSACTIONS GENERATION
    if (formData.status === 'Active' && !editingId) {
      const clientName = clients.find(c => c.id === clientId)?.name || 'Cliente';
      const salesExecName = members.find(m => m.id === salesExecId)?.name || 'Vendedor';
      const newTransactions: Transaction[] = [];
      const startD = new Date(formData.startDate);

      // 1. Setup Fee (Income) - IMMEDIATE (Current Month)
      // Se houver setup, entra como Realizado na data de início.
      if (setupVal > 0) {
        newTransactions.push({
          id: Date.now() + 1,
          description: `Setup - ${clientName} (${formData.title})`,
          amount: setupVal,
          type: 'income',
          date: formData.startDate,
          createdAt: new Date().toISOString().split('T')[0],
          status: 'Completed',
          clientId: clientId
        });
      }

      // 2. First Month (Income) - NEXT MONTH (+30 Days)
      // Mensalidade começa a contar 1 mês depois do contrato assinado.
      if (monthlyVal > 0) {
        const firstMonthDate = new Date(startD);
        firstMonthDate.setDate(firstMonthDate.getDate() + 30);

        newTransactions.push({
          id: Date.now() + 2,
          description: `Mensalidade (Mês 1) - ${clientName}`,
          amount: monthlyVal,
          type: 'income',
          date: firstMonthDate.toISOString().split('T')[0], // YYYY-MM-DD
          createdAt: new Date().toISOString().split('T')[0],
          status: 'Pending', // Previsto
          clientId: clientId
        });
      }

      // 3. Commission (Expense) - Provisioned
      // Comissão sobre Setup (imediata) + Comissão sobre 1ª mensalidade (futura)
      // Para simplificar o fluxo de caixa imediato, lançamos a comissão do Setup agora se houver.
      if (setupVal > 0) {
        const commissionSetup = setupVal * 0.30;
        newTransactions.push({
          id: Date.now() + 3,
          description: `Comissão Setup - ${salesExecName}`,
          amount: commissionSetup,
          type: 'commission',
          date: formData.startDate,
          createdAt: new Date().toISOString().split('T')[0],
          status: 'Pending',
          clientId: clientId
        });
      }

      if (newTransactions.length > 0) {
        setTransactions([...transactions, ...newTransactions]);
      }
    }

    // Persistir no Supabase
    const result = await saveContract(newContract);
    if (!result.success) {
      toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
      return;
    }

    setIsModalOpen(false);
    if (editingId) {
      toast.success('Contrato atualizado');
    } else {
      toast.success('Contrato criado');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Contrato',
      message: 'Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (ok) {
      // Persistir no Supabase
      const result = await deleteContract(id);
      if (!result.success) {
        toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
        return;
      }
      setContracts(contracts.filter(c => c.id !== id));
      toast.success('Contrato excluído');
    }
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 relative pb-16 md:pb-0">

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <h3 className={`font-semibold text-lg ${textMain}`}>
                {editingId ? 'Editar Contrato' : 'Novo Contrato (Venda)'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto max-h-[85vh] custom-scrollbar">

              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Título do Contrato</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none`}
                  placeholder="Ex: Consultoria Mensal + SEO"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Cliente</label>
                  <CustomDropdown
                    value={formData.clientId}
                    onChange={handleClientChange}
                    options={[
                      { value: '', label: 'Selecione...' },
                      ...clients.map(client => ({ value: client.id, label: `${client.name} - ${client.company}`, icon: <User size={12} /> }))
                    ]}
                    isDarkMode={isDarkMode}
                    placeholder="Selecione..."
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Vendedor (Closer)</label>
                  <CustomDropdown
                    value={formData.salesExecutiveId}
                    onChange={v => setFormData({ ...formData, salesExecutiveId: v })}
                    options={[
                      { value: '', label: 'Selecione...' },
                      ...members.map(member => ({ value: member.teamMemberId || member.id, label: member.name, icon: <User size={12} /> }))
                    ]}
                    isDarkMode={isDarkMode}
                    placeholder="Selecione..."
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    *Preenchido automaticamente ao selecionar cliente
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Valor Mensal (R$)</label>
                  <input
                    type="number"
                    value={formData.monthlyValue}
                    onChange={(e) => setFormData({ ...formData, monthlyValue: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none`}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Setup / Fechamento (R$)</label>
                  <input
                    type="number"
                    value={formData.setupValue}
                    onChange={(e) => setFormData({ ...formData, setupValue: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none`}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Data de Início</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none [color-scheme:${isDarkMode ? 'dark' : 'light'}]`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Duração (Meses)</label>
                  <input
                    type="number"
                    value={formData.contractDuration}
                    onChange={(e) => setFormData({ ...formData, contractDuration: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none`}
                    placeholder="12"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Status do Contrato</label>
                <CustomDropdown
                  value={formData.status}
                  onChange={v => setFormData({ ...formData, status: v as Contract['status'] })}
                  options={[
                    { value: 'Active', label: 'Ativo', dot: 'bg-emerald-500' },
                    { value: 'Pending', label: 'Pendente', dot: 'bg-amber-500' },
                    { value: 'Cancelled', label: 'Cancelado', dot: 'bg-red-500' },
                    { value: 'Ended', label: 'Encerrado', dot: 'bg-slate-400' },
                  ]}
                  isDarkMode={isDarkMode}
                />
                <p className={`text-[10px] ${textSub} mt-2 italic p-2 rounded ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                  <span className="font-bold text-emerald-500">Nota:</span> O "Setup" entrará no caixa hoje (Realizado). A "Mensalidade" será lançada para daqui a 30 dias (Pendente).
                </p>
              </div>

              <button
                type="submit"
                disabled={!isFormValid}
                className={`w-full py-3 font-bold rounded-lg transition-colors mt-2 shadow-lg ${isFormValid ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-900/20' : 'bg-slate-400 text-slate-200 cursor-not-allowed shadow-none'}`}
              >
                {editingId ? 'Salvar Contrato' : 'Fechar Venda (Criar Contrato)'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className={`text-2xl font-bold ${textMain}`}>Contratos</h1>
          <p className={`${textSub} text-sm`}>Gerencie vendas, recorrência e valores fechados.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1 md:flex-none">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar contrato..."
              className={`pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-full md:w-64 ${isDarkMode ? 'bg-dark border-dark-border text-slate-200 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-700 placeholder:text-slate-400'}`}
            />
          </div>
          {canCreateContract && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Plus size={18} /> <span className="hidden md:inline">Novo Contrato</span>
              <span className="md:hidden">Novo</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Mobile View: Cards */}
        <div className="md:hidden grid grid-cols-1 gap-4">
          {filteredContracts.map(contract => {
            const client = clients.find(c => c.id === contract.clientId.toString());
            const salesRep = members.find(m => m.teamMemberId === contract.salesExecutiveId?.toString() || m.id === contract.salesExecutiveId?.toString());

            return (
              <div key={contract.id} className={`${bgCard} border ${borderCol} p-4 rounded-xl shadow-sm flex flex-col gap-3 animate-in fade-in duration-300`}>
                {/* Header: Title + Status */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold ${textMain} truncate`}>{contract.title}</h3>
                    <div className={`text-xs ${textSub} mt-0.5 flex items-center gap-1`}>
                      <Briefcase size={12} />
                      <span className="truncate">{client ? client.company : 'Cliente N/A'}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0
                      ${contract.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      contract.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                        'bg-red-500/10 text-red-500 border border-red-500/20'}
                   `}>
                    {contract.status === 'Active' ? 'Ativo' : contract.status === 'Pending' ? 'Pendente' : 'Cancelado'}
                  </span>
                </div>

                {/* Details Grid */}
                <div className={`grid grid-cols-2 gap-3 py-3 border-t border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div>
                    <span className={`text-[10px] uppercase ${textSub} block mb-1 flex items-center gap-1`}><DollarSign size={10} /> Mensalidade</span>
                    <span className={`font-bold text-emerald-500 text-sm`}>{formatCurrency(contract.monthlyValue)}</span>
                  </div>
                  <div>
                    <span className={`text-[10px] uppercase ${textSub} block mb-1 flex items-center gap-1`}><Clock size={10} /> Duração</span>
                    <span className={`${textMain} text-sm`}>{contract.contractDuration} meses</span>
                  </div>
                  <div>
                    <span className={`text-[10px] uppercase ${textSub} block mb-1 flex items-center gap-1`}><Calendar size={10} /> Início</span>
                    <span className={`${textMain} text-sm`}>{new Date(contract.startDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div>
                    <span className={`text-[10px] uppercase ${textSub} block mb-1 flex items-center gap-1`}><User size={10} /> Vendedor</span>
                    <span className={`${textMain} text-sm flex items-center gap-1.5`}>
                      {salesRep && (
                        <>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] border font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                            {salesRep.name.charAt(0)}
                          </div>
                          <span className="truncate">{salesRep.name.split(' ')[0]}</span>
                        </>
                      )}
                      {!salesRep && 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex gap-2">
                  {canEditContract && (
                    <button
                      onClick={() => handleOpenModal(contract)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors flex items-center justify-center gap-1 ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                      <Pencil size={12} /> Editar
                    </button>
                  )}
                  {canDeleteContract && (
                    <button
                      onClick={() => handleDelete(contract.id)}
                      className={`py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors flex items-center justify-center gap-1 ${isDarkMode ? 'border-red-900/50 text-red-500 hover:bg-red-900/20' : 'border-red-200 text-red-500 hover:bg-red-50'}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View: Table */}
        <div className={`hidden md:block ${bgCard} border ${borderCol} ${isDarkMode ? '' : 'shadow-sm'} rounded-xl overflow-hidden`}>
          <table className="w-full text-left text-sm text-slate-400">
            <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium`}>
              <tr>
                <th className="px-6 py-4">Contrato</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Vendedor</th>
                <th className="px-6 py-4">Valor Mensal</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {filteredContracts.map((contract) => {
                const client = clients.find(c => c.id === contract.clientId.toString());
                const salesRep = members.find(m => m.teamMemberId === contract.salesExecutiveId?.toString() || m.id === contract.salesExecutiveId?.toString());

                return (
                  <tr key={contract.id} className={`${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`font-medium ${textMain}`}>{contract.title}</span>
                        <span className={`text-xs ${textSub}`}>{contract.contractDuration} meses • Início {new Date(contract.startDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 ${textSub}`}>
                      {client ? client.name : 'N/A'}
                    </td>
                    <td className={`px-6 py-4 ${textSub} flex items-center gap-2`}>
                      {salesRep ? (
                        <>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>{salesRep.name.charAt(0)}</div>
                          {salesRep.name}
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 font-medium text-emerald-500">
                      {formatCurrency(contract.monthlyValue)}
                      {contract.setupValue > 0 && (
                        <span className={`block text-[10px] ${textSub}`}>+ {formatCurrency(contract.setupValue)} setup</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${contract.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          contract.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                            'bg-red-500/10 text-red-500 border border-red-500/20'}
                      `}>
                        {contract.status === 'Active' ? <CheckCircle2 size={12} /> :
                          contract.status === 'Pending' ? <Clock size={12} /> : <AlertCircle size={12} />}
                        {contract.status === 'Active' ? 'Ativo' :
                          contract.status === 'Pending' ? 'Pendente' : 'Cancelado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {canEditContract && (
                          <button
                            onClick={() => handleOpenModal(contract)}
                            className="text-emerald-500 hover:text-emerald-400 font-medium text-xs hover:underline"
                          >
                            Editar
                          </button>
                        )}
                        {canDeleteContract && (
                          <button
                            onClick={() => handleDelete(contract.id)}
                            className="text-red-500 hover:text-red-400 font-medium text-xs hover:underline"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredContracts.length === 0 && (
        <div className={`p-8 text-center ${textSub}`}>
          <FileSignature size={48} className="mx-auto mb-3 opacity-20" />
          <p>Nenhum contrato encontrado{searchQuery ? ` para "${searchQuery}"` : ''}.</p>
        </div>
      )}
    </div>
  );
};