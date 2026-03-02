import React, { useState, useMemo } from 'react';
import {
    Wallet, Download, Printer, Plus, Minus, FileText, CheckCircle, Clock, ChevronDown, ChevronUp, History, Eye, Users, ArrowRight,
    AlertCircle, Search, CreditCard, User, TrendingUp, TrendingDown, Info, Banknote, BarChart3, Percent, DollarSign, Calendar, X, Check, Filter
} from 'lucide-react';
import { TeamMember, Commission, Withdrawal, PaymentRecord } from '../types';
import { useAppData } from '../hooks/useAppData';
import { formatCurrency } from '../utils';
import { useToast } from '../components/Toast';
import { saveCommission, saveWithdrawal, savePaymentRecord } from '../lib/dataService';
import { PaymentModal, PaymentData } from '../components/PaymentModal';
import { CustomDropdown } from '../components/CustomDropdown';
import { usePermissions } from '../hooks/usePermissions';

interface FolhaPagamentoProps {
    members: TeamMember[];
    isDarkMode: boolean;
    currentUser: TeamMember | null;
}

// Tabela INSS 2024/2025
const INSS_TABLE = [
    { min: 0, max: 1412.00, rate: 0.075 },
    { min: 1412.01, max: 2666.68, rate: 0.09 },
    { min: 2666.69, max: 4000.03, rate: 0.12 },
    { min: 4000.04, max: 7786.02, rate: 0.14 },
];

// Tabela IRRF 2024/2025
const IRRF_TABLE = [
    { min: 0, max: 2259.20, rate: 0, deduction: 0 },
    { min: 2259.21, max: 2826.65, rate: 0.075, deduction: 169.44 },
    { min: 2826.66, max: 3751.05, rate: 0.15, deduction: 381.44 },
    { min: 3751.06, max: 4664.68, rate: 0.225, deduction: 662.77 },
    { min: 4664.69, max: Infinity, rate: 0.275, deduction: 884.96 },
];
const IRRF_DEPENDENT_DEDUCTION = 189.59;

// Encargos do empregador
const EMPLOYER_TAXES = {
    inss: 0.20,
    fgts: 0.08,
    rat: 0.02,
    terceiros: 0.058,
};

interface PayrollBreakdown {
    baseSalary: number;
    commissions: number;
    grossSalary: number;
    inss: number;
    irrf: number;
    otherDeductions: number;
    netSalary: number;
    fgts: number;
    employerInss: number;
    totalCost: number;
}

function calculateINSS(grossSalary: number): number {
    let inss = 0;
    let previousMax = 0;
    for (const bracket of INSS_TABLE) {
        if (grossSalary <= bracket.min) break;
        const taxable = Math.min(grossSalary, bracket.max) - previousMax;
        inss += taxable * bracket.rate;
        previousMax = bracket.max;
    }
    return Math.round(inss * 100) / 100;
}

function calculateIRRF(baseIR: number, dependents: number = 0): number {
    const adjusted = baseIR - (dependents * IRRF_DEPENDENT_DEDUCTION);
    for (const bracket of IRRF_TABLE) {
        if (adjusted >= bracket.min && adjusted <= bracket.max) {
            const irrf = adjusted * bracket.rate - bracket.deduction;
            return Math.max(0, Math.round(irrf * 100) / 100);
        }
    }
    return 0;
}

type TabView = 'payroll' | 'history';

