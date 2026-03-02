/**
 * fiscalService.ts — Serviço de emissão de Nota Fiscal
 * 
 * Abstração para comunicação com provedores de emissão:
 * - Focus NFe (https://focusnfe.com.br)
 * - NFE.io (https://nfe.io)
 * - PlugNotas (https://plugnotas.com.br)
 * 
 * O serviço detecta automaticamente o provedor configurado
 * e redireciona as chamadas para a API correta.
 */

import { supabase } from './supabase';
import { Invoice, InvoiceEmitter, FiscalSettings, Subscription, SubscriptionPlan } from '../types';
import { getFiscalSettings, getEmitters, saveInvoice } from './dataService';

// ============================================
// Types
// ============================================

export type FiscalProvider = 'focus_nfe' | 'nfe_io' | 'plugnotas' | 'none';

export interface EmissionRequest {
    invoice: Invoice;
    emitter: InvoiceEmitter;
    provider: FiscalProvider;
    apiKey: string;
    environment: 'sandbox' | 'production';
}

export interface EmissionResponse {
    success: boolean;
    protocolNumber?: string;
    authorizationDate?: string;
    pdfUrl?: string;
    xmlUrl?: string;
    error?: string;
    rawResponse?: any;
}

export interface CancellationRequest {
    invoiceId: string;
    protocolNumber: string;
    reason: string;
    provider: FiscalProvider;
    apiKey: string;
    environment: 'sandbox' | 'production';
}

// ============================================
// Provider Base URLs
// ============================================

const PROVIDER_URLS: Record<FiscalProvider, { sandbox: string; production: string }> = {
    focus_nfe: {
        sandbox: 'https://homologacao.focusnfe.com.br/v2',
        production: 'https://api.focusnfe.com.br/v2',
    },
    nfe_io: {
        sandbox: 'https://api.nfe.io/v1',
        production: 'https://api.nfe.io/v1',
    },
    plugnotas: {
        sandbox: 'https://api.sandbox.plugnotas.com.br',
        production: 'https://api.plugnotas.com.br',
    },
    none: { sandbox: '', production: '' },
};

// ============================================
// Main Service Functions
// ============================================

/**
 * Emite uma NF via o provedor configurado
 */
