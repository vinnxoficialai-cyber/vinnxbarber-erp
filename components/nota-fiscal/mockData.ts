import { Invoice, InvoiceEmitter, FiscalSettings } from '../../types';

// ============ MOCK EMITTERS ============
export const MOCK_EMITTERS: InvoiceEmitter[] = [
    {
        id: 'emit-1', type: 'company', name: 'VINNX Barbearia LTDA', tradeName: 'VINNX Barbearia',
        cnpj: '12.345.678/0001-90', taxRegime: 'simples', municipalRegistration: '123456',
        stateRegistration: '987654321', address: 'Rua da Barbearia, 100 - Centro',
        city: 'Sao Paulo', state: 'SP', zip: '01000-000', email: 'fiscal@vinnx.com.br',
        phone: '(11) 99999-0000', defaultServiceCode: '6311', series: 'A1',
        nextNumber: 247, certificateExpiry: '2027-06-15', active: true,
    },
    {
        id: 'emit-2', type: 'professional', name: 'Carlos Oliveira MEI',
        cnpj: '98.765.432/0001-10', taxRegime: 'mei',
        address: 'Rua dos Barbeiros, 50', city: 'Sao Paulo', state: 'SP',
        email: 'carlos@email.com', active: true, memberId: 'member-1',
        series: 'B1', nextNumber: 89, certificateExpiry: '2027-03-20',
    },
    {
        id: 'emit-3', type: 'professional', name: 'Rafael Santos PJ',
        cnpj: '11.222.333/0001-44', taxRegime: 'simples',
        address: 'Av. Principal, 200', city: 'Sao Paulo', state: 'SP',
        email: 'rafael@email.com', active: true, memberId: 'member-2',
        series: 'C1', nextNumber: 34,
    },
    {
        id: 'emit-4', type: 'professional', name: 'Lucas Mendes MEI',
        cnpj: '44.555.666/0001-77', taxRegime: 'mei',
        address: 'Rua Lateral, 15', city: 'Sao Paulo', state: 'SP',
        email: 'lucas@email.com', active: false, memberId: 'member-3',
    },
];

// ============ MOCK INVOICES ============
const today = new Date();
const fmt = (d: Date) => d.toISOString().split('T')[0];
const ago = (days: number) => { const d = new Date(today); d.setDate(d.getDate() - days); return fmt(d); };