export const FolhaPagamento: React.FC<FolhaPagamentoProps> = ({ members, isDarkMode, currentUser }) => {
    const { commissions, withdrawals, paymentRecords, settings, refresh, setPaymentRecords, permissions: contextPermissions } = useAppData();
    const { can } = usePermissions(currentUser, contextPermissions);
    const canManagePayroll = can('edit', 'payroll');
    const toast = useToast();

    // Data scoping: non-admin sees only their own data
    const visibleMembers = useMemo(() => {
        if (canManagePayroll) return members;
        return members.filter(m => m.id === currentUser?.id);
    }, [members, canManagePayroll, currentUser?.id]);

    const [activeTab, setActiveTab] = useState<TabView>('payroll');
    const [isCommModalOpen, setIsCommModalOpen] = useState(false);
    const [isWithModalOpen, setIsWithModalOpen] = useState(false);
    const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [formEmployeeId, setFormEmployeeId] = useState('');
    const [formAmount, setFormAmount] = useState(0);
    const [formSource, setFormSource] = useState('');
    const [formReason, setFormReason] = useState<Withdrawal['reason']>('advance');
    const [formDesc, setFormDesc] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [showEncargos, setShowEncargos] = useState(false);
    const [paymentType, setPaymentType] = useState<'salary' | 'advance'>('salary');

    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    const calculatePayroll = (memberId: string): PayrollBreakdown => {
        const member = members.find(m => m.id === memberId);
        const baseSalary = member?.salary || 0;
        const contractType = member?.contractType || 'CLT';
        const hasStatutoryDeductions = contractType === 'CLT' || contractType === 'Estágio';

        const periodComm = commissions.filter(c => c.employeeId === memberId && c.period === selectedPeriod);
        const periodWith = withdrawals.filter(w => w.employeeId === memberId && w.date.startsWith(selectedPeriod));

        const commissionsTotal = periodComm.reduce((s, c) => s + c.amount, 0);
        const otherDeductions = periodWith.reduce((s, w) => s + w.amount, 0);
        const grossSalary = baseSalary + commissionsTotal;

        const inss = hasStatutoryDeductions ? calculateINSS(grossSalary) : 0;
        const baseIR = grossSalary - inss;
        const irrf = hasStatutoryDeductions ? calculateIRRF(baseIR) : 0;
        const netSalary = grossSalary - inss - irrf - otherDeductions;

        const fgts = hasStatutoryDeductions ? grossSalary * EMPLOYER_TAXES.fgts : 0;
        const employerInss = hasStatutoryDeductions ? grossSalary * EMPLOYER_TAXES.inss : 0;
        const rat = hasStatutoryDeductions ? grossSalary * EMPLOYER_TAXES.rat : 0;
        const terceiros = hasStatutoryDeductions ? grossSalary * EMPLOYER_TAXES.terceiros : 0;
        const totalCost = grossSalary + fgts + employerInss + rat + terceiros;

        return { baseSalary, commissions: commissionsTotal, grossSalary, inss, irrf, otherDeductions, netSalary, fgts, employerInss, totalCost };
    };

    const stats = useMemo(() => {
        let totalGross = 0, totalNet = 0, totalCost = 0, totalINSS = 0, totalIRRF = 0, totalFGTS = 0;
        visibleMembers.forEach(m => {
            const data = calculatePayroll(m.id);
            totalGross += data.grossSalary;
            totalNet += data.netSalary;
            totalCost += data.totalCost;
            totalINSS += data.inss;
            totalIRRF += data.irrf;
            totalFGTS += data.fgts;
        });
        return { totalGross, totalNet, totalCost, totalINSS, totalIRRF, totalFGTS };
    }, [visibleMembers, commissions, withdrawals, selectedPeriod]);

    // Payment Status Helpers
    const periodPaymentStats = useMemo(() => {
        const periodRecords = paymentRecords.filter(pr => pr.period === selectedPeriod);
        const paid = periodRecords.filter(pr => pr.status === 'paid').length;
        const paymentDay = settings?.financial?.paymentDay || 5;
        const now = new Date();
        const [year, month] = selectedPeriod.split('-').map(Number);
        const payDate = new Date(year, month - 1, paymentDay);
        const daysUntilPayment = Math.ceil((payDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { paid, pending: members.length - paid, paymentDay, daysUntilPayment };
    }, [paymentRecords, selectedPeriod, settings, members.length]);

    const getPaymentStatus = (memberId: string): PaymentRecord | undefined => {
        return paymentRecords.find(pr => pr.employeeId === memberId && pr.period === selectedPeriod);
    };

    const handleAddCommission = (e: React.FormEvent) => {
        e.preventDefault();
        const comm: Commission = {
            id: `comm-${Date.now()}`,
            employeeId: formEmployeeId,
            amount: formAmount,
            source: formSource || 'Manual',
            period: selectedPeriod,
            status: 'paid',
            createdAt: new Date().toISOString(),
        };
        saveCommission(comm).then(r => {
            if (r.success) {
                toast.success('Comissão adicionada!');
                refresh();
                setIsCommModalOpen(false);
                setFormEmployeeId(''); setFormAmount(0); setFormSource('');
            } else toast.error(r.error || 'Erro ao salvar');
        });
    };

    const handleAddWithdrawal = (e: React.FormEvent) => {
        e.preventDefault();
        const w: Withdrawal = {
            id: `with-${Date.now()}`,
            employeeId: formEmployeeId,
            amount: formAmount,
            reason: formReason,
            description: formDesc,
            date: new Date().toISOString().slice(0, 10),
            status: 'approved',
            createdAt: new Date().toISOString(),
        };
        saveWithdrawal(w).then(r => {
            if (r.success) {
                toast.success('Desconto adicionado!');
                refresh();
                setIsWithModalOpen(false);
                setFormEmployeeId(''); setFormAmount(0); setFormDesc('');
            } else toast.error(r.error || 'Erro ao salvar');
        });
    };

    const periodLabel = new Date(selectedPeriod + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const paidPercent = members.length > 0 ? Math.round((periodPaymentStats.paid / members.length) * 100) : 0;

    const openPayslip = (memberId: string) => {
        setSelectedEmployee(memberId);
        setIsPayslipModalOpen(true);
    };

    const openPaymentModal = (memberId: string) => {
        setPaymentType('salary');
        setSelectedEmployee(memberId);
        setIsPaymentModalOpen(true);
    };

    const openAdvanceModal = (memberId: string) => {
        setPaymentType('advance');
        setSelectedEmployee(memberId);
        setIsPaymentModalOpen(true);
    };

    const handleConfirmPayment = async (data: { paymentMethod: 'pix' | 'transfer' | 'cash'; notes?: string; transactionId?: string }) => {
        if (!selectedEmployee) return;

        if (paymentType === 'advance') {
            const member = members.find(m => m.id === selectedEmployee);
            const amount = (member?.baseSalary || 0) * 0.5;
            const withdrawal: Withdrawal = {
                id: `with-${Date.now()}`,
                employeeId: selectedEmployee,
                amount: amount,
                reason: 'advance',
                description: `Adiantamento Quinzenal - ${selectedPeriod}${data.transactionId ? ` (Tx: ${data.transactionId})` : ''}`,
                date: new Date().toISOString().slice(0, 10),
                status: 'approved',
                createdAt: new Date().toISOString(),
            };
            const result = await saveWithdrawal(withdrawal);
            if (result.success) {
                toast.success('Adiantamento registrado!');
                refresh();
                setIsPaymentModalOpen(false);
            } else {
                toast.error(result.error || 'Erro ao salvar');
            }
            return;
        }

        const payroll = calculatePayroll(selectedEmployee);
        const record: PaymentRecord = {
            id: `pay-${Date.now()}`,
            employeeId: selectedEmployee,
            period: selectedPeriod,
            grossSalary: payroll.grossSalary,
            netSalary: payroll.netSalary,
            inss: payroll.inss,
            irrf: payroll.irrf,
            fgts: payroll.fgts,
            commissions: payroll.commissions,
            deductions: payroll.otherDeductions,
            status: 'paid',
            paymentMethod: data.paymentMethod,
            paidAt: new Date().toISOString(),
            paidBy: 'admin',
            transactionId: data.transactionId,
            notes: data.notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await savePaymentRecord(record);
        if (result.success) {
            toast.success('Pagamento registrado!');
            setPaymentRecords([...paymentRecords, record]);
            setIsPaymentModalOpen(false);
        } else {
            toast.error(result.error || 'Erro ao registrar pagamento');
        }
    };

    const selectedMember = members.find(m => m.id === selectedEmployee);
    const getPaymentModalData = (): PaymentData | null => {
        if (!selectedEmployee || !selectedMember) return null;
        if (paymentType === 'advance') {
            const amount = (selectedMember.baseSalary || 0) * 0.5;
            return {
                employeeId: selectedEmployee,
                period: selectedPeriod,
                grossSalary: amount,
                netSalary: amount,
                inss: 0, irrf: 0, fgts: 0, commissions: 0, deductions: 0,
                status: 'pending'
            };
        }
        const stats = calculatePayroll(selectedEmployee);
        return {
            employeeId: selectedEmployee,
            period: selectedPeriod,
            grossSalary: stats.grossSalary,
            netSalary: stats.netSalary,
            inss: stats.inss,
            irrf: stats.irrf,
            fgts: stats.fgts,
            commissions: stats.commissions,
            deductions: stats.otherDeductions,
            status: getPaymentStatus(selectedEmployee)?.status || 'pending',
        };
    };
    const paymentModalData = getPaymentModalData();

    return (
        <div className="animate-in fade-in duration-300 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-3`}>
                        <div className="p-2.5 rounded-xl bg-primary/10">
                            <Wallet className="text-primary" size={22} />
                        </div>
                        Folha de Pagamento
                    </h1>
                    <p className={`${textSub} text-sm mt-1 ml-[52px]`}>
                        {canManagePayroll
                            ? <>Gerencie salários, pagamentos e histórico • <span className="capitalize font-medium">{periodLabel}</span></>
                            : <>Seus pagamentos e holerites • <span className="capitalize font-medium">{periodLabel}</span></>
                        }
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input type="month" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
                        className={`px-4 py-2.5 ${bgCard} border ${borderCol} rounded-xl text-sm ${textMain} focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none`} />

                    {canManagePayroll && (
                        <>
                            <button onClick={() => setIsCommModalOpen(true)} className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-emerald-500/20">
                                <Plus size={16} /> Comissão
                            </button>
                            <button onClick={() => setIsWithModalOpen(true)} className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-red-500/20">
                                <Minus size={16} /> Desconto
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Salário Bruto */}
                <div className={`${bgCard} border ${borderCol} rounded-2xl p-5 hover:shadow-lg transition-all group`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                            <DollarSign size={20} className="text-blue-500" />
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            <Users size={10} className="inline mr-1" />{visibleMembers.length} membros
                        </span>
                    </div>
                    <p className={`text-xs font-medium ${textSub} mb-1`}>Salário Bruto Total</p>
                    <p className={`text-2xl font-bold ${textMain}`}>{formatCurrency(stats.totalGross)}</p>
                </div>

                {/* Salário Líquido */}
                <div className={`${bgCard} border ${borderCol} rounded-2xl p-5 hover:shadow-lg transition-all group`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                            <TrendingUp size={20} className="text-emerald-500" />
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                            Líquido
                        </span>
                    </div>
                    <p className={`text-xs font-medium ${textSub} mb-1`}>Valor Líquido Total</p>
                    <p className="text-2xl font-bold text-emerald-500">{formatCurrency(stats.totalNet)}</p>
                </div>

                {/* Custo Total */}
                <div className={`${bgCard} border ${borderCol} rounded-2xl p-5 hover:shadow-lg transition-all group`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <BarChart3 size={20} className="text-primary" />
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-primary/10 text-primary' : 'bg-primary/5 text-primary'}`}>
                            + encargos
                        </span>
                    </div>
                    <p className={`text-xs font-medium ${textSub} mb-1`}>Custo Total Empresa</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(stats.totalCost)}</p>
                </div>

                {/* Status de Pagamento */}
                <div className={`${bgCard} border ${borderCol} rounded-2xl p-5 hover:shadow-lg transition-all group relative overflow-hidden`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                            <Calendar size={20} className="text-amber-500" />
                        </div>
                        <span className={`text-xs font-semibold ${periodPaymentStats.daysUntilPayment <= 3 ? 'text-red-500' : 'text-amber-500'}`}>
                            Dia {periodPaymentStats.paymentDay}
                            {periodPaymentStats.daysUntilPayment > 0 && periodPaymentStats.daysUntilPayment <= 7 && (
                                <span className="font-normal ml-1">({periodPaymentStats.daysUntilPayment}d)</span>
                            )}
                        </span>
                    </div>
                    <p className={`text-xs font-medium ${textSub} mb-2`}>Pagamentos Realizados</p>
                    <div className="flex items-end gap-3">
                        <p className="text-2xl font-bold text-emerald-500">{periodPaymentStats.paid}<span className={`text-base font-normal ${textSub}`}>/{members.length}</span></p>
                        <div className="flex-1 mb-1.5">
                            <div className={`h-2 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} overflow-hidden`}>
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                                    style={{ width: `${paidPercent}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Encargos Extras - collapsible */}
            <div className={`${bgCard} border ${borderCol} rounded-2xl overflow-hidden transition-all shadow-sm`}>
                <button onClick={() => setShowEncargos(!showEncargos)}
                    className={`w-full flex items-center justify-between p-4 ${textSub} hover:${isDarkMode ? 'bg-dark/30' : 'bg-slate-50'} transition-colors user-select-none`}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Percent size={16} /> Detalhes dos Encargos e Impostos
                    </div>
                    {showEncargos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {showEncargos && (
                    <div className={`px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t ${borderCol}`}>
                        <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-dark/30' : 'bg-slate-50'} mt-3`}>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-orange-500" />
                                <span className={`text-xs ${textSub}`}>INSS</span>
                            </div>
                            <p className="text-lg font-bold text-orange-500">{formatCurrency(stats.totalINSS)}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-dark/30' : 'bg-slate-50'} mt-3`}>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className={`text-xs ${textSub}`}>IRRF</span>
                            </div>
                            <p className="text-lg font-bold text-red-500">{formatCurrency(stats.totalIRRF)}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-dark/30' : 'bg-slate-50'} mt-3`}>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-purple-500" />
                                <span className={`text-xs ${textSub}`}>FGTS</span>
                            </div>
                            <p className="text-lg font-bold text-purple-500">{formatCurrency(stats.totalFGTS)}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-dark/30' : 'bg-slate-50'} mt-3`}>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                <span className={`text-xs ${textSub}`}>Impostos Totais</span>
                            </div>
                            <p className="text-lg font-bold text-primary">{formatCurrency(stats.totalINSS + stats.totalIRRF + stats.totalFGTS)}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2">
                <div className={`flex p-1 rounded-xl ${isDarkMode ? 'bg-dark' : 'bg-slate-100'}`}>
                    <button
                        onClick={() => setActiveTab('payroll')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'payroll'
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : `${textSub} hover:text-primary`
                            }`}
                    >
                        <DollarSign size={15} className="inline mr-1.5" /> Folha
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : `${textSub} hover:text-primary`
                            }`}
                    >
                        <History size={15} className="inline mr-1.5" /> Histórico
                    </button>
                </div>
            </div>

            {/* Payroll Tab - Table Layout */}
            {activeTab === 'payroll' && (
                <div className={`w-full overflow-hidden border ${borderCol} rounded-2xl ${bgCard} shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className={`border-b ${borderCol} ${isDarkMode ? 'bg-dark/50' : 'bg-slate-50'}`}>
                                    <th className={`p-4 text-xs font-semibold ${textSub}`}>FUNCIONÁRIO</th>
                                    <th className={`p-4 text-xs font-semibold ${textSub}`}>SALÁRIO BASE</th>
                                    <th className={`p-4 text-xs font-semibold ${textSub}`}>COMISSÃO</th>
                                    <th className={`p-4 text-xs font-semibold ${textSub}`}>DESCONTOS</th>
                                    <th className={`p-4 text-xs font-semibold ${textSub}`}>LÍQUIDO</th>
                                    <th className={`p-4 text-xs font-semibold ${textSub}`}>STATUS</th>
                                    <th className={`p-4 text-xs font-semibold ${textSub} text-right`}>AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleMembers.map(m => {
                                    const data = calculatePayroll(m.id);
                                    const paymentStatus = getPaymentStatus(m.id);
                                    const isPaid = paymentStatus?.status === 'paid';

                                    return (
                                        <tr key={m.id} className={`border-b last:border-0 ${borderCol} hover:${isDarkMode ? 'bg-dark/30' : 'bg-slate-50'} transition-colors`}>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} flex items-center justify-center overflow-hidden`}>
                                                        {m.image || m.avatar ? (
                                                            <img src={m.image || m.avatar} alt={m.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <User size={18} className={textSub} />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold text-sm ${textMain}`}>{m.name}</p>
                                                        <p className={`text-xs ${textSub}`}>{m.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`p-4 text-sm ${textMain}`}>{formatCurrency(data.baseSalary)}</td>
                                            <td className={`p-4 text-sm ${data.commissions > 0 ? 'text-emerald-500' : textSub}`}>
                                                {data.commissions > 0 ? `+${formatCurrency(data.commissions)}` : '-'}
                                            </td>
                                            <td className={`p-4 text-sm ${data.otherDeductions + data.inss + data.irrf > 0 ? 'text-red-500' : textSub}`}>
                                                {(data.otherDeductions + data.inss + data.irrf) > 0 ? `-${formatCurrency(data.inss + data.irrf + data.otherDeductions)}` : '-'}
                                            </td>
                                            <td className="p-4 text-sm font-bold text-emerald-500">{formatCurrency(data.netSalary)}</td>
                                            <td className="p-4">
                                                {isPaid ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                                                        <CheckCircle size={14} /> Pago
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-semibold">
                                                        <Clock size={14} /> Pendente
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    {m.paymentPreference === 'Quinzenal' && !isPaid && data.netSalary > 0 && canManagePayroll && !withdrawals.some(w => w.employeeId === m.id && w.reason === 'advance' && w.date.startsWith(selectedPeriod)) && (
                                                        <button
                                                            onClick={() => openAdvanceModal(m.id)}
                                                            className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
                                                            title="Adiantamento (50%)"
                                                        >
                                                            <Banknote size={16} />
                                                        </button>
                                                    )}

                                                    {isPaid ? (
                                                        <button onClick={() => openPayslip(m.id)} className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-slate-100'} ${textSub} hover:text-primary transition-colors`} title="Ver Holerite">
                                                            <FileText size={18} />
                                                        </button>
                                                    ) : (
                                                        canManagePayroll && (
                                                            <button
                                                                onClick={() => openPaymentModal(m.id)}
                                                                className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                                            >
                                                                <CreditCard size={14} /> Pagar
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {members.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className={`p-8 text-center ${textSub}`}>
                                            Nenhum funcionário encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {paymentRecords.length === 0 ? (
                        <div className={`${bgCard} border ${borderCol} rounded-2xl p-16 text-center`}>
                            <div className={`w-16 h-16 rounded-2xl ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} flex items-center justify-center mx-auto mb-4`}>
                                <History size={28} className={`${textSub} opacity-50`} />
                            </div>
                            <p className={`font-semibold ${textMain} mb-1`}>Nenhum pagamento registrado</p>
                            <p className={`text-sm ${textSub}`}>Os pagamentos realizados aparecerão aqui.</p>
                        </div>
                    ) : (
                        paymentRecords
                            .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
                            .map(pr => {
                                const member = members.find(m => m.id === pr.employeeId);
                                const prPeriodLabel = new Date(pr.period + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                                const methodLabels: Record<string, string> = { pix: 'PIX', transfer: 'TED/DOC', cash: 'Dinheiro' };

                                return (
                                    <div key={pr.id} className={`${bgCard} border ${borderCol} rounded-2xl p-5 hover:shadow-lg transition-all`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className={`w-10 h-10 rounded-xl ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} flex items-center justify-center overflow-hidden flex-shrink-0`}>
                                                    {member?.image || member?.avatar ? (
                                                        <img src={member.image || member.avatar} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User size={18} className={textSub} />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`font-semibold text-sm ${textMain} truncate`}>{member?.name || 'Desconhecido'}</p>
                                                    <p className={`text-xs ${textSub}`}>{prPeriodLabel}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 flex-shrink-0">
                                                <div className="text-right">
                                                    <p className={`text-xs ${textSub}`}>Líquido</p>
                                                    <p className="text-sm font-bold text-emerald-500">{formatCurrency(pr.netSalary)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-xs ${textSub}`}>Método</p>
                                                    <p className={`text-sm font-medium ${textMain}`}>{pr.paymentMethod ? methodLabels[pr.paymentMethod] || pr.paymentMethod : '-'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-xs ${textSub}`}>Data</p>
                                                    <p className={`text-sm ${textMain}`}>{pr.paidAt ? new Date(pr.paidAt).toLocaleDateString('pt-BR') : '-'}</p>
                                                </div>
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                                                    <CheckCircle size={12} /> Pago
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                    )}
                </div>
            )}

            {/* Comm Modal */}
            {isCommModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-2xl shadow-2xl w-full max-w-md`}>
                        <div className={`p-5 border-b ${borderCol} flex justify-between items-center`}>
                            <h3 className={`font-bold text-lg ${textMain}`}>Adicionar Comissão</h3>
                            <button onClick={() => setIsCommModalOpen(false)} className={`p-2 rounded-xl hover:bg-slate-500/10 ${textSub}`}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddCommission} className="p-6 space-y-4">
                            <div><label className={`block text-sm font-medium ${textMain} mb-2`}>Funcionário</label>
                                <CustomDropdown value={formEmployeeId} onChange={v => setFormEmployeeId(v)} options={[{ value: '', label: 'Selecione...' }, ...members.map(m => ({ value: m.id, label: m.name }))]} isDarkMode={isDarkMode} />
                            </div>
                            <div><label className={`block text-sm font-medium ${textMain} mb-2`}>Valor</label>
                                <input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(+e.target.value)} className={`w-full ${bgInput} border ${borderCol} rounded-xl p-3 text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} required />
                            </div>
                            <div><label className={`block text-sm font-medium ${textMain} mb-2`}>Origem</label>
                                <input type="text" value={formSource} onChange={e => setFormSource(e.target.value)} className={`w-full ${bgInput} border ${borderCol} rounded-xl p-3 text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} placeholder="Ex: Venda X" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsCommModalOpen(false)} className={`flex-1 py-3 font-semibold rounded-xl border ${borderCol} ${textMain}`}>Cancelar</button>
                                <button type="submit" className="flex-1 py-3 font-semibold rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">Adicionar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Withdrawal Modal */}
            {isWithModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-2xl shadow-2xl w-full max-w-md`}>
                        <div className={`p-5 border-b ${borderCol} flex justify-between items-center`}>
                            <h3 className={`font-bold text-lg ${textMain}`}>Adicionar Desconto</h3>
                            <button onClick={() => setIsWithModalOpen(false)} className={`p-2 rounded-xl hover:bg-slate-500/10 ${textSub}`}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddWithdrawal} className="p-6 space-y-4">
                            <div><label className={`block text-sm font-medium ${textMain} mb-2`}>Funcionário</label>
                                <CustomDropdown value={formEmployeeId} onChange={v => setFormEmployeeId(v)} options={[{ value: '', label: 'Selecione...' }, ...members.map(m => ({ value: m.id, label: m.name }))]} isDarkMode={isDarkMode} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={`block text-sm font-medium ${textMain} mb-2`}>Valor</label>
                                    <input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(+e.target.value)} className={`w-full ${bgInput} border ${borderCol} rounded-xl p-3 text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} required />
                                </div>
                                <div><label className={`block text-sm font-medium ${textMain} mb-2`}>Tipo</label>
                                    <CustomDropdown value={formReason} onChange={v => setFormReason(v as any)} options={[{ value: 'advance', label: 'Adiantamento' }, { value: 'loan', label: 'Empréstimo' }, { value: 'deduction', label: 'Desconto' }, { value: 'other', label: 'Outro' }]} isDarkMode={isDarkMode} />
                                </div>
                            </div>
                            <div><label className={`block text-sm font-medium ${textMain} mb-2`}>Descrição</label>
                                <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} className={`w-full ${bgInput} border ${borderCol} rounded-xl p-3 text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsWithModalOpen(false)} className={`flex-1 py-3 font-semibold rounded-xl border ${borderCol} ${textMain}`}>Cancelar</button>
                                <button type="submit" className="flex-1 py-3 font-semibold rounded-xl bg-red-500 text-white hover:bg-red-600">Adicionar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payslip & Payment Modals */}
            {isPayslipModalOpen && selectedEmployee && (() => {
                const member = members.find(m => m.id === selectedEmployee);
                const data = calculatePayroll(selectedEmployee);

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                        <div className={`${bgCard} border ${borderCol} rounded-2xl shadow-2xl w-full max-w-lg my-8`}>
                            <div className={`p-5 border-b ${borderCol} flex justify-between items-center`}>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-primary/10">
                                        <FileText size={18} className="text-primary" />
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-lg ${textMain}`}>Holerite</h3>
                                        <p className={`text-xs ${textSub}`}>{periodLabel}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsPayslipModalOpen(false)} className={`p-2 rounded-xl hover:bg-slate-500/10 ${textSub}`}><X size={20} /></button>
                            </div>
                            <div className="p-6 space-y-5">
                                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-dark/30' : 'bg-slate-50'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl ${isDarkMode ? 'bg-dark-surface' : 'bg-white'} flex items-center justify-center shadow-sm`}>
                                            <User size={22} className={textSub} />
                                        </div>
                                        <div>
                                            <p className={`font-bold text-lg ${textMain}`}>{member?.name}</p>
                                            <p className={`text-sm ${textSub}`}>{member?.role} • {member?.contractType || 'CLT'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className={`space-y-2 p-4 rounded-xl border ${borderCol}`}>
                                    <div className="flex justify-between text-sm"><span className={textSub}>Salário Base</span><span className={`font-medium ${textMain}`}>{formatCurrency(data.baseSalary)}</span></div>
                                    {data.commissions > 0 && <div className="flex justify-between text-sm"><span className={textSub}>Comissões</span><span className="text-emerald-500 font-medium">+{formatCurrency(data.commissions)}</span></div>}
                                    <div className={`flex justify-between text-sm pt-2 border-t ${borderCol} font-bold`}><span className={textMain}>Total Bruto</span><span className={textMain}>{formatCurrency(data.grossSalary)}</span></div>
                                </div>
                                <div className={`space-y-2 p-4 rounded-xl border ${borderCol}`}>
                                    <div className="flex justify-between text-sm"><span className={textSub}>INSS</span><span className="text-red-400 font-medium">-{formatCurrency(data.inss)}</span></div>
                                    <div className="flex justify-between text-sm"><span className={textSub}>IRRF</span><span className="text-red-400 font-medium">-{formatCurrency(data.irrf)}</span></div>
                                    {data.otherDeductions > 0 && <div className="flex justify-between text-sm"><span className={textSub}>Outros Descontos</span><span className="text-red-400 font-medium">-{formatCurrency(data.otherDeductions)}</span></div>}
                                    <div className={`flex justify-between text-sm pt-2 border-t ${borderCol} font-bold`}><span className={textMain}>Total Descontos</span><span className="text-red-400">-{formatCurrency(data.inss + data.irrf + data.otherDeductions)}</span></div>
                                </div>
                                <div className="p-5 rounded-xl bg-gradient-to-r from-primary/10 to-emerald-500/10 border border-primary/20">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-primary text-lg">Salário Líquido</span>
                                        <span className="text-3xl font-black text-primary">{formatCurrency(data.netSalary)}</span>
                                    </div>
                                </div>
                                <button onClick={() => setIsPayslipModalOpen(false)} className={`w-full py-3 font-semibold rounded-xl border ${borderCol} ${textMain} hover:bg-slate-500/5 transition-colors`}>Fechar</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {isPaymentModalOpen && selectedMember && paymentModalData && (
                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => { setIsPaymentModalOpen(false); setSelectedEmployee(null); }}
                    member={selectedMember}
                    paymentData={paymentModalData}
                    isDarkMode={isDarkMode}
                    onConfirmPayment={handleConfirmPayment}
                    companyName={settings?.company?.name || 'VINNX'}
                    companyLogo={settings?.company?.logo}
                    title={paymentType === 'advance' ? 'Pagamento de Adiantamento' : 'Realizar Pagamento'}
                    qrDescription={paymentType === 'advance' ? `Adiantamento ${periodLabel}` : undefined}
                />
            )}
        </div>
    );
};
