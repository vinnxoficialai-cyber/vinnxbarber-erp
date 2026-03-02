import { Invoice, InvoiceItem, InvoiceEmitter, InvoiceDocType } from '../../types';

// ============ FORMAT HELPERS ============
export const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatCpfCnpj = (doc: string) => doc; // passthrough — already formatted

export const formatDate = (iso: string) => {
    if (!iso) return '---';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
};

export const formatDateTime = (iso: string) => {
    if (!iso) return '---';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// ============ TYPES ============
export interface TaxSummary {
    issRate: number; issTotal: number;
    icmsRate?: number; icmsTotal?: number;
    pisRate?: number; pisTotal?: number;
    cofinsRate?: number; cofinsTotal?: number;
    totalTax: number;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// ============ STUB FUNCTIONS ============
// These will be connected to Supabase API in the future

export function createDraftFromComanda(comanda: any, emitter: InvoiceEmitter): Invoice {
    const items: InvoiceItem[] = (comanda.items || []).map((item: any, i: number) => ({
        id: `item-${Date.now()}-${i}`,
        type: item.type === 'product' ? 'product' as const : 'service' as const,
        sourceId: item.serviceId || item.productId || `src-${i}`,
        description: item.name || item.description || 'Item',
        quantity: item.quantity || 1,
        unitPrice: item.price || item.unitPrice || 0,
        totalPrice: (item.quantity || 1) * (item.price || item.unitPrice || 0),
    }));

    const totalServices = items.filter(i => i.type === 'service').reduce((s, i) => s + i.totalPrice, 0);
    const totalProducts = items.filter(i => i.type === 'product').reduce((s, i) => s + i.totalPrice, 0);

    return {
        id: crypto.randomUUID(),
        docType: totalProducts > 0 && totalServices === 0 ? 'nfce' : 'nfse',
        status: 'draft',
        emitterId: emitter.id,
        emitterName: emitter.tradeName || emitter.name,
        clientName: comanda.clientName || 'Consumidor Final',
        clientCpfCnpj: comanda.clientCpfCnpj,
        professionalId: comanda.barberId,
        professionalName: comanda.barberName,
        items,
        totalServices,
        totalProducts,
        totalAmount: totalServices + totalProducts,
        discountAmount: comanda.discountAmount || 0,
        events: [{
            id: `ev-${Date.now()}`,
            type: 'created',
            description: `Nota criada a partir da comanda`,
            timestamp: new Date().toISOString(),
        }],
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export function createManualDraft(data: {
    emitterId: string; emitterName: string; docType: InvoiceDocType;
    clientName: string; clientCpfCnpj?: string; clientEmail?: string;
    items: InvoiceItem[]; totalServices: number; totalProducts: number;
    totalAmount: number; notes?: string;
}): Invoice {
    return {
        id: crypto.randomUUID(),
        docType: data.docType,
        status: 'draft',
        emitterId: data.emitterId,
        emitterName: data.emitterName,
        clientName: data.clientName,
        clientCpfCnpj: data.clientCpfCnpj,
        clientEmail: data.clientEmail,
        items: data.items,
        totalServices: data.totalServices,
        totalProducts: data.totalProducts,
        totalAmount: data.totalAmount,
        discountAmount: 0,
        notes: data.notes,
        events: [{
            id: `ev-${Date.now()}`,
            type: 'created',
            description: 'Nota criada manualmente',
            timestamp: new Date().toISOString(),
        }],
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export function validateInvoice(invoice: Invoice): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!invoice.clientName) errors.push('Nome do cliente é obrigatório');
    if (invoice.items.length === 0) errors.push('A nota precisa de ao menos um item');
    if (invoice.totalAmount <= 0) errors.push('Valor total deve ser maior que zero');
    if (!invoice.clientCpfCnpj && invoice.docType === 'nfse') warnings.push('CPF/CNPJ do tomador não informado');
    if (!invoice.clientEmail) warnings.push('E-mail do cliente não informado');
    return { valid: errors.length === 0, errors, warnings };
}

export function calculateTaxes(items: InvoiceItem[], docType: InvoiceDocType): TaxSummary {
    const totalServices = items.filter(i => i.type === 'service').reduce((s, i) => s + i.totalPrice, 0);
    const totalProducts = items.filter(i => i.type === 'product').reduce((s, i) => s + i.totalPrice, 0);
    const issRate = docType === 'nfse' ? 0.05 : 0;
    const icmsRate = docType === 'nfce' ? 0.18 : 0;
    return {
        issRate, issTotal: totalServices * issRate,
        icmsRate, icmsTotal: totalProducts * icmsRate,
        pisRate: 0.0065, pisTotal: (totalServices + totalProducts) * 0.0065,
        cofinsRate: 0.03, cofinsTotal: (totalServices + totalProducts) * 0.03,
        totalTax: totalServices * issRate + totalProducts * icmsRate + (totalServices + totalProducts) * 0.0365,
    };
}

export function suggestDocType(items: InvoiceItem[]): InvoiceDocType {
    const hasServices = items.some(i => i.type === 'service');
    const hasProducts = items.some(i => i.type === 'product');
    if (hasServices && !hasProducts) return 'nfse';
    if (hasProducts && !hasServices) return 'nfce';
    return 'nfse'; // mixed → NFS-e by default
}

// Stubs for future Supabase integration
export async function queueInvoiceEmission(_invoice: Invoice): Promise<{ success: boolean; error?: string }> {
    return { success: true };
}

export async function cancelInvoice(_invoiceId: string, _reason: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
}

export async function downloadPdfXml(_invoice: Invoice, _type: 'pdf' | 'xml'): Promise<void> {
    console.log(`[Stub] Download ${_type} for invoice ${_invoice.id}`);
}

export async function resendEmail(_invoice: Invoice): Promise<{ success: boolean }> {
    return { success: true };
}

export async function exportInvoices(_invoices: Invoice[], _format: 'csv' | 'xlsx'): Promise<void> {
    console.log(`[Stub] Export ${_invoices.length} invoices as ${_format}`);
}
