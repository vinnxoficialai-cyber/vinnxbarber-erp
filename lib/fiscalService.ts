/**
 * fiscalService.ts — Serviço de emissão de Nota Fiscal
 *
 * ARQUITETURA CORRIGIDA:
 * Este arquivo roda NO BROWSER e NÃO chama APIs externas diretamente.
 * Toda comunicação com a Focus NFe é feita via /api/fiscal-emit (server-side).
 * Isso resolve o Bug #1 (API key exposta) e Bug #2 (RLS).
 */

import { supabase } from './supabase';
import { Invoice, InvoiceEmitter, FiscalSettings, Subscription, SubscriptionPlan } from '../types';
import { getFiscalSettings, getEmitters, saveInvoice } from './dataService';

// ============================================
// Types
// ============================================

export type FiscalProvider = 'focus_nfe' | 'nfe_io' | 'plugnotas' | 'none';

export interface EmissionResponse {
    success: boolean;
    status?: string;
    protocolNumber?: string;
    authorizationDate?: string;
    pdfUrl?: string;
    xmlUrl?: string;
    focusNfeRef?: string;
    error?: string;
    message?: string;
}

export interface CancellationRequest {
    invoiceId: string;
    protocolNumber: string;
    reason: string;
}

// ============================================
// Main Service Functions
// ============================================

/**
 * Emite uma NF via endpoint server-side /api/fiscal-emit
 * CORRIGIDO: não expõe mais a API key no browser (Bug #1)
 */
export async function emitInvoice(invoice: Invoice): Promise<EmissionResponse> {
    try {
        // Validações básicas client-side antes de chamar o servidor
        const settings = await getFiscalSettings(invoice.unitId);
        if (!settings || settings.apiProvider === 'none') {
            return {
                success: false,
                error: 'Nenhum provedor de NF configurado. Vá em Configurações → Integração API.',
            };
        }

        // Garantir que o invoice existe no banco antes de emitir
        await saveInvoice({ ...invoice, status: 'queued' });

        // Chamar endpoint server-side — apiKey nunca trafega no browser
        const res = await fetch('/api/fiscal-emit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: invoice.id }),
        });

        const data = await res.json();

        if (res.status === 200 && data.success) {
            return {
                success: true,
                status: data.status,
                focusNfeRef: data.focusNfeRef,
                protocolNumber: data.chave,
                message: data.message,
            };
        }

        if (res.status === 202) {
            // NFS-e assíncrona: processando, autorização vem via webhook
            return {
                success: true,
                status: 'processing',
                focusNfeRef: data.focusNfeRef,
                message: data.message || 'NFS-e enviada. Aguardando autorização da SEFAZ.',
            };
        }

        return {
            success: false,
            error: data.error || 'Erro ao emitir nota fiscal.',
        };

    } catch (err: any) {
        console.error('[fiscalService] emitInvoice error:', err);
        return { success: false, error: err.message || 'Erro de comunicação com o servidor.' };
    }
}

/**
 * Cancela uma NF emitida
 */
