import React, { useState, useMemo } from 'react';
import { Landmark, CreditCard, Plus, Wallet, MoreHorizontal, Pencil, Trash2, X, AlertCircle, ShoppingCart, CalendarClock, TrendingDown, Filter } from 'lucide-react';
import { BankAccount, AccountType, Transaction } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

interface AccountsProps {
  accounts: BankAccount[];
  setAccounts: (accounts: BankAccount[]) => void;
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;
  isDarkMode: boolean;
}

export const Accounts: React.FC<AccountsProps> = ({ accounts, setAccounts, transactions, setTransactions, isDarkMode }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  // Filter State: Default to current month (YYYY-MM)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 7));

  // Theme Helpers
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
  const shadowClass = isDarkMode ? '' : 'shadow-sm';

  // Account Form State
  const [formData, setFormData] = useState({
    name: '',
    institution: '',
    type: 'Checking' as AccountType,
    balance: '',
    limit: '',
    dueDate: '',
    color: 'from-violet-600 to-violet-800'
  });

  // Purchase Form State
  const [purchaseData, setPurchaseData] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    accountId: ''
  });

  // Form validation - account form
  const isFormValid = useMemo(() => {
    return formData.name.trim() !== '' &&
      formData.institution.trim() !== '' &&
      formData.balance.trim() !== '';
  }, [formData.name, formData.institution, formData.balance]);

  // Form validation - purchase form
  const isPurchaseFormValid = useMemo(() => {
    return purchaseData.accountId !== '' &&
      purchaseData.description.trim() !== '' &&
      purchaseData.amount.trim() !== '' &&
      parseFloat(purchaseData.amount) > 0;
  }, [purchaseData.accountId, purchaseData.description, purchaseData.amount]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR');

  // Filter Transactions that are linked to accounts (Invoices/Purchases)
  const accountTransactions = transactions
    .filter(t => {
      const isLinked = t.accountId && accounts.some(a => a.id === t.accountId);
      const matchesDate = filterDate ? t.date.startsWith(filterDate) : true;
      return isLinked && matchesDate;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- ACCOUNT HANDLERS ---

  const handleOpenModal = (account?: BankAccount) => {
    if (account) {
      setEditingId(account.id);
      setFormData({
        name: account.name,
        institution: account.institution,
        type: account.type,
        balance: account.balance.toString(),
        limit: account.limit ? account.limit.toString() : '',
        dueDate: account.dueDate ? account.dueDate.toString() : '',
        color: account.color
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        institution: '',
        type: 'Checking',
        balance: '',
        limit: '',
        dueDate: '',
        color: 'from-violet-600 to-violet-800'
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Conta',
      message: 'Tem certeza que deseja excluir esta conta?',
      variant: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (ok) {
      setAccounts(accounts.filter(acc => acc.id !== id));
      toast.success('Conta excluída');
    }
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();

    const newAccount: BankAccount = {
      id: editingId || Date.now().toString(),
      name: formData.name,
      institution: formData.institution,
      type: formData.type,
      balance: parseFloat(formData.balance) || 0,
      limit: formData.limit ? parseFloat(formData.limit) : undefined,
      dueDate: formData.dueDate ? parseInt(formData.dueDate) : undefined,
      color: formData.color,
      archived: false
    };

    if (editingId) {
      setAccounts(accounts.map(acc => acc.id === editingId ? newAccount : acc));
      toast.success('Conta atualizada');
    } else {
      setAccounts([...accounts, newAccount]);
      toast.success('Conta criada');
    }
    setIsModalOpen(false);
  };

  // --- PURCHASE HANDLERS ---

  const handleOpenPurchaseModal = () => {
    // Default to first credit card found
    const firstCard = accounts.find(a => a.type === 'CreditCard');
    setPurchaseData({
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      category: '',
      accountId: firstCard ? firstCard.id : ''
    });
    setIsPurchaseModalOpen(true);
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(purchaseData.amount);

    if (!purchaseData.accountId || isNaN(amountVal)) return;

    // 1. Create Transaction (Expense)
    const newTransaction: Transaction = {
      id: Date.now(),
      description: purchaseData.description,
      amount: amountVal,
      type: 'expense',
      date: purchaseData.date,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'Pending', // Credit card purchases are pending payment via invoice
      category: purchaseData.category || 'Cartão de Crédito',
      accountId: purchaseData.accountId
    };

    setTransactions([newTransaction, ...transactions]);

    // 2. Update Account Balance (Increase Invoice Amount)
    setAccounts(accounts.map(acc => {
      if (acc.id === purchaseData.accountId) {
        return { ...acc, balance: acc.balance + amountVal };
      }
      return acc;
    }));

    setIsPurchaseModalOpen(false);
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case 'CreditCard': return <CreditCard size={24} className="text-white opacity-80" />;
      case 'Cash': return <Wallet size={24} className="text-white opacity-80" />;
      default: return <Landmark size={24} className="text-white opacity-80" />;
    }
  };

  const getTypeLabel = (type: AccountType) => {
    switch (type) {
      case 'Checking': return 'Conta Corrente';
      case 'Savings': return 'Poupança';
      case 'CreditCard': return 'Cartão de Crédito';
      case 'Investment': return 'Investimento';
      case 'Cash': return 'Dinheiro';
      default: return type;
    }
  };

  // Color options for UI
  const colorOptions = [
    { label: 'Roxo (Nu)', value: 'from-violet-600 to-violet-800' },
    { label: 'Vermelho (Bra/San)', value: 'from-red-600 to-red-800' },
    { label: 'Laranja (Inter)', value: 'from-orange-500 to-orange-700' },
    { label: 'Azul (Ita/Cai)', value: 'from-blue-600 to-blue-800' },
    { label: 'Verde (Sic)', value: 'from-emerald-600 to-emerald-800' },
    { label: 'Preto (Black)', value: 'from-slate-800 to-black' },
    { label: 'Dourado', value: 'from-yellow-600 to-yellow-800' },
  ];

  return (
    <div className="animate-in fade-in duration-500 pb-16 md:pb-0">

      {/* Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <h3 className={`font-semibold text-lg ${textMain}`}>
                {editingId ? 'Editar Conta/Cartão' : 'Nova Conta/Cartão'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">

              {/* Card Preview */}
              <div className={`w-full h-32 rounded-xl bg-gradient-to-br ${formData.color} p-4 text-white shadow-lg flex flex-col justify-between mb-2`}>
                <div className="flex justify-between items-start">
                  <span className="font-medium opacity-90">{formData.name || 'Nome da Conta'}</span>
                  {getAccountIcon(formData.type)}
                </div>
                <div>
                  <span className="text-xs opacity-75 block">{formData.type === 'CreditCard' ? 'Fatura Atual' : 'Saldo'}</span>
                  <span className="text-xl font-bold">{formData.balance ? formatCurrency(parseFloat(formData.balance)) : 'R$ 0,00'}</span>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Nome (Apelido)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                  placeholder="Ex: Nubank Principal"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Instituição</label>
                  <input
                    type="text"
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    placeholder="Ex: Itaú"
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Tipo</label>
                  <CustomDropdown
                    value={formData.type}
                    onChange={v => setFormData({ ...formData, type: v as AccountType })}
                    options={[
                      { value: 'Checking', label: 'Conta Corrente' },
                      { value: 'Savings', label: 'Poupança' },
                      { value: 'CreditCard', label: 'Cartão de Crédito' },
                      { value: 'Investment', label: 'Investimento' },
                      { value: 'Cash', label: 'Dinheiro' },
                    ]}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>
                    {formData.type === 'CreditCard' ? 'Fatura Atual (R$)' : 'Saldo Atual (R$)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    placeholder="0.00"
                    required
                  />
                </div>
                {formData.type === 'CreditCard' && (
                  <div>
                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Limite Total (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.limit}
                      onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
                      className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              {formData.type === 'CreditCard' && (
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Dia do Vencimento da Fatura</label>
                  <input
                    type="number"
                    min="1" max="31"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    placeholder="Ex: 10"
                  />
                </div>
              )}

              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Cor do Cartão</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: opt.value })}
                      className={`w-8 h-8 rounded-full bg-gradient-to-br ${opt.value} border-2 ${formData.color === opt.value ? 'border-white ring-2 ring-primary' : 'border-transparent opacity-60 hover:opacity-100'} transition-all`}
                      title={opt.label}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!isFormValid}
                className={`w-full py-3 font-bold rounded-lg transition-colors mt-2 ${isFormValid ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}
              >
                {editingId ? 'Salvar Alterações' : 'Criar Conta'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <h3 className={`font-semibold text-lg ${textMain} flex items-center gap-2`}>
                <ShoppingCart size={18} className="text-primary" /> Nova Compra no Cartão
              </h3>
              <button onClick={() => setIsPurchaseModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Selecionar Cartão</label>
                <CustomDropdown
                  value={purchaseData.accountId}
                  onChange={v => setPurchaseData({ ...purchaseData, accountId: v })}
                  options={[
                    { value: '', label: 'Selecione...' },
                    ...accounts.filter(a => a.type === 'CreditCard').map(acc => ({ value: acc.id, label: `${acc.name} (Fatura: ${formatCurrency(acc.balance)})` }))
                  ]}
                  isDarkMode={isDarkMode}
                  placeholder="Selecione..."
                />
              </div>

              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Descrição</label>
                <input
                  type="text"
                  value={purchaseData.description}
                  onChange={(e) => setPurchaseData({ ...purchaseData, description: e.target.value })}
                  className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                  placeholder="Ex: Uber, Ifood, Software..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseData.amount}
                    onChange={(e) => setPurchaseData({ ...purchaseData, amount: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${textSub} mb-1`}>Data</label>
                  <input
                    type="date"
                    value={purchaseData.date}
                    onChange={(e) => setPurchaseData({ ...purchaseData, date: e.target.value })}
                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none [color-scheme:${isDarkMode ? 'dark' : 'light'}]`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${textSub} mb-1`}>Categoria</label>
                <input
                  type="text"
                  value={purchaseData.category}
                  onChange={(e) => setPurchaseData({ ...purchaseData, category: e.target.value })}
                  className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                  placeholder="Ex: Transporte, Alimentação"
                />
              </div>

              <p className={`text-[10px] ${textSub} italic bg-opacity-50 p-2 rounded ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                * Esta compra será adicionada à fatura do cartão selecionado e também aparecerá no Financeiro como "Pendente".
              </p>

              <button
                type="submit"
                disabled={!isPurchaseFormValid}
                className={`w-full py-3 font-bold rounded-lg transition-colors mt-2 ${isPurchaseFormValid ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}
              >
                Lançar Compra
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className={`text-2xl font-bold ${textMain}`}>Contas & Cartões</h1>
          <p className={`${textSub} text-sm`}>Gerencie suas contas bancárias e faturas de cartão.</p>
        </div>
        <div className="flex gap-2">
          {accounts.some(a => a.type === 'CreditCard') && (
            <button
              onClick={handleOpenPurchaseModal}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              <ShoppingCart size={18} /> Lançar Compra
            </button>
          )}
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Plus size={18} /> Nova Conta
          </button>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {accounts.map(account => (
          <div
            key={account.id}
            className={`rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 relative group min-h-[180px] flex flex-col justify-between p-6 bg-gradient-to-br ${account.color}`}
          >
            {/* Background Pattern Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-2xl"></div>

            {/* Header */}
            <div className="flex justify-between items-start relative z-10">
              <div>
                <h3 className="text-white font-bold text-lg tracking-wide">{account.name}</h3>
                <span className="text-white/70 text-xs font-medium uppercase tracking-wider">{account.institution} • {getTypeLabel(account.type)}</span>
              </div>
              {getAccountIcon(account.type)}
            </div>

            {/* Actions Overlay */}
            <div className="absolute top-4 right-14 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button onClick={() => handleOpenModal(account)} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white backdrop-blur-sm">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(account.id)} className="p-1.5 bg-white/20 hover:bg-red-500/50 rounded-lg text-white backdrop-blur-sm">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Balance Section */}
            <div className="relative z-10 mt-6">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-white/80 text-xs mb-1">
                    {account.type === 'CreditCard' ? 'Fatura Atual' : 'Saldo Disponível'}
                  </p>
                  <h2 className="text-3xl font-bold text-white tracking-tight">
                    {formatCurrency(account.balance)}
                  </h2>
                </div>
                {account.type === 'CreditCard' && account.dueDate && (
                  <div className="text-right">
                    <p className="text-white/70 text-[10px] uppercase">Vencimento</p>
                    <p className="text-white font-bold text-lg flex items-center gap-1">
                      <CalendarClock size={16} /> Dia {account.dueDate}
                    </p>
                  </div>
                )}
              </div>

              {/* Credit Card Specific: Limit Progress */}
              {account.type === 'CreditCard' && account.limit && (
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-white/80 mb-1">
                    <span>Limite Usado: {((account.balance / account.limit) * 100).toFixed(0)}%</span>
                    <span>Disp: {formatCurrency(account.limit - account.balance)}</span>
                  </div>
                  <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden backdrop-blur-sm">
                    <div
                      className={`h-full rounded-full ${account.balance / account.limit > 0.8 ? 'bg-red-400' : 'bg-white/90'}`}
                      style={{ width: `${Math.min((account.balance / account.limit) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add New Card (Empty State) */}
        {accounts.length === 0 && (
          <button
            onClick={() => handleOpenModal()}
            className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 p-8 transition-colors ${isDarkMode ? 'border-dark-border hover:border-primary/50 hover:bg-dark-surface' : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50'}`}
          >
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              <Plus size={24} />
            </div>
            <span className={`font-medium ${textSub}`}>Adicionar primeira conta</span>
          </button>
        )}
      </div>

      {/* NEW SECTION: Invoices & Purchases */}
      {accounts.some(a => a.type === 'CreditCard') && (
        <div className={`${bgCard} border ${borderCol} rounded-xl shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-2`}>
          <div className={`p-4 border-b ${borderCol} flex flex-col sm:flex-row justify-between items-center gap-4 ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                <TrendingDown size={18} />
              </div>
              <div>
                <h3 className={`font-bold ${textMain}`}>Faturas & Compras Recentes</h3>
                <span className={`text-xs ${textSub} hidden sm:block`}>Integrado ao Financeiro</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-300'}`}>
                <Filter size={14} className={textSub} />
                <input
                  type="month"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className={`bg-transparent border-none outline-none text-xs font-medium ${textMain} w-full [color-scheme:${isDarkMode ? 'dark' : 'light'}]`}
                />
                {filterDate && (
                  <button onClick={() => setFilterDate('')} className={`text-slate-400 hover:text-red-500 ml-1 transition-colors`} title="Limpar filtro">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={`${isDarkMode ? 'bg-dark text-slate-400' : 'bg-slate-50 text-slate-600'} uppercase text-xs`}>
                <tr>
                  <th className="px-6 py-3 font-medium">Compra / Descrição</th>
                  <th className="px-6 py-3 font-medium">Cartão Vinculado</th>
                  <th className="px-6 py-3 font-medium">Data da Compra</th>
                  <th className="px-6 py-3 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-dark-border' : 'divide-slate-200'}`}>
                {accountTransactions.map((tx) => {
                  const linkedAccount = accounts.find(a => a.id === tx.accountId);
                  return (
                    <tr key={tx.id} className={`${isDarkMode ? 'hover:bg-dark-border/30' : 'hover:bg-slate-50'} transition-colors`}>
                      <td className="px-6 py-3">
                        <span className={`font-medium ${textMain}`}>{tx.description}</span>
                        {tx.category && <span className={`block text-xs ${textSub}`}>{tx.category}</span>}
                      </td>
                      <td className="px-6 py-3">
                        {linkedAccount ? (
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${linkedAccount.color}`}></div>
                            <span className={textSub}>{linkedAccount.name}</span>
                          </div>
                        ) : <span className="text-red-400 text-xs">Cartão removido</span>}
                      </td>
                      <td className={`px-6 py-3 ${textSub}`}>{formatDate(tx.date)}</td>
                      <td className="px-6 py-3 text-right font-medium text-red-500">
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  );
                })}
                {accountTransactions.length === 0 && (
                  <tr>
                    <td colSpan={4} className={`px-6 py-8 text-center ${textSub}`}>
                      {filterDate
                        ? 'Nenhuma compra encontrada para este mês.'
                        : 'Nenhuma compra registrada nos cartões.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};