import React, { useState, useMemo } from 'react';
import { CreditCard, Plus, X, Pencil, Trash2, Building, Check, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { BankAccount, AccountType } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { saveBankAccount, deleteBankAccount } from '../lib/dataService';
import { useAppData } from '../context/AppDataContext';

interface ContasBancariasProps {
    isDarkMode: boolean;
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
    { value: 'Checking', label: 'Conta Corrente' },
    { value: 'Savings', label: 'Poupança' },
    { value: 'Investment', label: 'Investimentos' },
    { value: 'CreditCard', label: 'Cartão de Crédito' },
    { value: 'Cash', label: 'Dinheiro' },
];

const COLORS = ['#00bf62', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export const ContasBancarias: React.FC<ContasBancariasProps> = ({ isDarkMode }) => {
    // Use App Data Context
    const { bankAccounts: accounts, refresh } = useAppData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
    const confirm = useConfirm();
    const toast = useToast();
    const [formData, setFormData] = useState({
        name: '',
        institution: '',
        type: 'Checking' as AccountType,
        balance: 0,
        color: COLORS[0],
        isDefault: false,
    });

    // Theme helpers
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    // Form validation - required fields
    const isFormValid = useMemo(() => {
        return formData.name.trim() !== '' && formData.institution.trim() !== '';
    }, [formData.name, formData.institution]);

    const totalBalance = accounts.filter(a => !a.archived).reduce((sum, a) => sum + a.balance, 0);
    const totalAssets = accounts.filter(a => !a.archived && a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = accounts.filter(a => !a.archived && a.balance < 0).reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const handleOpenModal = (account?: BankAccount) => {
        if (account) {
            setEditingAccount(account);
            setFormData({
                name: account.name,
                institution: account.institution,
                type: account.type,
                balance: account.balance,
                color: account.color,
                isDefault: account.isDefault || false,
            });
        } else {
            setEditingAccount(null);
            setFormData({
                name: '',
                institution: '',
                type: 'Checking',
                balance: 0,
                color: COLORS[0],
                isDefault: false,
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const accountData: BankAccount = {
            id: editingAccount?.id || Date.now().toString(),
            name: formData.name,
            institution: formData.institution,
            type: formData.type,
            balance: formData.balance,
            color: formData.color,
            archived: false,
            isDefault: formData.isDefault,
        };

        // Persistir no Supabase
        const result = await saveBankAccount(accountData);
        if (!result.success) {
            toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
            return;
        }

        refresh(); // Atualiza context (que trará os dados atualizados do banco)

        if (editingAccount) {
            toast.success('Conta atualizada');
        } else {
            toast.success('Conta criada');
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: 'Excluir Conta Bancária',
            message: 'Tem certeza que deseja excluir esta conta bancária?',
            variant: 'danger',
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar'
        });
        if (ok) {
            // Persistir no Supabase
            const result = await deleteBankAccount(id);
            if (!result.success) {
                toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
                return;
            }
            refresh(); // Atualiza context
            toast.success('Conta excluída');
        }
    };

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <CreditCard className="text-primary" /> Contas Bancárias
                    </h1>
                    <p className={`${textSub} text-sm`}>Gerencie suas contas e saldos.</p>
                </div>

                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg text-sm flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
                >
                    <Plus size={16} /> Nova Conta
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Wallet size={20} className="text-primary" />
                        </div>
                        <span className={`text-sm ${textSub}`}>Saldo Total</span>
                    </div>
                    <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {formatCurrency(totalBalance)}
                    </p>
                </div>

                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <TrendingUp size={20} className="text-green-500" />
                        </div>
                        <span className={`text-sm ${textSub}`}>Total Ativos</span>
                    </div>
                    <p className={`text-2xl font-bold text-green-500`}>
                        {formatCurrency(totalAssets)}
                    </p>
                </div>

                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <TrendingDown size={20} className="text-red-500" />
                        </div>
                        <span className={`text-sm ${textSub}`}>Total Passivos</span>
                    </div>
                    <p className={`text-2xl font-bold text-red-500`}>
                        {formatCurrency(totalLiabilities)}
                    </p>
                </div>
            </div>

            {/* Accounts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.filter(a => !a.archived).map(account => (
                    <div
                        key={account.id}
                        className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden hover:shadow-lg transition-shadow`}
                    >
                        <div className="h-2" style={{ backgroundColor: account.color }}></div>
                        <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className={`font-semibold ${textMain}`}>{account.name}</h3>
                                        {account.isDefault && (
                                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                                                Principal
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm ${textSub} flex items-center gap-1`}>
                                        <Building size={12} /> {account.institution}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleOpenModal(account)}
                                        className={`p-1.5 rounded ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-slate-100'} ${textSub} hover:text-primary transition-colors`}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(account.id)}
                                        className={`p-1.5 rounded ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-slate-100'} ${textSub} hover:text-red-500 transition-colors`}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className={`inline-block text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} ${textSub} mb-3`}>
                                {ACCOUNT_TYPES.find(t => t.value === account.type)?.label}
                            </div>

                            <p className={`text-2xl font-bold ${account.balance >= 0 ? 'text-primary' : 'text-red-500'}`}>
                                {formatCurrency(account.balance)}
                            </p>
                        </div>
                    </div>
                ))}

                {accounts.filter(a => !a.archived).length === 0 && (
                    <div className={`col-span-full text-center py-12 ${textSub}`}>
                        <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
                        <p>Nenhuma conta cadastrada.</p>
                        <p className="text-sm">Clique em "Nova Conta" para começar.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>
                                {editingAccount ? 'Editar Conta' : 'Nova Conta'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Nome da Conta</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    placeholder="Ex: Conta Principal"
                                    required
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Banco/Instituição</label>
                                <input
                                    type="text"
                                    value={formData.institution}
                                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    placeholder="Ex: Nubank, Itaú"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Tipo</label>
                                    <CustomDropdown
                                        value={formData.type}
                                        onChange={v => setFormData({ ...formData, type: v as AccountType })}
                                        options={ACCOUNT_TYPES.map(t => ({ value: t.value, label: t.label }))}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Saldo Inicial</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.balance}
                                        onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-2`}>Cor</label>
                                <div className="flex gap-2">
                                    {COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color })}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${formData.color === color ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                                            style={{ backgroundColor: color }}
                                        >
                                            {formData.color === color && <Check size={14} className="text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className={`flex items-center gap-2 cursor-pointer`}>
                                <input
                                    type="checkbox"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                />
                                <span className={`text-sm ${textMain}`}>Conta principal</span>
                            </label>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className={`flex-1 py-3 font-bold rounded-lg border ${borderCol} ${textMain} hover:bg-opacity-10 transition-colors`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!isFormValid}
                                    className={`flex-1 py-3 font-bold rounded-lg transition-colors ${isFormValid ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
