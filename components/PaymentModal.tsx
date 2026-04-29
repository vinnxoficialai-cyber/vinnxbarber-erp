import React, { useState, useRef } from 'react';
import { X, Check, Download, Printer, Copy, CheckCircle, Clock, AlertCircle, Wallet, FileText, CreditCard, Banknote, Smartphone, ArrowRight, Info } from 'lucide-react';
import { TeamMember } from '../types';
import { PixQRCode } from './PixQRCode';
import { formatCurrency } from '../utils';
import { Separator } from './ui/Separator';
// @ts-ignore - html2canvas is loaded at runtime
import html2canvas from 'html2canvas';

export interface PaymentData {
    employeeId: string;
    period: string;
    grossSalary: number;
    netSalary: number;
    inss: number;
    irrf: number;
    fgts: number;
    commissions: number;
    deductions: number;
    status: 'pending' | 'processing' | 'paid' | 'partial';
}

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: TeamMember;
    paymentData: PaymentData;
    isDarkMode?: boolean; // kept for backward-compat but no longer used for styling
    onConfirmPayment: (data: {
        paymentMethod: 'pix' | 'transfer' | 'cash';
        notes?: string;
        transactionId?: string;
    }) => Promise<void>;
    paymentMethod?: 'pix' | 'transfer' | 'cash';
    notes?: string;
    transactionId?: string;
    companyName?: string;
    companyLogo?: string;
    title?: string;
    qrDescription?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    member,
    paymentData,
    isDarkMode = false,
    onConfirmPayment,
    companyName = 'VINNX',
    companyLogo,
    title = 'Realizar Pagamento',
    qrDescription
}) => {
    const [paymentMethod, setPaymentMethod] = useState<'pix' | 'transfer' | 'cash'>('pix');
    const [notes, setNotes] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const periodLabel = new Date(paymentData.period + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onConfirmPayment({
                paymentMethod,
                notes: notes || undefined,
                transactionId: transactionId || undefined
            });
            setShowReceipt(true);
        } catch (err) {
            console.error('Payment error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadReceipt = async () => {
        if (!receiptRef.current) return;
        try {
            const canvas = await html2canvas(receiptRef.current, {
                backgroundColor: isDarkMode ? '#1a1a2e' : '#ffffff',
                scale: 2
            });
            const link = document.createElement('a');
            link.download = `recibo_${member.name.replace(/\s/g, '_')}_${paymentData.period}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Error generating receipt:', err);
        }
    };

    const handlePrintReceipt = () => {
        window.print();
    };

    const totalDeductions = paymentData.inss + paymentData.irrf + paymentData.deductions;

    const methodOptions = [
        { key: 'pix' as const, label: 'PIX', icon: Smartphone, desc: 'Transferência instantânea' },
        { key: 'transfer' as const, label: 'TED/DOC', icon: CreditCard, desc: 'Transferência bancária' },
        { key: 'cash' as const, label: 'Dinheiro', icon: Banknote, desc: 'Pagamento em espécie' },
    ];

    // Receipt View
    if (showReceipt) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-lg rounded-xl shadow-2xl bg-card overflow-hidden border border-border">
                    {/* Success Header */}
                    <div className="p-6 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-center">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                            <CheckCircle size={32} className="text-white" />
                        </div>
                        <h2 className="text-xl font-bold">Pagamento Confirmado!</h2>
                        <p className="text-emerald-100 text-sm mt-1">Recibo gerado com sucesso</p>
                    </div>

                    {/* Receipt Content */}
                    <div ref={receiptRef} className="p-6 bg-card">
                        {/* Company */}
                        <div className="text-center mb-5 pb-4 border-b border-dashed border-border">
                            {companyLogo ? (
                                <img src={companyLogo} alt={companyName} className="h-10 mx-auto mb-2" />
                            ) : (
                                <h3 className="text-xl font-bold text-foreground">{companyName}</h3>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">Comprovante de Pagamento</p>
                        </div>

                        {/* Employee */}
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center shadow-sm border border-border">
                                <Wallet size={18} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.role} • {member.email}</p>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="rounded-lg p-4 bg-muted/20 mb-4">
                            <p className="text-xs uppercase tracking-wide mb-3 font-semibold text-muted-foreground">Referência: {periodLabel}</p>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Salário Bruto</span>
                                    <span className="font-medium text-foreground">{formatCurrency(paymentData.grossSalary)}</span>
                                </div>
                                {paymentData.commissions > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Comissões</span>
                                        <span className="text-emerald-500 font-medium">+{formatCurrency(paymentData.commissions)}</span>
                                    </div>
                                )}
                                {paymentData.inss > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">INSS</span>
                                        <span className="text-red-400 font-medium">-{formatCurrency(paymentData.inss)}</span>
                                    </div>
                                )}
                                {paymentData.irrf > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">IRRF</span>
                                        <span className="text-red-400 font-medium">-{formatCurrency(paymentData.irrf)}</span>
                                    </div>
                                )}
                                {paymentData.deductions > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Deduções</span>
                                        <span className="text-red-400 font-medium">-{formatCurrency(paymentData.deductions)}</span>
                                    </div>
                                )}
                                <Separator className="my-2" />
                                <div className="flex justify-between">
                                    <span className="font-bold text-foreground">Valor Líquido</span>
                                    <span className="font-bold text-primary text-xl">{formatCurrency(paymentData.netSalary)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Meta */}
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p>Data: {new Date().toLocaleString('pt-BR')}</p>
                            <p>Método: {paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'transfer' ? 'Transferência' : 'Dinheiro'}</p>
                            {transactionId && <p>ID Transação: {transactionId}</p>}
                            {notes && <p>Obs: {notes}</p>}
                        </div>

                        {/* Footer */}
                        <div className="mt-5 pt-4 border-t border-dashed border-border text-center">
                            <p className="text-xs text-muted-foreground">Documento gerado automaticamente</p>
                            <p className="text-xs text-muted-foreground">{companyName} • {new Date().getFullYear()}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-5 border-t border-border flex gap-3">
                        <button
                            onClick={handleDownloadReceipt}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 transition-all"
                        >
                            <Download size={18} /> Baixar Recibo
                        </button>
                        <button
                            onClick={handlePrintReceipt}
                            className="px-4 py-3 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <Printer size={18} />
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-3 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Payment Form View
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl h-[85vh] p-0 flex flex-col overflow-hidden rounded-xl shadow-2xl bg-card border border-border">
                {/* ── Header (fixed) ── */}
                <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                                <Wallet className="text-primary" size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                                <p className="text-sm text-muted-foreground">{member.name} • <span className="capitalize">{periodLabel}</span></p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                            <X size={22} />
                        </button>
                    </div>
                </div>

                {/* ── Body (scrollable) ── */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    {/* Employee Summary Card */}
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/20 border border-border">
                        <div className="w-12 h-12 rounded-lg bg-card flex items-center justify-center shadow-sm flex-shrink-0 border border-border">
                            {member.image || member.avatar ? (
                                <img src={member.image || member.avatar} alt={member.name} className="w-full h-full rounded-lg object-cover" />
                            ) : (
                                <Wallet size={20} className="text-primary" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.role} • {member.contractType || 'CLT'} • {member.pixKey ? 'PIX configurado' : 'Sem PIX'}</p>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid md:grid-cols-2 gap-5">
                        {/* Left: Payment Breakdown */}
                        <div className="space-y-5">
                            {/* Amount Breakdown */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText size={16} className="text-primary" />
                                    <h3 className="text-sm font-semibold text-foreground">Resumo do Pagamento</h3>
                                </div>
                                <div className="rounded-lg border border-border overflow-hidden">
                                    <div className="p-4 space-y-2.5 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Salário Base</span>
                                            <span className="font-medium text-foreground">{formatCurrency(paymentData.grossSalary - paymentData.commissions)}</span>
                                        </div>
                                        {paymentData.commissions > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Comissões</span>
                                                <span className="text-emerald-500 font-medium">+{formatCurrency(paymentData.commissions)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center pt-2.5 border-t border-border">
                                            <span className="font-medium text-foreground">Bruto Total</span>
                                            <span className="font-semibold text-foreground">{formatCurrency(paymentData.grossSalary)}</span>
                                        </div>
                                    </div>

                                    {/* Deductions */}
                                    <div className="p-4 space-y-2.5 text-sm border-t border-border bg-muted/20">
                                        {paymentData.inss > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">INSS</span>
                                                <span className="text-red-400 font-medium">-{formatCurrency(paymentData.inss)}</span>
                                            </div>
                                        )}
                                        {paymentData.irrf > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">IRRF</span>
                                                <span className="text-red-400 font-medium">-{formatCurrency(paymentData.irrf)}</span>
                                            </div>
                                        )}
                                        {paymentData.deductions > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Outras Deduções</span>
                                                <span className="text-red-400 font-medium">-{formatCurrency(paymentData.deductions)}</span>
                                            </div>
                                        )}
                                        {totalDeductions > 0 && (
                                            <div className="flex justify-between items-center pt-2 border-t border-border">
                                                <span className="text-muted-foreground font-medium">Total Descontos</span>
                                                <span className="text-red-400 font-semibold">-{formatCurrency(totalDeductions)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Net Salary highlight */}
                                    <div className="p-5 bg-primary/10">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-primary text-base">Valor Líquido</span>
                                            <span className="text-3xl font-black text-primary">{formatCurrency(paymentData.netSalary)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* FGTS info */}
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground">
                                <Info size={14} className="flex-shrink-0" />
                                <span>Depósito FGTS (8%): <span className="font-medium">{formatCurrency(paymentData.fgts)}</span></span>
                            </div>
                        </div>

                        {/* Right: Method + PIX */}
                        <div className="space-y-5">
                            {/* Payment Method */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <CreditCard size={16} className="text-primary" />
                                    <h3 className="text-sm font-semibold text-foreground">Método de Pagamento</h3>
                                </div>
                                <div className="space-y-2">
                                    {methodOptions.map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setPaymentMethod(opt.key)}
                                            className={`w-full flex items-center gap-3 p-3.5 rounded-lg border transition-all text-left ${paymentMethod === opt.key
                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                : 'border-border bg-card hover:bg-muted/30'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-lg ${paymentMethod === opt.key ? 'bg-primary/15' : 'bg-muted/30'}`}>
                                                <opt.icon size={18} className={paymentMethod === opt.key ? 'text-primary' : 'text-muted-foreground'} />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-sm font-semibold ${paymentMethod === opt.key ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                                                <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                            </div>
                                            {paymentMethod === opt.key && (
                                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                                    <Check size={12} className="text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* PIX QR */}
                            {paymentMethod === 'pix' && (
                                <div className="rounded-lg p-5 bg-muted/20 border border-border">
                                    <h4 className="font-semibold mb-3 text-center text-sm text-foreground">QR Code PIX</h4>
                                    {member.pixKey ? (
                                        <PixQRCode
                                            pixKey={member.pixKey}
                                            amount={paymentData.netSalary}
                                            recipientName={member.name}
                                            description={qrDescription || `Pagamento ${periodLabel}`}
                                            transactionId={`PAY-${paymentData.period}-${member.id.slice(0, 8)}`}
                                            isDarkMode={isDarkMode}
                                            size={160}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-8">
                                            <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mb-3">
                                                <AlertCircle className="text-amber-500" size={28} />
                                            </div>
                                            <p className="text-sm font-semibold text-foreground">Chave PIX não configurada</p>
                                            <p className="text-xs mt-1 text-muted-foreground text-center">
                                                Acesse o perfil do colaborador para<br />adicionar uma chave PIX
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Transaction ID */}
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">ID da Transação <span className="text-muted-foreground">(opcional)</span></label>
                                <input
                                    type="text"
                                    value={transactionId}
                                    onChange={(e) => setTransactionId(e.target.value)}
                                    placeholder="Ex: E123456789..."
                                    className="w-full px-3 py-2 h-9 rounded-md border border-input bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Observações <span className="text-muted-foreground">(opcional)</span></label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Adicione notas sobre o pagamento..."
                                    className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Footer (fixed) ── */}
                <div className="flex-shrink-0 border-t border-border p-4 flex gap-3 bg-card">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-full border border-border text-foreground font-semibold hover:bg-muted transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Clock size={18} className="animate-spin" />
                                Processando...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Confirmar Pagamento
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