export async function cancelInvoice(
    invoice: Invoice,
    reason: string
): Promise<EmissionResponse> {
    try {
        const settings = await getFiscalSettings(invoice.unitId);
        if (!settings || settings.apiProvider === 'none') {
            return { success: false, error: 'Provedor de NF não configurado.' };
        }

        if (!invoice.protocolNumber && !invoice.focusNfeRef) {
            return { success: false, error: 'Nota não possui referência para cancelamento.' };
        }

        // Verificar janela de cancelamento
        if (settings.cancellationWindowHours && invoice.authorizationDate) {
            const authDate = new Date(invoice.authorizationDate);
            const hoursElapsed = (Date.now() - authDate.getTime()) / (1000 * 60 * 60);
            if (hoursElapsed > settings.cancellationWindowHours) {
                return {
                    success: false,
                    error: `Prazo de cancelamento expirado (${settings.cancellationWindowHours}h). Use carta de correção.`,
                };
            }
        }

        const res = await fetch('/api/fiscal-emit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invoiceId: invoice.id,
                action: 'cancel',
                reason,
            }),
        });

        const data = await res.json();

        if (data.success) {
            // Atualizar status local
            await saveInvoice({
                ...invoice,
                status: 'cancelled',
                cancellationReason: reason,
                events: [
                    ...(invoice.events || []),
                    {
                        id: crypto.randomUUID(),
                        type: 'cancelled',
                        description: `Cancelada: ${reason}`,
                        timestamp: new Date().toISOString(),
                    },
                ],
            });
            return { success: true };
        }

        return { success: false, error: data.error || 'Erro ao cancelar.' };

    } catch (err: any) {
        console.error('[fiscalService] cancelInvoice error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Upload de certificado digital A1 para Supabase Storage
 * Bucket: 'fiscal' (privado — certificados são documentos sensíveis)
 */
export async function uploadCertificate(
    file: File,
    emitterId: string
): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
        const safeEmitterId = emitterId.replace(/[^a-zA-Z0-9\-_]/g, '_');
        const fileName = `certificates/${safeEmitterId}/${Date.now()}_${file.name}`;

        const { data, error } = await supabase.storage
            .from('fiscal')
            .upload(fileName, file, { upsert: true });

        if (error) throw error;

        return { success: true, path: data.path };
    } catch (err: any) {
        console.error('[fiscalService] uploadCertificate error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Cria uma ou duas invoices a partir de uma comanda fechada
 * CORRIGIDO: detecta comanda mista e respeita splitMixedComanda (Bug #4 fix)
 */
export async function createInvoiceFromComanda(
    comanda: any,
    emitter: InvoiceEmitter,
    settings?: FiscalSettings | null
): Promise<Invoice[]> {
    const items = (comanda.items || []).map((item: any) => ({
        id: crypto.randomUUID(),
        type: item.type === 'product' ? 'product' : 'service',
        sourceId: item.serviceId || item.productId || item.id || '',
        description: item.name || item.description || 'Item',
        quantity: item.quantity || 1,
        unitPrice: item.price || item.unitPrice || 0,
        totalPrice: (item.quantity || 1) * (item.price || item.unitPrice || 0),
    }));

    const serviceItems = items.filter((i: any) => i.type === 'service');
    const productItems = items.filter((i: any) => i.type === 'product');
    const totalServices = serviceItems.reduce((s: number, i: any) => s + i.totalPrice, 0);
    const totalProducts = productItems.reduce((s: number, i: any) => s + i.totalPrice, 0);
    const totalAmount = comanda.finalAmount || comanda.totalAmount || (totalServices + totalProducts);

    const baseInvoice = {
        emitterId: emitter.id,
        emitterName: emitter.name,
        clientId: comanda.clientId || undefined,
        clientName: comanda.clientName || 'Consumidor Final',
        clientCpfCnpj: comanda.clientCpfCnpj || '',
        clientEmail: comanda.clientEmail || '',
        comandaId: comanda.id,
        professionalId: comanda.barberId,
        professionalName: comanda.barberName || '',
        discountAmount: comanda.discountAmount || 0,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unitId: comanda.unitId || undefined,
    };

    const hasBoth = serviceItems.length > 0 && productItems.length > 0;
    const shouldSplit = hasBoth && (settings?.splitMixedComanda ?? true);

    if (shouldSplit) {
        // Comanda mista: 2 notas separadas
        const nfseInvoice: Invoice = {
            id: crypto.randomUUID(),
            ...baseInvoice,
            docType: 'nfse',
            status: 'draft',
            items: serviceItems,
            totalServices,
            totalProducts: 0,
            totalAmount: totalServices,
            issTotal: Number((totalServices * (emitter.nfseIssRate || 5) / 100).toFixed(2)),
            events: [{
                id: crypto.randomUUID(),
                type: 'created',
                description: `NFS-e criada da comanda #${comanda.id?.slice(0, 8)} (serviços)`,
                timestamp: new Date().toISOString(),
            }],
        };

        const nfceInvoice: Invoice = {
            id: crypto.randomUUID(),
            ...baseInvoice,
            docType: 'nfce',
            status: 'draft',
            items: productItems,
            totalServices: 0,
            totalProducts,
            totalAmount: totalProducts,
            events: [{
                id: crypto.randomUUID(),
                type: 'created',
                description: `NFC-e criada da comanda #${comanda.id?.slice(0, 8)} (produtos)`,
                timestamp: new Date().toISOString(),
            }],
        };

        return [nfseInvoice, nfceInvoice];
    }

    // Comanda simples: 1 nota
    const docType = productItems.length > 0 && serviceItems.length === 0 ? 'nfce' : 'nfse';
    const invoice: Invoice = {
        id: crypto.randomUUID(),
        ...baseInvoice,
        docType,
        status: 'draft',
        items,
        totalServices,
        totalProducts,
        totalAmount,
        issTotal: docType === 'nfse'
            ? Number((totalServices * (emitter.nfseIssRate || 5) / 100).toFixed(2))
            : undefined,
        events: [{
            id: crypto.randomUUID(),
            type: 'created',
            description: `NF criada da comanda #${comanda.id?.slice(0, 8)}`,
            timestamp: new Date().toISOString(),
        }],
    };

    return [invoice];
}

/**
 * Cria uma invoice a partir de uma assinatura paga
 * CORRIGIDO: usa ref determinística (período YYYYMM) para idempotência
 */
export async function createInvoiceFromSubscription(
    subscription: Subscription,
    plan: SubscriptionPlan,
    emitter: InvoiceEmitter,
    settings?: FiscalSettings | null,
): Promise<Invoice> {
    const issRate = emitter.nfseIssRate || 5;
    const amount = plan.price;
    const issTotal = Number((amount * issRate / 100).toFixed(2));
    const period = new Date().toISOString().slice(0, 7); // "2026-05"

    const recurrenceLabel: Record<string, string> = {
        monthly: 'Mensal', quarterly: 'Trimestral',
        semiannual: 'Semestral', annual: 'Anual',
    };

    const description = settings?.includePlanDetails !== false
        ? `Assinatura ${plan.name} — ${recurrenceLabel[plan.recurrence] || plan.recurrence} — ${period}`
        : `Assinatura de plano — ${period}`;

    return {
        id: crypto.randomUUID(),
        docType: 'nfse',
        status: 'draft',
        emitterId: emitter.id,
        emitterName: emitter.name,
        clientName: subscription.clientName || 'Assinante',
        clientCpfCnpj: '',
        clientEmail: subscription.billingEmail || '',
        appointmentId: subscription.id,
        // Ref determinística: o focusNfeRef será gerado pelo api/fiscal-emit
        items: [{
            id: crypto.randomUUID(),
            type: 'service' as const,
            sourceId: plan.id,
            description,
            quantity: 1,
            unitPrice: amount,
            totalPrice: amount,
            issRate,
        }],
        totalServices: amount,
        totalProducts: 0,
        totalAmount: amount,
        discountAmount: 0,
        issTotal,
        events: [{
            id: crypto.randomUUID(),
            type: 'created',
            description: `NFS-e criada da assinatura ${plan.name} — ${subscription.clientName} — ${period}`,
            timestamp: new Date().toISOString(),
        }],
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unitId: subscription.unitId || undefined,
    };
}

/**
 * Consulta o status atual de uma NF na Focus NFe via server-side
 */
export async function checkInvoiceStatus(invoice: Invoice): Promise<EmissionResponse> {
    try {
        if (!invoice.focusNfeRef) {
            return { success: false, error: 'Nota sem referência Focus NFe para consulta.' };
        }

        const res = await fetch('/api/fiscal-emit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invoiceId: invoice.id,
                action: 'check_status',
                focusNfeRef: invoice.focusNfeRef,
            }),
        });

        return await res.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
