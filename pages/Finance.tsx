import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Download, Plus, Pencil, Trash2, X, Percent, Wallet, Filter, CalendarClock, CheckCircle2, User, RefreshCw, AlertCircle, Calendar } from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { saveTransaction, deleteTransaction } from '../lib/dataService';
import { useAppData } from '../context/AppDataContext';
import { useFilteredData } from '../hooks/useFilteredData';
import { CustomDropdown } from '../components/CustomDropdown';

type ViewStatus = 'all' | 'realized' | 'forecast';
type FilterType = 'all' | 'income' | 'expense' | 'commission';

interface FinanceProps {
  isDarkMode: boolean;
  // Props mantidas para compatibilidade, mas ignoradas em favor do Context
  transactions?: Transaction[];
  setTransactions?: (t: Transaction[]) => void;
}

export const Finance: React.FC<FinanceProps> = ({ isDarkMode }) => {
  // Use App Data Context
  const { setTransactions, contracts, refresh } = useAppData();
  const { filteredTransactions: transactions, filteredClients: clients, filteredMembers: members, selectedUnitId } = useFilteredData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  // Theme Helpers
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

  // Filters State
  const [activeTab, setActiveTab] = useState<FilterType>('all');
  const [viewStatus, setViewStatus] = useState<ViewStatus>('all');

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'income' as TransactionType,
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString().split('T')[0],
    status: 'Completed' as 'Completed' | 'Pending' | 'Overdue',
    selectedClientId: ''
  });

  // Calculate Metrics from TRANSACTIONS (History/Ledger)
  const summary = useMemo(() => {
    return transactions.reduce((acc, curr) => {
      // Basic sums based on types
      if (curr.type === 'expense') {
        acc.expenses += curr.amount;
        // Expense reduces balance
        acc.balance -= curr.amount;
      } else if (curr.type === 'commission') {
        acc.commissions += curr.amount; // Total needed to pay team
        // Commission reduces balance (money leaving the agency to the team)
        acc.balance -= curr.amount;
      } else {
        acc.income += curr.amount;
        // Income increases balance
        acc.balance += curr.amount;
      }
      return acc;
    }, { balance: 0, income: 0, expenses: 0, commissions: 0 });
  }, [transactions]);

  // Calculate Upcoming Recurring Payments (Forecast from Contracts)
  const recurringPayments = useMemo(() => {
    return contracts
      .filter(c => c.status === 'Active' && c.monthlyValue > 0)
      .map(c => {
        const client = clients.find(cl => cl.id === c.clientId);
        const salesRep = members.find(m => m.id === c.salesExecutiveId);

        // Calculate "Next Payment" date based on Start Date day
        const startDate = new Date(c.startDate);
        const today = new Date();
        const nextPaymentDate = new Date(today.getFullYear(), today.getMonth(), startDate.getDate() + 1); // Roughly +30 days logic visually

        // If the day has passed this month, move to next month (simple logic for display)
        if (nextPaymentDate < today) {
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        }

        // Commission Calculation (20% of Monthly)
        const commissionVal = c.monthlyValue * 0.20;

        return {
          id: c.id,
          contractTitle: c.title,
          clientName: client ? client.name : 'Desconhecido',
          salesRepName: salesRep ? salesRep.name : 'N/A',
          amount: c.monthlyValue,
          commission: commissionVal,
          dueDate: nextPaymentDate
        };
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [contracts, clients, members]);

  // Filtered Data for Table
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesType = activeTab === 'all' || t.type === activeTab;
      const matchesStatus = viewStatus === 'all'
        ? true
        : viewStatus === 'forecast'
          ? (t.status === 'Pending' || t.status === 'Overdue')
          : t.status === 'Completed';

      return matchesType && matchesStatus;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, activeTab, viewStatus]);

  // Form validation - required fields
  const isFormValid = useMemo(() => {
    return formData.description.trim() !== '' &&
      formData.amount.trim() !== '' &&
      parseFloat(formData.amount) > 0;
  }, [formData.description, formData.amount]);

  // Handlers
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleOpenModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingId(transaction.id);
      setFormData({
        description: transaction.description,
        amount: transaction.amount.toString(),
        type: transaction.type,
        date: transaction.date,
        createdAt: transaction.createdAt,
        status: transaction.status,
        selectedClientId: transaction.clientId ? transaction.clientId.toString() : ''
      });
    } else {
      setEditingId(null);
      setFormData({
        description: '',
        amount: '',
        type: 'income',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString().split('T')[0],
        status: 'Completed',
        selectedClientId: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clientId = e.target.value;
    setFormData(prev => ({ ...prev, selectedClientId: clientId }));

    if (clientId) {
      const cid = clientId; // String id in updated types
      const client = clients.find(c => c.id === cid);

      // Auto-calculate suggested values
      if (client) {
        // Find active monthly contracts
        const activeContracts = contracts.filter(c => c.clientId === cid && c.status === 'Active');
        const totalMonthly = activeContracts.reduce((acc, curr) => acc + curr.monthlyValue, 0);

        // If creating an income (monthly payment)
        if (formData.type === 'income') {
          setFormData(prev => ({
            ...prev,
            selectedClientId: clientId,
            description: `Mensalidade - ${client.name}`,
            amount: totalMonthly.toString()
          }));
        }
        // If creating a commission (expense)
        else if (formData.type === 'commission') {
          // Estimate 20% commission on monthly
          const estCommission = totalMonthly * 0.20;
          const salesRep = members.find(m => m.id === client.salesExecutiveId);
          setFormData(prev => ({
            ...prev,
            selectedClientId: clientId,
            description: `Comissão - ${salesRep ? salesRep.name : 'Vendedor'}`,
            amount: estCommission.toString()
          }));
        }
      }
    }
  };

  const handleDelete = async (id: number) => {
    const tx = transactions.find(t => t.id === id);
    const ok = await confirm({
      title: 'Excluir Transação',
      message: `Tem certeza que deseja excluir "${tx?.description || 'esta transação'}"?`,
      variant: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (ok) {
      // Persistir no Supabase
      const result = await deleteTransaction(id);
      if (!result.success) {
        toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
        return;
      }

      // Otimistic Update
      setTransactions(transactions.filter(t => t.id !== id));
      toast.success('Transação excluída', `${tx?.description || 'Transação'} foi removida.`);
      refresh();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountValue = parseFloat(formData.amount);

    if (isNaN(amountValue)) return;

    const newTransaction: Transaction = {
      id: editingId || Date.now(), // ID temporário se novo, será substituído pelo DB se insert
      description: formData.description,
      amount: amountValue,
      type: formData.type,
      date: formData.date,
      createdAt: editingId ? formData.createdAt : new Date().toISOString().split('T')[0],
      status: formData.status,
      clientId: formData.selectedClientId || undefined,
      unitId: editingId
        ? transactions.find(t => t.id === editingId)?.unitId || (selectedUnitId !== 'all' ? selectedUnitId : undefined)
        : (selectedUnitId !== 'all' ? selectedUnitId : undefined),
    };

    // FIX: Client ID type mismatch handling
    const transactionToSave = {
      ...newTransaction,
      clientId: formData.selectedClientId || undefined
    };


    // Persistir no Supabase
    const result = await saveTransaction(transactionToSave);
    if (!result.success) {
      toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
      return;
    }

    // Refresh context to get data from DB (including correct ID)
    refresh();
    toast.success(editingId ? 'Transação atualizada' : 'Lançamento adicionado', `${formData.description} foi salvo com sucesso.`);

    setIsModalOpen(false);
  };

  return (
    <div className="animate-in fade-in duration-500 relative pb-10">

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <h3 className={`font-semibold text-lg ${textMain}`}>
                {editingId ? 'Editar Lançamento' : 'Novo Lançamento'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">

              {!editingId && (
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                    <User size={12} /> Vincular Cliente (Auto-preencher)
                  </label>
                  <CustomDropdown
                    value={formData.selectedClientId}
                    onChange={v => { handleClientSelect({ target: { value: v } } as any); }}
                    options={[
                      { value: '', label: 'Selecione para puxar valores...' },
                      ...clients.map(c => ({ value: c.id, label: `${c.name} - ${c.company}`, icon: <User size={12} /> }))
                    ]}
                    isDarkMode={isDarkMode}
                  />
                </div>
              )}

              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Descrição</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none placeholder:text-slate-500`}
                  placeholder="Ex: Recebimento Contrato X"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Categoria</label>
                  <CustomDropdown
                    value={formData.type}
                    onChange={v => setFormData({ ...formData, type: v as TransactionType })}
                    options={[
                      { value: 'income', label: 'Entrada (+)', dot: 'bg-blue-500' },
                      { value: 'expense', label: 'Saída (-)', dot: 'bg-red-500' },
                      { value: 'commission', label: 'Comissão (Pag. Equipe)', dot: 'bg-violet-500' }
                    ]}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Data Prevista</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none [color-scheme:${isDarkMode ? 'dark' : 'light'}]`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Status</label>
                  <CustomDropdown
                    value={formData.status}
                    onChange={v => setFormData({ ...formData, status: v as 'Completed' | 'Pending' | 'Overdue' })}
                    options={[
                      { value: 'Completed', label: 'Realizado (Pago)', dot: 'bg-emerald-500' },
                      { value: 'Pending', label: 'Previsto (Pendente)', dot: 'bg-blue-500' },
                      { value: 'Overdue', label: 'Atrasado', dot: 'bg-red-500' }
                    ]}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isFormValid}
                className={`w-full py-2.5 font-bold rounded-lg transition-colors mt-2 ${isFormValid ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}
              >
                {editingId ? 'Salvar Alterações' : 'Adicionar Lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${textMain}`}>Financeiro</h1>
          <p className={`${textSub} text-sm`}>Controle de entradas, saídas e comissões da equipe</p>
        </div>
        <div className="flex gap-3">
          <button className={`px-4 py-2 ${isDarkMode ? 'bg-dark-surface text-slate-200 border-dark-border' : 'bg-white text-slate-600 border-slate-300'} hover:opacity-80 border rounded-lg text-sm transition-colors flex items-center gap-2`}>
            <Download size={16} /> <span className="hidden sm:inline">Relatório</span>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* Stats Cards - 4 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Balance (Net) */}
        <div className="bg-primary/10 border border-primary/20 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary rounded-lg text-white">
              <Wallet size={20} />
            </div>
            <span className="text-primary font-medium text-sm">Saldo em Caixa</span>
          </div>
          <p className={`text-2xl font-bold ${textMain}`}>{formatCurrency(summary.balance)}</p>
        </div>

        {/* Income (Gross) */}
        <div className={`${bgCard} border ${borderCol} ${isDarkMode ? '' : 'shadow-sm'} p-5 rounded-xl`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <TrendingUp size={20} />
            </div>
            <span className={`${textSub} font-medium text-sm`}>Entradas (Contratos)</span>
          </div>
          <p className={`text-2xl font-bold ${textMain}`}>{formatCurrency(summary.income)}</p>
        </div>

        {/* Commissions (To Pay) */}
        <div className={`${bgCard} border ${borderCol} ${isDarkMode ? '' : 'shadow-sm'} p-5 rounded-xl`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-violet-500/10 rounded-lg text-violet-500">
              <Percent size={20} />
            </div>
            <span className={`${textSub} font-medium text-sm`}>Comissões (Equipe)</span>
          </div>
          <p className={`text-2xl font-bold ${textMain}`}>{formatCurrency(summary.commissions)}</p>
        </div>

        {/* Expenses */}
        <div className={`${bgCard} border ${borderCol} ${isDarkMode ? '' : 'shadow-sm'} p-5 rounded-xl`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
              <TrendingDown size={20} />
            </div>
            <span className={`${textSub} font-medium text-sm`}>Saídas (Despesas)</span>
          </div>
          <p className={`text-2xl font-bold ${textMain}`}>{formatCurrency(summary.expenses)}</p>
        </div>
      </div>

      {/* NEW: Upcoming Recurring Payments Forecast */}
      <div className={`${bgCard} border ${borderCol} ${isDarkMode ? '' : 'shadow-sm'} rounded-xl overflow-hidden flex flex-col mb-8`}>
        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
          <h3 className={`text-lg font-semibold ${textMain} flex items-center gap-2`}>
            <RefreshCw size={20} className="text-primary" /> Próximos Pagamentos (Recorrência)
          </h3>
          <span className={`text-xs ${textSub}`}>Baseado nos contratos ativos (Mês Atual)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={`${isDarkMode ? 'bg-dark text-slate-400' : 'bg-slate-50 text-slate-600'} uppercase text-xs`}>
              <tr>
                <th className="px-6 py-3 font-medium">Cliente / Contrato</th>
                <th className="px-6 py-3 font-medium">Vencimento (Estimado)</th>
                <th className="px-6 py-3 font-medium text-right">Valor Mensal</th>
                <th className="px-6 py-3 font-medium text-right">Comissão (20%)</th>
                <th className="px-6 py-3 font-medium text-right">Líquido</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-dark-border' : 'divide-slate-200'}`}>
              {recurringPayments.map((payment) => (
                <tr key={payment.id} className={`${isDarkMode ? 'hover:bg-dark-border/30' : 'hover:bg-slate-50'} transition-colors`}>
                  <td className="px-6 py-4">
                    <div className={`font-medium ${textMain}`}>{payment.clientName}</div>
                    <div className={`text-xs ${textSub}`}>{payment.contractTitle}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <CalendarClock size={12} />
                      {payment.dueDate.toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-primary">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className={`px-6 py-4 text-right ${textSub}`}>
                    <div className="flex flex-col items-end">
                      <span>{formatCurrency(payment.commission)}</span>
                      <span className={`text-[10px] ${textSub}`}>{payment.salesRepName}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right font-bold ${textMain}`}>
                    {formatCurrency(payment.amount - payment.commission)}
                  </td>
                </tr>
              ))}
              {recurringPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className={`px-6 py-8 text-center ${textSub}`}>
                    Nenhum contrato recorrente ativo no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Section */}
      <div className={`${bgCard} border ${borderCol} ${isDarkMode ? '' : 'shadow-sm'} rounded-xl overflow-hidden flex flex-col min-h-[400px]`}>

        {/* Toolbar */}
        <div className={`p-4 border-b ${borderCol} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <h3 className={`text-lg font-semibold ${textMain}`}>Histórico Financeiro (Lançamentos)</h3>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* View Mode (Status) */}
            <div className={`flex p-1 rounded-lg border ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <button
                onClick={() => setViewStatus('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewStatus === 'all' ? (isDarkMode ? 'bg-dark-surface text-white' : 'bg-white text-slate-900 shadow-sm') : textSub}`}
              >
                Tudo
              </button>
              <button
                onClick={() => setViewStatus('realized')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${viewStatus === 'realized' ? 'bg-primary/20 text-primary' : textSub}`}
              >
                <CheckCircle2 size={12} /> Realizado
              </button>
              <button
                onClick={() => setViewStatus('forecast')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${viewStatus === 'forecast' ? 'bg-blue-500/20 text-blue-500' : textSub}`}
              >
                <CalendarClock size={12} /> Previsto
              </button>
            </div>

            {/* Filter Tabs */}
            <div className={`flex p-1 rounded-lg border ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'all' ? (isDarkMode ? 'bg-dark-surface text-white' : 'bg-white text-slate-900 shadow-sm') : textSub}`}
              >
                Todos
              </button>
              <button
                onClick={() => setActiveTab('income')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'income' ? 'bg-blue-500/20 text-blue-500' : textSub}`}
              >
                Entradas
              </button>
              <button
                onClick={() => setActiveTab('expense')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'expense' ? 'bg-red-500/20 text-red-500' : textSub}`}
              >
                Saídas
              </button>
              <button
                onClick={() => setActiveTab('commission')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'commission' ? 'bg-violet-500/20 text-violet-500' : textSub}`}
              >
                Comissões
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto custom-scrollbar flex-1">
          <table className="w-full text-left text-sm">
            <thead className={`${isDarkMode ? 'bg-dark text-slate-400' : 'bg-slate-50 text-slate-600'} uppercase text-xs sticky top-0 z-10`}>
              <tr>
                <th className="px-6 py-4 font-medium">Descrição</th>
                <th className="px-6 py-4 font-medium">Categoria</th>
                <th className="px-6 py-4 font-medium">Cadastro</th>
                <th className="px-6 py-4 font-medium">Prevista</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Valor</th>
                <th className="px-6 py-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-dark-border' : 'divide-slate-200'}`}>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className={`${isDarkMode ? 'hover:bg-dark-border/50' : 'hover:bg-slate-50'} transition-colors group`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center
                        ${tx.type === 'income' ? 'bg-blue-500/10 text-blue-500' :
                          tx.type === 'commission' ? 'bg-violet-500/10 text-violet-500' :
                            'bg-red-500/10 text-red-500'}
                      `}>
                        {tx.type === 'income' ? <TrendingUp size={14} /> :
                          tx.type === 'commission' ? <Percent size={14} /> :
                            <TrendingDown size={14} />}
                      </div>
                      <span className={`${textMain} font-medium`}>{tx.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs capitalize font-medium
                      ${tx.type === 'income' ? 'text-blue-400' :
                        tx.type === 'commission' ? 'text-violet-400' :
                          'text-red-400'}
                    `}>
                      {tx.type === 'income' ? 'Entrada' : tx.type === 'expense' ? 'Despesa' : 'Pag. Comissão'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 ${textSub} text-xs`}>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="opacity-50" />
                      {formatDate(tx.createdAt)}
                    </div>
                  </td>
                  <td className={`px-6 py-4 ${textSub} text-xs font-medium`}>
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${tx.status === 'Completed' ? 'bg-primary/10 text-primary' :
                        tx.status === 'Overdue' ? 'bg-red-500/10 text-red-500' :
                          'bg-blue-500/10 text-blue-400'}
                    `}>
                      {tx.status === 'Completed' ? <CheckCircle2 size={12} /> :
                        tx.status === 'Overdue' ? <AlertCircle size={12} /> :
                          <CalendarClock size={12} />}
                      {tx.status === 'Completed' ? 'Realizado' :
                        tx.status === 'Overdue' ? 'Atrasado' : 'Previsto'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right font-medium 
                    ${tx.type === 'income' ? 'text-primary' : textMain}
                  `}>
                    {tx.type !== 'income' ? '- ' : '+ '}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenModal(tx)}
                        className={`p-1.5 rounded ${textSub} hover:${textMain} ${isDarkMode ? 'hover:bg-dark-surface' : 'hover:bg-slate-100'} transition-colors`}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-500 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className={`px-6 py-12 text-center ${textSub} text-sm`}>
                    <div className="flex flex-col items-center gap-2">
                      <Filter size={24} className="opacity-50" />
                      <p>Nenhum lançamento encontrado para os filtros selecionados.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};