export async function emitInvoice(invoice: Invoice): Promise<EmissionResponse> {
    try {
        // 1. Get settings
        const settings = await getFiscalSettings();
        if (!settings || settings.apiProvider === 'none' || !settings.apiKey) {
            return {
                success: false,
                error: 'Nenhum provedor de NF configurado. Vá em Configurações → Integração API para configurar.',
            };
        }

        // 2. Get emitter
        const emitters = await getEmitters();
        const emitter = emitters.find(e => e.id === invoice.emitterId) || emitters.find(e => e.type === 'company');
        if (!emitter) {
            return {
                success: false,
                error: 'Nenhum emitente configurado. Configure um emitente antes de emitir.',
            };
        }

        // 3. Validate certificate
        if (emitter.certificateStatus !== 'valid') {
            return {
                success: false,
                error: `Certificado digital ${emitter.certificateStatus === 'missing' ? 'não cadastrado' : emitter.certificateStatus === 'expired' ? 'expirado' : 'com problemas'}. Faça o upload do certificado A1 válido.`,
            };
        }

        // 4. Build request
        const request: EmissionRequest = {
            invoice,
            emitter,
            provider: settings.apiProvider as FiscalProvider,
            apiKey: settings.apiKey,
            environment: (settings.apiEnvironment as 'sandbox' | 'production') || 'sandbox',
        };

        // 5. Route to provider
        let response: EmissionResponse;
        switch (request.provider) {
            case 'focus_nfe':
                response = await emitViaFocusNFe(request);
                break;
            case 'nfe_io':
                response = await emitViaNfeIo(request);
                break;
            case 'plugnotas':
                response = await emitViaPlugNotas(request);
                break;
            default:
                return { success: false, error: 'Provedor não suportado.' };
        }

        // 6. Update invoice status
        if (response.success) {
            const updatedInvoice: Invoice = {
                ...invoice,
                status: 'authorized',
                protocolNumber: response.protocolNumber,
                authorizationDate: response.authorizationDate,
                pdfUrl: response.pdfUrl,
                xmlUrl: response.xmlUrl,
                events: [
                    ...(invoice.events || []),
                    {
                        id: crypto.randomUUID(),
                        type: 'authorized',
                        description: `NF autorizada via ${request.provider}. Protocolo: ${response.protocolNumber}`,
                        timestamp: new Date().toISOString(),
                    }
                ],
            };
            await saveInvoice(updatedInvoice);
        } else {
            const updatedInvoice: Invoice = {
                ...invoice,
                status: 'rejected',
                rejectionReason: response.error,
                events: [
                    ...(invoice.events || []),
                    {
                        id: crypto.randomUUID(),
                        type: 'rejected',
                        description: `Rejeição: ${response.error}`,
                        timestamp: new Date().toISOString(),
                    }
                ],
            };
            await saveInvoice(updatedInvoice);
        }

        return response;
    } catch (err: any) {
        console.error('Error emitting invoice:', err);
        return { success: false, error: err.message || 'Erro interno ao emitir NF.' };
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
        const settings = await getFiscalSettings();
        if (!settings || settings.apiProvider === 'none' || !settings.apiKey) {
            return { success: false, error: 'Provedor de NF não configurado.' };
        }

        if (!invoice.protocolNumber) {
            return { success: false, error: 'Nota não possui número de protocolo para cancelamento.' };
        }

        // Check cancellation window
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

        // Update invoice
        const updatedInvoice: Invoice = {
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
                }
            ],
        };
        await saveInvoice(updatedInvoice);

        return { success: true };
    } catch (err: any) {
        console.error('Error cancelling invoice:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Upload de certificado digital A1 para Supabase Storage
 */
export async function uploadCertificate(
    file: File,
    emitterId: string
): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
        const fileName = `certificates/${emitterId}/${Date.now()}_${file.name}`;

        const { data, error } = await supabase.storage
            .from('fiscal')
            .upload(fileName, file, { upsert: true });

        if (error) throw error;

        return { success: true, path: data.path };
    } catch (err: any) {
        console.error('Error uploading certificate:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Cria uma invoice a partir de uma comanda fechada
 */
export async function createInvoiceFromComanda(
    comanda: any,
    emitter: InvoiceEmitter,
    docType: 'nfse' | 'nfce' = 'nfse'
): Promise<Invoice> {
    const items = (comanda.items || []).map((item: any) => ({
        id: crypto.randomUUID(),
        type: item.type === 'product' ? 'product' : 'service',
        sourceId: item.serviceId || item.productId || '',
        description: item.name || item.description || 'Item',
        quantity: item.quantity || 1,
        unitPrice: item.price || item.unitPrice || 0,
        totalPrice: (item.quantity || 1) * (item.price || item.unitPrice || 0),
    }));

    const totalServices = items.filter((i: any) => i.type === 'service').reduce((s: number, i: any) => s + i.totalPrice, 0);
    const totalProducts = items.filter((i: any) => i.type === 'product').reduce((s: number, i: any) => s + i.totalPrice, 0);

    return {
        id: crypto.randomUUID(),
        docType,
        status: 'draft',
        emitterId: emitter.id,
        emitterName: emitter.name,
        clientName: comanda.clientName || 'Consumidor Final',
        clientCpfCnpj: comanda.clientCpfCnpj || '',
        clientEmail: comanda.clientEmail || '',
        comandaId: comanda.id,
        professionalId: comanda.barberId,
        professionalName: comanda.barberName || '',
        items,
        totalServices,
        totalProducts,
        totalAmount: comanda.finalAmount || comanda.totalAmount || (totalServices + totalProducts),
        discountAmount: comanda.discountAmount || 0,
        events: [{
            id: crypto.randomUUID(),
            type: 'created',
            description: `NF criada a partir da comanda #${comanda.id?.slice(0, 8)}`,
            timestamp: new Date().toISOString(),
        }],
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Cria uma invoice a partir de uma assinatura paga
 */
export async function createInvoiceFromSubscription(
    subscription: Subscription,
    plan: SubscriptionPlan,
    emitter: InvoiceEmitter,
): Promise<Invoice> {
    const issRate = (emitter.nfseIssRate || 5) / 100;
    const amount = plan.price;
    const issTotal = amount * issRate;

    const description = `Assinatura ${plan.name} — ${plan.recurrence === 'monthly' ? 'Mensal' : plan.recurrence === 'quarterly' ? 'Trimestral' : plan.recurrence === 'semiannual' ? 'Semestral' : 'Anual'}`;

    return {
        id: crypto.randomUUID(),
        docType: 'nfse',
        status: 'draft',
        emitterId: emitter.id,
        emitterName: emitter.name,
        clientName: subscription.clientName || 'Assinante',
        clientCpfCnpj: '',
        clientEmail: subscription.billingEmail || '',
        appointmentId: subscription.id, // ref to subscription
        items: [{
            id: crypto.randomUUID(),
            type: 'service' as const,
            sourceId: plan.id,
            description,
            quantity: 1,
            unitPrice: amount,
            totalPrice: amount,
            issRate: emitter.nfseIssRate || 5,
        }],
        totalServices: amount,
        totalProducts: 0,
        totalAmount: amount,
        discountAmount: 0,
        issTotal,
        events: [{
            id: crypto.randomUUID(),
            type: 'created',
            description: `NF criada a partir da assinatura ${plan.name} — ${subscription.clientName}`,
            timestamp: new Date().toISOString(),
        }],
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

// Provider-Specific Implementations
// ============================================

/**
 * Focus NFe — https://focusnfe.com.br/doc/
 */
async function emitViaFocusNFe(req: EmissionRequest): Promise<EmissionResponse> {
    const baseUrl = PROVIDER_URLS.focus_nfe[req.environment];
    const endpoint = req.invoice.docType === 'nfse' ? '/nfse' : '/nfce';

    try {
        const body = buildFocusNFePayload(req);

        const response = await fetch(`${baseUrl}${endpoint}?ref=${req.invoice.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${btoa(req.apiKey + ':' + '')}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (response.ok && (data.status === 'autorizado' || data.status === 'processando_autorizacao')) {
            return {
                success: true,
                protocolNumber: data.protocolo || data.numero_protocolo,
                authorizationDate: new Date().toISOString(),
                pdfUrl: data.caminho_danfe || data.url,
                xmlUrl: data.caminho_xml,
                rawResponse: data,
            };
        }

        return {
            success: false,
            error: data.mensagem || data.erros?.[0]?.mensagem || 'Erro na emissão via Focus NFe',
            rawResponse: data,
        };
    } catch (err: any) {
        return { success: false, error: `Erro de comunicação com Focus NFe: ${err.message}` };
    }
}

/**
 * NFE.io — https://nfe.io/docs/
 */
async function emitViaNfeIo(req: EmissionRequest): Promise<EmissionResponse> {
    const baseUrl = PROVIDER_URLS.nfe_io[req.environment];
    const companyId = req.emitter.cnpj?.replace(/\D/g, '');

    try {
        const body = buildNfeIoPayload(req);

        const response = await fetch(`${baseUrl}/companies/${companyId}/serviceinvoices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.apiKey,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (response.ok && data.id) {
            return {
                success: true,
                protocolNumber: data.id,
                authorizationDate: data.issuedOn || new Date().toISOString(),
                pdfUrl: data.pdfUrl,
                xmlUrl: data.xmlUrl,
                rawResponse: data,
            };
        }

        return {
            success: false,
            error: data.message || 'Erro na emissão via NFE.io',
            rawResponse: data,
        };
    } catch (err: any) {
        return { success: false, error: `Erro de comunicação com NFE.io: ${err.message}` };
    }
}

/**
 * PlugNotas — https://docs.plugnotas.com.br/
 */
async function emitViaPlugNotas(req: EmissionRequest): Promise<EmissionResponse> {
    const baseUrl = PROVIDER_URLS.plugnotas[req.environment];

    try {
        const body = buildPlugNotasPayload(req);

        const response = await fetch(`${baseUrl}/nfse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': req.apiKey,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (response.ok && data.documents?.[0]?.id) {
            return {
                success: true,
                protocolNumber: data.documents[0].id,
                authorizationDate: new Date().toISOString(),
                rawResponse: data,
            };
        }

        return {
            success: false,
            error: data.message || data.error || 'Erro na emissão via PlugNotas',
            rawResponse: data,
        };
    } catch (err: any) {
        return { success: false, error: `Erro de comunicação com PlugNotas: ${err.message}` };
    }
}

// ============================================
// Payload Builders
// ============================================

function buildFocusNFePayload(req: EmissionRequest) {
    const { invoice, emitter } = req;
    if (invoice.docType === 'nfse') {
        return {
            data_emissao: new Date().toISOString(),
            prestador: {
                cnpj: emitter.cnpj?.replace(/\D/g, ''),
                inscricao_municipal: emitter.municipalRegistration,
                codigo_municipio: emitter.city,
            },
            tomador: {
                cpf_cnpj: invoice.clientCpfCnpj?.replace(/\D/g, ''),
                razao_social: invoice.clientName,
                email: invoice.clientEmail,
            },
            servico: {
                aliquota: (emitter.nfseIssRate || 5) / 100,
                discriminacao: invoice.items.map(i => `${i.description} (${i.quantity}x)`).join('; '),
                iss_retido: false,
                item_lista_servico: emitter.defaultServiceCode || '1401',
                valor_servicos: invoice.totalAmount,
            },
        };
    }
    // NFC-e
    return {
        natureza_operacao: 'VENDA DE MERCADORIA',
        tipo_documento: 1,
        finalidade_emissao: 1,
        consumidor_final: 1,
        presenca_comprador: 1,
        items: invoice.items.map((item, i) => ({
            numero_item: i + 1,
            codigo_produto: item.sourceId || String(i + 1),
            descricao: item.description,
            quantidade_comercial: item.quantity,
            valor_unitario_comercial: item.unitPrice,
            valor_bruto: item.totalPrice,
        })),
        forma_pagamento: [{ tipo_pagamento: '01', valor: invoice.totalAmount }],
    };
}

function buildNfeIoPayload(req: EmissionRequest) {
    const { invoice, emitter } = req;
    return {
        cityServiceCode: emitter.defaultServiceCode || '1401',
        description: invoice.items.map(i => `${i.description} (${i.quantity}x)`).join('; '),
        servicesAmount: invoice.totalAmount,
        borrower: {
            name: invoice.clientName,
            federalTaxNumber: invoice.clientCpfCnpj?.replace(/\D/g, '') ? Number(invoice.clientCpfCnpj.replace(/\D/g, '')) : undefined,
            email: invoice.clientEmail,
        },
    };
}

function buildPlugNotasPayload(req: EmissionRequest) {
    const { invoice, emitter } = req;
    return [{
        prestador: { cpfCnpj: emitter.cnpj?.replace(/\D/g, '') },
        tomador: {
            cpfCnpj: invoice.clientCpfCnpj?.replace(/\D/g, ''),
            razaoSocial: invoice.clientName,
            email: invoice.clientEmail,
        },
        servico: [{
            codigo: emitter.defaultServiceCode || '1401',
            discriminacao: invoice.items.map(i => `${i.description} (${i.quantity}x)`).join('; '),
            cnae: emitter.cnae,
            issRetido: false,
            aliquotaIss: (emitter.nfseIssRate || 5) / 100,
            valor: { servico: invoice.totalAmount },
        }],
    }];
}