export const MOCK_INVOICES: Invoice[] = [
    {
        id: 'inv-1', number: '000245', series: 'A1', docType: 'nfse', status: 'authorized',
        emitterId: 'emit-1', emitterName: 'VINNX Barbearia LTDA',
        clientName: 'Joao Silva', clientCpfCnpj: '123.456.789-00', clientEmail: 'joao@email.com',
        professionalId: 'member-1', professionalName: 'Carlos Oliveira',
        items: [
            { id: 'it-1', type: 'service', sourceId: 's1', description: 'Corte Degrade', quantity: 1, unitPrice: 65, totalPrice: 65 },
            { id: 'it-2', type: 'service', sourceId: 's2', description: 'Barba Completa', quantity: 1, unitPrice: 35, totalPrice: 35 },
        ],
        totalServices: 100, totalProducts: 0, totalAmount: 100, discountAmount: 0,
        issTotal: 5, protocolNumber: 'SP-2026-00245', authorizationDate: ago(1),
        events: [
            { id: 'ev-1', type: 'created', description: 'Nota criada a partir da comanda #CMD-042', timestamp: ago(1) },
            { id: 'ev-2', type: 'authorized', description: 'Autorizada pela SEFAZ', timestamp: ago(1) },
        ],
        createdBy: 'admin', createdAt: ago(1), updatedAt: ago(1),
    },
    {
        id: 'inv-2', number: '000246', series: 'A1', docType: 'nfse', status: 'authorized',
        emitterId: 'emit-1', emitterName: 'VINNX Barbearia LTDA',
        clientName: 'Pedro Costa', clientCpfCnpj: '987.654.321-00',
        professionalId: 'member-2', professionalName: 'Rafael Santos',
        items: [
            { id: 'it-3', type: 'service', sourceId: 's1', description: 'Corte Social', quantity: 1, unitPrice: 50, totalPrice: 50 },
        ],
        totalServices: 50, totalProducts: 0, totalAmount: 50, discountAmount: 0,
        issTotal: 2.5, protocolNumber: 'SP-2026-00246', authorizationDate: ago(2),
        events: [
            { id: 'ev-3', type: 'created', description: 'Nota criada manualmente', timestamp: ago(2) },
            { id: 'ev-4', type: 'authorized', description: 'Autorizada pela SEFAZ', timestamp: ago(2) },
        ],
        createdBy: 'admin', createdAt: ago(2), updatedAt: ago(2),
    },
    {
        id: 'inv-3', docType: 'nfce', status: 'authorized',
        emitterId: 'emit-1', emitterName: 'VINNX Barbearia LTDA',
        clientName: 'Maria Fernandes', number: '000012', series: 'NFC',
        professionalId: 'member-1', professionalName: 'Carlos Oliveira',
        items: [
            { id: 'it-4', type: 'product', sourceId: 'p1', description: 'Pomada Matte Fox', quantity: 2, unitPrice: 45, totalPrice: 90 },
            { id: 'it-5', type: 'product', sourceId: 'p2', description: 'Shampoo Anticaspa', quantity: 1, unitPrice: 38, totalPrice: 38 },
        ],
        totalServices: 0, totalProducts: 128, totalAmount: 128, discountAmount: 0,
        icmsTotal: 23.04, protocolNumber: 'SP-NFC-00012', authorizationDate: ago(3),
        events: [
            { id: 'ev-5', type: 'created', description: 'NFC-e gerada da venda de produtos', timestamp: ago(3) },
            { id: 'ev-6', type: 'authorized', description: 'Autorizada pela SEFAZ', timestamp: ago(3) },
        ],
        createdBy: 'admin', createdAt: ago(3), updatedAt: ago(3),
    },
    {
        id: 'inv-4', docType: 'nfse', status: 'rejected',
        emitterId: 'emit-2', emitterName: 'Carlos Oliveira MEI',
        clientName: 'Ana Souza', clientCpfCnpj: '111.222.333-44',
        professionalId: 'member-1', professionalName: 'Carlos Oliveira',
        items: [
            { id: 'it-6', type: 'service', sourceId: 's3', description: 'Pigmentacao Capilar', quantity: 1, unitPrice: 120, totalPrice: 120 },
        ],
        totalServices: 120, totalProducts: 0, totalAmount: 120, discountAmount: 0,
        rejectionReason: 'CNPJ do tomador invalido ou nao encontrado na base da Receita Federal',
        events: [
            { id: 'ev-7', type: 'created', description: 'Nota criada', timestamp: ago(5) },
            { id: 'ev-8', type: 'rejected', description: 'Rejeitada: CNPJ invalido', timestamp: ago(5) },
        ],
        createdBy: 'admin', createdAt: ago(5), updatedAt: ago(5),
    },
    {
        id: 'inv-5', docType: 'nfse', status: 'cancelled',
        emitterId: 'emit-1', emitterName: 'VINNX Barbearia LTDA',
        clientName: 'Ricardo Lima', number: '000240', series: 'A1',
        items: [
            { id: 'it-7', type: 'service', sourceId: 's1', description: 'Corte + Barba', quantity: 1, unitPrice: 85, totalPrice: 85 },
        ],
        totalServices: 85, totalProducts: 0, totalAmount: 85, discountAmount: 0,
        cancellationReason: 'Erro na descricao do servico - emitida nota correta #000241',
        protocolNumber: 'SP-2026-00240',
        events: [
            { id: 'ev-9', type: 'authorized', description: 'Autorizada', timestamp: ago(10) },
            { id: 'ev-10', type: 'cancelled', description: 'Cancelada pelo usuario', timestamp: ago(8) },
        ],
        createdBy: 'admin', createdAt: ago(10), updatedAt: ago(8),
    },
    {
        id: 'inv-6', docType: 'nfse', status: 'processing',
        emitterId: 'emit-3', emitterName: 'Rafael Santos PJ',
        clientName: 'Fernando Alves',
        professionalId: 'member-2', professionalName: 'Rafael Santos',
        items: [
            { id: 'it-8', type: 'service', sourceId: 's4', description: 'Combo Premium', quantity: 1, unitPrice: 150, totalPrice: 150 },
        ],
        totalServices: 150, totalProducts: 0, totalAmount: 150, discountAmount: 0,
        events: [
            { id: 'ev-11', type: 'created', description: 'Nota criada', timestamp: ago(0) },
            { id: 'ev-12', type: 'queued', description: 'Enviada para processamento', timestamp: ago(0) },
        ],
        createdBy: 'admin', createdAt: ago(0), updatedAt: ago(0),
    },
    {
        id: 'inv-7', docType: 'nfse', status: 'draft',
        emitterId: 'emit-1', emitterName: 'VINNX Barbearia LTDA',
        clientName: 'Marcos Pereira',
        professionalId: 'member-1', professionalName: 'Carlos Oliveira',
        items: [
            { id: 'it-9', type: 'service', sourceId: 's1', description: 'Corte Infantil', quantity: 1, unitPrice: 40, totalPrice: 40 },
        ],
        totalServices: 40, totalProducts: 0, totalAmount: 40, discountAmount: 0,
        events: [
            { id: 'ev-13', type: 'created', description: 'Rascunho criado', timestamp: ago(0) },
        ],
        createdBy: 'admin', createdAt: ago(0), updatedAt: ago(0),
    },
    {
        id: 'inv-8', number: '000244', series: 'A1', docType: 'nfse', status: 'authorized',
        emitterId: 'emit-1', emitterName: 'VINNX Barbearia LTDA',
        clientName: 'Gabriel Rocha', clientCpfCnpj: '555.666.777-88',
        professionalId: 'member-2', professionalName: 'Rafael Santos',
        items: [
            { id: 'it-10', type: 'service', sourceId: 's5', description: 'Relaxamento Capilar', quantity: 1, unitPrice: 200, totalPrice: 200 },
        ],
        totalServices: 200, totalProducts: 0, totalAmount: 200, discountAmount: 0,
        issTotal: 10, protocolNumber: 'SP-2026-00244', authorizationDate: ago(4),
        events: [
            { id: 'ev-14', type: 'authorized', description: 'Autorizada pela SEFAZ', timestamp: ago(4) },
        ],
        createdBy: 'admin', createdAt: ago(4), updatedAt: ago(4),
    },
    {
        id: 'inv-9', docType: 'nfse', status: 'queued',
        emitterId: 'emit-2', emitterName: 'Carlos Oliveira MEI',
        clientName: 'Thiago Mendes',
        professionalId: 'member-1', professionalName: 'Carlos Oliveira',
        items: [
            { id: 'it-11', type: 'service', sourceId: 's1', description: 'Corte + Sobrancelha', quantity: 1, unitPrice: 75, totalPrice: 75 },
        ],
        totalServices: 75, totalProducts: 0, totalAmount: 75, discountAmount: 0,
        events: [
            { id: 'ev-15', type: 'queued', description: 'Na fila de processamento', timestamp: ago(0) },
        ],
        createdBy: 'admin', createdAt: ago(0), updatedAt: ago(0),
    },
    {
        id: 'inv-10', number: '000243', series: 'A1', docType: 'nfse', status: 'authorized',
        emitterId: 'emit-1', emitterName: 'VINNX Barbearia LTDA',
        clientName: 'Bruno Dias', clientCpfCnpj: '999.888.777-66',
        items: [
            { id: 'it-12', type: 'service', sourceId: 's1', description: 'Corte Degrade', quantity: 1, unitPrice: 65, totalPrice: 65 },
            { id: 'it-13', type: 'product', sourceId: 'p1', description: 'Gel Fixador', quantity: 1, unitPrice: 25, totalPrice: 25 },
        ],
        totalServices: 65, totalProducts: 25, totalAmount: 90, discountAmount: 0,
        issTotal: 3.25, protocolNumber: 'SP-2026-00243', authorizationDate: ago(6),
        events: [
            { id: 'ev-16', type: 'authorized', description: 'Autorizada', timestamp: ago(6) },
        ],
        createdBy: 'admin', createdAt: ago(6), updatedAt: ago(6),
    },
    {
        id: 'inv-11', number: '000242', series: 'B1', docType: 'nfse', status: 'authorized',
        emitterId: 'emit-2', emitterName: 'Carlos Oliveira MEI',
        clientName: 'Leonardo Martins', clientCpfCnpj: '222.333.444-55', clientEmail: 'leonardo@email.com',
        professionalId: 'member-1', professionalName: 'Carlos Oliveira',
        items: [
            { id: 'it-14', type: 'service', sourceId: 's6', description: 'Luzes + Tonalizacao', quantity: 1, unitPrice: 280, totalPrice: 280 },
        ],
        totalServices: 280, totalProducts: 0, totalAmount: 280, discountAmount: 0,
        issTotal: 14, protocolNumber: 'SP-2026-B1-042', authorizationDate: ago(7),
        pdfUrl: '/mock/nf-inv-11.pdf', xmlUrl: '/mock/nf-inv-11.xml',
        events: [
            { id: 'ev-17', type: 'created', description: 'Nota criada a partir da comanda #CMD-051', timestamp: ago(7) },
            { id: 'ev-18', type: 'authorized', description: 'Autorizada pela SEFAZ-SP', timestamp: ago(7) },
            { id: 'ev-19', type: 'pdf_generated', description: 'PDF gerado e disponivel para download', timestamp: ago(7) },
            { id: 'ev-20', type: 'email_sent', description: 'Enviada para leonardo@email.com', timestamp: ago(7) },
        ],
        createdBy: 'admin', createdAt: ago(7), updatedAt: ago(7),
    },
    {
        id: 'inv-12', number: '000013', series: 'NFC', docType: 'nfce', status: 'authorized',
        emitterId: 'emit-1', emitterName: 'VINNX Barbearia LTDA',
        clientName: 'Consumidor Final',
        professionalId: 'member-2', professionalName: 'Rafael Santos',
        items: [
            { id: 'it-15', type: 'product', sourceId: 'p3', description: 'Oleo para Barba Viking', quantity: 1, unitPrice: 55, totalPrice: 55 },
            { id: 'it-16', type: 'product', sourceId: 'p4', description: 'Pente de Madeira Premium', quantity: 1, unitPrice: 35, totalPrice: 35 },
            { id: 'it-17', type: 'product', sourceId: 'p5', description: 'Balm Pos-Barba', quantity: 2, unitPrice: 30, totalPrice: 60 },
        ],
        totalServices: 0, totalProducts: 150, totalAmount: 150, discountAmount: 0,
        icmsTotal: 27, protocolNumber: 'SP-NFC-00013', authorizationDate: ago(3),
        pdfUrl: '/mock/nf-inv-12.pdf',
        events: [
            { id: 'ev-21', type: 'created', description: 'NFC-e gerada na venda balcao', timestamp: ago(3) },
            { id: 'ev-22', type: 'authorized', description: 'Autorizada', timestamp: ago(3) },
        ],
        createdBy: 'admin', createdAt: ago(3), updatedAt: ago(3),
    },
    {
        id: 'inv-13', docType: 'nfse', status: 'rejected',
        emitterId: 'emit-3', emitterName: 'Rafael Santos PJ',
        clientName: 'Empresa ABC LTDA', clientCpfCnpj: '33.444.555/0001-66',
        professionalId: 'member-2', professionalName: 'Rafael Santos',
        items: [
            { id: 'it-18', type: 'service', sourceId: 's7', description: 'Pacote Corporativo (5 cortes)', quantity: 5, unitPrice: 50, totalPrice: 250 },
        ],
        totalServices: 250, totalProducts: 0, totalAmount: 250, discountAmount: 0,
        rejectionReason: 'Inscricao Municipal do prestador nao encontrada no cadastro do municipio',
        events: [
            { id: 'ev-23', type: 'created', description: 'Nota criada para pacote corporativo', timestamp: ago(4) },
            { id: 'ev-24', type: 'sent', description: 'Enviada para SEFAZ', timestamp: ago(4) },
            { id: 'ev-25', type: 'rejected', description: 'Rejeicao: IM invalida', timestamp: ago(4) },
        ],
        createdBy: 'admin', createdAt: ago(4), updatedAt: ago(4),
    },
    {
        id: 'inv-14', number: '000241', series: 'A1', docType: 'nfse', status: 'authorized',
        emitterId: 'emit-1', emitterName: 'VINNX Barbearia LTDA',
        clientName: 'Ricardo Lima', clientCpfCnpj: '777.888.999-00', clientEmail: 'ricardo@email.com',
        professionalId: 'member-1', professionalName: 'Carlos Oliveira',
        items: [
            { id: 'it-19', type: 'service', sourceId: 's1', description: 'Corte Degrade', quantity: 1, unitPrice: 65, totalPrice: 65 },
            { id: 'it-20', type: 'service', sourceId: 's2', description: 'Barba Completa', quantity: 1, unitPrice: 35, totalPrice: 35 },
        ],
        totalServices: 100, totalProducts: 0, totalAmount: 100, discountAmount: 0,
        issTotal: 5, protocolNumber: 'SP-2026-00241', authorizationDate: ago(8),
        correctionText: 'Corrigido endereco do tomador conforme solicitacao',
        pdfUrl: '/mock/nf-inv-14.pdf', xmlUrl: '/mock/nf-inv-14.xml',
        events: [
            { id: 'ev-26', type: 'authorized', description: 'Autorizada (substituicao da NF #000240)', timestamp: ago(8) },
            { id: 'ev-27', type: 'corrected', description: 'Carta de correcao registrada', timestamp: ago(7) },
            { id: 'ev-28', type: 'email_sent', description: 'Reenviada para ricardo@email.com', timestamp: ago(7) },
        ],
        createdBy: 'admin', createdAt: ago(8), updatedAt: ago(7),
    },
    {
        id: 'inv-15', docType: 'nfse', status: 'draft',
        emitterId: 'emit-1', emitterName: 'VINNX Barbearia LTDA',
        clientName: 'Eduardo Nascimento',
        professionalId: 'member-2', professionalName: 'Rafael Santos',
        items: [
            { id: 'it-21', type: 'service', sourceId: 's8', description: 'Design de Barba', quantity: 1, unitPrice: 55, totalPrice: 55 },
            { id: 'it-22', type: 'service', sourceId: 's9', description: 'Hidratacao Capilar', quantity: 1, unitPrice: 80, totalPrice: 80 },
        ],
        totalServices: 135, totalProducts: 0, totalAmount: 135, discountAmount: 0,
        notes: 'Cliente solicitou nota para reembolso pela empresa',
        events: [
            { id: 'ev-29', type: 'created', description: 'Rascunho criado manualmente', timestamp: ago(0) },
        ],
        createdBy: 'admin', createdAt: ago(0), updatedAt: ago(0),
    },
];

// ============ MOCK FISCAL CONFIG ============
export const DEFAULT_FISCAL_CONFIG: FiscalSettings = {
    autoEmitOnClose: false,
    autoSendEmail: false,
    defaultDocType: 'nfse',
    splitMixedComanda: true,
    apiProvider: 'none',
    apiEnvironment: 'sandbox',
    cancellationWindowHours: 24,
};

// ============ STATUS CONFIG ============
export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Rascunho', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
    queued: { label: 'Na Fila', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    processing: { label: 'Processando', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    authorized: { label: 'Autorizada', color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    rejected: { label: 'Rejeitada', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    cancelled: { label: 'Cancelada', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
};

export const DOC_TYPE_LABELS: Record<string, string> = {
    nfse: 'NFS-e',
    nfe: 'NF-e',
    nfce: 'NFC-e',
};
