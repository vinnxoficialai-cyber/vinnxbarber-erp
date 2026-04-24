// Frontend wrapper for ASAAS API operations
// Calls /api/asaas-operations with JWT auth

import { supabase } from './supabase';

const API_URL = '/api/asaas-operations';

async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Não autenticado');
    return { Authorization: `Bearer ${session.access_token}` };
}

async function callApi<T = any>(action: string, data?: any): Promise<T> {
    const headers = await getAuthHeader();
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify({ action, data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `API error ${res.status}`);
    return json;
}

// ═══ Public API ═══

export async function testAsaasConnection(apiKey?: string, environment?: string): Promise<{
    success: boolean;
    balance?: number;
    environment?: string;
}> {
    return callApi('testConnection', apiKey ? { apiKey, environment } : undefined);
}

export async function createAsaasCustomer(data: {
    clientId: string;
    name: string;
    cpfCnpj: string;
    email?: string;
    phone?: string;
}): Promise<{ success: boolean; customerId: string }> {
    return callApi('createCustomer', data);
}

export async function createAsaasSubscription(data: {
    customerId: string;
    subscriptionId: string;
    value: number;
    billingType?: string;
    nextDueDate?: string;
    description?: string;
    cycle?: string;
    creditCard?: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
    };
    creditCardHolderInfo?: {
        name?: string;
        email?: string;
        cpfCnpj?: string;
        postalCode?: string;
        addressNumber?: string;
        phone?: string;
    };
}): Promise<{ success: boolean; asaasSubscriptionId: string; firstPaymentStatus?: string }> {
    return callApi('createSubscription', data);
}

export async function cancelAsaasSubscription(data: {
    gatewaySubscriptionId: string;
    subscriptionId?: string;
}): Promise<{ success: boolean }> {
    return callApi('cancelSubscription', data);
}

export async function getAsaasPayments(data?: {
    customerId?: string;
    limit?: number;
}): Promise<{ success: boolean; payments: any[] }> {
    return callApi('getPayments', data);
}
