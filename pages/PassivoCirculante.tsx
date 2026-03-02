import React, { useState, useMemo } from 'react';
import { ArrowDownCircle, TrendingDown, Plus, Pencil, Trash2, X, AlertCircle, CalendarClock, CheckCircle2, Filter, AlertTriangle, Calendar } from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

interface PassivoCirculanteProps {
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  isDarkMode: boolean;
}

export const PassivoCirculante: React.FC<PassivoCirculanteProps> = ({ transactions, setTransactions, isDarkMode }) => {
  // Modal & Editing State
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Pending' as 'Completed' | 'Pending' | 'Overdue',
    category: ''
  });

  // Form validation - required fields
  const isFormValid = useMemo(() => {
    return formData.description.trim() !== '' &&
      formData.amount.trim() !== '' &&
      parseFloat(formData.amount) > 0;
  }, [formData.description, formData.amount]);

  // Calculate Metrics specifically for Payables
  const metrics = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense' || t.type === 'commission');

    return {
      totalPayable: expenses.filter(t => t.status !== 'Completed').reduce((acc, curr) => acc + curr.amount, 0),
      totalOverdue: expenses.filter(t => t.status === 'Overdue').reduce((acc, curr) => acc + curr.amount, 0),
      paidThisMonth: expenses.filter(t => {
        if (t.status !== 'Completed') return false;
        const tDate = new Date(t.date);
        const now = new Date();
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      }).reduce((acc, curr) => acc + curr.amount, 0),
      countOpen: expenses.filter(t => t.status === 'Pending').length
    };
  }, [transactions]);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return transactions
      .filter(t => t.type === 'expense' || t.type === 'commission') // Only Liabilities
      .filter(t => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'pending') return t.status === 'Pending';
        if (statusFilter === 'overdue') return t.status === 'Overdue';
        if (statusFilter === 'paid') return t.status === 'Completed';
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by Due Date ascending
  }, [transactions, statusFilter]);

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
        date: transaction.date,
        status: transaction.status,
        category: transaction.category || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        status: 'Pending',
        category: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Excluir Despesa',
      message: 'Tem certeza que deseja excluir esta despesa?',
      variant: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (ok) {
      setTransactions(transactions.filter(t => t.id !== id));
      toast.success('Despesa excluída');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const amountValue = parseFloat(formData.amount);
    if (isNaN(amountValue)) return;

    const newTransaction: Transaction = {
      id: editingId || Date.now(),
      description: formData.description,
      amount: amountValue,
      type: 'expense', // Always expense here
      date: formData.date,
      createdAt: new Date().toISOString().split('T')[0],
      status: formData.status,
      category: formData.category
    };

    if (editingId) {
      setTransactions(transactions.map(t => t.id === editingId ? newTransaction : t));
      toast.success('Despesa atualizada');
    } else {
      setTransactions([newTransaction, ...transactions]);
      toast.success('Despesa lançada');
    }
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
                {editingId ? 'Editar Despesa' : 'Nova Despesa'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">

              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Descrição / Fornecedor</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-red-500 outline-none placeholder:text-slate-500`}
                  placeholder="Ex: Aluguel, Servidor AWS..."
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
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-red-500 outline-none`}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Categoria</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-red-500 outline-none`}
                    placeholder="Ex: Infraestrutura"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Vencimento</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-red-500 outline-none [color-scheme:${isDarkMode ? 'dark' : 'light'}]`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Status</label>
                  <CustomDropdown
                    value={formData.status}
                    onChange={v => setFormData({ ...formData, status: v as 'Completed' | 'Pending' | 'Overdue' })}
                    options={[
                      { value: 'Pending', label: 'A Pagar (Pendente)', dot: 'bg-amber-500' },
                      { value: 'Completed', label: 'Pago', dot: 'bg-emerald-500' },
                      { value: 'Overdue', label: 'Atrasado', dot: 'bg-red-500' },
                    ]}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isFormValid}
                className={`w-full py-2.5 font-bold rounded-lg transition-colors mt-2 ${isFormValid ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}
              >
                {editingId ? 'Salvar Alterações' : 'Lançar Despesa'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
            <ArrowDownCircle className="text-red-500" /> Passivo Circulante
          </h1>
          <p className={`${textSub} text-sm`}>Gestão exclusiva de contas a pagar e despesas operacionais.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Nova Despesa
        </button>
      </div>

      {/* Stats Cards - Liabilities Focus */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Total Payable (Pending) */}
        <div className={`${bgCard} border ${borderCol} p-5 rounded-xl shadow-sm border-l-4 border-l-orange-500`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
              <CalendarClock size={20} />
            </div>
            <span className={`${textSub} font-medium text-sm`}>Total a Pagar (Aberto)</span>
          </div>
          <p className={`text-2xl font-bold ${textMain}`}>{formatCurrency(metrics.totalPayable)}</p>
          <p className="text-xs text-orange-500 mt-1 font-medium">{metrics.countOpen} contas pendentes</p>
        </div>

        {/* Overdue (Critical) */}
        <div className={`${bgCard} border ${borderCol} p-5 rounded-xl shadow-sm border-l-4 border-l-red-500`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
              <AlertTriangle size={20} />
            </div>
            <span className={`${textSub} font-medium text-sm`}>Vencido (Crítico)</span>
          </div>
          <p className={`text-2xl font-bold ${textMain}`}>{formatCurrency(metrics.totalOverdue)}</p>
        </div>

        {/* Paid (Month) */}
        <div className={`${bgCard} border ${borderCol} p-5 rounded-xl shadow-sm border-l-4 border-l-emerald-500`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <CheckCircle2 size={20} />
            </div>
            <span className={`${textSub} font-medium text-sm`}>Pago (Este Mês)</span>
          </div>
          <p className={`text-2xl font-bold ${textMain}`}>{formatCurrency(metrics.paidThisMonth)}</p>
        </div>
      </div>

      {/* Expense List */}
      <div className={`${bgCard} border ${borderCol} ${isDarkMode ? '' : 'shadow-sm'} rounded-xl overflow-hidden flex flex-col min-h-[400px]`}>

        {/* Toolbar */}
        <div className={`p-4 border-b ${borderCol} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <h3 className={`text-lg font-semibold ${textMain}`}>Contas & Despesas</h3>

          <div className={`flex p-1 rounded-lg border ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === 'all' ? (isDarkMode ? 'bg-dark-surface text-white' : 'bg-white text-slate-900 shadow-sm') : textSub}`}
            >
              Todas
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${statusFilter === 'pending' ? 'bg-orange-500/20 text-orange-500' : textSub}`}
            >
              A Pagar
            </button>
            <button
              onClick={() => setStatusFilter('overdue')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${statusFilter === 'overdue' ? 'bg-red-500/20 text-red-500' : textSub}`}
            >
              Vencidas
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${statusFilter === 'paid' ? 'bg-emerald-500/20 text-emerald-500' : textSub}`}
            >
              Pagas
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto custom-scrollbar flex-1">
          <table className="w-full text-left text-sm">
            <thead className={`${isDarkMode ? 'bg-dark text-slate-400' : 'bg-slate-50 text-slate-600'} uppercase text-xs sticky top-0 z-10`}>
              <tr>
                <th className="px-6 py-4 font-medium">Fornecedor / Descrição</th>
                <th className="px-6 py-4 font-medium">Categoria</th>
                <th className="px-6 py-4 font-medium">Vencimento</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Valor</th>
                <th className="px-6 py-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-dark-border' : 'divide-slate-200'}`}>
              {filteredExpenses.map((tx) => (
                <tr key={tx.id} className={`${isDarkMode ? 'hover:bg-dark-border/50' : 'hover:bg-slate-50'} transition-colors group`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500/10 text-red-500">
                        <TrendingDown size={14} />
                      </div>
                      <span className={`${textMain} font-medium`}>{tx.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs ${textSub} bg-opacity-20 px-2 py-1 rounded border ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`}>
                      {tx.category || 'Geral'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 ${textSub} text-xs font-medium`}>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className={new Date(tx.date) < new Date() && tx.status !== 'Completed' ? 'text-red-500' : 'opacity-50'} />
                      <span className={new Date(tx.date) < new Date() && tx.status !== 'Completed' ? 'text-red-500 font-bold' : ''}>
                        {formatDate(tx.date)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${tx.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                        tx.status === 'Overdue' ? 'bg-red-500/10 text-red-500' :
                          'bg-orange-500/10 text-orange-500'}
                    `}>
                      {tx.status === 'Completed' ? <CheckCircle2 size={12} /> :
                        tx.status === 'Overdue' ? <AlertCircle size={12} /> :
                          <CalendarClock size={12} />}
                      {tx.status === 'Completed' ? 'Pago' :
                        tx.status === 'Overdue' ? 'Atrasado' : 'A Pagar'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right font-medium text-red-500`}>
                    {formatCurrency(tx.amount)}
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
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className={`px-6 py-12 text-center ${textSub} text-sm`}>
                    <div className="flex flex-col items-center gap-2">
                      <Filter size={24} className="opacity-50" />
                      <p>Nenhuma despesa encontrada para este filtro.</p>
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